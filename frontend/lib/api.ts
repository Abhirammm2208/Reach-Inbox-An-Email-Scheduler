const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5005";

export interface ScheduleEmailRequest {
  subject: string;
  body: string;
  emails: string[];
  senderEmail: string;
  startTime: string;
  delayBetweenSends?: number;
  hourlyLimit?: number;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
    size: number;
  }>;
}

export interface ScheduledEmailResponse {
  id: string;
  senderEmail: string;
  subject: string;
  body: string;
  recipientEmails: string[];
  scheduledAt: string;
  status: "pending" | "processing" | "completed" | "failed";
  sentCount: number;
  failedCount: number;
  createdAt: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
    size: number;
  }>;
}

export interface SentEmailResponse {
  id: string;
  scheduledEmailId: string;
  recipientEmail: string;
  senderEmail: string;
  subject: string;
  body: string;
  status: "sent" | "failed";
  etherealUrl?: string;
  sentAt: string;
  errorMessage?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
    size: number;
  }>;
}

export interface StatsResponse {
  sent: number;
  failed: number;
  scheduled: number;
  completedScheduled: number;
}

export async function scheduleEmail(data: ScheduleEmailRequest): Promise<any> {
  const response = await fetch(`${API_URL}/api/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to schedule email");
  }

  return response.json();
}

export interface SendEmailRequest {
  subject: string;
  body: string;
  emails: string[];
  senderEmail: string;
  delayBetweenSends?: number;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
    size: number;
  }>;
}

export async function sendEmail(data: SendEmailRequest): Promise<any> {
  const response = await fetch(`${API_URL}/api/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to send email");
  }

  return response.json();
}

export async function getScheduledEmails(limit = 20, offset = 0) {
  const response = await fetch(
    `${API_URL}/api/scheduled?limit=${limit}&offset=${offset}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch scheduled emails");
  }

  return response.json();
}

export async function getSentEmails(limit = 20, offset = 0) {
  const response = await fetch(`${API_URL}/api/sent?limit=${limit}&offset=${offset}`);

  if (!response.ok) {
    throw new Error("Failed to fetch sent emails");
  }

  return response.json();
}

export async function getStats() {
  const response = await fetch(`${API_URL}/api/stats`);

  if (!response.ok) {
    throw new Error("Failed to fetch stats");
  }

  return response.json();
}

export async function getPendingEmails(limit = 20, offset = 0) {
  const response = await fetch(
    `${API_URL}/api/pending?limit=${limit}&offset=${offset}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch pending emails");
  }

  return response.json();
}
