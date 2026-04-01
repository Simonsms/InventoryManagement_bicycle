import type { CurrentUser } from '@/services/auth';

export default function access(initialState: { currentUser?: CurrentUser } | undefined) {
  const role = initialState?.currentUser?.role;
  return {
    isOwner: role === 'shop_owner',
    isAdminOrOwner: role === 'shop_owner' || role === 'store_admin',
    isStaff: !!role,
  };
}
