import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';

interface GoogleProfileEmail {
  value?: string;
}

interface GoogleProfileShape {
  id?: string;
  displayName?: string;
  emails?: GoogleProfileEmail[];
}

export interface GoogleOAuthUser {
  email: string;
  name: string;
  googleId: string;
  redirectTo?: string;
}

// Optional dependency loaded at runtime to keep compilation decoupled from type packages.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const GoogleStrategyBase = require('passport-google-oauth20').Strategy as new (
  ...args: any[]
) => any;

@Injectable()
export class GoogleStrategy extends PassportStrategy(
  GoogleStrategyBase,
  'google',
) {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
      session: false,
      passReqToCallback: true,
    });
  }

  validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: GoogleProfileShape,
  ): GoogleOAuthUser {
    const email = profile.emails?.[0]?.value?.trim().toLowerCase();
    if (!email || !profile.id) {
      throw new UnauthorizedException('Google account is missing required profile data.');
    }

    const redirectQuery = req.query?.redirectTo;
    const redirectTo =
      typeof redirectQuery === 'string' && redirectQuery.trim().length > 0
        ? redirectQuery.trim()
        : undefined;

    return {
      email,
      name: profile.displayName?.trim() || 'Google User',
      googleId: profile.id,
      redirectTo,
    };
  }
}
