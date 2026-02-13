import type {
  AssignIdentifierInput,
  AuthUser,
  DeviceConfigurationInput,
  DeviceUnit,
  Employee,
  FeedbackRecord,
  HistoryEvent,
  IdentifierType,
  InventoryIdentifier,
  ModuleKey,
  Product,
  ReassignIdentifierInput,
  ServiceAssignment,
} from '@/app/types';
import type { MarketplaceStatePayload, ServicesStatePayload } from '@/app/services/types';

type UnknownRecord = Record<string, unknown>;

export interface NormalizedAuthResponse {
  token: string;
  user: AuthUser;
}

export interface NormalizedWhatsAppOtpRequestResponse {
  requestId: string;
  expiresAt: string;
  debugCode?: string;
}

export interface NormalizedPurchaseResponse {
  purchaseId: string;
  createdDevices: DeviceUnit[];
  createdIdentifiers: InventoryIdentifier[];
  redirectModule: ModuleKey;
  marketplaceState: MarketplaceStatePayload;
}

export interface NormalizedActivateDeviceResponse {
  device: DeviceUnit;
  marketplaceState: MarketplaceStatePayload;
}

export type NormalizedMutationAction = 'assign' | 'remove' | 'reassign';

export interface NormalizedServiceMutationMeta {
  module: ModuleKey;
  action: NormalizedMutationAction;
  employeeName: string;
  identifierCode: string;
  deviceName: string;
}

export interface NormalizedServiceMutationResponse {
  servicesState: ServicesStatePayload;
  marketplaceState: MarketplaceStatePayload;
  meta: NormalizedServiceMutationMeta;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pickFirstDefined<T>(...values: (T | null | undefined)[]): T | undefined {
  return values.find((value) => value !== undefined && value !== null);
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return fallback;
}

function asOptionalString(value: unknown): string | undefined {
  const parsedValue = asString(value).trim();
  return parsedValue.length > 0 ? parsedValue : undefined;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value);
    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }

  return fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return null;
  }

  return asNumber(value, 0);
}

function toModuleKey(value: unknown): ModuleKey | null {
  const normalized = asString(value).trim().toLowerCase();

  const aliases: Record<string, ModuleKey> = {
    'rfid-presence': 'rfid-presence',
    rfid_presence: 'rfid-presence',
    'rfid-porte': 'rfid-porte',
    rfid_porte: 'rfid-porte',
    biometrie: 'biometrie',
    biometric: 'biometrie',
    feedback: 'feedback',
  };

  return aliases[normalized] ?? null;
}

function toIdentifierType(value: unknown): IdentifierType | null {
  const normalized = asString(value).trim().toLowerCase();

  const aliases: Record<string, IdentifierType> = {
    'badge-rfid': 'badge-rfid',
    badge_rfid: 'badge-rfid',
    empreinte: 'empreinte',
    'serrure-rfid': 'serrure-rfid',
    serrure_rfid: 'serrure-rfid',
  };

  return aliases[normalized] ?? null;
}

function getAction(value: unknown): NormalizedMutationAction {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === 'remove') {
    return 'remove';
  }
  if (normalized === 'reassign') {
    return 'reassign';
  }
  return 'assign';
}

function getMutationMetaSource(value: unknown): UnknownRecord {
  const root = asRecord(value);
  const data = asRecord(root.data);
  return asRecord(pickFirstDefined(root.meta, data.meta));
}

function getPayloadSource(value: unknown): UnknownRecord {
  const root = asRecord(value);
  const data = asRecord(root.data);

  if (Object.keys(data).length > 0) {
    return data;
  }

  return root;
}

function getMarketplaceSource(value: unknown): UnknownRecord {
  const source = getPayloadSource(value);
  return asRecord(
    pickFirstDefined(source.marketplace, source.marketplaceState, source.marketplace_state, source),
  );
}

function getServicesSource(value: unknown): UnknownRecord {
  const source = getPayloadSource(value);
  return asRecord(pickFirstDefined(source.services, source.servicesState, source.services_state, source));
}

function toDeviceUnit(value: unknown): DeviceUnit | null {
  const source = asRecord(value);
  const module = toModuleKey(pickFirstDefined(source.module, source.module_key, source.moduleKey));
  const typeSafeId = asOptionalString(source.id);

  if (!module || !typeSafeId) {
    return null;
  }

  return {
    id: typeSafeId,
    module,
    name: asString(source.name, `Boitier ${typeSafeId}`),
    location: asString(source.location, 'A configurer'),
    provisionedMacAddress: asString(
      pickFirstDefined(source.provisionedMacAddress, source.provisioned_mac_address),
      '',
    ),
    systemIdentifier: asOptionalString(
      pickFirstDefined(source.systemIdentifier, source.system_identifier),
    ),
    configured: asBoolean(source.configured, false),
    capacity: asNumber(source.capacity, 0),
    createdAt: asString(pickFirstDefined(source.createdAt, source.created_at), new Date().toISOString()),
    activatedAt: asOptionalString(pickFirstDefined(source.activatedAt, source.activated_at)),
  };
}

function toInventoryIdentifier(value: unknown): InventoryIdentifier | null {
  const source = asRecord(value);
  const module = toModuleKey(pickFirstDefined(source.module, source.module_key, source.moduleKey));
  const type = toIdentifierType(pickFirstDefined(source.type, source.identifier_type));
  const id = asOptionalString(source.id);

  if (!module || !type || !id) {
    return null;
  }

  return {
    id,
    module,
    type,
    code: asString(source.code, id.toUpperCase()),
    status: asString(source.status).toLowerCase() === 'assigned' ? 'assigned' : 'available',
    deviceId: asOptionalString(pickFirstDefined(source.deviceId, source.device_id)),
    employeeId: asOptionalString(pickFirstDefined(source.employeeId, source.employee_id)),
    acquiredAt: asString(pickFirstDefined(source.acquiredAt, source.acquired_at), new Date().toISOString()),
  };
}

function toEmployee(value: unknown): Employee | null {
  const source = asRecord(value);
  const id = asOptionalString(source.id);

  if (!id) {
    return null;
  }

  const firstName = asString(pickFirstDefined(source.firstName, source.first_name), '');
  const lastName = asString(pickFirstDefined(source.lastName, source.last_name), '');

  return {
    id,
    firstName,
    lastName,
    fullName:
      asOptionalString(pickFirstDefined(source.fullName, source.full_name)) ||
      `${firstName} ${lastName}`.trim() ||
      id,
  };
}

function toServiceAssignment(value: unknown): ServiceAssignment | null {
  const source = asRecord(value);
  const module = toModuleKey(pickFirstDefined(source.module, source.module_key, source.moduleKey));
  const id = asOptionalString(source.id);
  const deviceId = asOptionalString(pickFirstDefined(source.deviceId, source.device_id));
  const identifierId = asOptionalString(pickFirstDefined(source.identifierId, source.identifier_id));
  const employeeId = asOptionalString(pickFirstDefined(source.employeeId, source.employee_id));

  if (!module || !id || !deviceId || !identifierId || !employeeId) {
    return null;
  }

  return {
    id,
    module,
    deviceId,
    identifierId,
    employeeId,
    createdAt: asString(pickFirstDefined(source.createdAt, source.created_at), new Date().toISOString()),
    updatedAt: asString(pickFirstDefined(source.updatedAt, source.updated_at), new Date().toISOString()),
  };
}

function toHistoryEvent(value: unknown): HistoryEvent | null {
  const source = asRecord(value);
  const module = toModuleKey(pickFirstDefined(source.module, source.module_key, source.moduleKey));
  const id = asOptionalString(source.id);
  const deviceId = asOptionalString(pickFirstDefined(source.deviceId, source.device_id));

  if (!module || !id || !deviceId) {
    return null;
  }

  return {
    id,
    module,
    deviceId,
    employee: asString(source.employee, 'Inconnu'),
    identifier: asString(source.identifier, 'N/A'),
    device: asString(source.device, 'Boitier'),
    action: asString(source.action, 'Evenement'),
    occurredAt: asString(pickFirstDefined(source.occurredAt, source.occurred_at), new Date().toISOString()),
  };
}

function toFeedbackRecord(value: unknown): FeedbackRecord | null {
  const source = asRecord(value);
  const id = asOptionalString(source.id);
  const deviceId = asOptionalString(pickFirstDefined(source.deviceId, source.device_id));

  if (!id || !deviceId) {
    return null;
  }

  const sentimentValue = asString(source.sentiment).toLowerCase();
  const sentiment: FeedbackRecord['sentiment'] =
    sentimentValue === 'negative' || sentimentValue === 'neutral' || sentimentValue === 'positive'
      ? sentimentValue
      : 'neutral';

  return {
    id,
    deviceId,
    module: 'feedback',
    sentiment,
    createdAt: asString(pickFirstDefined(source.createdAt, source.created_at), new Date().toISOString()),
  };
}

function mapCollection<T>(values: unknown, mapper: (value: unknown) => T | null): T[] {
  return asArray(values).map(mapper).filter((entry): entry is T => entry !== null);
}

export function toAuthUser(value: unknown): AuthUser {
  const source = asRecord(value);
  return {
    id: asString(pickFirstDefined(source.id, source.user_id), ''),
    firstName: asString(pickFirstDefined(source.firstName, source.first_name), ''),
    lastName: asString(pickFirstDefined(source.lastName, source.last_name), ''),
    email: asString(source.email, ''),
    company: asString(source.company, ''),
  };
}

export function toSessionUserResponse(value: unknown): AuthUser {
  const root = asRecord(value);
  const source = getPayloadSource(value);
  const data = asRecord(root.data);
  const userSource = asRecord(
    pickFirstDefined(source.user, source.profile, data.user, root.user, source),
  );
  const user = toAuthUser(userSource);

  if (!user.id) {
    throw new Error('Session API invalide.');
  }

  return user;
}

export function toAuthResponse(value: unknown): NormalizedAuthResponse {
  const root = asRecord(value);
  const source = getPayloadSource(value);
  const data = asRecord(root.data);
  const token = asString(
    pickFirstDefined(
      source.token,
      source.access_token,
      source.accessToken,
      data.token,
      data.access_token,
      data.accessToken,
      root.token,
      root.access_token,
      root.accessToken,
    ),
    '',
  );
  const userSource = asRecord(
    pickFirstDefined(source.user, source.profile, data.user, root.user, root.profile),
  );
  const user = toAuthUser(userSource);

  if (!token || !user.id) {
    throw new Error('Reponse auth invalide.');
  }

  return {
    token,
    user,
  };
}

export function toWhatsAppOtpRequestResponse(value: unknown): NormalizedWhatsAppOtpRequestResponse {
  const root = asRecord(value);
  const source = getPayloadSource(value);
  const data = asRecord(root.data);
  const requestId = asString(
    pickFirstDefined(source.requestId, source.request_id, data.requestId, root.requestId),
    '',
  );

  if (!requestId) {
    throw new Error('Reponse OTP invalide.');
  }

  return {
    requestId,
    expiresAt: asString(
      pickFirstDefined(source.expiresAt, source.expires_at, data.expiresAt, root.expiresAt),
      '',
    ),
    debugCode: asOptionalString(
      pickFirstDefined(source.debugCode, source.debug_code, data.debugCode, root.debugCode),
    ),
  };
}

export function toProductList(value: unknown): Product[] {
  const source = getPayloadSource(value);
  const list = Array.isArray(value)
    ? value
    : asArray(pickFirstDefined(source.items, source.products, source.catalog, source.data));

  return list
    .map((entry) => {
      const item = asRecord(entry);
      const id = asOptionalString(item.id);
      const module = toModuleKey(pickFirstDefined(item.module, item.module_key, item.moduleKey));

      if (!id || !module) {
        return null;
      }

      const kindValue = asString(pickFirstDefined(item.kind, item.type)).toLowerCase();
      const kind: Product['kind'] = kindValue === 'identifier-pack' ? 'identifier-pack' : 'device';
      const identifierType = toIdentifierType(
        pickFirstDefined(item.identifierType, item.identifier_type),
      );

      return {
        id,
        apiSku: asOptionalString(pickFirstDefined(item.apiSku, item.api_sku)),
        kind,
        module,
        identifierType: identifierType || undefined,
        label: asString(pickFirstDefined(item.label, item.name), id),
        description: asString(item.description, ''),
        unitPrice: asNumber(pickFirstDefined(item.unitPrice, item.unit_price, item.price), 0),
        stockLimit:
          pickFirstDefined(item.stockLimit, item.stock_limit) !== undefined
            ? asNumber(pickFirstDefined(item.stockLimit, item.stock_limit), 0)
            : undefined,
        includedIdentifiers:
          pickFirstDefined(item.includedIdentifiers, item.included_identifiers) !== undefined
            ? asNumber(pickFirstDefined(item.includedIdentifiers, item.included_identifiers), 0)
            : undefined,
        quantityPerPack:
          pickFirstDefined(item.quantityPerPack, item.quantity_per_pack) !== undefined
            ? asNumber(pickFirstDefined(item.quantityPerPack, item.quantity_per_pack), 0)
            : undefined,
      } satisfies Product;
    })
    .filter((entry): entry is Product => entry !== null);
}

export function toMarketplaceState(value: unknown): MarketplaceStatePayload {
  const source = getMarketplaceSource(value);
  const stockSource = asRecord(
    pickFirstDefined(source.productStockById, source.product_stock_by_id),
  );

  const productStockById = Object.entries(stockSource).reduce<Record<string, number | null>>(
    (accumulator, [productId, stockValue]) => {
      accumulator[productId] = asNullableNumber(stockValue);
      return accumulator;
    },
    {},
  );

  return {
    productStockById,
    devices: mapCollection(
      pickFirstDefined(source.devices, source.device_units),
      toDeviceUnit,
    ),
    inventory: mapCollection(
      pickFirstDefined(source.inventory, source.identifiers),
      toInventoryIdentifier,
    ),
  };
}

export function toServicesState(value: unknown): ServicesStatePayload {
  const source = getServicesSource(value);

  return {
    employees: mapCollection(pickFirstDefined(source.employees, source.staff), toEmployee),
    assignments: mapCollection(
      pickFirstDefined(source.assignments, source.identifier_assignments),
      toServiceAssignment,
    ),
    history: mapCollection(
      pickFirstDefined(source.history, source.events, source.timeline),
      toHistoryEvent,
    ),
    feedbackRecords: mapCollection(
      pickFirstDefined(source.feedbackRecords, source.feedback_records),
      toFeedbackRecord,
    ),
  };
}

export function toPurchaseResponse(value: unknown): NormalizedPurchaseResponse {
  const source = getPayloadSource(value);
  const redirectModule =
    toModuleKey(pickFirstDefined(source.redirectModule, source.redirect_module)) || 'rfid-presence';

  return {
    purchaseId: asString(pickFirstDefined(source.purchaseId, source.purchase_id), ''),
    createdDevices: mapCollection(
      pickFirstDefined(source.createdDevices, source.created_devices),
      toDeviceUnit,
    ),
    createdIdentifiers: mapCollection(
      pickFirstDefined(source.createdIdentifiers, source.created_identifiers),
      toInventoryIdentifier,
    ),
    redirectModule,
    marketplaceState: toMarketplaceState(
      pickFirstDefined(source.marketplaceState, source.marketplace_state, source.marketplace),
    ),
  };
}

export function toActivateDeviceResponse(value: unknown): NormalizedActivateDeviceResponse {
  const source = getPayloadSource(value);
  const device = toDeviceUnit(pickFirstDefined(source.device, source.device_unit));

  if (!device) {
    throw new Error('Reponse activation boitier invalide.');
  }

  return {
    device,
    marketplaceState: toMarketplaceState(
      pickFirstDefined(source.marketplaceState, source.marketplace_state, source.marketplace),
    ),
  };
}

export function toServiceMutationResponse(value: unknown): NormalizedServiceMutationResponse {
  const source = getPayloadSource(value);
  const metaSource = getMutationMetaSource(value);
  const module = toModuleKey(pickFirstDefined(metaSource.module, metaSource.module_key)) || 'rfid-presence';

  return {
    servicesState: toServicesState(
      pickFirstDefined(source.servicesState, source.services_state, source.services),
    ),
    marketplaceState: toMarketplaceState(
      pickFirstDefined(source.marketplaceState, source.marketplace_state, source.marketplace),
    ),
    meta: {
      module,
      action: getAction(metaSource.action),
      employeeName: asString(
        pickFirstDefined(metaSource.employeeName, metaSource.employee_name),
        '',
      ),
      identifierCode: asString(
        pickFirstDefined(metaSource.identifierCode, metaSource.identifier_code),
        '',
      ),
      deviceName: asString(pickFirstDefined(metaSource.deviceName, metaSource.device_name), ''),
    },
  };
}

function mapDeviceForApi(value: DeviceUnit): UnknownRecord {
  return {
    id: value.id,
    module: value.module,
    name: value.name,
    location: value.location,
    provisionedMacAddress: value.provisionedMacAddress,
    systemIdentifier: value.systemIdentifier,
    configured: value.configured,
    capacity: value.capacity,
    createdAt: value.createdAt,
    activatedAt: value.activatedAt,
  };
}

function mapIdentifierForApi(value: InventoryIdentifier): UnknownRecord {
  return {
    id: value.id,
    module: value.module,
    type: value.type,
    code: value.code,
    status: value.status,
    deviceId: value.deviceId,
    employeeId: value.employeeId,
    acquiredAt: value.acquiredAt,
  };
}

function mapEmployeeForApi(value: Employee): UnknownRecord {
  return {
    id: value.id,
    firstName: value.firstName,
    lastName: value.lastName,
    fullName: value.fullName,
  };
}

function mapAssignmentForApi(value: ServiceAssignment): UnknownRecord {
  return {
    id: value.id,
    module: value.module,
    deviceId: value.deviceId,
    identifierId: value.identifierId,
    employeeId: value.employeeId,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function mapHistoryForApi(value: HistoryEvent): UnknownRecord {
  return {
    id: value.id,
    module: value.module,
    deviceId: value.deviceId,
    employee: value.employee,
    identifier: value.identifier,
    device: value.device,
    action: value.action,
    occurredAt: value.occurredAt,
  };
}

function mapFeedbackForApi(value: FeedbackRecord): UnknownRecord {
  return {
    id: value.id,
    deviceId: value.deviceId,
    module: value.module,
    sentiment: value.sentiment,
    createdAt: value.createdAt,
  };
}

export function toSignInPayload(payload: { email: string; password: string }): UnknownRecord {
  return {
    email: payload.email,
    password: payload.password,
  };
}

export function toSignUpPayload(payload: {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  password: string;
}): UnknownRecord {
  return {
    firstName: payload.firstName,
    lastName: payload.lastName,
    company: payload.company,
    email: payload.email,
    password: payload.password,
  };
}

export function toGoogleVerifyPayload(idToken: string): UnknownRecord {
  return {
    idToken,
  };
}

export function toWhatsAppRequestPayload(phone: string): UnknownRecord {
  return {
    phone,
  };
}

export function toWhatsAppVerifyPayload(payload: {
  requestId: string;
  code: string;
  phone: string;
}): UnknownRecord {
  return {
    requestId: payload.requestId,
    code: payload.code,
    phone: payload.phone,
  };
}

export function toPurchasePayload(payload: { productId: string; quantity: number }): UnknownRecord {
  return {
    productId: payload.productId,
    quantity: payload.quantity,
  };
}

export function toActivateDevicePayload(payload: DeviceConfigurationInput): UnknownRecord {
  return {
    name: payload.name,
    location: payload.location,
    systemIdentifier: payload.systemIdentifier,
  };
}

export function toAssignIdentifierPayload(payload: AssignIdentifierInput): UnknownRecord {
  return {
    module: payload.module,
    deviceId: payload.deviceId,
    identifierId: payload.identifierId,
    firstName: payload.firstName,
    lastName: payload.lastName,
  };
}

export function toReassignIdentifierPayload(payload: ReassignIdentifierInput): UnknownRecord {
  return {
    assignmentId: payload.assignmentId,
    deviceId: payload.deviceId,
    firstName: payload.firstName,
    lastName: payload.lastName,
  };
}

export function toMarketplaceStatePayloadForApi(payload: MarketplaceStatePayload): UnknownRecord {
  return {
    productStockById: { ...payload.productStockById },
    devices: payload.devices.map(mapDeviceForApi),
    inventory: payload.inventory.map(mapIdentifierForApi),
  };
}

export function toServicesStatePayloadForApi(payload: ServicesStatePayload): UnknownRecord {
  return {
    employees: payload.employees.map(mapEmployeeForApi),
    assignments: payload.assignments.map(mapAssignmentForApi),
    history: payload.history.map(mapHistoryForApi),
    feedbackRecords: payload.feedbackRecords.map(mapFeedbackForApi),
  };
}
