import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Inventory } from './Inventory';

@Entity('inventory_batches')
export class InventoryBatch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  inventoryId: number;

  @ManyToOne(() => Inventory)
  @JoinColumn({ name: 'inventory_id' })
  inventory: Inventory;

  @Column()
  batchNo: string;

  @Column()
  quantity: number;

  @Column({ type: 'date' })
  purchaseDate: string;

  @Column({ type: 'date', nullable: true })
  expiryDate: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  costPrice: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
