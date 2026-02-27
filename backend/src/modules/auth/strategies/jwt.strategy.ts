import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../../../common/interfaces/jwt-payload.interface';
import { readCookieValue } from '../../../common/utils/security.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const accessCookieName = configService.get<string>('AUTH_ACCESS_COOKIE_NAME') ?? 'rfid.access_token';

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request | undefined) => {
          if (!req) {
            return null;
          }
          const rawCookieHeader = req.headers.cookie;
          return readCookieValue(rawCookieHeader, accessCookieName) ?? null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: AccessTokenPayload): AccessTokenPayload {
    return payload;
  }
}
