import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Store } from './Store';
import { User } from './User';
import { TransferItem } from './TransferItem';

export type TransferStatus = 'pending' | 'approved' | 'rejected' | 'completed';

@Entity('transfers')
export class Transfer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fromStoreId: number;

  @ManyToOne(() => Store)
  @JoinColumn({ name: 'from_store_id' })
  fromStore: Store;

  @Column()
  toStoreId: number;

  @ManyToOne(() => Store)
  @JoinColumn({ name: 'to_store_id' })
  toStore: Store;

  @Column({ default: 'pending' })
  status: TransferStatus;

  @Column()
  requestedBy: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requested_by' })
  requester: User;

  @Column({ type: 'int', nullable: true })
  approvedBy: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approver: User | null;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => TransferItem, (item) => item.transfer)
  items: TransferItem[];
}
