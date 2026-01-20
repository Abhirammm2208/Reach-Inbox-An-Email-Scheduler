import { AppDataSource } from "../db/connection";
import { ScheduledEmail } from "../db/entities/ScheduledEmail";

async function fixCompletedStatus() {
  try {
    // Initialize database connection
    await AppDataSource.initialize();
    console.log("✅ Database connected");

    const scheduledRepository = AppDataSource.getRepository(ScheduledEmail);

    // Find all scheduled emails that are marked as pending or processing
    // but have all emails sent/failed
    const scheduledEmails = await scheduledRepository.find({
      where: [
        { status: "pending" },
        { status: "processing" },
      ],
    });

    console.log(`Found ${scheduledEmails.length} scheduled emails to check`);

    let fixedCount = 0;

    for (const scheduled of scheduledEmails) {
      const totalEmails = scheduled.recipientEmails.length;
      const completedCount = scheduled.sentCount + scheduled.failedCount;

      if (completedCount >= totalEmails) {
        // This scheduled email should be marked as completed
        await scheduledRepository.update(scheduled.id, {
          status: "completed",
          completedAt: scheduled.completedAt || new Date(),
        });

        console.log(
          `✅ Fixed: ${scheduled.subject} (${scheduled.sentCount}/${totalEmails} sent, ${scheduled.failedCount} failed)`
        );
        fixedCount++;
      }
    }

    console.log(`\n✅ Fixed ${fixedCount} scheduled emails`);
    await AppDataSource.destroy();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

fixCompletedStatus();
