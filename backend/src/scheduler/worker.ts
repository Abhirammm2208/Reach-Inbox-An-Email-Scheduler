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
    // gotta check if we're hitting rate limits first
    const senderLimit = await rateLimiter.checkRateLimit(senderEmail);
    const globalLimit = await rateLimiter.checkGlobalRateLimit();

    if (!senderLimit.allowed) {
      // sender hit their limit, push to next hour
      const nextTime = rateLimiter.getNextAvailableTime(new Date());
      throw new Error(
        `Sender rate limit exceeded. Rescheduling to ${nextTime.toISOString()}`
      );
    }

    if (!globalLimit.allowed) {
      // global limit reached, delay this job
      const nextTime = rateLimiter.getNextAvailableTime(new Date());
      throw new Error(
        `Global rate limit exceeded. Rescheduling to ${nextTime.toISOString()}`
      );
    }

    // wait a bit between sends so we don't spam the smtp server
    await applyDelay(config.worker.delayBetweenSendMs);

    // need to convert attachments from base64 to Buffer for nodemailer
    const emailAttachments = attachments?.map(att => ({
      filename: att.filename,
      content: Buffer.from(att.content, 'base64'),
      contentType: att.contentType,
    }));

    // alright let's actually send this thing
    const result = await sendEmail({
      from: senderEmail,
      to: recipientEmail,
      subject,
      html: body,
      attachments: emailAttachments,
    });

    // cool it worked, update the db
    if (result.success) {
      // mark this email as sent
      await emailRepository.update(emailId, {
        status: "sent",
        sentAt: new Date(),
        jobId: job.id,
      });

      // save it to sent emails table for history
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

      // now update the batch stats and see if we're done
      const scheduledRepository = AppDataSource.getRepository(ScheduledEmail);
      
      // grab the current state first
      const scheduledEmail = await scheduledRepository.findOne({
        where: { id: scheduledEmailId },
      });

      if (scheduledEmail) {
        const totalEmails = scheduledEmail.recipientEmails.length;
        const newSentCount = scheduledEmail.sentCount + 1;
        const completedCount = newSentCount + scheduledEmail.failedCount;

        // update everything in one go
        if (completedCount >= totalEmails) {
          // yay all done! mark batch as completed
          await scheduledRepository.update(scheduledEmailId, {
            sentCount: newSentCount,
            status: "completed",
            completedAt: new Date(),
          });
          console.log(`✅ Scheduled email batch completed: ${scheduledEmailId} (${newSentCount}/${totalEmails} sent)`);
        } else {
          // still got more to send, just increment the counter
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

    // check if this failed bc of rate limit, if so we'll try again later
    if (errorMessage.includes("rate limit")) {
      const match = errorMessage.match(/Rescheduling to (.+)$/);
      if (match && match[1]) {
        const nextTime = new Date(match[1]);
        const delay = Math.max(0, nextTime.getTime() - Date.now());

        // throw it back in the queue with a delay
        const emailQueue = getEmailQueue();
        await emailQueue.add("send", job.data, {
          delay,
          jobId: `${job.data.emailId}-retry-${Date.now()}`,
        });

        console.log(`⏱️  Email rescheduled due to rate limit: ${job.data.emailId}`);
        return;
      }
    }

    // welp this one failed, mark it
    const emailRepository = AppDataSource.getRepository(Email);
    const sentEmailRepository = AppDataSource.getRepository(SentEmail);

    await emailRepository.update(emailId, {
      status: "failed",
      errorMessage,
      jobId: job.id,
    });

    // still need to save it for the audit trail
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

    // update the batch stats even for failures
    const scheduledRepository = AppDataSource.getRepository(ScheduledEmail);
    
    // get the latest numbers
    const scheduledEmail = await scheduledRepository.findOne({
      where: { id: scheduledEmailId },
    });

    if (scheduledEmail) {
      const totalEmails = scheduledEmail.recipientEmails.length;
      const newFailedCount = scheduledEmail.failedCount + 1;
      const completedCount = scheduledEmail.sentCount + newFailedCount;

      // update fail count and check if we're done
      if (completedCount >= totalEmails) {
        // batch is done (even with some failures)
        await scheduledRepository.update(scheduledEmailId, {
          failedCount: newFailedCount,
          status: "completed",
          completedAt: new Date(),
        });
        console.log(`✅ Scheduled email batch completed (with failures): ${scheduledEmailId} (${scheduledEmail.sentCount}/${totalEmails} sent, ${newFailedCount} failed)`);
      } else {
        // more emails to go, just bump the fail counter
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
