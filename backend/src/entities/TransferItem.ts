import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Transfer } from './Transfer';
import { Product } from './Product';

@Entity('transfer_items')
export class TransferItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  transferId: number;

  @ManyToOne(() => Transfer)
  @JoinColumn({ name: 'transfer_id' })
  transfer: Transfer;

  @Column()
  productId: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column()
  quantity: number;
}
