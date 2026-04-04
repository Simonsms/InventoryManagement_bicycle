import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemainingSchemaSnakeCaseCleanup1775403600000 implements MigrationInterface {
  name = 'RemainingSchemaSnakeCaseCleanup1775403600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.assertNoConflicts(queryRunner, 'products', 'categoryId', 'category_id');
    await this.assertNoConflicts(queryRunner, 'categories', 'parentId', 'parent_id');
    await this.assertNoConflicts(queryRunner, 'stocktakes', 'storeId', 'store_id');
    await this.assertNoConflicts(queryRunner, 'stocktakes', 'createdBy', 'created_by');
    await this.assertNoConflicts(queryRunner, 'stocktakes', 'completedBy', 'completed_by');
    await this.assertNoConflicts(queryRunner, 'stocktake_items', 'stocktakeId', 'stocktake_id');
    await this.assertNoConflicts(queryRunner, 'stocktake_items', 'productId', 'product_id');

    await this.backfillColumn(queryRunner, 'products', 'category_id', 'categoryId');
    await this.backfillColumn(queryRunner, 'categories', 'parent_id', 'parentId');
    await this.backfillColumn(queryRunner, 'stocktakes', 'store_id', 'storeId');
    await this.backfillColumn(queryRunner, 'stocktakes', 'created_by', 'createdBy');
    await this.backfillColumn(queryRunner, 'stocktakes', 'completed_by', 'completedBy');
    await this.backfillColumn(queryRunner, 'stocktake_items', 'stocktake_id', 'stocktakeId');
    await this.backfillColumn(queryRunner, 'stocktake_items', 'product_id', 'productId');

    await this.assertNoNulls(queryRunner, 'products', 'category_id');
    await this.assertNoNulls(queryRunner, 'stocktakes', 'store_id');
    await this.assertNoNulls(queryRunner, 'stocktakes', 'created_by');
    await this.assertNoNulls(queryRunner, 'stocktake_items', 'stocktake_id');
    await this.assertNoNulls(queryRunner, 'stocktake_items', 'product_id');

    await queryRunner.query(`
      ALTER TABLE "products"
      ALTER COLUMN "category_id" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "stocktakes"
      ALTER COLUMN "store_id" SET NOT NULL,
      ALTER COLUMN "created_by" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "stocktake_items"
      ALTER COLUMN "stocktake_id" SET NOT NULL,
      ALTER COLUMN "product_id" SET NOT NULL
    `);

    await this.assertConstraintExists(queryRunner, 'FK_9a5f6868c96e0069e699f33e124');
    await this.assertConstraintExists(queryRunner, 'FK_88cea2dc9c31951d06437879b40');
    await this.assertConstraintExists(queryRunner, 'FK_e095df2b88ebd9a7e1e0081abe4');
    await this.assertConstraintExists(queryRunner, 'FK_fe54ce80f19bf1f6402f57b1170');
    await this.assertConstraintExists(queryRunner, 'FK_a9170a1137d9e2fd60acb42ffa1');
    await this.assertConstraintExists(queryRunner, 'FK_5059a60f69f88f0f9b89d6df968');
    await this.assertConstraintExists(queryRunner, 'FK_abb20eb25754004fb589b6f9558');

    await queryRunner.query(`
      ALTER TABLE "products"
      DROP COLUMN IF EXISTS "categoryId"
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      DROP COLUMN IF EXISTS "parentId"
    `);

    await queryRunner.query(`
      ALTER TABLE "stocktakes"
      DROP COLUMN IF EXISTS "storeId",
      DROP COLUMN IF EXISTS "createdBy",
      DROP COLUMN IF EXISTS "completedBy"
    `);

    await queryRunner.query(`
      ALTER TABLE "stocktake_items"
      DROP COLUMN IF EXISTS "stocktakeId",
      DROP COLUMN IF EXISTS "productId"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "categoryId" integer`);
    await queryRunner.query(`ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "parentId" integer`);
    await queryRunner.query(`ALTER TABLE "stocktakes" ADD COLUMN IF NOT EXISTS "storeId" integer`);
    await queryRunner.query(`ALTER TABLE "stocktakes" ADD COLUMN IF NOT EXISTS "createdBy" integer`);
    await queryRunner.query(`ALTER TABLE "stocktakes" ADD COLUMN IF NOT EXISTS "completedBy" integer`);
    await queryRunner.query(`ALTER TABLE "stocktake_items" ADD COLUMN IF NOT EXISTS "stocktakeId" integer`);
    await queryRunner.query(`ALTER TABLE "stocktake_items" ADD COLUMN IF NOT EXISTS "productId" integer`);

    await queryRunner.query(`
      UPDATE "products"
      SET "categoryId" = COALESCE("categoryId", "category_id")
    `);

    await queryRunner.query(`
      UPDATE "categories"
      SET "parentId" = COALESCE("parentId", "parent_id")
    `);

    await queryRunner.query(`
      UPDATE "stocktakes"
      SET "storeId" = COALESCE("storeId", "store_id"),
          "createdBy" = COALESCE("createdBy", "created_by"),
          "completedBy" = COALESCE("completedBy", "completed_by")
    `);

    await queryRunner.query(`
      UPDATE "stocktake_items"
      SET "stocktakeId" = COALESCE("stocktakeId", "stocktake_id"),
          "productId" = COALESCE("productId", "product_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "products"
      ALTER COLUMN "categoryId" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "stocktakes"
      ALTER COLUMN "storeId" SET NOT NULL,
      ALTER COLUMN "createdBy" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "stocktake_items"
      ALTER COLUMN "stocktakeId" SET NOT NULL,
      ALTER COLUMN "productId" SET NOT NULL
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
