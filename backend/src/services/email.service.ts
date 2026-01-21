import nodemailer, { Transporter } from "nodemailer";
import { config } from "../config";

let transporter: Transporter;

export async function initializeEmailService(): Promise<void> {
  // for dev/testing, i'm using ethereal (fake smtp)
  if (config.email.ethereal.user && config.email.ethereal.pass) {
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: config.email.ethereal.user,
        pass: config.email.ethereal.pass,
      },
    });

    // make sure it connects
    try {
      await transporter.verify();
      console.log("✅ Email service configured with Ethereal");
    } catch (error) {
      console.error("❌ Email service verification failed:", error);
      throw error;
    }
  } else {
    throw new Error("Ethereal email credentials not configured");
  }
}

export interface SendEmailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    encoding?: string;
    contentType?: string;
  }>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  etherealUrl?: string;
  error?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const info = await transporter.sendMail({
      from: options.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments,
    });

    // ethereal gives you a preview link - super useful for testing
    const etherealUrl = nodemailer.getTestMessageUrl(info);

    return {
      success: true,
      messageId: info.messageId,
      etherealUrl: etherealUrl || undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Failed to send email to ${options.to}:`, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export function getTransporter(): Transporter {
  if (!transporter) {
    throw new Error("Email service not initialized");
  }
  return transporter;
}
