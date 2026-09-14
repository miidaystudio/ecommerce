import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string | undefined;
  private readonly fromEmail: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('RESEND_API_KEY') ?? process.env.RESEND_API_KEY;
    this.fromEmail =
      this.config.get<string>('RESEND_FROM_EMAIL') ??
      process.env.RESEND_FROM_EMAIL ??
      'miiday <onboarding@resend.dev>';
  }

  /** Best-effort: order and status notifications must never fail the action that triggered them. */
  async send(message: EmailMessage): Promise<void> {
    try {
      await this.deliver(message);
    } catch (err) {
      this.logger.warn(`Email to ${message.to} not sent: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Throws when the code can't be delivered: a customer who never receives it
   * can't activate their account, so registration must not report success.
   */
  async sendOtpEmail(to: string, otp: string): Promise<void> {
    await this.deliver({
      to,
      subject: `WELCOME TO MIIDAY, your one-time-password is ${otp}`,
      body: `WELCOME TO MIIDAY, your one-time-password is ${otp}\n\nThis code will expire in 10 minutes. If you did not request this, please ignore this email.`,
      html: this.buildOtpHtml(otp),
    });
  }

  private hasLiveKey(): boolean {
    const key = this.apiKey?.trim();
    return Boolean(key && !key.startsWith('re_placeholder') && !key.startsWith('placeholder'));
  }

  private async deliver(message: EmailMessage): Promise<void> {
    if (!this.hasLiveKey()) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('RESEND_API_KEY is not configured');
      }
      // Development stub. Digits are masked so a one-time code never lands in logs.
      this.logger.log(`[email:stub] To: ${message.to} | Subject: ${message.subject.replace(/\d/g, '*')}`);
      return;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: this.fromEmail,
        to: [message.to],
        subject: message.subject,
        text: message.body,
        html: message.html,
      }),
    });

    if (!res.ok) {
      // Only the status: Resend's error body can quote the request, which for an
      // OTP email contains the code.
      this.logger.error(`Resend rejected an email to ${message.to} (HTTP ${res.status})`);
      throw new Error(`Resend responded with HTTP ${res.status}`);
    }
  }

  private buildOtpHtml(otp: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to miiday</title>
</head>
<body style="margin: 0; padding: 40px 20px; background-color: #FAF9F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2E2A24;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 480px; background-color: #FFFFFF; border: 1px solid #E8E4DA; border-radius: 12px; overflow: hidden; margin: 0 auto;">
    <tr>
      <td style="padding: 32px 32px 24px 32px; text-align: left;">
        <div style="font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: #2E2A24; margin-bottom: 24px;">
          miiday<span style="color: #C9A876;">.</span>
        </div>
        <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 600; line-height: 1.3; color: #2E2A24;">
          Welcome to miiday
        </h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #716D64;">
          Your one-time password for account registration is:
        </p>
        <div style="background-color: #F3F1EA; border: 1px solid #E8E4DA; border-radius: 10px; padding: 18px 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-family: 'JetBrains Mono', monospace, ui-monospace; font-size: 34px; font-weight: 700; letter-spacing: 0.25em; color: #4A4238;">${otp}</span>
        </div>
        <p style="margin: 0 0 8px 0; font-size: 13px; line-height: 1.5; color: #716D64;">
          This verification code will expire in <strong>10 minutes</strong>.
        </p>
        <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #716D64;">
          If you did not request this registration, you can safely ignore this email.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 32px; background-color: #FAF9F6; border-top: 1px solid #E8E4DA; text-align: center; font-size: 11px; color: #716D64;">
        © miiday · linen &amp; oak for a slower home
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
