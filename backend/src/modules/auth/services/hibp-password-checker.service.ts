import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

export const COMPROMISED_PASSWORD_CHECKER = Symbol('COMPROMISED_PASSWORD_CHECKER');
export const HIBP_RANGE_GATEWAY = Symbol('HIBP_RANGE_GATEWAY');

export interface CompromisedPasswordCheckResult {
  compromised: boolean;
  breachCount: number;
  provider: 'hibp-mock';
}

export interface CompromisedPasswordChecker {
  check(password: string): Promise<CompromisedPasswordCheckResult>;
}

export interface HibpRangeGateway {
  getRangeByPrefix(prefix: string): Promise<string>;
}

@Injectable()
export class MockHibpRangeGateway implements HibpRangeGateway {
  async getRangeByPrefix(_prefix: string): Promise<string> {
    // Intentionally empty mock: replace by an HTTP range lookup to HIBP in production integration.
    return '';
  }
}

@Injectable()
export class HibpCompromisedPasswordCheckerService implements CompromisedPasswordChecker {
  private readonly logger = new Logger(HibpCompromisedPasswordCheckerService.name);

  constructor(
    @Inject(HIBP_RANGE_GATEWAY)
    private readonly hibpRangeGateway: HibpRangeGateway,
  ) {}

  async check(password: string): Promise<CompromisedPasswordCheckResult> {
    const hash = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    let rangeResponse = '';

    try {
      rangeResponse = await this.hibpRangeGateway.getRangeByPrefix(prefix);
    } catch (error) {
      this.logger.warn(
        `hibp_range_lookup_failed prefix=${prefix} reason=${error instanceof Error ? error.message : 'unknown'}`,
      );
    }

    const breachCount = this.extractBreachCount(rangeResponse, suffix);

    return {
      compromised: breachCount > 0,
      breachCount,
      provider: 'hibp-mock',
    };
  }

  private extractBreachCount(rangeResponse: string, targetSuffix: string): number {
    const lines = rangeResponse.split(/\r?\n/);

    for (const line of lines) {
      const normalized = line.trim();
      if (!normalized) {
        continue;
      }

      const [suffix, count] = normalized.split(':', 2);
      if (!suffix || !count) {
        continue;
      }

      if (suffix.toUpperCase() !== targetSuffix) {
        continue;
      }

      const parsedCount = Number.parseInt(count, 10);
      if (Number.isFinite(parsedCount) && parsedCount > 0) {
        return parsedCount;
      }
    }

    return 0;
  }
}
