import { AppDataSource } from "../db/connection";
import { ScheduledEmail } from "../db/entities/ScheduledEmail";
import { Email } from "../db/entities/Email";
import { getEmailQueue } from "./queue";
import { LessThanOrEqual } from "typeorm";

class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 60 * 1000; // checking every minute if anything needs to go out

  // kick off the scheduler
  start() {
    if (this.intervalId) {
      console.log("⚠️ Scheduler is already running");
      return;
    }

    console.log("🕐 Starting scheduler service...");
    
    // run it right away first time
    this.checkAndQueueEmails();
    
    // then keep checking every minute
    this.intervalId = setInterval(() => {
      this.checkAndQueueEmails();
    }, this.CHECK_INTERVAL);

    console.log("✅ Scheduler service started");
  }

  // shut it down cleanly
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("⏹️ Scheduler service stopped");
    }
  }

  // this is where we check what needs to be sent
  private async checkAndQueueEmails() {
    try {
      const scheduledRepository = AppDataSource.getRepository(ScheduledEmail);
      const emailRepository = AppDataSource.getRepository(Email);
      const emailQueue = getEmailQueue();

      // looking for emails that need to go out:
      // - still pending
      // - time has come (or coming up in next minute)
      const now = new Date();
      const oneMinuteFromNow = new Date(now.getTime() + this.CHECK_INTERVAL);

      const dueScheduledEmails = await scheduledRepository.find({
        where: {
          status: "pending",
          scheduledAt: LessThanOrEqual(oneMinuteFromNow),
        },
      });

      if (dueScheduledEmails.length === 0) {
        return; // nothing to do right now
      }

      console.log(`📬 Found ${dueScheduledEmails.length} scheduled email batch(es) ready to queue`);

      for (const scheduledEmail of dueScheduledEmails) {
        try {
          // grab all the emails that haven't been sent yet for this batch
          const pendingEmails = await emailRepository.find({
            where: {
              scheduledEmailId: scheduledEmail.id,
              status: "pending",
            },
          });

          if (pendingEmails.length === 0) {
            // weird, no emails left? mark batch as done i guess
            scheduledEmail.status = "completed";
            scheduledEmail.completedAt = new Date();
            await scheduledRepository.save(scheduledEmail);
            continue;
          }

          // figure out how much to delay based on scheduled time
          const scheduledTime = new Date(scheduledEmail.scheduledAt).getTime();
          const baseDelay = Math.max(0, scheduledTime - Date.now());

          console.log(`📤 Queueing ${pendingEmails.length} emails for batch ${scheduledEmail.id}`);

          // add all emails to queue with small delays between each
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

          // mark it as processing so we don't queue it again
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

// just use this one instance everywhere
export const schedulerService = new SchedulerService();
