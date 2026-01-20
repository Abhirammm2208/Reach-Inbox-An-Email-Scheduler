import express from "express";
import cors from "cors";
import { initializeDatabase } from "./db/connection";
import { initializeEmailService } from "./services/email.service";
import { createEmailWorker } from "./scheduler/worker";
import { schedulerService } from "./scheduler/schedulerService";
import routes from "./api/routes";
import { config } from "./config";

const app = express();

// Middleware
app.use(cors({ origin: config.server.corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api", routes);

// Start server
async function start(): Promise<void> {
  try {
    // Initialize database
    await initializeDatabase();

    // Initialize email service
    await initializeEmailService();

    // Start worker in background
    console.log("🚀 Starting email worker...");
    const worker = createEmailWorker();

    // Start scheduler service
    console.log("🚀 Starting scheduler service...");
    schedulerService.start();

    // Start server
    app.listen(config.server.port, () => {
      console.log(`🚀 Server running on http://localhost:${config.server.port}`);
      console.log(`📧 Worker concurrency: ${config.worker.concurrency}`);
      console.log(`⏱️  Delay between sends: ${config.worker.delayBetweenSendMs}ms`);
      console.log(
        `📊 Rate limit per sender: ${config.rateLimit.maxEmailsPerHourPerSender}/hour`
      );
      console.log(`📊 Global rate limit: ${config.rateLimit.maxEmailsPerHour}/hour`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  schedulerService.stop();
  process.exit(0);
});

start();
