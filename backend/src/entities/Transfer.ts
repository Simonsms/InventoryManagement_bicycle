import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Store } from './Store';
import { User } from './User';
import { TransferItem } from './TransferItem';

export type TransferType = 'physical_transfer' | 'book_adjustment';
export type TransferStatus = 'pending' | 'approved' | 'in_transit' | 'rejected' | 'completed';

@Entity('transfers')
export class Transfer {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Store)
  @JoinColumn({ name: 'from_store_id' })
  fromStore: Store;

  @Column({ name: 'from_store_id' })
  fromStoreId: number;

  @ManyToOne(() => Store)
  @JoinColumn({ name: 'to_store_id' })
  toStore: Store;

  @Column({ name: 'to_store_id' })
  toStoreId: number;

  @Column({ name: 'type', default: 'physical_transfer' })
  type: TransferType;

  @Column({ name: 'status', default: 'pending' })
  status: TransferStatus;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requested_by' })
  requester: User;

  @Column({ name: 'requested_by' })
  requestedBy: number;

  @Column({ name: 'approved_by', type: 'int', nullable: true })
  approvedBy: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approver: User | null;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'shipped_by', type: 'int', nullable: true })
  shippedBy: number | null;

  @Column({ name: 'shipped_at', type: 'timestamp', nullable: true })
  shippedAt: Date | null;

  @Column({ name: 'received_by', type: 'int', nullable: true })
  receivedBy: number | null;

  @Column({ name: 'received_at', type: 'timestamp', nullable: true })
  receivedAt: Date | null;

  @Column({ name: 'completed_by', type: 'int', nullable: true })
  completedBy: number | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'self_approved_exception', type: 'boolean', default: false })
  selfApprovedException: boolean;

  @Column({ name: 'reason_code', type: 'varchar', nullable: true })
  reasonCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => TransferItem, (item) => item.transfer)
  items: TransferItem[];
}
