# 第二批历史双轨列清理设计文档

**日期**：2026-04-05
**状态**：已确认，待实现

---

## 1. 背景

第一批清理已经完成调拨与库存流转主链路 5 表的双轨列收口，但库里仍残留第二批历史命名债，主要集中在商品分类与盘点链路。

如果这部分不继续清掉，后续仍会出现同类问题：

- ORM 映射和真实数据列不一致
- 外键挂在下划线列，但数据写在驼峰列
- 新代码一旦切到标准映射，就会在旧非空列上直接报错

---

## 2. 本次范围

### 2.1 纳入清理

- `products`
- `categories`
- `stocktakes`
- `stocktake_items`

### 2.2 明确不纳入

- `users`

原因：

- 实库中的 `users` 当前已只保留 `store_id`、`role_id`
- 不再属于双轨残留问题

---

## 3. 实库证据

本设计基于 2026-04-05 对真实 PostgreSQL 库的只读核查。

### `products`

- 同时存在：
  - `categoryId`
  - `category_id`
- 当前数据在 `categoryId`
- 外键挂在 `category_id`

### `categories`

- 同时存在：
  - `parentId`
  - `parent_id`
- 当前两列都基本为空
- 外键挂在 `parent_id`

### `stocktakes`

- 同时存在：
  - `storeId`
  - `createdBy`
  - `completedBy`
  - 以及对应的 `store_id`、`created_by`、`completed_by`
- 当前数据在驼峰列
- 外键挂在下划线列

### `stocktake_items`

- 同时存在：
  - `stocktakeId`
  - `productId`
  - 以及对应的 `stocktake_id`、`product_id`
- 当前表数据为空，但双轨结构仍在
- 外键挂在下划线列

---

## 4. 目标

本次目标：

1. 把第二批残留双轨列彻底清掉
2. 统一保留数据库 `snake_case`
3. 让商品、分类、盘点链路的实体映射和约束重新一致

非目标：

- 不重做商品或盘点业务流程
- 不扩大到更多已无双轨问题的表

---

## 5. 方案选择

### 方案 A：一次清理 4 张剩余表

范围：

- `products`
- `categories`
- `stocktakes`
- `stocktake_items`

优点：

- 边界清晰
- 一次清掉当前剩余的主要双轨历史债
- 后续不会再在商品和盘点链路上重复踩同类坑

缺点：

- 需要一起回归商品与盘点接口

### 方案 B：只清商品链路

范围：

- `products`
- `categories`

缺点：

- `stocktakes` 与 `stocktake_items` 仍然是脏结构
- 后续还要再做一轮

### 方案 C：只清盘点链路

范围：

- `stocktakes`
- `stocktake_items`

缺点：

- `products` 仍保留 “数据在驼峰列、FK 在下划线列” 的结构风险

### 选型结论

采用方案 A。

---

## 6. 最终设计

### 6.1 命名规范

数据库最终统一保留 `snake_case`：

- `category_id`
- `parent_id`
- `store_id`
- `created_by`
- `completed_by`
- `stocktake_id`
- `product_id`

TypeScript 属性名仍可保留：

- `categoryId`
- `parentId`
- `storeId`
- `createdBy`
- `completedBy`
- `stocktakeId`
- `productId`

但实体映射必须显式绑定到下划线列。

### 6.2 数据迁移规则

迁移顺序：

1. 冲突检查
2. 数据回填
3. 非空校验
4. 约束校验
5. 删除驼峰列
6. 同步切换实体与查询

通用规则：

- `snake_case = COALESCE(snake_case, camelCase)`
- 如果驼峰列与下划线列同时非空且不一致，迁移直接失败

### 6.3 表级规则

#### `products`

- `categoryId -> category_id`
- 回填后删除 `categoryId`
- `category_id` 收口为 `NOT NULL`

#### `categories`

- `parentId -> parent_id`
- 回填后删除 `parentId`
- `parent_id` 保持可空

#### `stocktakes`

- `storeId -> store_id`
- `createdBy -> created_by`
- `completedBy -> completed_by`
- 回填后删除旧驼峰列
- `store_id`、`created_by` 收口为 `NOT NULL`
- `completed_by` 保持可空

#### `stocktake_items`

- `stocktakeId -> stocktake_id`
- `productId -> product_id`
- 回填后删除旧驼峰列
- `stocktake_id`、`product_id` 收口为 `NOT NULL`

### 6.4 代码改动边界

重点文件：

- `backend/src/entities/Product.ts`
- `backend/src/entities/Category.ts`
- `backend/src/entities/Stocktake.ts`
- `backend/src/entities/StocktakeItem.ts`
- `backend/src/routes/products.ts`
- `backend/src/routes/categories.ts`
- `backend/src/routes/stocktakes.ts`
- 以及引用 `p.categoryId`、`st.storeId`、`item.productId` 等列名的查询位置

---

## 7. 风险控制

主要风险：

- 盘点接口切换后仍引用旧驼峰列
- 商品查询条件仍写 `p.categoryId`
- `stocktake_items` 虽是空表，但结构删除后如果实体未同步会直接报错

控制方式：

- 迁移前先做冲突检查
- 迁移与实体切换同一轮完成
- 必须回归商品列表、分类列表、盘点新建、盘点明细、盘点完成

---

## 8. 验证方案

至少验证：

- `backend npm run build`
- 现有 `auth/transfers` 回归仍通过
- 商品/分类接口可正常读写
- 盘点接口可正常创建、填写、完成
- 数据库中 4 张表不再保留旧驼峰列

---

## 9. 结论

第二批建议一次清掉 `products`、`categories`、`stocktakes`、`stocktake_items`，继续统一为数据库 `snake_case`。

做完这一轮后，项目里已确认的主要双轨列历史债就基本清空了。
