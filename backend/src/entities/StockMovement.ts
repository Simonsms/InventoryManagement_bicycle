import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Store } from './Store';
import { Product } from './Product';
import { InventoryBatch } from './InventoryBatch';
import { User } from './User';

export type MovementType = 'in' | 'out' | 'transfer_in' | 'transfer_out' | 'adjust';

@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  storeId: number;

  @ManyToOne(() => Store)
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column()
  productId: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'int', nullable: true })
  batchId: number | null;

  @ManyToOne(() => InventoryBatch, { nullable: true })
  @JoinColumn({ name: 'batch_id' })
  batch: InventoryBatch | null;

  @Column()
  type: MovementType;

  @Column()
  quantity: number;

  @Column({ type: 'varchar', nullable: true })
  referenceNo: string | null;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  @Column()
  operatedBy: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'operated_by' })
  operator: User;

  @CreateDateColumn()
  createdAt: Date;
}
