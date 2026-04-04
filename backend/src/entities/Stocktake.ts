import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Store } from './Store';
import { User } from './User';

export type StocktakeStatus = 'open' | 'completed';

@Entity('stocktakes')
export class Stocktake {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'store_id' })
  storeId: number;

  @ManyToOne(() => Store)
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column({ default: 'open' })
  status: StocktakeStatus;

  @Column({ name: 'created_by' })
  createdBy: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @Column({ name: 'completed_by', type: 'int', nullable: true })
  completedBy: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'completed_by' })
  completer: User | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;
}
