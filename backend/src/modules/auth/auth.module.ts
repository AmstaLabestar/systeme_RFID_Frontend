import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { RolesModule } from '../roles/roles.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MagicLinkTokensRepository } from './repositories/magic-link-tokens.repository';
import { RefreshTokensRepository } from './repositories/refresh-tokens.repository';
import { GoogleTokenVerifierService } from './providers/google-token-verifier.service';
import { ConsoleEmailGateway } from './providers/console-email.gateway';
import { EMAIL_GATEWAY } from './providers/email-gateway.interface';
import { SmtpEmailGateway } from './providers/smtp-email.gateway';
import { AuthAttemptService } from './services/auth-attempt.service';
import { CredentialService } from './services/credential.service';
import {
  COMPROMISED_PASSWORD_CHECKER,
  HibpCompromisedPasswordCheckerService,
  HIBP_RANGE_GATEWAY,
  MockHibpRangeGateway,
} from './services/hibp-password-checker.service';
import { SessionService } from './services/session.service';
import { TokenService } from './services/token.service';
import { TwoFactorService } from './services/two-factor.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
    UsersModule,
    TenantsModule,
    RolesModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    RefreshTokensRepository,
    MagicLinkTokensRepository,
    GoogleTokenVerifierService,
    AuthAttemptService,
    TokenService,
    SessionService,
    TwoFactorService,
    CredentialService,
    HibpCompromisedPasswordCheckerService,
    {
      provide: HIBP_RANGE_GATEWAY,
      useClass: MockHibpRangeGateway,
    },
    {
      provide: COMPROMISED_PASSWORD_CHECKER,
      useExisting: HibpCompromisedPasswordCheckerService,
    },
    {
      provide: EMAIL_GATEWAY,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const provider = configService.getOrThrow<string>('EMAIL_PROVIDER');

        if (provider === 'smtp') {
          const from = configService.getOrThrow<string>('EMAIL_FROM');
          const host = configService.getOrThrow<string>('SMTP_HOST');
          const port = configService.getOrThrow<number>('SMTP_PORT');
          const secure = configService.getOrThrow<boolean>('SMTP_SECURE');
          const user = configService.getOrThrow<string>('SMTP_USER');
          const pass = configService.getOrThrow<string>('SMTP_PASS');

          return new SmtpEmailGateway(from, host, port, secure, user, pass);
        }

        return new ConsoleEmailGateway();
      },
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
