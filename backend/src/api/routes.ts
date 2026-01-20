import { Router, Request, Response } from "express";
import { AppDataSource } from "../db/connection";
import { Email } from "../db/entities/Email";
import { ScheduledEmail } from "../db/entities/ScheduledEmail";
import { SentEmail } from "../db/entities/SentEmail";
import { getEmailQueue } from "../scheduler/queue";
import { rateLimiter } from "../scheduler/rateLimit";
import { v4 as uuidv4 } from "uuid";

const router = Router();

interface ScheduleEmailRequest {
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

/**
 * Schedule emails to be sent at a specific time
 */
router.post("/schedule", async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      subject,
      body,
      emails,
      senderEmail,
      startTime,
      delayBetweenSends = 2000,
      hourlyLimit,
      attachments,
    }: ScheduleEmailRequest = req.body;

    // Validate input
    if (!subject || !body || !emails || emails.length === 0 || !senderEmail || !startTime) {
      return res.status(400).json({
        error: "Missing required fields: subject, body, emails, senderEmail, startTime",
      });
    }

    if (emails.length === 0) {
      return res.status(400).json({ error: "At least one email is required" });
    }

    const scheduledAtTime = new Date(startTime);
    if (isNaN(scheduledAtTime.getTime())) {
      return res.status(400).json({ error: "Invalid startTime format" });
    }

    const emailRepository = AppDataSource.getRepository(Email);
    const scheduledRepository = AppDataSource.getRepository(ScheduledEmail);

    // Create scheduled email record
    const scheduledEmail = scheduledRepository.create({
      senderEmail,
      subject,
      body,
      recipientEmails: emails,
      scheduledAt: scheduledAtTime,
      delayBetweenSendMs: delayBetweenSends,
      hourlyLimit,
      status: "pending",
      attachments,
    });

    const savedScheduled = await scheduledRepository.save(scheduledEmail);

    // Create email records (but don't queue them yet)
    // The scheduler service will queue them when the time arrives
    for (let i = 0; i < emails.length; i++) {
      const email = emailRepository.create({
        recipientEmail: emails[i],
        senderEmail,
        subject,
        body,
        status: "pending",
        attachments,
        scheduledEmailId: savedScheduled.id, // Link to scheduled email
      });

      await emailRepository.save(email);

      console.log(
        `📧 Scheduled email to ${emails[i]} for ${scheduledAtTime.toISOString()}`
      );
    }

    res.status(200).json({
      success: true,
      scheduledEmailId: savedScheduled.id,
      totalEmails: emails.length,
      scheduledAt: scheduledAtTime.toISOString(),
      message: `Successfully scheduled ${emails.length} emails`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Schedule error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * Send emails immediately (no scheduling)
 */
router.post("/send", async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      subject,
      body,
      emails,
      senderEmail,
      delayBetweenSends = 2000,
      attachments,
    }: Omit<ScheduleEmailRequest, 'startTime'> = req.body;

    // Validate input
    if (!subject || !body || !emails || emails.length === 0 || !senderEmail) {
      return res.status(400).json({
        error: "Missing required fields: subject, body, emails, senderEmail",
      });
    }

    const emailRepository = AppDataSource.getRepository(Email);
    const scheduledRepository = AppDataSource.getRepository(ScheduledEmail);
    const emailQueue = getEmailQueue();

    // Create scheduled email record with immediate send time
    const scheduledEmail = scheduledRepository.create({
      senderEmail,
      subject,
      body,
      recipientEmails: emails,
      scheduledAt: new Date(), // Send now
      delayBetweenSendMs: delayBetweenSends,
      status: "pending",
      attachments,
    });

    const savedScheduled = await scheduledRepository.save(scheduledEmail);

    // Create email records and queue jobs immediately
    for (let i = 0; i < emails.length; i++) {
      const email = emailRepository.create({
        recipientEmail: emails[i],
        senderEmail,
        subject,
        body,
        status: "pending",
        scheduledEmailId: savedScheduled.id,
        attachments,
      });

      // Save email record first to get ID
      const savedEmail = await emailRepository.save(email);

      // Queue job with minimal delay (immediate + stagger)
      const jobDelay = i * delayBetweenSends;

      await emailQueue.add(
        "send",
        {
          emailId: savedEmail.id,
          scheduledEmailId: savedScheduled.id,
          senderEmail,
          recipientEmail: emails[i],
          subject,
          body,
          attachments,
        },
        {
          delay: jobDelay,
          jobId: `${savedEmail.id}-${Date.now()}`,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      console.log(`📧 Queued immediate email to ${emails[i]}`);
    }

    res.status(200).json({
      success: true,
      scheduledEmailId: savedScheduled.id,
      totalEmails: emails.length,
      message: `Successfully queued ${emails.length} emails for immediate sending`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Send error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * Get scheduled emails (pending/processing)
 */
router.get("/scheduled", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const scheduledRepository = AppDataSource.getRepository(ScheduledEmail);
    const { In } = await import("typeorm");

    const [data, total] = await scheduledRepository.findAndCount({
      where: { 
        status: In(["pending", "processing", "completed"])
      },
      order: { scheduledAt: "DESC" },
      take: limit,
      skip: offset,
    });

    // Get email counts for each scheduled batch
    const emailRepository = AppDataSource.getRepository(Email);
    const scheduledWithCounts = await Promise.all(
      data.map(async (scheduled) => {
        const [, emailCount] = await emailRepository.findAndCount({
          where: { jobId: undefined },
        });

        return {
          ...scheduled,
          totalEmails: scheduled.recipientEmails.length,
        };
      })
    );

    res.json({
      data: scheduledWithCounts,
      total,
      limit,
      offset,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Get scheduled error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * Get sent emails
 */
router.get("/sent", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const sentRepository = AppDataSource.getRepository(SentEmail);

    const [data, total] = await sentRepository.findAndCount({
      order: { sentAt: "DESC" },
      take: limit,
      skip: offset,
    });

    res.json({
      data,
      total,
      limit,
      offset,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Get sent error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * Get statistics
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const emailRepository = AppDataSource.getRepository(Email);
    const sentRepository = AppDataSource.getRepository(SentEmail);
    const scheduledRepository = AppDataSource.getRepository(ScheduledEmail);

    const [, totalEmails] = await emailRepository.findAndCount();
    const [, sentCount] = await sentRepository.findAndCount({
      where: { status: "sent" },
    });
    const [, failedCount] = await sentRepository.findAndCount({
      where: { status: "failed" },
    });
    const [, pendingScheduled] = await scheduledRepository.findAndCount({
      where: { status: "pending" },
    });

    res.json({
      totalEmailsCreated: totalEmails,
      emailsSent: sentCount,
      emailsFailed: failedCount,
      pendingSchedules: pendingScheduled,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Stats error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * Get pending emails (not yet sent)
 */
router.get("/pending", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const emailRepository = AppDataSource.getRepository(Email);

    const [data, total] = await emailRepository.findAndCount({
      where: { status: "pending" },
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset,
    });

    res.json({
      data,
      total,
      limit,
      offset,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Get pending error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * Get email statistics (counts for scheduled, sent, failed)
 */
router.get("/stats", async (req: Request, res: Response): Promise<any> => {
  try {
    const emailRepository = AppDataSource.getRepository(Email);
    const scheduledEmailRepository = AppDataSource.getRepository(ScheduledEmail);

    // Get sent count (status = 'sent')
    const sentCount = await emailRepository.count({
      where: { status: "sent" },
    });

    // Get failed count
    const failedCount = await emailRepository.count({
      where: { status: "failed" },
    });

    // Get scheduled batches count
    const scheduledCount = await scheduledEmailRepository.count({
      where: { status: "pending" },
    });

    // Get processing scheduled batches
    const processingCount = await scheduledEmailRepository.count({
      where: { status: "processing" },
    });

    // Get completed scheduled batches
    const completedScheduledCount = await scheduledEmailRepository.count({
      where: { status: "completed" },
    });

    res.json({
      sent: sentCount,
      failed: failedCount,
      scheduled: scheduledCount + processingCount,
      completedScheduled: completedScheduledCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Get stats error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
