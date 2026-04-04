import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, UpdateDateColumn, Unique } from 'typeorm';
import { Store } from './Store';
import { Product } from './Product';

@Entity('inventory')
@Unique(['store', 'product'])
export class Inventory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Store)
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column({ name: 'store_id' })
  storeId: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'product_id' })
  productId: number;

  @Column({ default: 0 })
  quantity: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
