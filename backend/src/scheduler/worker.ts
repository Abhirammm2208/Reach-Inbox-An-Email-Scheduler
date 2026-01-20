import { Worker, Job } from "bullmq";
import { AppDataSource } from "../db/connection";
import { Email } from "../db/entities/Email";
import { SentEmail } from "../db/entities/SentEmail";
import { ScheduledEmail } from "../db/entities/ScheduledEmail";
import { sendEmail } from "../services/email.service";
import { getRedis, getEmailQueue } from "./queue";
import { rateLimiter } from "./rateLimit";
import { config } from "../config";

interface EmailJobData {
  emailId: string;
  scheduledEmailId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
    size: number;
  }>;
}

export function createEmailWorker(): Worker {
  const worker = new Worker(
    "emails",
    async (job: Job<EmailJobData>) => {
      return await processEmailJob(job);
    },
    {
      connection: {
        host: config.redis.url.includes('@') ? (config.redis.url.split('@')[1]?.split(':')[0] || 'localhost') : 'localhost',
        port: config.redis.url.includes(':') ? parseInt(config.redis.url.split(':').pop() || '6379') : 6379,
        password: config.redis.url.includes(':') ? config.redis.url.split(':')[2]?.split('@')[0] : undefined,
        maxRetriesPerRequest: null,
      },
      concurrency: config.worker.concurrency,
    }
  );

  worker.on("completed", (job) => {
    console.log(`✅ Email sent successfully: ${job.data.emailId}`);
  });

  worker.on("failed", (job, err) => {
    if (job) {
      console.error(`❌ Email job failed: ${job.data.emailId} - ${err.message}`);
    }
  });

  worker.on("error", (err) => {
    console.error("❌ Worker error:", err);
  });

  return worker;
}

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { emailId, scheduledEmailId, senderEmail, recipientEmail, subject, body, attachments } = job.data;

  const emailRepository = AppDataSource.getRepository(Email);
  const sentEmailRepository = AppDataSource.getRepository(SentEmail);

  try {
    // Check rate limits
    const senderLimit = await rateLimiter.checkRateLimit(senderEmail);
    const globalLimit = await rateLimiter.checkGlobalRateLimit();

    if (!senderLimit.allowed) {
      // Reschedule for next hour
      const nextTime = rateLimiter.getNextAvailableTime(new Date());
      throw new Error(
        `Sender rate limit exceeded. Rescheduling to ${nextTime.toISOString()}`
      );
    }

    if (!globalLimit.allowed) {
      // Reschedule for next hour
      const nextTime = rateLimiter.getNextAvailableTime(new Date());
      throw new Error(
        `Global rate limit exceeded. Rescheduling to ${nextTime.toISOString()}`
      );
    }

    // Apply delay between sends
    await applyDelay(config.worker.delayBetweenSendMs);

    // Convert attachments from stored format to nodemailer format
    const emailAttachments = attachments?.map(att => ({
      filename: att.filename,
      content: Buffer.from(att.content, 'base64'),
      contentType: att.contentType,
    }));

    // Send email
    const result = await sendEmail({
      from: senderEmail,
      to: recipientEmail,
      subject,
      html: body,
      attachments: emailAttachments,
    });

    // Update database
    if (result.success) {
      // Mark email as sent
      await emailRepository.update(emailId, {
        status: "sent",
        sentAt: new Date(),
        jobId: job.id,
      });

      // Create sent email record
      await sentEmailRepository.insert({
        scheduledEmailId,
        recipientEmail,
        senderEmail,
        subject,
        body,
        status: "sent",
        etherealMessageUrl: result.etherealUrl,
        attachments,
      });

      // Update scheduled email stats and check completion
      const scheduledRepository = AppDataSource.getRepository(ScheduledEmail);
      
      // First, get current counts
      const scheduledEmail = await scheduledRepository.findOne({
        where: { id: scheduledEmailId },
      });

      if (scheduledEmail) {
        const totalEmails = scheduledEmail.recipientEmails.length;
        const newSentCount = scheduledEmail.sentCount + 1;
        const completedCount = newSentCount + scheduledEmail.failedCount;

        // Update sent count and status in one operation
        if (completedCount >= totalEmails) {
          // All emails processed - mark as completed
          await scheduledRepository.update(scheduledEmailId, {
            sentCount: newSentCount,
            status: "completed",
            completedAt: new Date(),
          });
          console.log(`✅ Scheduled email batch completed: ${scheduledEmailId} (${newSentCount}/${totalEmails} sent)`);
        } else {
          // Still processing - increment count and update status
          await scheduledRepository.update(scheduledEmailId, {
            sentCount: newSentCount,
            status: scheduledEmail.status === "pending" ? "processing" : scheduledEmail.status,
            startedAt: scheduledEmail.startedAt || new Date(),
          });
        }
      }
    } else {
      throw new Error(result.error || "Failed to send email");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Check if this is a rate limit error - if so, reschedule
    if (errorMessage.includes("rate limit")) {
      const match = errorMessage.match(/Rescheduling to (.+)$/);
      if (match && match[1]) {
        const nextTime = new Date(match[1]);
        const delay = Math.max(0, nextTime.getTime() - Date.now());

        // Re-queue with new delay
        const emailQueue = getEmailQueue();
        await emailQueue.add("send", job.data, {
          delay,
          jobId: `${job.data.emailId}-retry-${Date.now()}`,
        });

        console.log(`⏱️  Email rescheduled due to rate limit: ${job.data.emailId}`);
        return;
      }
    }

    // Mark as failed
    const emailRepository = AppDataSource.getRepository(Email);
    const sentEmailRepository = AppDataSource.getRepository(SentEmail);

    await emailRepository.update(emailId, {
      status: "failed",
      errorMessage,
      jobId: job.id,
    });

    // Create sent email record with failure
    await sentEmailRepository.insert({
      scheduledEmailId,
      recipientEmail,
      senderEmail,
      subject,
      body,
      status: "failed",
      errorMessage,
      attachments,
    });

    // Update scheduled email stats and check completion
    const scheduledRepository = AppDataSource.getRepository(ScheduledEmail);
    
    // First, get current counts
    const scheduledEmail = await scheduledRepository.findOne({
      where: { id: scheduledEmailId },
    });

    if (scheduledEmail) {
      const totalEmails = scheduledEmail.recipientEmails.length;
      const newFailedCount = scheduledEmail.failedCount + 1;
      const completedCount = scheduledEmail.sentCount + newFailedCount;

      // Update failed count and status in one operation
      if (completedCount >= totalEmails) {
        // All emails processed - mark as completed
        await scheduledRepository.update(scheduledEmailId, {
          failedCount: newFailedCount,
          status: "completed",
          completedAt: new Date(),
        });
        console.log(`✅ Scheduled email batch completed (with failures): ${scheduledEmailId} (${scheduledEmail.sentCount}/${totalEmails} sent, ${newFailedCount} failed)`);
      } else {
        // Still processing - increment count
        await scheduledRepository.update(scheduledEmailId, {
          failedCount: newFailedCount,
        });
      }
    }

    throw error;
  }
}

function applyDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
