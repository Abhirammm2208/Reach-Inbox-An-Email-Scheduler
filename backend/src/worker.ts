/**
 * Standalone worker process
 * Run this separately from the main server for horizontal scaling
 */
import { initializeDatabase } from "./db/connection";
import { initializeEmailService } from "./services/email.service";
import { createEmailWorker } from "./scheduler/worker";

async function startWorker(): Promise<void> {
  try {
    console.log("🚀 Starting email worker process...");

    // Initialize database
    await initializeDatabase();

    // Initialize email service
    await initializeEmailService();

    // Start worker
    const worker = createEmailWorker();

    console.log("✅ Email worker started and listening for jobs");

    // Graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n🛑 Shutting down worker...");
      await worker.close();
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Failed to start worker:", error);
    process.exit(1);
  }
}

startWorker();
