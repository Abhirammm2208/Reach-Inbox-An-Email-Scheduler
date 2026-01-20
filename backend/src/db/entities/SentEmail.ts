import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("sent_emails")
export class SentEmail {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  scheduledEmailId!: string;

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

  @Column({
    type: "enum",
    enum: ["sent", "failed"],
    default: "sent",
  })
  status!: "sent" | "failed";

  @Column({ nullable: true })
  errorMessage?: string;

  @Column({ nullable: true })
  etherealMessageUrl?: string;

  @CreateDateColumn()
  sentAt!: Date;
}
