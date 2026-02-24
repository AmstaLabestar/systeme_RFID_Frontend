import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface AttemptBucket {
  count: number;
  windowStart: number;
}

@Injectable()
export class AuthAttemptService {
  private readonly buckets = new Map<string, AttemptBucket>();

  assertWithinLimit(key: string, maxAttempts: number, windowMs: number): void {
    const now = Date.now();
    const current = this.buckets.get(key);

    if (!current || now - current.windowStart > windowMs) {
      this.buckets.set(key, { count: 0, windowStart: now });
      return;
    }

    if (current.count >= maxAttempts) {
      throw new HttpException(
        'Too many attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordFailure(key: string, windowMs: number): void {
    const now = Date.now();
    const current = this.buckets.get(key);

    if (!current || now - current.windowStart > windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now });
      return;
    }

    this.buckets.set(key, {
      count: current.count + 1,
      windowStart: current.windowStart,
    });
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }
}
