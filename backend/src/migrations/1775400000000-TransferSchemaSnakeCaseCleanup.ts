import { MigrationInterface, QueryRunner } from 'typeorm';

export class TransferSchemaSnakeCaseCleanup1775400000000 implements MigrationInterface {
  name = 'TransferSchemaSnakeCaseCleanup1775400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.assertNoConflicts(queryRunner, 'transfer_items', 'transferId', 'transfer_id');
    await this.assertNoConflicts(queryRunner, 'transfer_items', 'productId', 'product_id');
    await this.assertNoConflicts(queryRunner, 'stock_movements', 'storeId', 'store_id');
    await this.assertNoConflicts(queryRunner, 'stock_movements', 'productId', 'product_id');
    await this.assertNoConflicts(queryRunner, 'stock_movements', 'batchId', 'batch_id');
    await this.assertNoConflicts(queryRunner, 'stock_movements', 'operatedBy', 'operated_by');
    await this.assertNoConflicts(queryRunner, 'inventory_batches', 'inventoryId', 'inventory_id');

    await this.backfillColumn(queryRunner, 'transfer_items', 'transfer_id', 'transferId');
    await this.backfillColumn(queryRunner, 'transfer_items', 'product_id', 'productId');
    await this.backfillColumn(queryRunner, 'stock_movements', 'store_id', 'storeId');
    await this.backfillColumn(queryRunner, 'stock_movements', 'product_id', 'productId');
    await this.backfillColumn(queryRunner, 'stock_movements', 'batch_id', 'batchId');
    await this.backfillColumn(queryRunner, 'stock_movements', 'operated_by', 'operatedBy');
    await this.backfillColumn(queryRunner, 'inventory_batches', 'inventory_id', 'inventoryId');

    await this.assertNoNulls(queryRunner, 'transfer_items', 'transfer_id');
    await this.assertNoNulls(queryRunner, 'transfer_items', 'product_id');
    await this.assertNoNulls(queryRunner, 'stock_movements', 'store_id');
    await this.assertNoNulls(queryRunner, 'stock_movements', 'product_id');
    await this.assertNoNulls(queryRunner, 'stock_movements', 'operated_by');
    await this.assertNoNulls(queryRunner, 'inventory_batches', 'inventory_id');
    await this.assertNoNulls(queryRunner, 'inventory', 'store_id');
    await this.assertNoNulls(queryRunner, 'inventory', 'product_id');
    await this.assertNoNulls(queryRunner, 'transfers', 'from_store_id');
    await this.assertNoNulls(queryRunner, 'transfers', 'to_store_id');
    await this.assertNoNulls(queryRunner, 'transfers', 'requested_by');

    await queryRunner.query(`
      ALTER TABLE "transfer_items"
      ALTER COLUMN "transfer_id" SET NOT NULL,
      ALTER COLUMN "product_id" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_movements"
      ALTER COLUMN "store_id" SET NOT NULL,
      ALTER COLUMN "product_id" SET NOT NULL,
      ALTER COLUMN "operated_by" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_batches"
      ALTER COLUMN "inventory_id" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory"
      ALTER COLUMN "store_id" SET NOT NULL,
      ALTER COLUMN "product_id" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "transfers"
      ALTER COLUMN "from_store_id" SET NOT NULL,
      ALTER COLUMN "to_store_id" SET NOT NULL,
      ALTER COLUMN "requested_by" SET NOT NULL
    `);

    await this.assertConstraintExists(queryRunner, 'FK_fc49d37b7156137bffe903a8199');
    await this.assertConstraintExists(queryRunner, 'FK_ae7fbcacbd14c5422ec0b7175f6');
    await this.assertConstraintExists(queryRunner, 'FK_5914e3685851db1a0be9733594f');
    await this.assertConstraintExists(queryRunner, 'FK_2c1bb05b80ddcc562cd28d826c6');
    await this.assertConstraintExists(queryRunner, 'FK_64c67f927d872a7e19700ab6637');
    await this.assertConstraintExists(queryRunner, 'FK_9166b844c38f686c95b7f01b202');
    await this.assertConstraintExists(queryRunner, 'FK_7192a6d523e5376bbb347de30f1');
    await this.assertConstraintExists(queryRunner, 'UQ_inventory_store_product');

    await queryRunner.query(`
      ALTER TABLE "transfer_items"
      DROP COLUMN IF EXISTS "transferId",
      DROP COLUMN IF EXISTS "productId"
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_movements"
      DROP COLUMN IF EXISTS "storeId",
      DROP COLUMN IF EXISTS "productId",
      DROP COLUMN IF EXISTS "batchId",
      DROP COLUMN IF EXISTS "operatedBy"
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_batches"
      DROP COLUMN IF EXISTS "inventoryId"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transfer_items" ADD COLUMN IF NOT EXISTS "transferId" integer`);
    await queryRunner.query(`ALTER TABLE "transfer_items" ADD COLUMN IF NOT EXISTS "productId" integer`);
    await queryRunner.query(`ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "storeId" integer`);
    await queryRunner.query(`ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "productId" integer`);
    await queryRunner.query(`ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "batchId" integer`);
    await queryRunner.query(`ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "operatedBy" integer`);
    await queryRunner.query(`ALTER TABLE "inventory_batches" ADD COLUMN IF NOT EXISTS "inventoryId" integer`);

    await queryRunner.query(`
      UPDATE "transfer_items"
      SET "transferId" = COALESCE("transferId", "transfer_id"),
          "productId" = COALESCE("productId", "product_id")
    `);

    await queryRunner.query(`
      UPDATE "stock_movements"
      SET "storeId" = COALESCE("storeId", "store_id"),
          "productId" = COALESCE("productId", "product_id"),
          "batchId" = COALESCE("batchId", "batch_id"),
          "operatedBy" = COALESCE("operatedBy", "operated_by")
    `);

    await queryRunner.query(`
      UPDATE "inventory_batches"
      SET "inventoryId" = COALESCE("inventoryId", "inventory_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "transfer_items"
      ALTER COLUMN "transferId" SET NOT NULL,
      ALTER COLUMN "productId" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_movements"
      ALTER COLUMN "storeId" SET NOT NULL,
      ALTER COLUMN "productId" SET NOT NULL,
      ALTER COLUMN "operatedBy" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_batches"
      ALTER COLUMN "inventoryId" SET NOT NULL
    `);
  }

  private async assertNoConflicts(
    queryRunner: QueryRunner,
    tableName: string,
    camelColumn: string,
    snakeColumn: string,
  ) {
    const [row] = await queryRunner.query(`
      SELECT COUNT(*)::int AS conflict_count
      FROM "${tableName}"
      WHERE "${camelColumn}" IS NOT NULL
        AND "${snakeColumn}" IS NOT NULL
        AND "${camelColumn}" IS DISTINCT FROM "${snakeColumn}"
    `);

    if (row.conflict_count > 0) {
      throw new Error(`表 ${tableName} 的列 ${camelColumn} 与 ${snakeColumn} 存在 ${row.conflict_count} 条冲突数据，迁移终止`);
    }
  }

  private async backfillColumn(
    queryRunner: QueryRunner,
    tableName: string,
    snakeColumn: string,
    camelColumn: string,
  ) {
    await queryRunner.query(`
      UPDATE "${tableName}"
      SET "${snakeColumn}" = COALESCE("${snakeColumn}", "${camelColumn}")
      WHERE "${snakeColumn}" IS NULL
        AND "${camelColumn}" IS NOT NULL
    `);
  }

  private async assertNoNulls(queryRunner: QueryRunner, tableName: string, columnName: string) {
    const [row] = await queryRunner.query(`
      SELECT COUNT(*)::int AS null_count
      FROM "${tableName}"
      WHERE "${columnName}" IS NULL
    `);

    if (row.null_count > 0) {
      throw new Error(`表 ${tableName} 的列 ${columnName} 仍有 ${row.null_count} 条空值，不能收口为单轨列`);
    }
  }

  private async assertConstraintExists(queryRunner: QueryRunner, constraintName: string) {
    const [row] = await queryRunner.query(`
      SELECT COUNT(*)::int AS constraint_count
      FROM pg_constraint
      WHERE conname = $1
    `, [constraintName]);

    if (row.constraint_count === 0) {
      throw new Error(`缺少预期约束 ${constraintName}，迁移终止`);
    }
  }
}
