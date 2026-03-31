import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Category } from './Category';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  categoryId: number;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column()
  name: string;

  @Column()
  brand: string;

  @Column({ type: 'varchar', nullable: true })
  modelNumber: string | null;

  @Column({ type: 'jsonb', default: {} })
  specs: Record<string, unknown>;

  @Column({ type: 'int', nullable: true })
  warrantyMonths: number | null;

  @Column({ default: 2 })
  lowStockThreshold: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
