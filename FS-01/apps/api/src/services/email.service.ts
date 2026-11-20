import nodemailer, { type Transporter } from "nodemailer";
import type { Logger } from "pino";
import type { ApiEnv } from "../config/env.js";

export interface PasswordResetMessage {
  email: string;
  name: string;
  token: string;
}

export interface WorkspaceInvitationMessage {
  email: string;
  inviterName: string;
  workspaceName: string;
  token: string;
}

export interface Mailer {
  sendPasswordReset(message: PasswordResetMessage): Promise<void>;
  sendWorkspaceInvitation(message: WorkspaceInvitationMessage): Promise<void>;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

class DevelopmentMailer implements Mailer {
  constructor(
    private readonly env: ApiEnv,
    private readonly logger: Logger,
  ) {}

  async sendPasswordReset(message: PasswordResetMessage): Promise<void> {
    const resetUrl = `${this.env.APP_URL}/reset-password?token=${encodeURIComponent(message.token)}`;
    this.logger.info({ email: message.email, resetUrl }, "Development password reset link");
  }

  async sendWorkspaceInvitation(message: WorkspaceInvitationMessage): Promise<void> {
    const invitationUrl = `${this.env.APP_URL}/invite?token=${encodeURIComponent(message.token)}`;
    this.logger.info({ email: message.email, invitationUrl }, "Development workspace invitation link");
  }
}

class SmtpMailer implements Mailer {
  private readonly transporter: Transporter;

  constructor(private readonly env: ApiEnv) {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    });
  }

  async sendPasswordReset(message: PasswordResetMessage): Promise<void> {
    const resetUrl = `${this.env.APP_URL}/reset-password?token=${encodeURIComponent(message.token)}`;
    const safeName = escapeHtml(message.name);
    const safeUrl = escapeHtml(resetUrl);

    await this.transporter.sendMail({
      from: this.env.MAIL_FROM,
      to: message.email,
      subject: "Reset your Orvyn password",
      text: `Hi ${message.name}, reset your password using this link: ${resetUrl}. The link expires in 30 minutes.`,
      html: `<p>Hi ${safeName},</p><p>Reset your password using the link below. It expires in 30 minutes.</p><p><a href="${safeUrl}">Reset password</a></p>`,
    });
  }

  async sendWorkspaceInvitation(message: WorkspaceInvitationMessage): Promise<void> {
    const invitationUrl = `${this.env.APP_URL}/invite?token=${encodeURIComponent(message.token)}`;
    const safeInviter = escapeHtml(message.inviterName);
    const safeWorkspace = escapeHtml(message.workspaceName);
    const safeUrl = escapeHtml(invitationUrl);

    await this.transporter.sendMail({
      from: this.env.MAIL_FROM,
      to: message.email,
      subject: `${message.inviterName} invited you to ${message.workspaceName}`,
      text: `${message.inviterName} invited you to ${message.workspaceName} on Orvyn. Open ${invitationUrl}. The invitation expires in 7 days.`,
      html: `<p>${safeInviter} invited you to <strong>${safeWorkspace}</strong> on Orvyn.</p><p><a href="${safeUrl}">Review invitation</a></p><p>This invitation expires in 7 days.</p>`,
    });
  }
}

export function createMailer(env: ApiEnv, logger: Logger): Mailer {
  return env.MAIL_TRANSPORT === "smtp" ? new SmtpMailer(env) : new DevelopmentMailer(env, logger);
}
