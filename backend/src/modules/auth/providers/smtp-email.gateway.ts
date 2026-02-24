import { Injectable } from '@nestjs/common';
import type { EmailGateway } from './email-gateway.interface';

interface SmtpTransporter {
  sendMail(options: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<unknown>;
}

interface NodemailerModuleLike {
  createTransport(options: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  }): SmtpTransporter;
}

@Injectable()
export class SmtpEmailGateway implements EmailGateway {
  private readonly transporter: SmtpTransporter;

  constructor(
    private readonly from: string,
    host: string,
    port: number,
    secure: boolean,
    user: string,
    pass: string,
  ) {
    // Optional dependency loaded only when SMTP provider is selected.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer = require('nodemailer') as NodemailerModuleLike;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }

  async sendMagicLink(email: string, magicLinkUrl: string, expiresAt: Date): Promise<void> {
    const subject = 'Your secure magic sign-in link';
    const text = [
      'Use this secure sign-in link:',
      magicLinkUrl,
      `It expires at: ${expiresAt.toISOString()}`,
      'If you did not request this link, ignore this email.',
    ].join('\n');

    const html = [
      '<p>Use this secure sign-in link:</p>',
      `<p><a href="${magicLinkUrl}">${magicLinkUrl}</a></p>`,
      `<p>It expires at: <strong>${expiresAt.toISOString()}</strong></p>`,
      '<p>If you did not request this link, ignore this email.</p>',
    ].join('');

    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject,
      text,
      html,
    });
  }
}
