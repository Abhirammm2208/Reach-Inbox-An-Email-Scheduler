import express from "express";
import cors from "cors";
import { initializeDatabase } from "./db/connection";
import { initializeEmailService } from "./services/email.service";
import { createEmailWorker } from "./scheduler/worker";
import { schedulerService } from "./scheduler/schedulerService";
import routes from "./api/routes";
import { config } from "./config";

const app = express();

// middleware setup
app.use(cors({ origin: config.server.corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// all the main api routes
app.use("/api", routes);

// start the whole thing up
async function start(): Promise<void> {
  try {
    // connect to the database first
    await initializeDatabase();

    // setup email service
    await initializeEmailService();

    // fire up the worker to process email jobs
    console.log("🚀 Starting email worker...");
    const worker = createEmailWorker();

    // start the scheduler that checks for pending emails
    console.log("🚀 Starting scheduler service...");
    schedulerService.start();

    // start the express server
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

// handle graceful shutdown when i ctrl+c
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  schedulerService.stop();
  process.exit(0);
});

start();
