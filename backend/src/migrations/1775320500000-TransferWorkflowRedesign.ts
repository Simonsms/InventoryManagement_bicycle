import { MigrationInterface, QueryRunner } from 'typeorm';

export class TransferWorkflowRedesign1775320500000 implements MigrationInterface {
  name = 'TransferWorkflowRedesign1775320500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transfers"
      ADD COLUMN IF NOT EXISTS "type" character varying NOT NULL DEFAULT 'physical_transfer',
      ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "shipped_by" integer,
      ADD COLUMN IF NOT EXISTS "shipped_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "received_by" integer,
      ADD COLUMN IF NOT EXISTS "received_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "completed_by" integer,
      ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "self_approved_exception" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "reason_code" character varying
    `);

    await queryRunner.query(`
      UPDATE "transfers"
      SET "type" = 'physical_transfer'
      WHERE "type" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "transfers"
      ADD CONSTRAINT "FK_transfers_shipped_by"
      FOREIGN KEY ("shipped_by") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `).catch(() => undefined);

    await queryRunner.query(`
      ALTER TABLE "transfers"
      ADD CONSTRAINT "FK_transfers_received_by"
      FOREIGN KEY ("received_by") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `).catch(() => undefined);

    await queryRunner.query(`
      ALTER TABLE "transfers"
      ADD CONSTRAINT "FK_transfers_completed_by"
      FOREIGN KEY ("completed_by") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `).catch(() => undefined);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transfers" DROP CONSTRAINT IF EXISTS "FK_transfers_completed_by"`);
    await queryRunner.query(`ALTER TABLE "transfers" DROP CONSTRAINT IF EXISTS "FK_transfers_received_by"`);
    await queryRunner.query(`ALTER TABLE "transfers" DROP CONSTRAINT IF EXISTS "FK_transfers_shipped_by"`);
    await queryRunner.query(`
      ALTER TABLE "transfers"
      DROP COLUMN IF EXISTS "reason_code",
      DROP COLUMN IF EXISTS "self_approved_exception",
      DROP COLUMN IF EXISTS "completed_at",
      DROP COLUMN IF EXISTS "completed_by",
      DROP COLUMN IF EXISTS "received_at",
      DROP COLUMN IF EXISTS "received_by",
      DROP COLUMN IF EXISTS "shipped_at",
      DROP COLUMN IF EXISTS "shipped_by",
      DROP COLUMN IF EXISTS "approved_at",
      DROP COLUMN IF EXISTS "type"
    `);
  }
}
