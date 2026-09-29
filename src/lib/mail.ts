import "server-only";
import nodemailer from "nodemailer";
import { env } from "./env";

let transport: nodemailer.Transporter | null = null;

export async function sendEnrolmentEmail(to: { email: string; name: string }, link: string, reissue: boolean) {
  const subject = reissue ? "Your new Firmware Hub sign-in link" : "You've been invited to Firmware Hub";
  const text = [
    `Hi ${to.name},`,
    "",
    reissue
      ? "An administrator has issued you a new link to register a passkey for Firmware Hub."
      : "You've been given access to download sensor firmware from Firmware Hub.",
    "",
    "Open this link on the device you want to sign in with, and register a passkey (Face ID, Touch ID, Windows Hello, or a security key):",
    link,
    "",
    "The link expires in 72 hours and can be used once.",
  ].join("\n");

  if (!env.smtpUrl) {
    console.warn(`[mail] SMTP_URL not set — enrolment link for ${to.email}: ${link}`);
    return;
  }
  transport ??= nodemailer.createTransport(env.smtpUrl);
  await transport.sendMail({ from: env.mailFrom, to: `"${to.name}" <${to.email}>`, subject, text });
}
