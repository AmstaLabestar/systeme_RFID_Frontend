import {
  Body,
  Controller,
  Get,
  HttpCode,
  Query,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../../common/interfaces/jwt-payload.interface';
import type { RequestMeta } from '../../common/interfaces/request-meta.interface';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';
import { AuthService } from './auth.service';
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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post(['register', 'signup'])
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, this.extractRequestMeta(req));
  }

  @Post(['login', 'signin'])
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, this.extractRequestMeta(req));
  }

  @Post(['login/verify-2fa', 'signin/verify-2fa'])
  @HttpCode(200)
  verifyLoginTwoFactor(@Body() dto: VerifyLoginTwoFactorDto, @Req() req: Request) {
    return this.authService.verifyLoginTwoFactor(dto, this.extractRequestMeta(req));
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth(): void {
    // Passport handles redirect to Google OAuth consent screen.
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleCallback(
    @Req() req: Request & { user: GoogleOAuthUser },
    @Query('redirectTo') redirectTo?: string,
  ) {
    return this.authService.googleOAuthCallback(
      req.user,
      this.extractRequestMeta(req),
      redirectTo,
    );
  }

  @Post(['google', 'google/verify'])
  @HttpCode(200)
  googleLogin(@Body() dto: GoogleLoginDto, @Req() req: Request) {
    return this.authService.googleLogin(dto, this.extractRequestMeta(req));
  }

  @Post('magic-link')
  @HttpCode(200)
  requestMagicLink(@Body() dto: RequestMagicLinkDto, @Req() req: Request) {
    return this.authService.requestMagicLink(dto, this.extractRequestMeta(req));
  }

  @Post('magic-link/verify')
  @HttpCode(200)
  verifyMagicLink(@Body() dto: VerifyMagicLinkDto, @Req() req: Request) {
    return this.authService.verifyMagicLink(dto, this.extractRequestMeta(req));
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
  @HttpCode(200)
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto, this.extractRequestMeta(req));
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  logout(@CurrentUser() user: AccessTokenPayload, @Body() dto: LogoutDto) {
    return this.authService.logout(user.userId, dto);
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  session(@CurrentUser() user: AccessTokenPayload) {
    return this.authService.session(user.userId);
  }

  private extractRequestMeta(req: Request): RequestMeta {
    const xForwardedFor = req.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
    const firstForwardedIp = forwardedIp?.split(',')[0]?.trim();
    const userAgentHeader = req.headers['user-agent'];
    const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;

    return {
      ipAddress: firstForwardedIp ?? req.ip ?? req.socket.remoteAddress ?? undefined,
      userAgent: userAgent ?? undefined,
    };
  }
}
