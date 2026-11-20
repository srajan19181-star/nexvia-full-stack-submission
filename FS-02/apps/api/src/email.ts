import { env } from "./config";
import { AppError } from "./http";

type EmailMessage = { to: string; subject: string; html: string; text: string };

export async function sendEmail(message: EmailMessage) {
  if (env.EMAIL_PROVIDER === "console") {
    if (env.NODE_ENV === "production") throw new AppError(503, "EMAIL_NOT_CONFIGURED", "Transactional email is not configured");
    console.info(JSON.stringify({ event: "development_email", to: message.to, subject: message.subject, text: message.text }));
    return { provider: "console" as const };
  }
  if (!env.RESEND_API_KEY) throw new AppError(503, "EMAIL_NOT_CONFIGURED", "Transactional email is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
  });
  if (!response.ok) throw new AppError(502, "EMAIL_DELIVERY_FAILED", "Email provider rejected the message");
  return { provider: "resend" as const };
}

export const verificationEmail = (name: string, url: string): Omit<EmailMessage, "to"> => ({
  subject: "Verify your AUREVA account",
  text: `Hello ${name}, verify your email address: ${url}`,
  html: `<p>Hello ${escapeHtml(name)},</p><p>Verify your AUREVA email address to activate your account.</p><p><a href="${escapeHtml(url)}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
});

export const passwordResetEmail = (name: string, url: string): Omit<EmailMessage, "to"> => ({
  subject: "Reset your AUREVA password",
  text: `Hello ${name}, reset your password: ${url}`,
  html: `<p>Hello ${escapeHtml(name)},</p><p>A password reset was requested for your AUREVA account.</p><p><a href="${escapeHtml(url)}">Reset password</a></p><p>This link expires in one hour. Ignore this message if you did not request it.</p>`,
});

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!);
}
