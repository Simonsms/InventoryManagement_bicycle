import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Stocktake } from './Stocktake';
import { Product } from './Product';

@Entity('stocktake_items')
export class StocktakeItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'stocktake_id' })
  stocktakeId: number;

  @ManyToOne(() => Stocktake)
  @JoinColumn({ name: 'stocktake_id' })
  stocktake: Stocktake;

  @Column({ name: 'product_id' })
  productId: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column()
  systemQty: number;

  @Column({ type: 'int', nullable: true })
  actualQty: number | null;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  get difference(): number | null {
    if (this.actualQty === null) return null;
    return this.actualQty - this.systemQty;
  }
}
