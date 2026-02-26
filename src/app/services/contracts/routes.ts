export const AUTH_ROUTES = {
  session: '/auth/session',
  signIn: '/auth/signin',
  signInVerify2fa: '/auth/signin/verify-2fa',
  signUp: '/auth/signup',
  googleVerify: '/auth/google/verify',
  magicLink: '/auth/magic-link',
  magicLinkVerify: '/auth/magic-link/verify',
  refresh: '/auth/refresh',
  logout: '/auth/logout',
} as const;

export const MARKETPLACE_ROUTES = {
  systems: '/marketplace/systems',
  state: '/devices/my',
  orders: '/marketplace/orders',
  activateDevice: (deviceId: string) => `/devices/${deviceId}/configure`,
} as const;

export const ADMIN_ROUTES = {
  systems: '/admin/systems',
  createSystem: '/admin/systems',
  updateSystemActivation: (systemId: string) => `/admin/systems/${systemId}/activation`,
  updateSystemPricing: (systemId: string) => `/admin/systems/${systemId}/pricing`,
  createDevicesBulk: (systemId: string) => `/admin/systems/${systemId}/devices/bulk`,
  validateDevicesImport: (systemId: string) =>
    `/admin/systems/${systemId}/devices/import/validate`,
  createSystemIdentifiersBulk: (systemId: string) => `/admin/systems/${systemId}/identifiers/bulk`,
  createDeviceIdentifiers: (deviceId: string) => `/admin/devices/${deviceId}/identifiers`,
  inventoryDevices: '/admin/inventory/devices',
  inventoryDeviceById: (deviceId: string) => `/admin/inventory/devices/${deviceId}`,
  inventoryAlerts: '/admin/inventory/alerts/low-stock',
  inventoryMovements: '/admin/inventory/movements',
  adminLogs: '/admin/logs',
  webhooks: '/admin/webhooks',
  updateWebhookActivation: (webhookId: string) => `/admin/webhooks/${webhookId}/activation`,
  testWebhook: (webhookId: string) => `/admin/webhooks/${webhookId}/test`,
} as const;

export const SERVICES_ROUTES = {
  state: '/services/state',
  assignments: '/services/assignments',
  assignmentById: (assignmentId: string) => `/services/assignments/${assignmentId}`,
  reassignAssignment: (assignmentId: string) => `/services/assignments/${assignmentId}/reassign`,
} as const;

export const PUBLIC_ROUTES = {
  feedbackByQrToken: (qrToken: string) => `/public/feedback/${encodeURIComponent(qrToken)}`,
} as const;
