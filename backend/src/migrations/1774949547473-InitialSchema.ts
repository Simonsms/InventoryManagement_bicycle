import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1774949547473 implements MigrationInterface {
    name = 'InitialSchema1774949547473'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "stores" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "address" character varying, "phone" character varying, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7aa6e7d71fa7acdd7ca43d7c9cb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "roles" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "permissions" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE ("name"), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" SERIAL NOT NULL, "storeId" integer, "roleId" integer NOT NULL, "name" character varying NOT NULL, "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "store_id" integer, "role_id" integer, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "transfers" ("id" SERIAL NOT NULL, "fromStoreId" integer NOT NULL, "toStoreId" integer NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "requestedBy" integer NOT NULL, "approvedBy" integer, "note" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "from_store_id" integer, "to_store_id" integer, "requested_by" integer, "approved_by" integer, CONSTRAINT "PK_f712e908b465e0085b4408cabc3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "categories" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "parentId" integer, "parent_id" integer, CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "products" ("id" SERIAL NOT NULL, "categoryId" integer NOT NULL, "name" character varying NOT NULL, "brand" character varying NOT NULL, "modelNumber" character varying, "specs" jsonb NOT NULL DEFAULT '{}', "warrantyMonths" integer, "lowStockThreshold" integer NOT NULL DEFAULT '2', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "category_id" integer, CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "transfer_items" ("id" SERIAL NOT NULL, "transferId" integer NOT NULL, "productId" integer NOT NULL, "quantity" integer NOT NULL, "transfer_id" integer, "product_id" integer, CONSTRAINT "PK_d7258a0518246eabb01bffd56a9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "stocktakes" ("id" SERIAL NOT NULL, "storeId" integer NOT NULL, "status" character varying NOT NULL DEFAULT 'open', "createdBy" integer NOT NULL, "completedBy" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "completedAt" TIMESTAMP, "store_id" integer, "created_by" integer, "completed_by" integer, CONSTRAINT "PK_06743abbde0490196ad25408080" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "stocktake_items" ("id" SERIAL NOT NULL, "stocktakeId" integer NOT NULL, "productId" integer NOT NULL, "systemQty" integer NOT NULL, "actualQty" integer, "note" character varying, "stocktake_id" integer, "product_id" integer, CONSTRAINT "PK_ae9032cee05270c5f3dca8d633b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "inventory" ("id" SERIAL NOT NULL, "storeId" integer NOT NULL, "productId" integer NOT NULL, "quantity" integer NOT NULL DEFAULT '0', "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "store_id" integer, "product_id" integer, CONSTRAINT "UQ_12c28c4b395f2c332f804ef1cac" UNIQUE ("storeId", "productId"), CONSTRAINT "PK_82aa5da437c5bbfb80703b08309" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "inventory_batches" ("id" SERIAL NOT NULL, "inventoryId" integer NOT NULL, "batchNo" character varying NOT NULL, "quantity" integer NOT NULL, "purchaseDate" date NOT NULL, "expiryDate" date, "costPrice" numeric(10,2), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "inventory_id" integer, CONSTRAINT "PK_1b670b7f687d8b8c58ef8d4629a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "stock_movements" ("id" SERIAL NOT NULL, "storeId" integer NOT NULL, "productId" integer NOT NULL, "batchId" integer, "type" character varying NOT NULL, "quantity" integer NOT NULL, "referenceNo" character varying, "note" character varying, "operatedBy" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "store_id" integer, "product_id" integer, "batch_id" integer, "operated_by" integer, CONSTRAINT "PK_57a26b190618550d8e65fb860e7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_98a52595c9031d60f5c8d280ca4" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transfers" ADD CONSTRAINT "FK_050e9321dd2289633309a84dba9" FOREIGN KEY ("from_store_id") REFERENCES "stores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transfers" ADD CONSTRAINT "FK_7fb21ce0e77256dff69c38d891a" FOREIGN KEY ("to_store_id") REFERENCES "stores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transfers" ADD CONSTRAINT "FK_8ca44548e1b51e06dd28b389250" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transfers" ADD CONSTRAINT "FK_a3284c02ae0c3b2759fac384b56" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_88cea2dc9c31951d06437879b40" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "products" ADD CONSTRAINT "FK_9a5f6868c96e0069e699f33e124" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transfer_items" ADD CONSTRAINT "FK_fc49d37b7156137bffe903a8199" FOREIGN KEY ("transfer_id") REFERENCES "transfers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transfer_items" ADD CONSTRAINT "FK_ae7fbcacbd14c5422ec0b7175f6" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stocktakes" ADD CONSTRAINT "FK_e095df2b88ebd9a7e1e0081abe4" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stocktakes" ADD CONSTRAINT "FK_fe54ce80f19bf1f6402f57b1170" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stocktakes" ADD CONSTRAINT "FK_a9170a1137d9e2fd60acb42ffa1" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stocktake_items" ADD CONSTRAINT "FK_5059a60f69f88f0f9b89d6df968" FOREIGN KEY ("stocktake_id") REFERENCES "stocktakes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stocktake_items" ADD CONSTRAINT "FK_abb20eb25754004fb589b6f9558" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inventory" ADD CONSTRAINT "FK_11f936d3d7a959d55b61f2eb685" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inventory" ADD CONSTRAINT "FK_732fdb1f76432d65d2c136340dc" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inventory_batches" ADD CONSTRAINT "FK_7192a6d523e5376bbb347de30f1" FOREIGN KEY ("inventory_id") REFERENCES "inventory"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_5914e3685851db1a0be9733594f" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_2c1bb05b80ddcc562cd28d826c6" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_64c67f927d872a7e19700ab6637" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_9166b844c38f686c95b7f01b202" FOREIGN KEY ("operated_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_9166b844c38f686c95b7f01b202"`);
        await queryRunner.query(`ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_64c67f927d872a7e19700ab6637"`);
        await queryRunner.query(`ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_2c1bb05b80ddcc562cd28d826c6"`);
        await queryRunner.query(`ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_5914e3685851db1a0be9733594f"`);
        await queryRunner.query(`ALTER TABLE "inventory_batches" DROP CONSTRAINT "FK_7192a6d523e5376bbb347de30f1"`);
        await queryRunner.query(`ALTER TABLE "inventory" DROP CONSTRAINT "FK_732fdb1f76432d65d2c136340dc"`);
        await queryRunner.query(`ALTER TABLE "inventory" DROP CONSTRAINT "FK_11f936d3d7a959d55b61f2eb685"`);
        await queryRunner.query(`ALTER TABLE "stocktake_items" DROP CONSTRAINT "FK_abb20eb25754004fb589b6f9558"`);
        await queryRunner.query(`ALTER TABLE "stocktake_items" DROP CONSTRAINT "FK_5059a60f69f88f0f9b89d6df968"`);
        await queryRunner.query(`ALTER TABLE "stocktakes" DROP CONSTRAINT "FK_a9170a1137d9e2fd60acb42ffa1"`);
        await queryRunner.query(`ALTER TABLE "stocktakes" DROP CONSTRAINT "FK_fe54ce80f19bf1f6402f57b1170"`);
        await queryRunner.query(`ALTER TABLE "stocktakes" DROP CONSTRAINT "FK_e095df2b88ebd9a7e1e0081abe4"`);
        await queryRunner.query(`ALTER TABLE "transfer_items" DROP CONSTRAINT "FK_ae7fbcacbd14c5422ec0b7175f6"`);
        await queryRunner.query(`ALTER TABLE "transfer_items" DROP CONSTRAINT "FK_fc49d37b7156137bffe903a8199"`);
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "FK_9a5f6868c96e0069e699f33e124"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_88cea2dc9c31951d06437879b40"`);
        await queryRunner.query(`ALTER TABLE "transfers" DROP CONSTRAINT "FK_a3284c02ae0c3b2759fac384b56"`);
        await queryRunner.query(`ALTER TABLE "transfers" DROP CONSTRAINT "FK_8ca44548e1b51e06dd28b389250"`);
        await queryRunner.query(`ALTER TABLE "transfers" DROP CONSTRAINT "FK_7fb21ce0e77256dff69c38d891a"`);
        await queryRunner.query(`ALTER TABLE "transfers" DROP CONSTRAINT "FK_050e9321dd2289633309a84dba9"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_98a52595c9031d60f5c8d280ca4"`);
        await queryRunner.query(`DROP TABLE "stock_movements"`);
        await queryRunner.query(`DROP TABLE "inventory_batches"`);
        await queryRunner.query(`DROP TABLE "inventory"`);
        await queryRunner.query(`DROP TABLE "stocktake_items"`);
        await queryRunner.query(`DROP TABLE "stocktakes"`);
        await queryRunner.query(`DROP TABLE "transfer_items"`);
        await queryRunner.query(`DROP TABLE "products"`);
        await queryRunner.query(`DROP TABLE "categories"`);
        await queryRunner.query(`DROP TABLE "transfers"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "roles"`);
        await queryRunner.query(`DROP TABLE "stores"`);
    }

}
