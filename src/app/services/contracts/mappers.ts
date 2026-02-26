import type {
  AssignIdentifierInput,
  AuthUser,
  DeviceConfigurationInput,
  DeviceUnit,
  Employee,
  FeedbackRecord,
  HistoryEvent,
  IdentifierType,
  InventoryIdentifier,
  ModuleKey,
  Product,
  ReassignIdentifierInput,
  ServiceAssignment,
} from '@/app/types';
import type { MarketplaceStatePayload, ServicesStatePayload } from '@/app/services/types';

type UnknownRecord = Record<string, unknown>;

export interface NormalizedAuthResponse {
  token: string;
  refreshToken?: string;
  redirectTo?: string;
  user: AuthUser;
}

export interface NormalizedPurchaseResponse {
  purchaseId: string;
  createdDevices: DeviceUnit[];
  createdIdentifiers: InventoryIdentifier[];
  redirectModule: ModuleKey;
  marketplaceState: MarketplaceStatePayload;
}

export interface NormalizedActivateDeviceResponse {
  device: DeviceUnit;
  marketplaceState: MarketplaceStatePayload;
}

export type NormalizedMutationAction = 'assign' | 'remove' | 'reassign';

export interface NormalizedServiceMutationMeta {
  module: ModuleKey;
  action: NormalizedMutationAction;
  employeeName: string;
  identifierCode: string;
  deviceName: string;
}

export interface NormalizedServiceMutationResponse {
  servicesState: ServicesStatePayload;
  marketplaceState: MarketplaceStatePayload;
  meta: NormalizedServiceMutationMeta;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pickFirstDefined<T>(...values: (T | null | undefined)[]): T | undefined {
  return values.find((value) => value !== undefined && value !== null);
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return fallback;
}

function asOptionalString(value: unknown): string | undefined {
  const parsedValue = asString(value).trim();
  return parsedValue.length > 0 ? parsedValue : undefined;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value);
    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }

  return fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return null;
  }

  return asNumber(value, 0);
}

function toModuleKey(value: unknown): ModuleKey | null {
  const normalized = asString(value).trim().toLowerCase();

  const aliases: Record<string, ModuleKey> = {
    'rfid-presence': 'rfid-presence',
    rfidpresence: 'rfid-presence',
    rfid_presence: 'rfid-presence',
    'rfid presence': 'rfid-presence',
    'rfid-porte': 'rfid-porte',
    rfidporte: 'rfid-porte',
    rfid_porte: 'rfid-porte',
    'rfid porte': 'rfid-porte',
    biometrie: 'biometrie',
    biometric: 'biometrie',
    biometry: 'biometrie',
    feedback: 'feedback',
  };

  return aliases[normalized] ?? null;
}

function toIdentifierType(value: unknown): IdentifierType | null {
  const normalized = asString(value).trim().toLowerCase();

  const aliases: Record<string, IdentifierType> = {
    'badge-rfid': 'badge-rfid',
    badge_rfid: 'badge-rfid',
    badge: 'badge-rfid',
    empreinte: 'empreinte',
    fingerprint: 'empreinte',
    'serrure-rfid': 'serrure-rfid',
    serrure_rfid: 'serrure-rfid',
    serrure: 'serrure-rfid',
  };

  return aliases[normalized] ?? null;
}

function getAction(value: unknown): NormalizedMutationAction {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === 'remove') {
    return 'remove';
  }
  if (normalized === 'reassign') {
    return 'reassign';
  }
  return 'assign';
}

function getMutationMetaSource(value: unknown): UnknownRecord {
  const root = asRecord(value);
  const data = asRecord(root.data);
  return asRecord(pickFirstDefined(root.meta, data.meta));
}

function getPayloadSource(value: unknown): UnknownRecord {
  const root = asRecord(value);
  const data = asRecord(root.data);

  if (Object.keys(data).length > 0) {
    return data;
  }

  return root;
}

function getMarketplaceSource(value: unknown): UnknownRecord {
  const source = getPayloadSource(value);
  return asRecord(
    pickFirstDefined(source.marketplace, source.marketplaceState, source.marketplace_state, source),
  );
}

function getServicesSource(value: unknown): UnknownRecord {
  const source = getPayloadSource(value);
  return asRecord(pickFirstDefined(source.services, source.servicesState, source.services_state, source));
}

function toDeviceUnit(value: unknown): DeviceUnit | null {
  const source = asRecord(value);
  const systemSource = asRecord(source.system);
  const module =
    toModuleKey(
      pickFirstDefined(
        source.module,
        source.module_key,
        source.moduleKey,
        source.systemCode,
        source.system_code,
        systemSource.code,
        systemSource.name,
      ),
    ) || null;
  const typeSafeId = asOptionalString(source.id);

  if (!module || !typeSafeId) {
    return null;
  }

  const rawMacAddress = asString(
    pickFirstDefined(source.provisionedMacAddress, source.provisioned_mac_address, source.macAddress),
    '',
  );
  const configuredName = asOptionalString(pickFirstDefined(source.name, source.configuredName));
  const configuredLocation = asOptionalString(pickFirstDefined(source.location, source.configuredLocation));
  const isConfigured = asBoolean(
    pickFirstDefined(source.configured, source.isConfigured, source.is_configured),
    false,
  );
  const identifierCollection = asArray(pickFirstDefined(source.identifiers, source.inventory));
  const explicitCapacity = pickFirstDefined(source.capacity, systemSource.identifiersPerDevice);
  const resolvedCapacity =
    explicitCapacity !== undefined
      ? asNumber(explicitCapacity, 0)
      : identifierCollection.length;
  const resolvedName =
    configuredName ||
    (asOptionalString(systemSource.name) ? `${asOptionalString(systemSource.name)} (${typeSafeId.slice(0, 6)})` : undefined) ||
    `Boitier ${typeSafeId}`;

  return {
    id: typeSafeId,
    module,
    name: resolvedName,
    location: configuredLocation || 'A configurer',
    provisionedMacAddress: rawMacAddress,
    qrToken: asOptionalString(pickFirstDefined(source.qrToken, source.qr_token, source.qrCodeToken)),
    systemIdentifier: asOptionalString(
      pickFirstDefined(
        source.systemIdentifier,
        source.system_identifier,
        isConfigured ? rawMacAddress : undefined,
      ),
    ),
    configured: isConfigured,
    capacity: resolvedCapacity,
    createdAt: asString(
      pickFirstDefined(source.createdAt, source.created_at, source.assignedAt, source.assigned_at),
      new Date().toISOString(),
    ),
    activatedAt: asOptionalString(
      pickFirstDefined(source.activatedAt, source.activated_at, source.updatedAt, source.updated_at),
    ),
  };
}

function toInventoryIdentifier(value: unknown): InventoryIdentifier | null {
  const source = asRecord(value);
  const systemSource = asRecord(source.system);
  const deviceSource = asRecord(source.device);
  const deviceSystem = asRecord(deviceSource.system);
  const serviceAssignmentSource = asRecord(source.serviceAssignment);
  const module = toModuleKey(
    pickFirstDefined(
      source.module,
      source.module_key,
      source.moduleKey,
      source.systemCode,
      source.system_code,
      systemSource.code,
      systemSource.name,
      deviceSystem.code,
      deviceSystem.name,
    ),
  );
  const type = toIdentifierType(pickFirstDefined(source.type, source.identifier_type));
  const id = asOptionalString(source.id);

  if (!module || !type || !id) {
    return null;
  }

  const employeeId = asOptionalString(
    pickFirstDefined(
      source.employeeId,
      source.employee_id,
      serviceAssignmentSource.employeeId,
      serviceAssignmentSource.employee_id,
    ),
  );
  const normalizedStatus = asOptionalString(source.status)?.toLowerCase();
  const explicitStatus: InventoryIdentifier['status'] | null =
    normalizedStatus === 'available'
      ? 'available'
      : normalizedStatus === 'assigned' && employeeId
        ? 'assigned'
        : null;

  return {
    id,
    module,
    type,
    code: asString(pickFirstDefined(source.code, source.physicalIdentifier), id.toUpperCase()),
    status: explicitStatus ?? (employeeId ? 'assigned' : 'available'),
    deviceId: asOptionalString(
      pickFirstDefined(
        source.deviceId,
        source.device_id,
        serviceAssignmentSource.deviceId,
        serviceAssignmentSource.device_id,
      ),
    ),
    employeeId,
    acquiredAt: asString(
      pickFirstDefined(source.acquiredAt, source.acquired_at, source.createdAt, source.created_at),
      new Date().toISOString(),
    ),
  };
}

function toEmployee(value: unknown): Employee | null {
  const source = asRecord(value);
  const id = asOptionalString(source.id);

  if (!id) {
    return null;
  }

  const firstName = asString(pickFirstDefined(source.firstName, source.first_name), '');
  const lastName = asString(pickFirstDefined(source.lastName, source.last_name), '');

  return {
    id,
    firstName,
    lastName,
    fullName:
      asOptionalString(pickFirstDefined(source.fullName, source.full_name)) ||
      `${firstName} ${lastName}`.trim() ||
      id,
  };
}

function toServiceAssignment(value: unknown): ServiceAssignment | null {
  const source = asRecord(value);
  const module = toModuleKey(pickFirstDefined(source.module, source.module_key, source.moduleKey));
  const id = asOptionalString(source.id);
  const deviceId = asOptionalString(pickFirstDefined(source.deviceId, source.device_id));
  const identifierId = asOptionalString(pickFirstDefined(source.identifierId, source.identifier_id));
  const employeeId = asOptionalString(pickFirstDefined(source.employeeId, source.employee_id));

  if (!module || !id || !deviceId || !identifierId || !employeeId) {
    return null;
  }

  return {
    id,
    module,
    deviceId,
    identifierId,
    employeeId,
    createdAt: asString(pickFirstDefined(source.createdAt, source.created_at), new Date().toISOString()),
    updatedAt: asString(pickFirstDefined(source.updatedAt, source.updated_at), new Date().toISOString()),
  };
}

function toHistoryEvent(value: unknown): HistoryEvent | null {
  const source = asRecord(value);
  const module = toModuleKey(pickFirstDefined(source.module, source.module_key, source.moduleKey));
  const id = asOptionalString(source.id);
  const deviceId = asOptionalString(pickFirstDefined(source.deviceId, source.device_id));

  if (!module || !id || !deviceId) {
    return null;
  }

  return {
    id,
    module,
    deviceId,
    employee: asString(source.employee, 'Inconnu'),
    identifier: asString(source.identifier, 'N/A'),
    device: asString(source.device, 'Boitier'),
    action: asString(source.action, 'Evenement'),
    occurredAt: asString(pickFirstDefined(source.occurredAt, source.occurred_at), new Date().toISOString()),
  };
}

function toFeedbackRecord(value: unknown): FeedbackRecord | null {
  const source = asRecord(value);
  const id = asOptionalString(source.id);
  const deviceId = asOptionalString(pickFirstDefined(source.deviceId, source.device_id));

  if (!id || !deviceId) {
    return null;
  }

  const sentimentValue = asString(source.sentiment).toLowerCase();
  const sentiment: FeedbackRecord['sentiment'] =
    sentimentValue === 'negative' || sentimentValue === 'neutral' || sentimentValue === 'positive'
      ? sentimentValue
      : 'neutral';
  const feedbackSourceValue = asString(source.source, 'BUTTON').trim().toUpperCase();
  const feedbackSource: FeedbackRecord['source'] = feedbackSourceValue === 'QR' ? 'QR' : 'BUTTON';
  const comment = asOptionalString(source.comment);

  return {
    id,
    deviceId,
    module: 'feedback',
    sentiment,
    source: feedbackSource,
    comment,
    createdAt: asString(pickFirstDefined(source.createdAt, source.created_at), new Date().toISOString()),
  };
}

function mapCollection<T>(values: unknown, mapper: (value: unknown) => T | null): T[] {
  return asArray(values).map(mapper).filter((entry): entry is T => entry !== null);
}

export function toAuthUser(value: unknown): AuthUser {
  const source = asRecord(value);
  const roleSource = asRecord(source.role);
  return {
    id: asString(pickFirstDefined(source.id, source.user_id), ''),
    firstName: asString(pickFirstDefined(source.firstName, source.first_name), ''),
    lastName: asString(pickFirstDefined(source.lastName, source.last_name), ''),
    email: asString(source.email, ''),
    company: asString(source.company, ''),
    roleName: asOptionalString(pickFirstDefined(source.roleName, source.role_name, roleSource.name)),
  };
}

export function toSessionUserResponse(value: unknown): AuthUser {
  const root = asRecord(value);
  const source = getPayloadSource(value);
  const data = asRecord(root.data);
  const userSource = asRecord(
    pickFirstDefined(source.user, source.profile, data.user, root.user, source),
  );
  const user = toAuthUser(userSource);

  if (!user.id) {
    throw new Error('Session API invalide.');
  }

  return user;
}

export function toAuthResponse(value: unknown): NormalizedAuthResponse {
  const root = asRecord(value);
  const source = getPayloadSource(value);
  const data = asRecord(root.data);
  const token = asString(
    pickFirstDefined(
      source.token,
      source.access_token,
      source.accessToken,
      data.token,
      data.access_token,
      data.accessToken,
      root.token,
      root.access_token,
      root.accessToken,
    ),
    '',
  );
  const userSource = asRecord(
    pickFirstDefined(source.user, source.profile, data.user, root.user, root.profile),
  );
  const user = toAuthUser(userSource);
  const refreshToken = asOptionalString(
    pickFirstDefined(
      source.refreshToken,
      source.refresh_token,
      data.refreshToken,
      data.refresh_token,
      root.refreshToken,
      root.refresh_token,
    ),
  );
  const redirectTo = asOptionalString(
    pickFirstDefined(source.redirectTo, source.redirect_to, data.redirectTo, root.redirectTo),
  );

  if (!token || !user.id) {
    throw new Error('Reponse auth invalide.');
  }

  return {
    token,
    refreshToken,
    redirectTo,
    user,
  };
}

export function toProductList(value: unknown): Product[] {
  const source = getPayloadSource(value);
  const list = Array.isArray(value)
    ? value
    : asArray(pickFirstDefined(source.items, source.products, source.catalog, source.data));
  const products: Product[] = [];

  list.forEach((entry) => {
    const item = asRecord(entry);
    const systemCodeOrModule = pickFirstDefined(
      item.code,
      item.systemCode,
      item.system_code,
      item.module,
      item.moduleKey,
      item.module_key,
    );
    const module = toModuleKey(systemCodeOrModule);
    const hasStockSummaryFields =
      systemCodeOrModule !== undefined &&
      (item.availableDevices !== undefined || item.availableExtensions !== undefined);

    if (hasStockSummaryFields && module) {
      const systemName = asString(item.name, module);
      const identifierType = toIdentifierType(
        pickFirstDefined(item.identifierType, item.identifier_type),
      );
      const hasIdentifiers = asBoolean(item.hasIdentifiers, module !== 'feedback');
      const identifiersPerDevice = asNumber(
        pickFirstDefined(item.identifiersPerDevice, item.identifiers_per_device),
        hasIdentifiers ? 5 : 0,
      );
      const availableDevices = asNumber(
        pickFirstDefined(item.availableDevices, item.available_devices),
        0,
      );
      const availableExtensions = asNumber(
        pickFirstDefined(item.availableExtensions, item.available_extensions),
        0,
      );
      const deviceUnitPriceCents = asNumber(
        pickFirstDefined(item.deviceUnitPriceCents, item.device_unit_price_cents),
        0,
      );
      const extensionUnitPriceCents = asNumber(
        pickFirstDefined(item.extensionUnitPriceCents, item.extension_unit_price_cents),
        0,
      );

      products.push({
        id: `device-${module}`,
        apiSku: asString(item.code, ''),
        kind: 'device',
        module,
        identifierType: identifierType || undefined,
        label: `Boitier ${systemName}`,
        description: `Boitier physique ${systemName} provisionne en stock reel.`,
        unitPriceMinor: Math.max(deviceUnitPriceCents, 0),
        currency: asString(item.currency, 'XOF'),
        stockLimit: Math.max(availableDevices, 0),
        includedIdentifiers: Math.max(identifiersPerDevice, 0),
      });

      if (module !== 'feedback' && hasIdentifiers) {
        products.push({
          id: `identifier-extension-${module}`,
          apiSku: `${asString(item.code, '')}-EXT`,
          kind: 'identifier-pack',
          module,
          identifierType: identifierType || undefined,
          label: `Extensions ${systemName}`,
          description: `Extensions physiques ${systemName} deja en stock reel.`,
          unitPriceMinor: Math.max(extensionUnitPriceCents, 0),
          currency: asString(item.currency, 'XOF'),
          stockLimit: Math.max(availableExtensions, 0),
          quantityPerPack: 1,
        });
      }

      return;
    }

    const id = asOptionalString(item.id);
    const fallbackModule = toModuleKey(pickFirstDefined(item.module, item.module_key, item.moduleKey));
    if (!id || !fallbackModule) {
      return;
    }

    const kindValue = asString(pickFirstDefined(item.kind, item.type)).toLowerCase();
    const kind: Product['kind'] = kindValue === 'identifier-pack' ? 'identifier-pack' : 'device';
    const identifierType = toIdentifierType(
      pickFirstDefined(item.identifierType, item.identifier_type),
    );

    products.push({
      id,
      apiSku: asOptionalString(pickFirstDefined(item.apiSku, item.api_sku)),
      kind,
      module: fallbackModule,
      identifierType: identifierType || undefined,
      label: asString(pickFirstDefined(item.label, item.name), id),
      description: asString(item.description, ''),
      unitPriceMinor: asNumber(
        pickFirstDefined(
          item.unitPriceMinor,
          item.unit_price_minor,
          item.unitPriceCents,
          item.unit_price_cents,
          item.unitPrice,
          item.unit_price,
          item.price,
        ),
        0,
      ),
      currency: asString(item.currency, 'XOF'),
      stockLimit:
        pickFirstDefined(item.stockLimit, item.stock_limit) !== undefined
          ? asNumber(pickFirstDefined(item.stockLimit, item.stock_limit), 0)
          : undefined,
      includedIdentifiers:
        pickFirstDefined(item.includedIdentifiers, item.included_identifiers) !== undefined
          ? asNumber(pickFirstDefined(item.includedIdentifiers, item.included_identifiers), 0)
          : undefined,
      quantityPerPack:
        pickFirstDefined(item.quantityPerPack, item.quantity_per_pack) !== undefined
          ? asNumber(pickFirstDefined(item.quantityPerPack, item.quantity_per_pack), 0)
          : undefined,
    });
  });

  return products;
}

export function toMarketplaceState(value: unknown): MarketplaceStatePayload {
  const source = getMarketplaceSource(value);
  const stockSource = asRecord(pickFirstDefined(source.productStockById, source.product_stock_by_id));
  const productStockById = Object.entries(stockSource).reduce<Record<string, number | null>>((accumulator, [productId, stockValue]) => {
    accumulator[productId] = asNullableNumber(stockValue);
    return accumulator;
  }, {});
  const rawDevices = asArray(pickFirstDefined(source.devices, source.device_units));

  const devices = mapCollection(
    rawDevices,
    toDeviceUnit,
  );

  const inventoryFromRoot = mapCollection(
    pickFirstDefined(source.inventory, source.identifiers),
    toInventoryIdentifier,
  );
  const standaloneInventory = mapCollection(
    pickFirstDefined(source.standaloneIdentifiers, source.standalone_identifiers),
    toInventoryIdentifier,
  );
  const inventoryFromDevices = devices.flatMap((device) => {
    const rawDevice = rawDevices.find((entry) => {
      const record = asRecord(entry);
      return asOptionalString(record.id) === device.id;
    });
    const deviceRecord = asRecord(rawDevice);
    const rawIdentifiers = asArray(pickFirstDefined(deviceRecord.identifiers, deviceRecord.inventory));

    return rawIdentifiers
      .map((rawIdentifier) => {
        const identifierRecord = asRecord(rawIdentifier);
        return toInventoryIdentifier({
          ...identifierRecord,
          module: pickFirstDefined(
            identifierRecord.module,
            identifierRecord.module_key,
            identifierRecord.moduleKey,
            device.module,
          ),
          deviceId: pickFirstDefined(
            identifierRecord.deviceId,
            identifierRecord.device_id,
            device.id,
          ),
        });
      })
      .filter((entry): entry is InventoryIdentifier => entry !== null);
  });

  const inventoryMap = new Map<string, InventoryIdentifier>();
  [...inventoryFromRoot, ...inventoryFromDevices, ...standaloneInventory].forEach((identifier) => {
    inventoryMap.set(identifier.id, identifier);
  });

  return {
    productStockById,
    devices,
    inventory: Array.from(inventoryMap.values()),
  };
}

export function toServicesState(value: unknown): ServicesStatePayload {
  const source = getServicesSource(value);

  return {
    employees: mapCollection(pickFirstDefined(source.employees, source.staff), toEmployee),
    assignments: mapCollection(
      pickFirstDefined(source.assignments, source.identifier_assignments),
      toServiceAssignment,
    ),
    history: mapCollection(
      pickFirstDefined(source.history, source.events, source.timeline),
      toHistoryEvent,
    ),
    feedbackRecords: mapCollection(
      pickFirstDefined(source.feedbackRecords, source.feedback_records),
      toFeedbackRecord,
    ),
  };
}

export function toPurchaseResponse(value: unknown): NormalizedPurchaseResponse {
  const source = getPayloadSource(value);
  const order = asRecord(source.order);
  const orderSystem = asRecord(order.system);
  const redirectModule =
    toModuleKey(
      pickFirstDefined(
        source.redirectModule,
        source.redirect_module,
        orderSystem.code,
        orderSystem.name,
      ),
    ) || 'rfid-presence';

  return {
    purchaseId: asString(pickFirstDefined(source.purchaseId, source.purchase_id, order.id), ''),
    createdDevices: mapCollection(
      pickFirstDefined(source.createdDevices, source.created_devices, source.allocatedDevices, source.allocated_devices),
      toDeviceUnit,
    ),
    createdIdentifiers: mapCollection(
      pickFirstDefined(source.createdIdentifiers, source.created_identifiers, source.allocatedIdentifiers, source.allocated_identifiers),
      toInventoryIdentifier,
    ),
    redirectModule,
    marketplaceState: toMarketplaceState(
      pickFirstDefined(
        source.marketplaceState,
        source.marketplace_state,
        source.marketplace,
        {
          devices: pickFirstDefined(source.createdDevices, source.allocatedDevices),
          inventory: pickFirstDefined(source.createdIdentifiers, source.allocatedIdentifiers),
        },
      ),
    ),
  };
}

export function toActivateDeviceResponse(value: unknown): NormalizedActivateDeviceResponse {
  const source = getPayloadSource(value);
  const device = toDeviceUnit(pickFirstDefined(source.device, source.device_unit, source));

  if (!device) {
    throw new Error('Reponse activation boitier invalide.');
  }

  return {
    device,
    marketplaceState: toMarketplaceState(
      pickFirstDefined(source.marketplaceState, source.marketplace_state, source.marketplace),
    ),
  };
}

export function toServiceMutationResponse(value: unknown): NormalizedServiceMutationResponse {
  const source = getPayloadSource(value);
  const metaSource = getMutationMetaSource(value);
  const module = toModuleKey(pickFirstDefined(metaSource.module, metaSource.module_key)) || 'rfid-presence';

  return {
    servicesState: toServicesState(
      pickFirstDefined(source.servicesState, source.services_state, source.services),
    ),
    marketplaceState: toMarketplaceState(
      pickFirstDefined(source.marketplaceState, source.marketplace_state, source.marketplace),
    ),
    meta: {
      module,
      action: getAction(metaSource.action),
      employeeName: asString(
        pickFirstDefined(metaSource.employeeName, metaSource.employee_name),
        '',
      ),
      identifierCode: asString(
        pickFirstDefined(metaSource.identifierCode, metaSource.identifier_code),
        '',
      ),
      deviceName: asString(pickFirstDefined(metaSource.deviceName, metaSource.device_name), ''),
    },
  };
}

export function toSignInPayload(payload: {
  identifier: string;
  password: string;
  redirectTo?: string;
}): UnknownRecord {
  const body: UnknownRecord = {
    identifier: payload.identifier,
    password: payload.password,
  };

  if (payload.redirectTo) {
    body.redirectTo = payload.redirectTo;
  }

  return body;
}

export function toSignUpPayload(payload: {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  password: string;
  phoneNumber?: string;
}): UnknownRecord {
  const body: UnknownRecord = {
    firstName: payload.firstName,
    lastName: payload.lastName,
    company: payload.company,
    email: payload.email,
    password: payload.password,
  };

  if (payload.phoneNumber) {
    body.phoneNumber = payload.phoneNumber;
  }

  return body;
}

export function toGoogleVerifyPayload(idToken: string): UnknownRecord {
  return {
    idToken,
  };
}

export function toPurchasePayload(payload: { productId: string; quantity: number }): UnknownRecord {
  const normalizedProductId = payload.productId.trim().toLowerCase();

  if (normalizedProductId.startsWith('pack-')) {
    throw new Error(
      'Produit legacy deprecie. Utilisez les SKUs marketplace allocation-only (device-* ou identifier-extension-*).',
    );
  }

  const extractedDeviceModule = normalizedProductId.startsWith('device-')
    ? toModuleKey(normalizedProductId.replace('device-', ''))
    : null;
  const extractedExtensionModule = normalizedProductId.startsWith('identifier-extension-')
    ? toModuleKey(normalizedProductId.replace('identifier-extension-', ''))
    : null;
  const module = extractedDeviceModule ?? extractedExtensionModule;
  const targetType =
    extractedExtensionModule ? 'IDENTIFIER_EXTENSION' : 'DEVICE';

  if (extractedExtensionModule === 'feedback') {
    throw new Error('Le systeme FEEDBACK ne supporte pas les extensions.');
  }

  const systemCodeByModule: Record<ModuleKey, string> = {
    'rfid-presence': 'RFID_PRESENCE',
    'rfid-porte': 'RFID_PORTE',
    biometrie: 'BIOMETRIE',
    feedback: 'FEEDBACK',
  };

  if (!module) {
    throw new Error('Produit marketplace invalide: impossible de determiner le systeme cible.');
  }

  return {
    systemCode: systemCodeByModule[module],
    targetType,
    quantity: payload.quantity,
  };
}

export function toActivateDevicePayload(payload: DeviceConfigurationInput): UnknownRecord {
  const body: UnknownRecord = {
    location: payload.location,
    systemIdentifier: payload.systemIdentifier,
  };

  if (payload.name && payload.name.trim().length > 0) {
    body.name = payload.name;
  }

  return body;
}

export function toAssignIdentifierPayload(payload: AssignIdentifierInput): UnknownRecord {
  return {
    module: payload.module,
    deviceId: payload.deviceId,
    identifierId: payload.identifierId,
    firstName: payload.firstName,
    lastName: payload.lastName,
  };
}

export function toReassignIdentifierPayload(payload: ReassignIdentifierInput): UnknownRecord {
  return {
    assignmentId: payload.assignmentId,
    deviceId: payload.deviceId,
    firstName: payload.firstName,
    lastName: payload.lastName,
  };
}
