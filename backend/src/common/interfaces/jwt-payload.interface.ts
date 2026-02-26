export interface AccessTokenPayload {
  userId: string;
  email: string;
  tenantId: string;
  isTwoFactorAuthenticated: boolean;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}
