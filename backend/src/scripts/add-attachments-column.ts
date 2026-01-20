import { AppDataSource } from "../db/connection";

async function addAttachmentsColumn() {
  try {
    await AppDataSource.initialize();
    console.log("✅ Database connected");

    // Run raw SQL to add the column if it doesn't exist
    await AppDataSource.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'sent_emails' AND column_name = 'attachments'
        ) THEN
          ALTER TABLE sent_emails ADD COLUMN attachments text;
        END IF;
      END $$;
    `);

    console.log("✅ Added attachments column to sent_emails table");

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

addAttachmentsColumn();
