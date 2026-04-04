# Transfer Schema Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up the transfer and inventory-flow schema so the five core tables use only `snake_case` database columns while keeping the redesigned transfer workflow working end-to-end.

**Architecture:** Keep the current business workflow intact and treat this as a schema-alignment change, not a feature redesign. Implement a single TypeORM migration that validates conflicts, backfills `snake_case` columns, rebuilds constraints, and removes legacy camelCase columns, then align all affected entities and query points to explicit `snake_case` mappings.

**Tech Stack:** TypeScript, Express, TypeORM, PostgreSQL, Jest, Biome

---

### Task 1: Add Schema-Conflict Coverage And Preflight Checks

**Files:**
- Modify: `backend/tests/transfers.test.ts`
- Modify: `backend/tests/auth.test.ts`
- Create: `backend/src/migrations/1775400000000-TransferSchemaSnakeCaseCleanup.ts`
- Reference: `docs/superpowers/specs/2026-04-05-transfer-schema-cleanup-design.md`

- [ ] **Step 1: Extend the transfer regression test with post-write assertions**

Add assertions after the existing physical-transfer and bookkeeping-adjustment flows that verify the API still returns success after rows are read back through entity relations.

Example checks to add in `backend/tests/transfers.test.ts`:

```ts
expect(shipRes.status).toBe(200);
expect(receiveRes.status).toBe(200);

const completedListRes = await request(app)
  .get('/api/v1/transfers')
  .query({ status: 'completed', type: 'physical_transfer' })
  .set('Authorization', `Bearer ${token}`);

expect(completedListRes.status).toBe(200);
expect(completedListRes.body.some((item: { id: number }) => item.id === transferId)).toBe(true);
```

- [ ] **Step 2: Add a migration preflight test helper path**

Add a focused assertion block in `backend/tests/transfers.test.ts` that directly reads the saved transfer item and movement relations through TypeORM repositories after a completed transfer, so a broken join-column mapping fails the test.

Example repository read:

```ts
const savedTransfer = await AppDataSource.getRepository(Transfer).findOne({
  where: { id: transferId },
  relations: ['items'],
});

expect(savedTransfer).toBeTruthy();
expect(savedTransfer!.items.length).toBeGreaterThan(0);
```

- [ ] **Step 3: Run the current regression tests before any schema change**

Run:

```bash
cd backend
npx jest tests/auth.test.ts tests/transfers.test.ts --runInBand --forceExit
```

Expected:
- PASS on the current branch
- This is the baseline proving later failures come from the cleanup work, not from pre-existing transfer regressions

- [ ] **Step 4: Draft the migration skeleton with explicit preflight checks**

Create `backend/src/migrations/1775400000000-TransferSchemaSnakeCaseCleanup.ts` with helper methods that:

- inspect each target table for conflicting camelCase/snake_case values
- throw on mismatch
- backfill with `COALESCE`

Skeleton shape:

```ts
export class TransferSchemaSnakeCaseCleanup1775400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.assertNoConflicts(queryRunner, 'transfer_items', 'transferId', 'transfer_id');
    await this.backfillColumn(queryRunner, 'transfer_items', 'transfer_id', 'transferId');
  }
}
```

- [ ] **Step 5: Commit the preflight coverage checkpoint**

Run:

```bash
git add backend/tests/transfers.test.ts backend/tests/auth.test.ts backend/src/migrations/1775400000000-TransferSchemaSnakeCaseCleanup.ts
git commit -m "test: add schema cleanup preflight coverage"
```

---

### Task 2: Implement The One-Shot Database Migration

**Files:**
- Modify: `backend/src/migrations/1775400000000-TransferSchemaSnakeCaseCleanup.ts`
- Reference: `backend/src/migrations/1774949547473-InitialSchema.ts`
- Reference: `backend/src/migrations/1775320500000-TransferWorkflowRedesign.ts`

- [ ] **Step 1: Write the failing migration preflight run**

Run the new migration against the current database before finishing implementation, expecting either a migration error or a no-op skeleton result.

Run:

```bash
cd backend
npm run migration:run
```

Expected:
- FAIL or incomplete behavior until the cleanup migration is fully implemented

- [ ] **Step 2: Implement conflict detection for all five target tables**

In `backend/src/migrations/1775400000000-TransferSchemaSnakeCaseCleanup.ts`, add checks for:

- `transfer_items.transferId` vs `transfer_items.transfer_id`
- `transfer_items.productId` vs `transfer_items.product_id`
- `stock_movements.storeId` vs `stock_movements.store_id`
- `stock_movements.productId` vs `stock_movements.product_id`
- `stock_movements.batchId` vs `stock_movements.batch_id`
- `stock_movements.operatedBy` vs `stock_movements.operated_by`
- `inventory_batches.inventoryId` vs `inventory_batches.inventory_id`

Representative SQL:

```sql
SELECT COUNT(*) AS conflict_count
FROM "stock_movements"
WHERE "storeId" IS NOT NULL
  AND "store_id" IS NOT NULL
  AND "storeId" <> "store_id";
```

- [ ] **Step 3: Implement backfill, constraints, and column drops in dependency-safe order**

Implement the `up` migration to:

1. backfill `transfer_items`
2. backfill `stock_movements`
3. backfill `inventory_batches`
4. validate `inventory`
5. validate `transfers`
6. set required `snake_case` columns to `NOT NULL`
7. recreate or confirm FKs and unique constraints on `snake_case`
8. drop old camelCase columns

Representative backfill SQL:

```sql
UPDATE "transfer_items"
SET "transfer_id" = COALESCE("transfer_id", "transferId"),
    "product_id" = COALESCE("product_id", "productId");
```

Representative drop SQL:

```sql
ALTER TABLE "stock_movements"
DROP COLUMN IF EXISTS "storeId",
DROP COLUMN IF EXISTS "productId",
DROP COLUMN IF EXISTS "batchId",
DROP COLUMN IF EXISTS "operatedBy";
```

- [ ] **Step 4: Implement a defensive `down` migration**

Add a `down` that recreates the dropped camelCase columns, copies data back from `snake_case`, and restores the pre-cleanup structure as far as possible.

Representative rollback SQL:

```sql
ALTER TABLE "inventory_batches" ADD COLUMN IF NOT EXISTS "inventoryId" integer;
UPDATE "inventory_batches" SET "inventoryId" = "inventory_id" WHERE "inventoryId" IS NULL;
```

- [ ] **Step 5: Run the migration and verify structure**

Run:

```bash
cd backend
npm run migration:run
```

Then run a verification script or SQL checks confirming:

- legacy camelCase columns are gone from the five target tables
- `snake_case` columns contain the expected data
- key constraints still exist

- [ ] **Step 6: Commit the migration checkpoint**

Run:

```bash
git add backend/src/migrations/1775400000000-TransferSchemaSnakeCaseCleanup.ts
git commit -m "feat: clean transfer schema legacy columns"
```

---

### Task 3: Align Entity Mappings And Query Points

**Files:**
- Modify: `backend/src/entities/TransferItem.ts`
- Modify: `backend/src/entities/StockMovement.ts`
- Modify: `backend/src/entities/InventoryBatch.ts`
- Modify: `backend/src/entities/Inventory.ts`
- Modify: `backend/src/entities/Transfer.ts`
- Modify: `backend/src/routes/transfers.ts`
- Modify: `backend/src/routes/inventory.ts`
- Modify: `backend/src/routes/movements.ts`
- Modify: `backend/src/routes/import.ts`

- [ ] **Step 1: Switch entity columns to explicit `snake_case` mapping**

Update each entity so TypeScript property names stay the same, but every affected database column is explicitly mapped.

Representative entity update:

```ts
@Column({ name: 'transfer_id' })
transferId: number;

@ManyToOne(() => Transfer)
@JoinColumn({ name: 'transfer_id' })
transfer: Transfer;
```

Do the same for:

- `product_id`
- `store_id`
- `batch_id`
- `operated_by`
- `inventory_id`

- [ ] **Step 2: Fix query-builder filters that still rely on ORM-generated camelCase column names**

Search and update all affected query clauses in:

- `backend/src/routes/transfers.ts`
- `backend/src/routes/inventory.ts`
- `backend/src/routes/movements.ts`
- `backend/src/routes/import.ts`

Representative change:

```ts
qb.andWhere('m.store_id = :storeId', { storeId: req.scopedStoreId });
qb.andWhere('m.product_id = :pid', { pid: parseInt(req.query.product_id as string, 10) });
```

- [ ] **Step 3: Run TypeScript build to catch broken entity metadata or query references**

Run:

```bash
cd backend
npm run build
```

Expected:
- PASS with no missing property or metadata errors

- [ ] **Step 4: Re-run transfer and auth tests after code alignment**

Run:

```bash
cd backend
npx jest tests/auth.test.ts tests/transfers.test.ts --runInBand --forceExit
```

Expected:
- PASS

- [ ] **Step 5: Commit the application-layer alignment**

Run:

```bash
git add backend/src/entities/TransferItem.ts backend/src/entities/StockMovement.ts backend/src/entities/InventoryBatch.ts backend/src/entities/Inventory.ts backend/src/entities/Transfer.ts backend/src/routes/transfers.ts backend/src/routes/inventory.ts backend/src/routes/movements.ts backend/src/routes/import.ts
git commit -m "refactor: align transfer schema mappings"
```

---

### Task 4: Run End-To-End Verification And Update Docs

**Files:**
- Modify: `docs/transfer-module-usage.md` (only if implementation details changed)
- Modify: `docs/transfer-module-sop.md` (only if implementation details changed)
- Reference: `docs/superpowers/specs/2026-04-05-transfer-schema-cleanup-design.md`

- [ ] **Step 1: Run backend regression and static verification**

Run:

```bash
cd backend
npm run build
npx jest tests/auth.test.ts tests/transfers.test.ts --runInBand --forceExit
```

Expected:
- PASS

- [ ] **Step 2: Run frontend lint on the transfer page contract**

Run:

```bash
cd frontend
npx @biomejs/biome lint src/pages/transfers/index.tsx src/services/api.ts src/typings.d.ts
```

Expected:
- PASS

- [ ] **Step 3: Run manual workflow verification against the live app**

Verify:

1. create physical transfer -> approve -> ship -> receive
2. create bookkeeping adjustment -> approve -> execute-adjustment
3. inventory list and batch detail still load
4. stock movement list still shows transfer flows

- [ ] **Step 4: Capture the final schema evidence**

Run a read-only script or SQL query against PostgreSQL to confirm:

- `transfer_items` no longer has `transferId` / `productId`
- `stock_movements` no longer has `storeId` / `productId` / `batchId` / `operatedBy`
- `inventory_batches` no longer has `inventoryId`
- `transfers` and `inventory` still have the expected `snake_case` constraints

- [ ] **Step 5: Update docs only if behavior or operator guidance changed**

If the cleanup only changes internal schema shape, do not touch user-facing SOP text. If any implementation limitation or deployment note changed, add a short “数据库结构清理后说明” note to the relevant docs.

- [ ] **Step 6: Commit the final verified state**

Run:

```bash
git add docs/transfer-module-usage.md docs/transfer-module-sop.md
git commit -m "docs: note transfer schema cleanup rollout"
```

Skip this commit if no docs changed.

---

## Notes

- This plan intentionally does not expand into `stocktakes`, `stocktake_items`, or `users`.
- `frontend npm run tsc` is not the release gate for this task because the repo already has unrelated Umi-generated typing issues.
- The migration is a high-risk destructive schema change. Get explicit confirmation immediately before executing it on the database.
- Under the current session constraints, plan-review subagent dispatch is not used unless the user explicitly requests delegated review.
