import Redis from "ioredis";
import { getRedis } from "./queue";
import { config } from "../config";

interface RateLimitResult {
  allowed: boolean;
  remainingInWindow: number;
  resetTime: Date;
}

export class RateLimiter {
  private redis: Redis;

  constructor() {
    this.redis = getRedis();
  }

  // check if this sender can send another email right now
  async checkRateLimit(senderEmail: string): Promise<RateLimitResult> {
    const now = new Date();
    const hourWindow = this.getHourWindow(now);
    const key = `rate_limit:${senderEmail}:${hourWindow}`;

    // see how many they've sent this hour
    const currentCount = await this.redis.get(key);
    const count = currentCount ? parseInt(currentCount, 10) : 0;

    const maxPerSender = config.rateLimit.maxEmailsPerHourPerSender;

    if (count < maxPerSender) {
      // they're good, bump the counter
      await this.redis.incr(key);
      await this.redis.expire(key, 3600); // expires in an hour

      // tell them how many they have left
      const resetTime = new Date(now);
      resetTime.setHours(resetTime.getHours() + 1);
      resetTime.setMinutes(0, 0, 0);

      return {
        allowed: true,
        remainingInWindow: maxPerSender - count - 1,
        resetTime,
      };
    }

    const resetTime = new Date(now);
    resetTime.setHours(resetTime.getHours() + 1);
    resetTime.setMinutes(0, 0, 0);

    return {
      allowed: false,
      remainingInWindow: 0,
      resetTime,
    };
  }

  // check the global limit across all senders
  async checkGlobalRateLimit(): Promise<RateLimitResult> {
    const now = new Date();
    const hourWindow = this.getHourWindow(now);
    const key = `rate_limit:global:${hourWindow}`;

    const currentCount = await this.redis.get(key);
    const count = currentCount ? parseInt(currentCount, 10) : 0;

    const maxGlobal = config.rateLimit.maxEmailsPerHour;

    if (count < maxGlobal) {
      await this.redis.incr(key);
      await this.redis.expire(key, 3600);

      const resetTime = new Date(now);
      resetTime.setHours(resetTime.getHours() + 1);
      resetTime.setMinutes(0, 0, 0);

      return {
        allowed: true,
        remainingInWindow: maxGlobal - count - 1,
        resetTime,
      };
    }

    const resetTime = new Date(now);
    resetTime.setHours(resetTime.getHours() + 1);
    resetTime.setMinutes(0, 0, 0);

    return {
      allowed: false,
      remainingInWindow: 0,
      resetTime,
    };
  }

  // figure out when they can try again
  getNextAvailableTime(currentTime: Date): Date {
    const next = new Date(currentTime);
    next.setHours(next.getHours() + 1);
    next.setMinutes(0, 1, 0); // start of next hour plus a min
    return next;
  }

  // make a key for the current hour bucket (like 2026-01-20-15 for 3pm)
  private getHourWindow(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hour = String(date.getUTCHours()).padStart(2, "0");
    return `${year}-${month}-${day}-${hour}`;
  }

  // grab current stats for a sender (useful for debugging)
  async getStats(senderEmail: string): Promise<{
    sentThisHour: number;
    remainingThisHour: number;
    hourResetTime: Date;
  }> {
    const now = new Date();
    const hourWindow = this.getHourWindow(now);
    const key = `rate_limit:${senderEmail}:${hourWindow}`;

    const currentCount = await this.redis.get(key);
    const count = currentCount ? parseInt(currentCount, 10) : 0;

    const resetTime = new Date(now);
    resetTime.setHours(resetTime.getHours() + 1);
    resetTime.setMinutes(0, 0, 0);

    return {
      sentThisHour: count,
      remainingThisHour: Math.max(0, config.rateLimit.maxEmailsPerHourPerSender - count),
      hourResetTime: resetTime,
    };
  }
}

export const rateLimiter = new RateLimiter();
