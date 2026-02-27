import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface AttemptBucket {
  count: number;
  windowStart: number;
  expiresAt: number;
  lastUpdated: number;
}

@Injectable()
export class AuthAttemptService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthAttemptService.name);
  private readonly buckets = new Map<string, AttemptBucket>();
  private readonly redisUrl?: string;
  private readonly redisPrefix: string;
  private readonly maxBuckets: number;
  private readonly cleanupIntervalMs: number;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private redisClient: {
    connect: () => Promise<void>;
    quit: () => Promise<void>;
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, options?: { PX?: number }) => Promise<unknown>;
    incr: (key: string) => Promise<number>;
    del: (key: string) => Promise<number>;
    pExpire: (key: string, milliseconds: number) => Promise<number>;
    pTTL: (key: string) => Promise<number>;
  } | null = null;

  constructor(private readonly configService: ConfigService) {
    const configuredRedisUrl = this.configService.get<string>('AUTH_ATTEMPT_REDIS_URL')?.trim();
    this.redisUrl = configuredRedisUrl && configuredRedisUrl.length > 0 ? configuredRedisUrl : undefined;
    this.redisPrefix = this.configService.get<string>('AUTH_ATTEMPT_REDIS_PREFIX') ?? 'auth:attempt';
    this.maxBuckets = this.configService.get<number>('AUTH_ATTEMPT_MAX_BUCKETS') ?? 20_000;
    this.cleanupIntervalMs =
      this.configService.get<number>('AUTH_ATTEMPT_CLEANUP_INTERVAL_MS') ?? 60_000;
  }

  async onModuleInit(): Promise<void> {
    this.cleanupTimer = setInterval(() => {
      this.pruneExpiredBuckets();
    }, this.cleanupIntervalMs);

    if (!this.redisUrl) {
      return;
    }

    try {
      // Optional runtime dependency: Redis client is loaded only when configured.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const redisModule = require('redis') as {
        createClient: (options: { url: string }) => {
          connect: () => Promise<void>;
          quit: () => Promise<void>;
          get: (key: string) => Promise<string | null>;
          set: (key: string, value: string, options?: { PX?: number }) => Promise<unknown>;
          incr: (key: string) => Promise<number>;
          del: (key: string) => Promise<number>;
          pExpire: (key: string, milliseconds: number) => Promise<number>;
          pTTL: (key: string) => Promise<number>;
        };
      };

      const client = redisModule.createClient({ url: this.redisUrl });
      await client.connect();
      this.redisClient = client;
      this.logger.log('Auth attempt limiter is running in Redis mode.');
    } catch (error) {
      this.redisClient = null;
      this.logger.warn(
        'Failed to initialize Redis for auth attempts; falling back to in-memory limiter.',
      );
      if (error instanceof Error) {
        this.logger.warn(error.message);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.redisClient) {
      await this.redisClient.quit().catch(() => undefined);
      this.redisClient = null;
    }
  }

  async assertWithinLimit(key: string, maxAttempts: number, windowMs: number): Promise<void> {
    const now = Date.now();

    if (await this.assertWithinLimitRedis(key, maxAttempts)) {
      return;
    }

    const current = this.buckets.get(key);

    if (!current || now - current.windowStart > windowMs) {
      this.buckets.set(key, {
        count: 0,
        windowStart: now,
        expiresAt: now + windowMs,
        lastUpdated: now,
      });
      this.enforceMemoryBound();
      return;
    }

    current.lastUpdated = now;
    if (current.count >= maxAttempts) {
      throw new HttpException(
        'Too many attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordFailure(key: string, windowMs: number): Promise<void> {
    const now = Date.now();

    if (await this.recordFailureRedis(key, windowMs)) {
      return;
    }

    const current = this.buckets.get(key);

    if (!current || now - current.windowStart > windowMs) {
      this.buckets.set(key, {
        count: 1,
        windowStart: now,
        expiresAt: now + windowMs,
        lastUpdated: now,
      });
      this.enforceMemoryBound();
      return;
    }

    this.buckets.set(key, {
      count: current.count + 1,
      windowStart: current.windowStart,
      expiresAt: current.expiresAt,
      lastUpdated: now,
    });
  }

  async reset(key: string): Promise<void> {
    if (await this.resetRedis(key)) {
      return;
    }

    this.buckets.delete(key);
  }

  private getRedisKey(key: string): string {
    return `${this.redisPrefix}:${key}`;
  }

  private async assertWithinLimitRedis(key: string, maxAttempts: number): Promise<boolean> {
    if (!this.redisClient) {
      return false;
    }

    const redisKey = this.getRedisKey(key);

    try {
      const rawCount = await this.redisClient.get(redisKey);
      if (!rawCount) {
        return true;
      }

      const count = Number.parseInt(rawCount, 10);
      if (!Number.isNaN(count) && count >= maxAttempts) {
        throw new HttpException(
          'Too many attempts. Try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.handleRedisFailure(error);
      return false;
    }
  }

  private async recordFailureRedis(key: string, windowMs: number): Promise<boolean> {
    if (!this.redisClient) {
      return false;
    }

    const redisKey = this.getRedisKey(key);

    try {
      const nextCount = await this.redisClient.incr(redisKey);
      if (nextCount === 1) {
        await this.redisClient.pExpire(redisKey, windowMs);
        return true;
      }

      const ttl = await this.redisClient.pTTL(redisKey);
      if (ttl < 0) {
        await this.redisClient.pExpire(redisKey, windowMs);
      }

      return true;
    } catch (error) {
      this.handleRedisFailure(error);
      return false;
    }
  }

  private async resetRedis(key: string): Promise<boolean> {
    if (!this.redisClient) {
      return false;
    }

    const redisKey = this.getRedisKey(key);

    try {
      await this.redisClient.del(redisKey);
      return true;
    } catch (error) {
      this.handleRedisFailure(error);
      return false;
    }
  }

  private pruneExpiredBuckets(): void {
    if (this.buckets.size === 0) {
      return;
    }

    const now = Date.now();
    this.buckets.forEach((bucket, key) => {
      if (bucket.expiresAt <= now) {
        this.buckets.delete(key);
      }
    });
  }

  private enforceMemoryBound(): void {
    if (this.buckets.size <= this.maxBuckets) {
      return;
    }

    const sortedKeys = Array.from(this.buckets.entries())
      .sort((left, right) => left[1].lastUpdated - right[1].lastUpdated)
      .map(([key]) => key);
    const overflow = this.buckets.size - this.maxBuckets;

    for (let index = 0; index < overflow; index += 1) {
      const key = sortedKeys[index];
      if (key) {
        this.buckets.delete(key);
      }
    }
  }

  private handleRedisFailure(error: unknown): void {
    this.redisClient = null;
    this.logger.warn('Auth attempt Redis store is unavailable; switched to in-memory limiter.');
    if (error instanceof Error) {
      this.logger.warn(error.message);
    }
  }
}
