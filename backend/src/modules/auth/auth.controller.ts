import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import ms from 'ms';
import { randomBytes } from 'crypto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';
import type { AccessTokenPayload } from '../../common/interfaces/jwt-payload.interface';
import type { RequestMeta } from '../../common/interfaces/request-meta.interface';
import { readCookieValue } from '../../common/utils/security.util';
import { AuthService } from './auth.service';
import type {
  AuthResponseDto,
  LoginTwoFactorChallengeResponseDto,
  PublicAuthResponseDto,
} from './dto/auth-response.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestMagicLinkDto } from './dto/request-magic-link.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyMagicLinkDto } from './dto/verify-magic-link.dto';
import { VerifyLoginTwoFactorDto } from './dto/verify-login-2fa.dto';
import { VerifyTwoFactorCodeDto } from './dto/verify-two-factor-code.dto';
import type { GoogleOAuthUser } from './strategies/google.strategy';

type RequestWithCorrelationId = Request & { requestId?: string };

@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean;
  private readonly accessCookieName: string;
  private readonly refreshCookieName: string;
  private readonly csrfCookieName: string;
  private readonly refreshCookieTtlMs: number;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    const nodeEnv = this.configService.get<string>('NODE_ENV') ?? 'development';
    this.isProduction = nodeEnv === 'production';
    this.accessCookieName =
      this.configService.get<string>('AUTH_ACCESS_COOKIE_NAME') ?? 'rfid.access_token';
    this.refreshCookieName =
      this.configService.get<string>('AUTH_REFRESH_COOKIE_NAME') ?? 'rfid.refresh_token';
    this.csrfCookieName =
      this.configService.get<string>('AUTH_CSRF_COOKIE_NAME') ?? 'rfid.csrf_token';
    this.refreshCookieTtlMs = this.parseDurationMs(
      this.configService.getOrThrow<string>('JWT_REFRESH_TTL'),
      'JWT_REFRESH_TTL',
    );
  }

  @Post(['register', 'signup'])
  @Throttle({
    global: {
      limit: 6,
      ttl: 60_000,
    },
  })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authResponse = await this.authService.register(dto, this.extractRequestMeta(req));
    this.setAuthCookies(res, authResponse);
    return this.toPublicAuthResponse(authResponse);
  }

  @Post(['login', 'signin'])
  @Throttle({
    global: {
      limit: 20,
      ttl: 60_000,
    },
  })
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authResult = await this.authService.login(dto, this.extractRequestMeta(req));
    if (this.isAuthResponse(authResult)) {
      this.setAuthCookies(res, authResult);
    }
    return this.toPublicAuthResult(authResult);
  }

  @Post(['login/verify-2fa', 'signin/verify-2fa'])
  @Throttle({
    global: {
      limit: 30,
      ttl: 60_000,
    },
  })
  @HttpCode(200)
  async verifyLoginTwoFactor(
    @Body() dto: VerifyLoginTwoFactorDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authResponse = await this.authService.verifyLoginTwoFactor(
      dto,
      this.extractRequestMeta(req),
    );
    this.setAuthCookies(res, authResponse);
    return this.toPublicAuthResponse(authResponse);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth(): void {
    // Passport handles redirect to Google OAuth consent screen.
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: Request & { user: GoogleOAuthUser },
    @Res({ passthrough: true }) res: Response,
    @Query('redirectTo') redirectTo?: string,
  ) {
    const authResult = await this.authService.googleOAuthCallback(
      req.user,
      this.extractRequestMeta(req),
      redirectTo,
    );
    if (this.isAuthResponse(authResult)) {
      this.setAuthCookies(res, authResult);
    }
    return this.toPublicAuthResult(authResult);
  }

  @Post(['google', 'google/verify'])
  @Throttle({
    global: {
      limit: 15,
      ttl: 60_000,
    },
  })
  @HttpCode(200)
  async googleLogin(
    @Body() dto: GoogleLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authResult = await this.authService.googleLogin(dto, this.extractRequestMeta(req));
    if (this.isAuthResponse(authResult)) {
      this.setAuthCookies(res, authResult);
    }
    return this.toPublicAuthResult(authResult);
  }

  @Post('magic-link')
  @Throttle({
    global: {
      limit: 6,
      ttl: 60_000,
    },
  })
  @HttpCode(200)
  requestMagicLink(@Body() dto: RequestMagicLinkDto, @Req() req: Request) {
    return this.authService.requestMagicLink(dto, this.extractRequestMeta(req));
  }

  @Post('magic-link/verify')
  @Throttle({
    global: {
      limit: 20,
      ttl: 60_000,
    },
  })
  @HttpCode(200)
  async verifyMagicLink(
    @Body() dto: VerifyMagicLinkDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authResult = await this.authService.verifyMagicLink(dto, this.extractRequestMeta(req));
    if (this.isAuthResponse(authResult)) {
      this.setAuthCookies(res, authResult);
    }
    return this.toPublicAuthResult(authResult);
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  setupTwoFactor(@CurrentUser() user: AccessTokenPayload) {
    return this.authService.setupTwoFactor(user.userId);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  enableTwoFactor(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: VerifyTwoFactorCodeDto,
  ) {
    return this.authService.enableTwoFactor(user.userId, dto.code);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard, TwoFactorAuthGuard)
  disableTwoFactor(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: VerifyTwoFactorCodeDto,
  ) {
    return this.authService.disableTwoFactor(user.userId, dto.code);
  }

  @Post('refresh')
  @Throttle({
    global: {
      limit: 60,
      ttl: 60_000,
    },
  })
  @HttpCode(200)
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = dto.refreshToken ?? this.readRefreshTokenFromRequest(req);
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required.');
    }

    const authResponse = await this.authService.refresh(
      { refreshToken },
      this.extractRequestMeta(req),
    );
    this.setAuthCookies(res, authResponse);
    return this.toPublicAuthResponse(authResponse);
  }

  @Post('logout')
  @Throttle({
    global: {
      limit: 30,
      ttl: 60_000,
    },
  })
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async logout(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: LogoutDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = dto.refreshToken ?? this.readRefreshTokenFromRequest(req);
    const response = await this.authService.logout(user.userId, { refreshToken });
    this.clearAuthCookies(res);
    return response;
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  session(
    @CurrentUser() user: AccessTokenPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.setCsrfCookie(res, this.issueCsrfToken());
    return this.authService.session(user.userId);
  }

  private extractRequestMeta(req: Request): RequestMeta {
    const requestWithCorrelationId = req as RequestWithCorrelationId;
    const userAgentHeader = req.headers['user-agent'];
    const rawUserAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;
    const userAgent = rawUserAgent?.trim().slice(0, 512);

    return {
      requestId: requestWithCorrelationId.requestId,
      ipAddress: req.ip ?? req.socket.remoteAddress ?? undefined,
      userAgent: userAgent ?? undefined,
    };
  }

  private readRefreshTokenFromRequest(req: Request): string | undefined {
    return readCookieValue(req.headers.cookie, this.refreshCookieName);
  }

  private isAuthResponse(
    value: AuthResponseDto | LoginTwoFactorChallengeResponseDto,
  ): value is AuthResponseDto {
    return (
      typeof (value as Partial<AuthResponseDto>).accessToken === 'string' &&
      typeof (value as Partial<AuthResponseDto>).refreshToken === 'string'
    );
  }

  private toPublicAuthResponse(authResponse: AuthResponseDto): PublicAuthResponseDto {
    const {
      accessToken: _accessToken,
      refreshToken: _refreshToken,
      token: _token,
      ...publicResponse
    } = authResponse;
    return publicResponse;
  }

  private toPublicAuthResult(
    value: AuthResponseDto | LoginTwoFactorChallengeResponseDto,
  ): PublicAuthResponseDto | LoginTwoFactorChallengeResponseDto {
    if (this.isAuthResponse(value)) {
      return this.toPublicAuthResponse(value);
    }
    return value;
  }

  private setAuthCookies(res: Response, authResponse: AuthResponseDto): void {
    const baseCookie = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax' as const,
      path: '/',
    };

    res.cookie(this.accessCookieName, authResponse.accessToken, {
      ...baseCookie,
      maxAge: Math.max(authResponse.expiresIn, 1) * 1000,
    });

    res.cookie(this.refreshCookieName, authResponse.refreshToken, {
      ...baseCookie,
      maxAge: this.refreshCookieTtlMs,
    });

    this.setCsrfCookie(res, this.issueCsrfToken());
  }

  private clearAuthCookies(res: Response): void {
    const baseCookie = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax' as const,
      path: '/',
    };

    res.clearCookie(this.accessCookieName, baseCookie);
    res.clearCookie(this.refreshCookieName, baseCookie);
    res.clearCookie(this.csrfCookieName, {
      httpOnly: false,
      secure: this.isProduction,
      sameSite: 'lax',
      path: '/',
    });
  }

  private setCsrfCookie(res: Response, csrfToken: string): void {
    res.cookie(this.csrfCookieName, csrfToken, {
      httpOnly: false,
      secure: this.isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: this.refreshCookieTtlMs,
    });
  }

  private issueCsrfToken(): string {
    return randomBytes(24).toString('hex');
  }

  private parseDurationMs(value: string, envName: string): number {
    const parsed = ms(value as never);
    if (typeof parsed !== 'number' || Number.isNaN(parsed) || parsed <= 0) {
      throw new Error(`${envName} has an invalid duration.`);
    }
    return parsed;
  }
}
