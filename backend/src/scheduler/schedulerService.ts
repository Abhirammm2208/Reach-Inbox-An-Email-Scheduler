import { AppDataSource } from "../db/connection";
import { ScheduledEmail } from "../db/entities/ScheduledEmail";
import { Email } from "../db/entities/Email";
import { getEmailQueue } from "./queue";
import { LessThanOrEqual } from "typeorm";

class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 60 * 1000; // Check every 1 minute

  /**
   * Start the scheduler service
   */
  start() {
    if (this.intervalId) {
      console.log("⚠️ Scheduler is already running");
      return;
    }

    console.log("🕐 Starting scheduler service...");
    
    // Run immediately on start
    this.checkAndQueueEmails();
    
    // Then run every minute
    this.intervalId = setInterval(() => {
      this.checkAndQueueEmails();
    }, this.CHECK_INTERVAL);

    console.log("✅ Scheduler service started");
  }

  /**
   * Stop the scheduler service
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("⏹️ Scheduler service stopped");
    }
  }

  /**
   * Check for scheduled emails that need to be queued
   */
  private async checkAndQueueEmails() {
    try {
      const scheduledRepository = AppDataSource.getRepository(ScheduledEmail);
      const emailRepository = AppDataSource.getRepository(Email);
      const emailQueue = getEmailQueue();

      // Find scheduled emails that:
      // 1. Are pending
      // 2. Have a scheduledAt time that has passed or is within the next minute
      const now = new Date();
      const oneMinuteFromNow = new Date(now.getTime() + this.CHECK_INTERVAL);

      const dueScheduledEmails = await scheduledRepository.find({
        where: {
          status: "pending",
          scheduledAt: LessThanOrEqual(oneMinuteFromNow),
        },
      });

      if (dueScheduledEmails.length === 0) {
        return; // No emails to process
      }

      console.log(`📬 Found ${dueScheduledEmails.length} scheduled email batch(es) ready to queue`);

      for (const scheduledEmail of dueScheduledEmails) {
        try {
          // Find all pending emails for this scheduled batch
          const pendingEmails = await emailRepository.find({
            where: {
              scheduledEmailId: scheduledEmail.id,
              status: "pending",
            },
          });

          if (pendingEmails.length === 0) {
            // Mark as completed if no pending emails
            scheduledEmail.status = "completed";
            scheduledEmail.completedAt = new Date();
            await scheduledRepository.save(scheduledEmail);
            continue;
          }

          // Calculate delay from scheduled time (not from now)
          const scheduledTime = new Date(scheduledEmail.scheduledAt).getTime();
          const baseDelay = Math.max(0, scheduledTime - Date.now());

          console.log(`📤 Queueing ${pendingEmails.length} emails for batch ${scheduledEmail.id}`);

          // Queue all emails with staggered delays
          for (let i = 0; i < pendingEmails.length; i++) {
            const email = pendingEmails[i];
            const jobDelay = baseDelay + (i * scheduledEmail.delayBetweenSendMs);

            await emailQueue.add(
              "send",
              {
                emailId: email.id,
                scheduledEmailId: scheduledEmail.id,
                senderEmail: email.senderEmail,
                recipientEmail: email.recipientEmail,
                subject: email.subject,
                body: email.body,
                attachments: email.attachments,
              },
              {
                delay: jobDelay,
                jobId: `${email.id}-${Date.now()}`,
                removeOnComplete: true,
                removeOnFail: false,
              }
            );
          }

          // Update status to processing (it's now queued)
          scheduledEmail.status = "processing";
          await scheduledRepository.save(scheduledEmail);

          console.log(`✅ Successfully queued batch ${scheduledEmail.id} with ${pendingEmails.length} emails`);
        } catch (error) {
          console.error(`❌ Error processing scheduled batch ${scheduledEmail.id}:`, error);
        }
      }
    } catch (error) {
      console.error("❌ Error in scheduler service:", error);
    }
  }
}

// Export singleton instance
export const schedulerService = new SchedulerService();
