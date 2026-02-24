export const EMAIL_GATEWAY = Symbol('EMAIL_GATEWAY');

export interface EmailGateway {
  sendMagicLink(email: string, magicLinkUrl: string, expiresAt: Date): Promise<void>;
}
