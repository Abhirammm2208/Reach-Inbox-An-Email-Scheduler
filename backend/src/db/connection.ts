import { DataSource } from "typeorm";
import { config } from "../config";
import { Email } from "./entities/Email";
import { ScheduledEmail } from "./entities/ScheduledEmail";
import { SentEmail } from "./entities/SentEmail";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: config.database.url,
  synchronize: true,
  logging: false,
  entities: [Email, ScheduledEmail, SentEmail],
  migrations: ["src/db/migrations/*.ts"],
  subscribers: [],
});

export async function initializeDatabase(): Promise<void> {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log("✅ Database connection established");
    }
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    console.log("✅ Database connection closed");
  }
}
