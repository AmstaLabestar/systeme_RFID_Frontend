export interface AuthUserResponseDto {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  provider: string;
  isTwoFactorEnabled: boolean;
  company: string;
  tenant: {
    id: string;
    name: string;
    domain: string;
  };
  role: {
    id: string;
    name: string;
    permissions: unknown;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  token: string;
  tokenType: 'Bearer';
  expiresIn: number;
  redirectTo: string;
  user: AuthUserResponseDto;
}

export type PublicAuthResponseDto = Omit<AuthResponseDto, 'accessToken' | 'refreshToken' | 'token'>;

export interface LoginTwoFactorChallengeResponseDto {
  requiresTwoFactor: true;
  twoFactorToken: string;
  expiresIn: number;
  // Absolute timestamp helps frontend countdown timers.
  expiresAt?: string;
  redirectTo: string;
  user: Pick<AuthUserResponseDto, 'id' | 'email' | 'isTwoFactorEnabled'>;
}

export interface SetupTwoFactorResponseDto {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
  isTwoFactorEnabled: boolean;
}

export interface RequestMagicLinkResponseDto {
  success: true;
  message: string;
}
