import { request } from '@umijs/max';

// ---- 分类 ----
export async function getCategories() {
  return request<API.Category[]>('/api/v1/categories');
}

export async function createCategory(data: { name: string; parentId?: number | null }) {
  return request<API.Category>('/api/v1/categories', { method: 'POST', data });
}

export async function updateCategory(id: number, data: { name?: string; parentId?: number | null }) {
  return request<API.Category>(`/api/v1/categories/${id}`, { method: 'PUT', data });
}

export async function deleteCategory(id: number) {
  return request(`/api/v1/categories/${id}`, { method: 'DELETE' });
}

// ---- 商品 ----
export async function getProducts(params?: {
  category_id?: number;
  brand?: string;
  keyword?: string;
}) {
  return request<API.Product[]>('/api/v1/products', { params });
}

export async function getProduct(id: number) {
  return request<API.Product>(`/api/v1/products/${id}`);
}

export async function createProduct(data: Partial<API.Product>) {
  return request<API.Product>('/api/v1/products', { method: 'POST', data });
}

export async function updateProduct(id: number, data: Partial<API.Product>) {
  return request<API.Product>(`/api/v1/products/${id}`, { method: 'PUT', data });
}

export async function deactivateProduct(id: number) {
  return request(`/api/v1/products/${id}`, { method: 'DELETE' });
}

// ---- 库存 ----
export async function getInventory(params?: {
  store_id?: number;
  category_id?: number;
  brand?: string;
  keyword?: string;
}) {
  return request<API.Inventory[]>('/api/v1/inventory', { params });
}

export async function getInventoryBatches(inventoryId: number) {
  return request<API.InventoryBatch[]>(`/api/v1/inventory/${inventoryId}/batches`);
}

export async function getLowStockAlerts(params?: { store_id?: number }) {
  return request<API.Inventory[]>('/api/v1/inventory/alerts', { params });
}

export async function getStaleInventory(params?: { store_id?: number; days?: number }) {
  return request<API.Inventory[]>('/api/v1/inventory/stale', { params });
}

// ---- 出入库 ----
export async function stockIn(data: {
  productId: number;
  quantity: number;
  batchNo: string;
  purchaseDate: string;
  costPrice?: number;
  note?: string;
  store_id?: number;
}) {
  const { store_id, ...body } = data;
  return request('/api/v1/movements/in', { method: 'POST', data: body, params: store_id ? { store_id } : {} });
}

export async function stockOut(data: {
  productId: number;
  quantity: number;
  referenceNo?: string;
  note?: string;
  store_id?: number;
}) {
  const { store_id, ...body } = data;
  return request('/api/v1/movements/out', { method: 'POST', data: body, params: store_id ? { store_id } : {} });
}

export async function getMovements(params?: {
  store_id?: number;
  product_id?: number;
  type?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}) {
  return request<{ list: API.StockMovement[]; total: number; page: number; pageSize: number }>(
    '/api/v1/movements',
    { params },
  );
}

// ---- 调拨 ----
export async function getTransfers(params?: { status?: string; store_id?: number }) {
  return request<API.Transfer[]>('/api/v1/transfers', { params });
}

export async function createTransfer(data: {
  toStoreId: number;
  items: { productId: number; quantity: number }[];
  note?: string;
  store_id?: number;
}) {
  const { store_id, ...body } = data;
  return request('/api/v1/transfers', { method: 'POST', data: body, params: store_id ? { store_id } : {} });
}

export async function approveTransfer(id: number) {
  return request(`/api/v1/transfers/${id}/approve`, { method: 'PUT' });
}

export async function rejectTransfer(id: number) {
  return request(`/api/v1/transfers/${id}/reject`, { method: 'PUT' });
}

export async function completeTransfer(id: number) {
  return request(`/api/v1/transfers/${id}/complete`, { method: 'PUT' });
}

// ---- 盘点 ----
export async function getStocktakes(params?: { status?: string; store_id?: number }) {
  return request<API.Stocktake[]>('/api/v1/stocktakes', { params });
}

export async function createStocktake(params?: { store_id?: number }) {
  return request('/api/v1/stocktakes', { method: 'POST', params });
}

export async function getStocktakeItems(stocktakeId: number) {
  return request<API.StocktakeItem[]>(`/api/v1/stocktakes/${stocktakeId}/items`);
}

export async function updateStocktakeItems(
  stocktakeId: number,
  items: { productId: number; actualQty: number; note?: string }[],
) {
  return request(`/api/v1/stocktakes/${stocktakeId}/items`, { method: 'PUT', data: items });
}

export async function completeStocktake(stocktakeId: number) {
  return request(`/api/v1/stocktakes/${stocktakeId}/complete`, { method: 'POST' });
}

// ---- 门店 ----
export async function getStores() {
  return request<API.Store[]>('/api/v1/stores');
}

export async function createStore(data: { name: string; address?: string; phone?: string }) {
  return request<API.Store>('/api/v1/stores', { method: 'POST', data });
}

export async function updateStore(id: number, data: { name?: string; address?: string; phone?: string }) {
  return request<API.Store>(`/api/v1/stores/${id}`, { method: 'PUT', data });
}

export async function deactivateStore(id: number) {
  return request(`/api/v1/stores/${id}`, { method: 'DELETE' });
}

// ---- 用户 ----
export async function getUsers(params?: { store_id?: number }) {
  return request<API.User[]>('/api/v1/users', { params });
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  roleId: number;
  storeId?: number;
}) {
  return request('/api/v1/users', { method: 'POST', data });
}

export async function updateUser(id: number, data: { name?: string; roleId?: number; storeId?: number; password?: string }) {
  return request(`/api/v1/users/${id}`, { method: 'PUT', data });
}

export async function deactivateUser(id: number) {
  return request(`/api/v1/users/${id}`, { method: 'DELETE' });
}

// ---- Excel 导入 ----
export async function importProducts(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return request<{ success: number; failed: number; errors: string[] }>(
    '/api/v1/import/products',
    { method: 'POST', data: formData }
  );
}

export async function importInventory(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return request<{ success: number; failed: number; errors: string[] }>(
    '/api/v1/import/inventory',
    { method: 'POST', data: formData }
  );
}

// ---- 仪表盘 ----
export async function getDashboard() {
  return request<{
    totalSkus: number;
    lowStockCount: number;
    pendingTransferCount: number;
    storeStats: { storeId: number; storeName: string; totalQty: number; skuCount: number }[];
    lowStockItems: API.Inventory[];
    pendingTransfers: API.Transfer[];
  }>('/api/v1/dashboard');
}
