import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';
import { RoomParticipant } from './room-participant.entity';
import { Message } from './message.entity';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 16 })
  code: string;

  @Column({ length: 120 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'host_id' })
  hostId: string;

  @ManyToOne(() => User, (user) => user.hostedRooms, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'host_id' })
  host: User;

  @Column({ type: 'int', default: 10 })
  maxParticipants: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isPrivate: boolean;

  @Column({ nullable: true, select: false })
  passcodeHash: string;

  @OneToMany(() => RoomParticipant, (rp) => rp.room)
  participants: RoomParticipant[];

  @OneToMany(() => Message, (message) => message.room)
  messages: Message[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
