import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HardwareSystemCode } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { sanitizeString } from '../../common/utils/security.util';
import { MetricsService } from '../observability/metrics.service';
import { IngestDeviceEventDto } from './dto/ingest-device-event.dto';
import { DeviceIngestionService } from './device-ingestion.service';

type MqttQos = 0 | 1 | 2;

interface MqttSubscriptionGrant {
  topic: string;
}

type MqttSubscribeCallback = (error: Error | null, granted?: MqttSubscriptionGrant[]) => void;

interface MqttClientLike {
  on(event: 'connect', handler: () => void): this;
  on(event: 'error', handler: (error: Error) => void): this;
  on(event: 'close', handler: () => void): this;
  on(event: 'offline', handler: () => void): this;
  on(event: 'message', handler: (topic: string, payload: Buffer) => void): this;
  subscribe(topic: string | string[], options: { qos: MqttQos }, callback?: MqttSubscribeCallback): void;
  end(force?: boolean): void;
}

type MqttConnectFn = (
  brokerUrl: string,
  options: {
    clientId?: string;
    username?: string;
    password?: string;
    reconnectPeriod?: number;
    connectTimeout?: number;
  },
) => MqttClientLike;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = sanitizeString(value);
  return normalized.length > 0 ? normalized : undefined;
}

function asOptionalPositiveInteger(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = sanitizeString(value);
    if (normalized.length === 0) {
      return undefined;
    }

    const parsed = Number(normalized);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return undefined;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = sanitizeString(value).toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
      return false;
    }
  }

  return fallback;
}

function asIntegerInRange(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = asOptionalPositiveInteger(value);
  if (typeof parsed !== 'number') {
    return fallback;
  }

  if (parsed < min || parsed > max) {
    return fallback;
  }

  return parsed;
}

function parseTopics(value: unknown): string[] {
  const raw = asOptionalString(value);
  if (!raw) {
    return ['devices/+/events'];
  }

  const topics = raw
    .split(',')
    .map((segment) => sanitizeString(segment))
    .filter((segment) => segment.length > 0);

  return topics.length > 0 ? topics : ['devices/+/events'];
}

function normalizeSystemCode(value: unknown): HardwareSystemCode | undefined {
  const raw = asOptionalString(value);
  if (!raw) {
    return undefined;
  }

  const normalized = raw.replace(/[\s-]+/g, '_').toUpperCase();
  if ((Object.values(HardwareSystemCode) as string[]).includes(normalized)) {
    return normalized as HardwareSystemCode;
  }

  return undefined;
}

function extractDeviceIdFromTopic(topic: string): string | undefined {
  const segments = sanitizeString(topic)
    .split('/')
    .map((segment) => sanitizeString(segment))
    .filter((segment) => segment.length > 0);
  const devicesIndex = segments.findIndex((segment) => segment.toLowerCase() === 'devices');

  if (devicesIndex < 0 || devicesIndex + 1 >= segments.length) {
    return undefined;
  }

  return asOptionalString(segments[devicesIndex + 1]);
}

function extractBearerTokenOrRaw(value: unknown): string | undefined {
  const raw = asOptionalString(value);
  if (!raw) {
    return undefined;
  }

  const [scheme, credentials] = raw.split(/\s+/, 2);
  if (scheme && credentials && scheme.toLowerCase() === 'bearer') {
    return asOptionalString(credentials);
  }

  return raw;
}

function pickFirstDefined<T>(...values: (T | undefined)[]): T | undefined {
  return values.find((value) => value !== undefined);
}

@Injectable()
export class DeviceMqttIngestionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeviceMqttIngestionService.name);
  private readonly mqttEnabled: boolean;
  private readonly mqttBrokerUrl: string;
  private readonly mqttTopics: string[];
  private readonly mqttQos: MqttQos;
  private readonly mqttClientId?: string;
  private readonly mqttUsername?: string;
  private readonly mqttPassword?: string;
  private readonly reconnectPeriodMs: number;
  private readonly connectTimeoutMs: number;
  private mqttClient: MqttClientLike | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly deviceIngestionService: DeviceIngestionService,
    private readonly metricsService: MetricsService,
  ) {
    this.mqttEnabled = asBoolean(this.configService.get('DEVICE_MQTT_ENABLED'), false);
    this.mqttBrokerUrl = asOptionalString(this.configService.get('DEVICE_MQTT_BROKER_URL')) ?? '';
    this.mqttTopics = parseTopics(this.configService.get('DEVICE_MQTT_TOPICS'));
    this.mqttQos = asIntegerInRange(this.configService.get('DEVICE_MQTT_QOS'), 1, 0, 2) as MqttQos;
    this.mqttClientId =
      asOptionalString(this.configService.get('DEVICE_MQTT_CLIENT_ID')) ??
      `rfid-backend-ingestion-${process.pid}`;
    this.mqttUsername = asOptionalString(this.configService.get('DEVICE_MQTT_USERNAME'));
    this.mqttPassword = asOptionalString(this.configService.get('DEVICE_MQTT_PASSWORD'));
    this.reconnectPeriodMs = asIntegerInRange(
      this.configService.get('DEVICE_MQTT_RECONNECT_PERIOD_MS'),
      5000,
      1000,
      60000,
    );
    this.connectTimeoutMs = asIntegerInRange(
      this.configService.get('DEVICE_MQTT_CONNECT_TIMEOUT_MS'),
      30000,
      1000,
      120000,
    );
  }

  async onModuleInit(): Promise<void> {
    if (!this.mqttEnabled) {
      this.logger.log('MQTT device ingestion is disabled.');
      return;
    }

    if (!this.mqttBrokerUrl) {
      this.logger.error('MQTT ingestion enabled but DEVICE_MQTT_BROKER_URL is empty.');
      return;
    }

    const connectFn = await this.resolveMqttConnectFn();
    if (!connectFn) {
      this.logger.error('MQTT package is unavailable. Install "mqtt" to enable broker ingestion.');
      return;
    }

    try {
      this.mqttClient = connectFn(this.mqttBrokerUrl, {
        clientId: this.mqttClientId,
        username: this.mqttUsername,
        password: this.mqttPassword,
        reconnectPeriod: this.reconnectPeriodMs,
        connectTimeout: this.connectTimeoutMs,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Failed to initialize MQTT client: ${message}`);
      this.mqttClient = null;
      return;
    }

    this.registerClientHandlers();
  }

  onModuleDestroy(): void {
    if (!this.mqttClient) {
      return;
    }

    this.mqttClient.end(true);
    this.mqttClient = null;
  }

  async processBrokerMessage(topic: string, payloadBuffer: Buffer): Promise<void> {
    const { ingestionKey, dto } = await this.parseBrokerPayload(topic, payloadBuffer);
    const authContext = await this.deviceIngestionService.resolveDeviceAuthContext(ingestionKey);
    await this.deviceIngestionService.ingestEvent(authContext, dto);
  }

  private registerClientHandlers(): void {
    if (!this.mqttClient) {
      return;
    }

    this.mqttClient.on('connect', () => {
      if (!this.mqttClient) {
        return;
      }

      this.logger.log(`MQTT connected. Subscribing to topics: ${this.mqttTopics.join(', ')}`);
      this.mqttClient.subscribe(this.mqttTopics, { qos: this.mqttQos }, (error, granted) => {
        if (error) {
          this.logger.error(`MQTT subscription failed: ${error.message}`);
          return;
        }

        const grantedTopics = Array.isArray(granted)
          ? granted.map((entry) => entry.topic).join(', ')
          : this.mqttTopics.join(', ');
        this.logger.log(`MQTT subscription active: ${grantedTopics}`);
      });
    });

    this.mqttClient.on('error', (error: Error) => {
      this.logger.error(`MQTT client error: ${error.message}`);
    });

    this.mqttClient.on('offline', () => {
      this.logger.warn('MQTT client offline.');
    });

    this.mqttClient.on('close', () => {
      this.logger.warn('MQTT connection closed.');
    });

    this.mqttClient.on('message', (topic, payload) => {
      void this.processBrokerMessage(topic, payload).catch((error) => {
        const message = error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(`MQTT message rejected for topic "${topic}": ${message}`);
      });
    });
  }

  private async resolveMqttConnectFn(): Promise<MqttConnectFn | null> {
    try {
      const moduleName = 'mqtt';
      const mqttModule = (await import(moduleName)) as Record<string, unknown>;

      if (isFunction(mqttModule.connect)) {
        return mqttModule.connect as MqttConnectFn;
      }

      const defaultExport = mqttModule.default;
      if (isFunction(defaultExport)) {
        return defaultExport as MqttConnectFn;
      }
      if (isRecord(defaultExport) && isFunction(defaultExport.connect)) {
        return defaultExport.connect as MqttConnectFn;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Unable to load MQTT package: ${message}`);
      return null;
    }

    return null;
  }

  private async parseBrokerPayload(
    topic: string,
    payloadBuffer: Buffer,
  ): Promise<{ ingestionKey: string; dto: IngestDeviceEventDto }> {
    const payloadAsString = payloadBuffer.toString('utf8');
    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(payloadAsString);
    } catch {
      this.rejectWithMetrics('MQTT payload is not valid JSON.');
    }

    if (!isRecord(parsedPayload)) {
      this.rejectWithMetrics('MQTT payload must be a JSON object.');
    }

    const root = parsedPayload as Record<string, unknown>;
    const eventRecord = isRecord(root.event) ? root.event : root;
    const sourceRecord = isRecord(eventRecord.source) ? eventRecord.source : {};
    const topicDeviceId = extractDeviceIdFromTopic(topic);

    const ingestionKey = pickFirstDefined(
      extractBearerTokenOrRaw(root.ingestionKey),
      extractBearerTokenOrRaw(root.ingestion_key),
      extractBearerTokenOrRaw(root.deviceKey),
      extractBearerTokenOrRaw(root.device_key),
      extractBearerTokenOrRaw(root.authorization),
      extractBearerTokenOrRaw(root.auth),
      extractBearerTokenOrRaw(eventRecord.ingestionKey),
      extractBearerTokenOrRaw(eventRecord.ingestion_key),
      extractBearerTokenOrRaw(eventRecord.authorization),
      extractBearerTokenOrRaw(eventRecord.auth),
    );

    const eventId = asOptionalString(eventRecord.eventId);
    const eventType = asOptionalString(eventRecord.eventType);
    const occurredAt = asOptionalString(eventRecord.occurredAt);
    const sentAt = asOptionalString(eventRecord.sentAt);
    const schemaVersion = asOptionalString(eventRecord.schemaVersion) ?? '1.0';
    const sourceDeviceId = pickFirstDefined(
      asOptionalString(sourceRecord.deviceId),
      asOptionalString(eventRecord.deviceId),
      topicDeviceId,
    );
    const sourceSystemCode = normalizeSystemCode(
      pickFirstDefined(
        asOptionalString(sourceRecord.systemCode),
        asOptionalString(eventRecord.systemCode),
      ),
    );
    const sourceDeviceMac = pickFirstDefined(
      asOptionalString(sourceRecord.deviceMac),
      asOptionalString(eventRecord.deviceMac),
    );
    const sourceFirmwareVersion = pickFirstDefined(
      asOptionalString(sourceRecord.firmwareVersion),
      asOptionalString(eventRecord.firmwareVersion),
    );
    const sourceSequence = pickFirstDefined(
      asOptionalPositiveInteger(sourceRecord.sequence),
      asOptionalPositiveInteger(eventRecord.sourceSequence),
      asOptionalPositiveInteger(eventRecord.sequence),
    );
    const eventPayload = eventRecord.payload;

    if (!ingestionKey) {
      this.rejectWithMetrics('MQTT payload is missing ingestion key.');
    }

    if (!eventId || !eventType || !occurredAt || !sourceDeviceId || !sourceSystemCode) {
      this.rejectWithMetrics('MQTT payload does not contain required event fields.');
    }

    if (!isRecord(eventPayload)) {
      this.rejectWithMetrics('MQTT payload field must be a JSON object.');
    }

    const dtoCandidate: Record<string, unknown> = {
      schemaVersion,
      eventId,
      eventType,
      occurredAt,
      sentAt,
      source: {
        deviceId: sourceDeviceId,
        systemCode: sourceSystemCode,
        deviceMac: sourceDeviceMac,
        firmwareVersion: sourceFirmwareVersion,
        sequence: sourceSequence,
      },
      payload: eventPayload,
    };

    const dto = plainToInstance(IngestDeviceEventDto, dtoCandidate);
    const validationErrors = await validate(dto, {
      whitelist: true,
      forbidUnknownValues: true,
    });

    if (validationErrors.length > 0) {
      this.rejectWithMetrics('MQTT payload validation failed.');
    }

    return {
      ingestionKey,
      dto,
    };
  }

  private rejectWithMetrics(message: string): never {
    this.metricsService.recordDeviceIngestionRejected();
    throw new BadRequestException(message);
  }
}
