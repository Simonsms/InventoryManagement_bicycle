export default [
  {
    path: '/user',
    layout: false,
    routes: [
      {
        name: 'login',
        path: '/user/login',
        component: './user/login',
      },
    ],
  },
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    icon: 'DashboardOutlined',
    component: './Welcome',
  },
  {
    path: '/products',
    name: 'products',
    icon: 'ShoppingOutlined',
    component: './products',
  },
  {
    path: '/import',
    name: 'import',
    icon: 'ImportOutlined',
    access: 'isAdminOrOwner',
    component: './import',
  },
  {
    path: '/inventory',
    name: 'inventory',
    icon: 'DatabaseOutlined',
    component: './inventory',
  },
  {
    path: '/movements',
    name: 'movements',
    icon: 'SwapOutlined',
    component: './movements',
  },
  {
    path: '/transfers',
    name: 'transfers',
    icon: 'DeliveredProcedureOutlined',
    component: './transfers',
  },
  {
    path: '/stocktakes',
    name: 'stocktakes',
    icon: 'AuditOutlined',
    component: './stocktakes',
  },
  {
    path: '/alerts',
    name: 'alerts',
    icon: 'BellOutlined',
    access: 'isAdminOrOwner',
    component: './alerts',
  },
  {
    path: '/settings',
    name: 'settings',
    icon: 'SettingOutlined',
    access: 'isOwner',
    routes: [
      {
        path: '/settings',
        redirect: '/settings/stores',
      },
      {
        path: '/settings/stores',
        name: 'stores',
        component: './settings/stores',
      },
      {
        path: '/settings/users',
        name: 'users',
        component: './settings/users',
      },
      {
        path: '/settings/config',
        name: 'config',
        component: './settings/config',
      },
    ],
  },
  {
    component: '404',
    layout: false,
    path: './*',
  },
];
