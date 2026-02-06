import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from "typeorm";
import { User } from "./User";

export enum Frequency {
  MONTHLY = "MONTHLY",
  WEEKLY = "WEEKLY",
  YEARLY = "YEARLY"
}

@Entity()
@Index(["userId"])
export class Bill {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  userId!: string;

  @ManyToOne(() => User, (user) => user.id, { onDelete: "CASCADE" })
  user!: User;

  @Column()
  name!: string;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  amount!: string | null;

  @Column({ type: "varchar", length: 8, nullable: true })
  currency!: string | null;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column()
  isRecurring!: boolean;

  @Column({ type: "enum", enum: Frequency, nullable: true })
  frequency!: Frequency | null;

  @Column({ type: "datetime" })
  dueDate!: Date;

  @Column({ type: "datetime", nullable: true })
  paidAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
