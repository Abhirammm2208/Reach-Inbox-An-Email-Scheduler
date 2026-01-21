import { Queue, Worker, QueueOptions } from "bullmq";
import Redis from "ioredis";
import { config } from "../config";

let redis: Redis;
let emailQueue: Queue;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    redis.on("error", (err) => {
      console.error("❌ Redis error:", err);
    });
    redis.on("connect", () => {
      console.log("✅ Redis connected");
    });
  }
  return redis;
}

export function getEmailQueue(): Queue {
  if (!emailQueue) {
    const queueOptions: QueueOptions = {
      connection: {
        host: config.redis.url.includes('@') ? (config.redis.url.split('@')[1]?.split(':')[0] || 'localhost') : 'localhost',
        port: config.redis.url.includes(':') ? parseInt(config.redis.url.split(':').pop() || '6379') : 6379,
        password: config.redis.url.includes(':') ? config.redis.url.split(':')[2]?.split('@')[0] : undefined,
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    };
    emailQueue = new Queue("emails", queueOptions);

    // listen for errors
    emailQueue.on("error", (err) => {
      console.error("❌ Queue error:", err);
    });
  }
  return emailQueue;
}

export async function closeQueue(): Promise<void> {
  if (emailQueue) {
    await emailQueue.close();
    console.log("✅ Email queue closed");
  }
  if (redis) {
    await redis.quit();
    console.log("✅ Redis connection closed");
  }
}
