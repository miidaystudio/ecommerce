import { Injectable, Logger } from '@nestjs/common';

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

// Stand-in for Resend/SendGrid pending client-provided credentials (same
// pattern as LocalImageStorageService for image uploads — flagged in
// memory.md). Logs what would be sent so the order-status-change flow is
// fully exercised and testable now; swapping in a real provider later is a
// single class implementing this same send() shape.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async send(message: EmailMessage): Promise<void> {
    this.logger.log(`[email:stub] To: ${message.to} | Subject: ${message.subject}\n${message.body}`);
  }
}
