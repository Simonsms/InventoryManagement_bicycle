# Remaining Schema Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining camelCase database columns from the product/category and stocktake chains so the confirmed historical schema debt is fully cleaned up.

**Architecture:** Reuse the first cleanup pattern: one TypeORM migration handles conflict detection, backfill, null validation, and legacy-column deletion; application code then switches all affected entities and query points to explicit `snake_case` mappings. Keep the current product, category, and stocktake business behavior unchanged.

**Tech Stack:** TypeScript, Express, TypeORM, PostgreSQL, Jest

---

### Task 1: Add Regression Coverage For Product And Stocktake Paths

**Files:**
- Create: `backend/tests/stocktakes.test.ts`
- Modify: `backend/tests/transfers.test.ts`
- Reference: `docs/superpowers/specs/2026-04-05-remaining-schema-cleanup-design.md`

- [ ] **Step 1: Write a failing stocktake regression test**

Create `backend/tests/stocktakes.test.ts` covering:

- create stocktake
- read stocktake items
- update actual quantities
- complete stocktake

Include at least one direct repository read through `Stocktake` and `StocktakeItem` relations so broken join-column mappings fail.

- [ ] **Step 2: Write a failing product/category smoke path**

In the same test file or a focused second test block, verify:

- `GET /api/v1/categories` returns 200
- `GET /api/v1/products` returns 200

Add a query using `?category_id=` so a wrong `categoryId/category_id` filter breaks visibly.

- [ ] **Step 3: Run the new tests to verify RED**

Run:

```bash
cd backend
npx jest tests/stocktakes.test.ts --runInBand --forceExit
```

Expected:
- FAIL until the new test file and any required setup are correct

- [ ] **Step 4: Re-run existing transfer/auth regression as baseline**

Run:

```bash
cd backend
npx jest tests/auth.test.ts tests/transfers.test.ts --runInBand --forceExit
```

Expected:
- PASS before second-batch schema changes

---

### Task 2: Implement The Second Cleanup Migration

**Files:**
- Create: `backend/src/migrations/1775403600000-RemainingSchemaSnakeCaseCleanup.ts`
- Reference: `backend/src/migrations/1775400000000-TransferSchemaSnakeCaseCleanup.ts`

- [ ] **Step 1: Create migration skeleton with conflict helpers**

Create `backend/src/migrations/1775403600000-RemainingSchemaSnakeCaseCleanup.ts` with reusable helpers:

- `assertNoConflicts`
- `backfillColumn`
- `assertNoNulls`
- `assertConstraintExists`

- [ ] **Step 2: Add conflict and backfill logic for the four target tables**

Handle these pairs:

- `products.categoryId -> products.category_id`
- `categories.parentId -> categories.parent_id`
- `stocktakes.storeId -> stocktakes.store_id`
- `stocktakes.createdBy -> stocktakes.created_by`
- `stocktakes.completedBy -> stocktakes.completed_by`
- `stocktake_items.stocktakeId -> stocktake_items.stocktake_id`
- `stocktake_items.productId -> stocktake_items.product_id`

- [ ] **Step 3: Add null and constraint validation**

Validate:

- `products.category_id` non-null
- `stocktakes.store_id` non-null
- `stocktakes.created_by` non-null
- `stocktake_items.stocktake_id` non-null
- `stocktake_items.product_id` non-null

Also verify expected FKs already exist on:

- `products.category_id`
- `categories.parent_id`
- `stocktakes.store_id`
- `stocktakes.created_by`
- `stocktakes.completed_by`
- `stocktake_items.stocktake_id`
- `stocktake_items.product_id`

- [ ] **Step 4: Drop legacy camelCase columns**

Drop:

- `products.categoryId`
- `categories.parentId`
- `stocktakes.storeId`
- `stocktakes.createdBy`
- `stocktakes.completedBy`
- `stocktake_items.stocktakeId`
- `stocktake_items.productId`

- [ ] **Step 5: Implement defensive down migration**

Recreate dropped camelCase columns and backfill them from `snake_case`.

- [ ] **Step 6: Run the migration**

Run:

```bash
cd backend
npm run migration:run
```

Expected:
- PASS

---

### Task 3: Align Entity Mappings And Query Filters

**Files:**
- Modify: `backend/src/entities/Product.ts`
- Modify: `backend/src/entities/Category.ts`
- Modify: `backend/src/entities/Stocktake.ts`
- Modify: `backend/src/entities/StocktakeItem.ts`
- Modify: `backend/src/routes/products.ts`
- Modify: `backend/src/routes/categories.ts`
- Modify: `backend/src/routes/stocktakes.ts`
- Modify: `backend/src/routes/inventory.ts`

- [ ] **Step 1: Switch entities to explicit `snake_case` mapping**

Representative changes:

```ts
@Column({ name: 'category_id' })
categoryId: number;

@Column({ name: 'stocktake_id' })
stocktakeId: number;
```

Apply the same pattern to:

- `parent_id`
- `store_id`
- `created_by`
- `completed_by`
- `product_id`

- [ ] **Step 2: Fix query-builder and repository filters**

Update filters that still refer to camelCase SQL columns, such as:

- `p.categoryId`
- `st.storeId`

Representative query update:

```ts
qb.andWhere('p.category_id = :cid', { cid: parseInt(req.query.category_id as string, 10) });
qb.andWhere('st.store_id = :sid', { sid: req.scopedStoreId });
```

- [ ] **Step 3: Run backend build**

Run:

```bash
cd backend
npm run build
```

Expected:
- PASS

---

### Task 4: Run Product, Stocktake, And Existing Regression Verification

**Files:**
- Test: `backend/tests/stocktakes.test.ts`
- Test: `backend/tests/auth.test.ts`
- Test: `backend/tests/transfers.test.ts`

- [ ] **Step 1: Run stocktake regression**

Run:

```bash
cd backend
npx jest tests/stocktakes.test.ts --runInBand --forceExit
```

Expected:
- PASS

- [ ] **Step 2: Run combined backend regression**

Run:

```bash
cd backend
npx jest tests/auth.test.ts tests/transfers.test.ts tests/stocktakes.test.ts --runInBand --forceExit
```

Expected:
- PASS

- [ ] **Step 3: Perform HTTP smoke verification**

Verify:

1. `GET /api/v1/categories` returns 200
2. `GET /api/v1/products` returns 200
3. create stocktake returns 201
4. stocktake items query returns 200
5. stocktake completion returns 200

- [ ] **Step 4: Verify schema cleanup**

Run a read-only SQL/script check confirming:

- `products` no longer has `categoryId`
- `categories` no longer has `parentId`
- `stocktakes` no longer has `storeId` / `createdBy` / `completedBy`
- `stocktake_items` no longer has `stocktakeId` / `productId`

---

## Notes

- This plan intentionally excludes `users`.
- If product/category tests expose pre-existing unrelated issues, stop and isolate them before continuing.
- This is another destructive schema cleanup. High-risk confirmation is required immediately before executing the migration.
