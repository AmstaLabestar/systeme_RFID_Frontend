import { Injectable } from '@nestjs/common';
import type { RequestMeta } from '../../common/interfaces/request-meta.interface';
import type {
  AuthResponseDto,
  AuthUserResponseDto,
  LoginTwoFactorChallengeResponseDto,
  RequestMagicLinkResponseDto,
  SetupTwoFactorResponseDto,
} from './dto/auth-response.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestMagicLinkDto } from './dto/request-magic-link.dto';
import { VerifyLoginTwoFactorDto } from './dto/verify-login-2fa.dto';
import { VerifyMagicLinkDto } from './dto/verify-magic-link.dto';
import { CredentialService } from './services/credential.service';
import { SessionService } from './services/session.service';
import { TwoFactorService } from './services/two-factor.service';
import type { GoogleOAuthUser } from './strategies/google.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly credentialService: CredentialService,
    private readonly twoFactorService: TwoFactorService,
    private readonly sessionService: SessionService,
  ) {}

  register(dto: RegisterDto, meta: RequestMeta): Promise<AuthResponseDto> {
    return this.credentialService.register(dto, meta);
  }

  login(
    dto: LoginDto,
    meta: RequestMeta,
  ): Promise<AuthResponseDto | LoginTwoFactorChallengeResponseDto> {
    return this.credentialService.login(dto, meta);
  }

  verifyLoginTwoFactor(dto: VerifyLoginTwoFactorDto, meta: RequestMeta): Promise<AuthResponseDto> {
    return this.twoFactorService.verifyLoginTwoFactor(dto, meta);
  }

  googleOAuthCallback(
    profile: GoogleOAuthUser,
    meta: RequestMeta,
    redirectTo?: string,
  ): Promise<AuthResponseDto | LoginTwoFactorChallengeResponseDto> {
    return this.credentialService.googleOAuthCallback(profile, meta, redirectTo);
  }

  googleLogin(
    dto: GoogleLoginDto,
    meta: RequestMeta,
  ): Promise<AuthResponseDto | LoginTwoFactorChallengeResponseDto> {
    return this.credentialService.googleLogin(dto, meta);
  }

  requestMagicLink(
    dto: RequestMagicLinkDto,
    meta: RequestMeta,
  ): Promise<RequestMagicLinkResponseDto> {
    return this.credentialService.requestMagicLink(dto, meta);
  }

  verifyMagicLink(
    dto: VerifyMagicLinkDto,
    meta: RequestMeta,
  ): Promise<AuthResponseDto | LoginTwoFactorChallengeResponseDto> {
    return this.credentialService.verifyMagicLink(dto, meta);
  }

  setupTwoFactor(userId: string): Promise<SetupTwoFactorResponseDto> {
    return this.twoFactorService.setupTwoFactor(userId);
  }

  enableTwoFactor(userId: string, code: string): Promise<{ success: true; isTwoFactorEnabled: true }> {
    return this.twoFactorService.enableTwoFactor(userId, code);
  }

  disableTwoFactor(
    userId: string,
    code: string,
  ): Promise<{ success: true; isTwoFactorEnabled: false }> {
    return this.twoFactorService.disableTwoFactor(userId, code);
  }

  refresh(dto: RefreshTokenDto, meta: RequestMeta): Promise<AuthResponseDto> {
    return this.sessionService.refresh(dto, meta);
  }

  logout(userId: string, dto: LogoutDto): Promise<{ success: true }> {
    return this.sessionService.logout(userId, dto);
  }

  session(userId: string): Promise<AuthUserResponseDto> {
    return this.sessionService.session(userId);
  }
}
