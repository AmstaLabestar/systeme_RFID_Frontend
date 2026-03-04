import { createHash } from 'crypto';
import {
  HibpCompromisedPasswordCheckerService,
  type HibpRangeGateway,
} from './hibp-password-checker.service';

describe('HibpCompromisedPasswordCheckerService', () => {
  it('returns not compromised when the HIBP range response is empty', async () => {
    const gateway: HibpRangeGateway = {
      getRangeByPrefix: jest.fn().mockResolvedValue(''),
    };
    const service = new HibpCompromisedPasswordCheckerService(gateway);
    const result = await service.check('correct horse battery staple');

    expect(result).toEqual({
      compromised: false,
      breachCount: 0,
      provider: 'hibp-mock',
    });
    expect(gateway.getRangeByPrefix).toHaveBeenCalledTimes(1);
  });

  it('detects compromised passwords from suffix matches', async () => {
    const password = 'StrongPass#1234';
    const hash = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const gateway: HibpRangeGateway = {
      getRangeByPrefix: jest.fn().mockResolvedValue(`${suffix}:18\r\nABCDEF0123456789:1`),
    };
    const service = new HibpCompromisedPasswordCheckerService(gateway);
    const result = await service.check(password);

    expect(gateway.getRangeByPrefix).toHaveBeenCalledWith(prefix);
    expect(result).toEqual({
      compromised: true,
      breachCount: 18,
      provider: 'hibp-mock',
    });
  });
});
