import { Injectable, Logger } from '@nestjs/common';
import type { EmailGateway } from './email-gateway.interface';

@Injectable()
export class ConsoleEmailGateway implements EmailGateway {
  private readonly logger = new Logger(ConsoleEmailGateway.name);

  async sendMagicLink(email: string, magicLinkUrl: string, expiresAt: Date): Promise<void> {
    this.logger.log(
      `Magic Link [DEV] -> ${email} | url=${magicLinkUrl} | expiresAt=${expiresAt.toISOString()}`,
    );
  }
}
