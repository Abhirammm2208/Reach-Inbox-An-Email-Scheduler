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

    // make sure we have everything we need
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

    // create the main scheduled email record
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

    // create individual email records - scheduler will queue them when it's time
    for (let i = 0; i < emails.length; i++) {
      const email = emailRepository.create({
        recipientEmail: emails[i],
        senderEmail,
        subject,
        body,
        status: "pending",
        attachments,
        scheduledEmailId: savedScheduled.id, // link to parent batch
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

// endpoint to send emails immediately (no scheduling)
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

    // make sure we have what we need
    if (!subject || !body || !emails || emails.length === 0 || !senderEmail) {
      return res.status(400).json({
        error: "Missing required fields: subject, body, emails, senderEmail",
      });
    }

    const emailRepository = AppDataSource.getRepository(Email);
    const scheduledRepository = AppDataSource.getRepository(ScheduledEmail);
    const emailQueue = getEmailQueue();

    // create scheduled record with send time = now
    const scheduledEmail = scheduledRepository.create({
      senderEmail,
      subject,
      body,
      recipientEmails: emails,
      scheduledAt: new Date(), // right now
      delayBetweenSendMs: delayBetweenSends,
      status: "pending",
      attachments,
    });

    const savedScheduled = await scheduledRepository.save(scheduledEmail);

    // queue everything immediately
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

      // save the record first so we have an id
      const savedEmail = await emailRepository.save(email);

      // add it to the queue with a stagger delay
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

// get scheduled emails (pending/processing)
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

    // get email counts for each scheduled batch
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

// get sent emails
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

// get stats for the dashboard
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

// get pending emails (haven't sent yet)
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

// another stats endpoint with different data
router.get("/stats", async (req: Request, res: Response): Promise<any> => {
  try {
    const emailRepository = AppDataSource.getRepository(Email);
    const scheduledEmailRepository = AppDataSource.getRepository(ScheduledEmail);

    // count how many got sent
    const sentCount = await emailRepository.count({
      where: { status: "sent" },
    });

    // count failures
    const failedCount = await emailRepository.count({
      where: { status: "failed" },
    });

    // count scheduled batches
    const scheduledCount = await scheduledEmailRepository.count({
      where: { status: "pending" },
    });

    // count ones currently processing
    const processingCount = await scheduledEmailRepository.count({
      where: { status: "processing" },
    });

    // count completed batches
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
