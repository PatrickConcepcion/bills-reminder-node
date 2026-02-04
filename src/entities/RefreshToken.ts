import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index
} from "typeorm";
import { User } from "./User";

@Entity()
@Index(["userId", "isRevoked"])
@Index(["familyId"])
@Index(["expiresAt"])
export class RefreshToken {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user!: User;

  @Column({ unique: true })
  sessionId!: string;

  @Column()
  familyId!: string;

  @Column({ unique: true })
  tokenHash!: string;

  @Column({ type: "datetime" })
  expiresAt!: Date;

  @Column({ default: false })
  isRevoked!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
