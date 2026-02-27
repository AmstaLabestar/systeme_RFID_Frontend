export const PERMISSIONS = {
  users: {
    read: 'users.read',
    manage: 'users.manage',
  },
  roles: {
    read: 'roles.read',
    manage: 'roles.manage',
  },
  tenants: {
    read: 'tenants.read',
    manage: 'tenants.manage',
  },
  admin: {
    systemsRead: 'admin.systems.read',
    systemsManage: 'admin.systems.manage',
    inventoryRead: 'admin.inventory.read',
    stockManage: 'admin.stock.manage',
    logsRead: 'admin.logs.read',
    webhooksRead: 'admin.webhooks.read',
    webhooksManage: 'admin.webhooks.manage',
  },
} as const;

const OWNER_DEFAULT_PERMISSIONS = [
  PERMISSIONS.users.read,
  PERMISSIONS.users.manage,
  PERMISSIONS.roles.read,
  PERMISSIONS.roles.manage,
  PERMISSIONS.tenants.read,
  PERMISSIONS.tenants.manage,
] as const;

const ADMIN_DEFAULT_PERMISSIONS = [
  ...OWNER_DEFAULT_PERMISSIONS,
  PERMISSIONS.admin.systemsRead,
  PERMISSIONS.admin.systemsManage,
  PERMISSIONS.admin.inventoryRead,
  PERMISSIONS.admin.stockManage,
  PERMISSIONS.admin.logsRead,
  PERMISSIONS.admin.webhooksRead,
  PERMISSIONS.admin.webhooksManage,
] as const;

export const DEFAULT_ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  owner: OWNER_DEFAULT_PERMISSIONS,
  admin: ADMIN_DEFAULT_PERMISSIONS,
};
