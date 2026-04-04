# 调拨与库存流转双轨列清理设计文档

**日期**：2026-04-05
**状态**：已确认，待实现

---

## 1. 背景

当前项目数据库存在早期遗留的“双轨列”问题：同一业务字段同时存在驼峰列和下划线列，代码为了适配脏库，已经出现“部分实体映射驼峰、部分实体映射下划线”的混搭状态。

这类结构在 TypeORM、QueryBuilder、迁移脚本和关联查询里都很容易继续埋雷。当前调拨模块已经完成业务流程改造，下一步应先把调拨与库存流转主链路的表结构收口，否则后续继续迭代会反复踩同一类坑。

---

## 2. 已确认的真实现状

本设计基于 2026-04-05 对真实 PostgreSQL 库的只读核查。

### 2.1 当前纳入清理范围的表

- `transfers`
- `transfer_items`
- `stock_movements`
- `inventory_batches`
- `inventory`

### 2.2 当前不纳入本次清理的表

- `stocktakes`
- `stocktake_items`
- `users`

原因：

- 这三张表也存在历史遗留，但不在本次已改造的调拨主流程关键链路上
- 单次结构手术应控制边界，避免扩大为全库改造

### 2.3 实库证据摘要

#### `transfers`

- 仅保留了 `snake_case` 业务列：`from_store_id`、`to_store_id`、`requested_by`、`approved_by`
- 当前数据主要承载在下划线列
- 这张表已经基本收口，不是本次风险中心

#### `inventory`

- 仅保留 `store_id`、`product_id`
- 当前数据主要承载在下划线列
- 唯一约束已存在：`UNIQUE (store_id, product_id)`

#### `transfer_items`

- 同时存在：
  - 驼峰列：`transferId`、`productId`
  - 下划线列：`transfer_id`、`product_id`
- 当前数据主要在驼峰列
- 现有外键约束挂在下划线列

#### `stock_movements`

- 同时存在：
  - 驼峰列：`storeId`、`productId`、`batchId`、`operatedBy`
  - 下划线列：`store_id`、`product_id`、`batch_id`、`operated_by`
- 当前数据主要在驼峰列
- 现有外键约束挂在下划线列

#### `inventory_batches`

- 同时存在：
  - 驼峰列：`inventoryId`
  - 下划线列：`inventory_id`
- 当前数据主要在驼峰列
- 现有外键约束挂在下划线列

---

## 3. 目标

本次清理的目标只有三个：

1. 让调拨与库存流转主链路的数据库列命名收口为一种规范
2. 让 ORM 映射、真实数据承载列、外键约束三者重新一致
3. 在不扩大业务范围的前提下，消除当前最容易导致 500、错查、错关联的结构隐患

非目标：

- 不顺手清理全库所有历史问题
- 不重做业务流程
- 不新增新的兼容层

---

## 4. 方案对比

### 方案 A：单次迁移，只清理调拨与库存流转主链路 5 表

范围：

- `transfers`
- `transfer_items`
- `stock_movements`
- `inventory_batches`
- `inventory`

策略：

- 统一保留 `snake_case`
- 一次迁移内完成数据回填、约束重建、代码映射切换和旧列删除

优点：

- 边界清晰
- 风险可控
- 直接覆盖当前已改造的调拨链路

缺点：

- `stocktakes` 等其他脏表留待下一轮处理

### 方案 B：单次迁移，扩大到盘点链路

额外包含：

- `stocktakes`
- `stocktake_items`

优点：

- 库存相关核心表命名更统一

缺点：

- 回归范围扩大
- 本次问题焦点从调拨链路偏移到全库存链路

### 方案 C：一次性全库清理

优点：

- 理论上最彻底

缺点：

- 风险最高
- 回归面过大
- 不适合作为当前业务改造的收尾动作

### 选型结论

采用方案 A。

原因：

- 当前真实风险集中在 `transfer_items`、`stock_movements`、`inventory_batches` 这三张“数据在驼峰列、约束在下划线列”的表
- `transfers` 和 `inventory` 已经基本按下划线列落稳，纳入本次只是为了把主链路统一收口
- 控制单次结构手术边界，比“顺手多做几张表”更稳

---

## 5. 最终设计

### 5.1 命名规范

数据库最终统一只保留 `snake_case`：

- `transfer_id`
- `product_id`
- `store_id`
- `batch_id`
- `operated_by`
- `inventory_id`
- 以及 `transfers`、`inventory` 中现有下划线列

TypeScript 属性名仍可保留当前常见写法，例如：

- `transferId`
- `productId`
- `storeId`

但实体映射必须显式绑定到下划线列，不再依赖默认命名。

### 5.2 迁移策略

采用一次性结构迁移，顺序如下：

1. 检查目标表是否存在“驼峰列与下划线列同时非空且值不一致”的冲突记录
2. 若存在冲突，迁移直接失败，不做静默覆盖
3. 使用 `COALESCE(snake_case, camelCase)` 将驼峰列数据回填到下划线列
4. 对业务要求非空的下划线列补 `NOT NULL`
5. 校验并重建下划线列上的外键、唯一约束和索引
6. 删除旧驼峰列
7. 同步更新实体映射和查询语句

### 5.3 表级处理规则

#### `transfers`

- 当前已主要使用下划线列
- 本次只做完整性校验
- 不新增兼容列
- 保持当前 FK 结构

#### `inventory`

- 当前已主要使用下划线列
- 保持 `store_id`、`product_id` 和唯一约束
- 确认实体与约束继续一致

#### `transfer_items`

- 将 `transferId -> transfer_id`
- 将 `productId -> product_id`
- 回填后删除：
  - `transferId`
  - `productId`

#### `stock_movements`

- 将 `storeId -> store_id`
- 将 `productId -> product_id`
- 将 `batchId -> batch_id`
- 将 `operatedBy -> operated_by`
- 回填后删除：
  - `storeId`
  - `productId`
  - `batchId`
  - `operatedBy`

#### `inventory_batches`

- 将 `inventoryId -> inventory_id`
- 回填后删除：
  - `inventoryId`

### 5.4 执行顺序

推荐顺序：

1. `transfer_items`
2. `stock_movements`
3. `inventory_batches`
4. `inventory`
5. `transfers`

设计原则：

- 先处理当前最脏的子表
- 再确认被引用主表保持稳定
- 避免在 FK 链尚未一致时直接删列

### 5.5 代码改动边界

本次代码改动仅限于与目标 5 表直接相关的实体和使用点。

重点文件：

- `backend/src/entities/Transfer.ts`
- `backend/src/entities/TransferItem.ts`
- `backend/src/entities/StockMovement.ts`
- `backend/src/entities/InventoryBatch.ts`
- `backend/src/entities/Inventory.ts`
- `backend/src/routes/transfers.ts`
- `backend/src/routes/inventory.ts`
- `backend/src/routes/import.ts`
- `backend/src/routes/movements.ts`

如果代码中存在裸 SQL 或 QueryBuilder 显式写列名，也要同步统一为真实保留列。

---

## 6. 风险控制

### 6.1 主要风险

- 删除旧列后，仍有代码引用驼峰列
- 某些历史数据两套列同时有值但不一致
- 外键约束与实体映射不一致，导致运行期新增数据失败

### 6.2 控制措施

- 迁移前先做冲突检查，发现不一致直接失败
- 迁移脚本先回填，再约束，再删列，不倒序执行
- 实体映射切换和迁移在同一轮提交中完成
- 执行后必须跑接口回归和结构校验，不凭主观判断收工

### 6.3 回退策略

本次为数据库结构删除型变更，逻辑上可写 `down`，但真正稳妥的回退依赖数据库备份。

因此实施前应视为高风险操作，默认前提为：

- 已有数据库备份
- 可接受在结构迁移失败时立刻停止并人工介入

---

## 7. 验证方案

### 7.1 后端验证

- `cd backend && npm run build`
- `cd backend && npx jest tests/auth.test.ts tests/transfers.test.ts --runInBand --forceExit`

### 7.2 前端验证

- `cd frontend && npx @biomejs/biome lint src/pages/transfers/index.tsx src/services/api.ts src/typings.d.ts`

说明：

- `frontend npm run tsc` 当前仓库已有 Umi 类型遗留问题，不能作为本次结构清理的唯一阻断条件
- 如果本次改动引入新的前端类型错误，仍需修复

### 7.3 手工业务回归

至少验证以下链路：

1. 新建实物调拨 -> 审批 -> 发货 -> 收货
2. 新建账面划转 -> 审批 -> 执行划转
3. 查看库存列表与批次明细，确认数据能正常展示
4. 查看库存流水，确认 `transfer_out` / `transfer_in` 记录正常

### 7.4 数据结构核验

迁移完成后必须确认：

- 目标 5 表中旧驼峰列已不存在
- 数据已完整落在下划线列
- 关键 FK 和唯一约束存在
- 新增调拨和库存流水时，写入列与实体映射一致

---

## 8. 实施前提

进入实现前必须满足以下前提：

1. 用户确认按本设计实施
2. 视为高风险数据库结构变更，实施前再次获得明确确认
3. 实施过程中不扩大到 `stocktakes`、`stocktake_items`、`users`

---

## 9. 结论

本次应采用“单次迁移，收口主链路 5 表，统一保留 `snake_case`”的方案。

这不是为了风格统一，而是为了让以下三件事重新一致：

- ORM 映射
- 真实数据承载列
- 外键与唯一约束

只有把这三者对齐，调拨与库存流转链路后续才不会继续反复出现“查得到、写不进、关联错、迁移炸”的低级结构问题。
