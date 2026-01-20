import dotenv from "dotenv";

dotenv.config();

export const config = {
  database: {
    url: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/reachinbox",
  },
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  server: {
    port: parseInt(process.env.PORT || "3001", 10),
    nodeEnv: process.env.NODE_ENV || "development",
    corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  },
  email: {
    ethereal: {
      user: process.env.ETHEREAL_USER,
      pass: process.env.ETHEREAL_PASS,
    },
  },
  rateLimit: {
    maxEmailsPerHourPerSender: parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || "100", 10),
    maxEmailsPerHour: parseInt(process.env.MAX_EMAILS_PER_HOUR || "500", 10),
  },
  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || "2", 10),
    delayBetweenSendMs: parseInt(process.env.DELAY_BETWEEN_SENDS_MS || "2000", 10),
  },
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },
};

export default config;
