import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("scheduled_emails")
export class ScheduledEmail {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  senderEmail!: string;

  @Column()
  subject!: string;

  @Column("text")
  body!: string;

  @Column("simple-json", { nullable: true })
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
    size: number;
  }>;

  @Column("simple-array")
  recipientEmails!: string[];

  @Column()
  scheduledAt!: Date;

  @Column({ nullable: true })
  startedAt?: Date;

  @Column({ nullable: true })
  completedAt?: Date;

  @Column({
    type: "enum",
    enum: ["pending", "processing", "completed", "failed"],
    default: "pending",
  })
  status!: "pending" | "processing" | "completed" | "failed";

  @Column({ default: 2000 })
  delayBetweenSendMs!: number;

  @Column({ nullable: true })
  hourlyLimit?: number;

  @Column({ default: 0 })
  sentCount!: number;

  @Column({ default: 0 })
  failedCount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
