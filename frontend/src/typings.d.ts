declare module 'slash2';
declare module '*.css';
declare module '*.less';
declare module '*.scss';
declare module '*.sass';
declare module '*.svg';
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.bmp';
declare module '*.tiff';
declare module 'omit.js';
declare module 'numeral';
declare module 'mockjs';

declare namespace API {
  type RoleName = 'shop_owner' | 'store_admin' | 'staff';

  type Store = {
    id: number;
    name: string;
    address: string | null;
    phone: string | null;
    isActive: boolean;
    createdAt: string;
  };

  type Role = {
    id: number;
    name: RoleName;
  };

  type User = {
    id: number;
    name: string;
    email: string;
    roleId: number;
    storeId: number | null;
    role?: Role;
    store?: Store;
    isActive: boolean;
    createdAt: string;
  };

  type CurrentUser = {
    id: number;
    name: string;
    email: string;
    role: RoleName;
    storeId: number | null;
    storeName: string | null;
    avatar?: string;
  };

  type Category = {
    id: number;
    name: string;
    parentId: number | null;
    parent?: Category | null;
  };

  type Product = {
    id: number;
    categoryId: number;
    category?: Category;
    name: string;
    brand: string;
    modelNumber: string | null;
    specs: Record<string, unknown>;
    warrantyMonths: number | null;
    lowStockThreshold: number;
    isActive: boolean;
    createdAt: string;
  };

  type Inventory = {
    id: number;
    storeId: number;
    store?: Store;
    productId: number;
    product?: Product;
    quantity: number;
    updatedAt: string;
  };

  type InventoryBatch = {
    id: number;
    inventoryId: number;
    batchNo: string;
    quantity: number;
    purchaseDate: string;
    expiryDate: string | null;
    costPrice: number | null;
    createdAt: string;
  };

  type MovementType = 'in' | 'out' | 'transfer_in' | 'transfer_out' | 'adjust';

  type StockMovement = {
    id: number;
    storeId: number;
    store?: Store;
    productId: number;
    product?: Product;
    batchId: number | null;
    type: MovementType;
    quantity: number;
    referenceNo: string | null;
    note: string | null;
    operatedBy: number;
    operator?: User;
    createdAt: string;
  };

  type TransferType = 'physical_transfer' | 'book_adjustment';

  type TransferStatus = 'pending' | 'approved' | 'in_transit' | 'rejected' | 'completed';

  type TransferItem = {
    id: number;
    transferId: number;
    productId: number;
    product?: Product;
    quantity: number;
  };

  type Transfer = {
    id: number;
    fromStoreId: number;
    fromStore?: Store;
    toStoreId: number;
    toStore?: Store;
    type: TransferType;
    status: TransferStatus;
    requestedBy: number;
    requester?: User;
    approvedBy: number | null;
    approver?: User | null;
    approvedAt: string | null;
    shippedBy: number | null;
    shippedAt: string | null;
    receivedBy: number | null;
    receivedAt: string | null;
    completedBy: number | null;
    completedAt: string | null;
    selfApprovedException: boolean;
    reasonCode: string | null;
    note: string | null;
    items?: TransferItem[];
    createdAt: string;
    updatedAt: string;
  };

  type StocktakeStatus = 'open' | 'completed';

  type StocktakeItem = {
    id: number;
    stocktakeId: number;
    productId: number;
    product?: Product;
    systemQty: number;
    actualQty: number | null;
    difference: number | null;
    note: string | null;
  };

  type Stocktake = {
    id: number;
    storeId: number;
    store?: Store;
    status: StocktakeStatus;
    createdBy: number;
    creator?: User;
    completedBy: number | null;
    createdAt: string;
    completedAt: string | null;
  };
}
