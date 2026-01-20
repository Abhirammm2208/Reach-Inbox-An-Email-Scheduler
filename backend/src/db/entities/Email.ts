import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("emails")
export class Email {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  recipientEmail!: string;

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

  @Column({ nullable: true })
  scheduledEmailId?: string;

  @Column({ nullable: true })
  jobId?: string;

  @Column({
    type: "enum",
    enum: ["pending", "sent", "failed"],
    default: "pending",
  })
  status!: "pending" | "sent" | "failed";

  @Column({ nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ nullable: true })
  sentAt?: Date;
}
