import { RoleName } from '../entities/Role';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        storeId: number | null;
        role: RoleName;
      };
      scopedStoreId?: number;
    }
  }
}
