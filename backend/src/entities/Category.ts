import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ name: 'parent_id', type: 'int', nullable: true })
  parentId: number | null;

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Category | null;
}
