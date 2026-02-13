export const AUTH_ROUTES = {
  session: '/auth/session',
  signIn: '/auth/signin',
  signUp: '/auth/signup',
  googleVerify: '/auth/google/verify',
  whatsappRequest: '/auth/whatsapp/request',
  whatsappVerify: '/auth/whatsapp/verify',
} as const;

export const MARKETPLACE_ROUTES = {
  catalog: '/marketplace/catalog',
  state: '/marketplace/state',
  purchases: '/marketplace/purchases',
  activateDevice: (deviceId: string) => `/marketplace/devices/${deviceId}/activate`,
} as const;

export const SERVICES_ROUTES = {
  state: '/services/state',
  assignments: '/services/assignments',
  assignmentById: (assignmentId: string) => `/services/assignments/${assignmentId}`,
  reassignAssignment: (assignmentId: string) => `/services/assignments/${assignmentId}/reassign`,
} as const;

export const SYSTEM_ROUTES = {
  marketplaceState: '/systems/marketplace-state',
  servicesState: '/systems/services-state',
} as const;
