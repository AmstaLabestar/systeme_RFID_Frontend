import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { App } from '@tinyhttp/app';
import { cors } from '@tinyhttp/cors';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { json } from 'milliparsec';
import { createApp } from 'json-server/lib/app.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'db.json');
const port = Number(process.env.AUTH_API_PORT || 4011);
const otpTtlInMilliseconds = 5 * 60 * 1000;
const defaultDeviceStock = 100;

const defaultMarketplaceStockById = {
  'device-rfid-presence': defaultDeviceStock,
  'device-rfid-porte': defaultDeviceStock,
  'device-biometrie': defaultDeviceStock,
  'device-feedback': defaultDeviceStock,
  'pack-badge-rfid': null,
  'pack-empreinte': null,
  'pack-serrure-rfid': null,
};

const moduleLabels = {
  'rfid-presence': 'RFID Presence',
  'rfid-porte': 'RFID Porte',
  biometrie: 'Biometrie',
  feedback: 'Feedback',
};

const identifierPrefixes = {
  'badge-rfid': 'BAD',
  empreinte: 'EMP',
  'serrure-rfid': 'SER',
};

const identifierCounterSeed = {
  'badge-rfid': 1000,
  empreinte: 3000,
  'serrure-rfid': 2000,
};

const deviceCounterSeed = {
  'rfid-presence': 0,
  'rfid-porte': 0,
  biometrie: 0,
  feedback: 0,
};

const deviceMacCounterSeed = {
  'rfid-presence': 0,
  'rfid-porte': 0,
  biometrie: 0,
  feedback: 0,
};

const moduleMacSegment = {
  'rfid-presence': 0x31,
  'rfid-porte': 0x32,
  biometrie: 0x33,
  feedback: 0x34,
};

const moduleActionLabels = {
  'rfid-presence': {
    assign: 'Association badge employee',
    remove: 'Retrait badge employee',
  },
  'rfid-porte': {
    assign: 'Association identifiant porte',
    remove: 'Retrait identifiant porte',
  },
  biometrie: {
    assign: 'Association empreinte employee',
    remove: 'Retrait empreinte employee',
  },
  feedback: {
    assign: 'N/A',
    remove: 'N/A',
  },
};

const marketplaceCatalog = [
  {
    id: 'device-rfid-presence',
    apiSku: 'HW-RFP-001',
    kind: 'device',
    module: 'rfid-presence',
    identifierType: 'badge-rfid',
    label: 'Boitier RFID Presence',
    description: 'Unite centrale de gestion de presence et badges RFID.',
    unitPrice: 21000,
    stockLimit: defaultDeviceStock,
    includedIdentifiers: 5,
  },
  {
    id: 'device-rfid-porte',
    apiSku: 'HW-RFD-001',
    kind: 'device',
    module: 'rfid-porte',
    identifierType: 'serrure-rfid',
    label: 'Boitier RFID Porte',
    description: 'Unite centrale de controle d acces des portes.',
    unitPrice: 20000,
    stockLimit: defaultDeviceStock,
    includedIdentifiers: 5,
  },
  {
    id: 'device-biometrie',
    apiSku: 'HW-BIO-001',
    kind: 'device',
    module: 'biometrie',
    identifierType: 'empreinte',
    label: 'Boitier Empreinte Digitale',
    description: 'Unite centrale de reconnaissance biometrique.',
    unitPrice: 20000,
    stockLimit: defaultDeviceStock,
    includedIdentifiers: 5,
  },
  {
    id: 'device-feedback',
    apiSku: 'HW-FBK-001',
    kind: 'device',
    module: 'feedback',
    label: 'Boitier Feedback',
    description: 'Boitier a 3 boutons (negatif, neutre, positif) pour la satisfaction.',
    unitPrice: 15000,
    stockLimit: defaultDeviceStock,
    includedIdentifiers: 0,
  },
  {
    id: 'pack-badge-rfid',
    apiSku: 'PK-BAD-010',
    kind: 'identifier-pack',
    module: 'rfid-presence',
    identifierType: 'badge-rfid',
    label: 'Pack Badges RFID',
    description: '10 badges RFID supplementaires pour vos boitiers presence.',
    unitPrice: 1000,
    quantityPerPack: 10,
  },
  {
    id: 'pack-empreinte',
    apiSku: 'PK-BIO-010',
    kind: 'identifier-pack',
    module: 'biometrie',
    identifierType: 'empreinte',
    label: 'Pack Emprunts (Empreinte)',
    description: '10 identifiants biometrie supplementaires.',
    unitPrice: 1000,
    quantityPerPack: 10,
  },
  {
    id: 'pack-serrure-rfid',
    apiSku: 'PK-SER-010',
    kind: 'identifier-pack',
    module: 'rfid-porte',
    identifierType: 'serrure-rfid',
    label: 'Pack Serrures RFID',
    description: '10 identifiants de serrure supplementaires pour RFID Porte.',
    unitPrice: 1000,
    quantityPerPack: 10,
  },
];

const catalogById = new Map(marketplaceCatalog.map((product) => [product.id, product]));
const macAddressRegex = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;

function getSeedUsers() {
  return [
    {
      id: 'usr-admin',
      firstName: 'Admin',
      lastName: 'SaaS',
      company: 'Tech Souveraine',
      email: 'admin@techsouveraine.io',
      password: 'demo12345',
    },
  ];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDefaultMarketplaceState() {
  return {
    productStockById: {
      ...defaultMarketplaceStockById,
    },
    devices: [],
    inventory: [],
  };
}

function getDefaultServicesState() {
  return {
    employees: [
      { id: 'emp-1', firstName: 'Aminata', lastName: 'Diarra', fullName: 'Aminata Diarra' },
      { id: 'emp-2', firstName: 'Ibrahim', lastName: 'Diallo', fullName: 'Ibrahim Diallo' },
      { id: 'emp-3', firstName: 'Moussa', lastName: 'Sana', fullName: 'Moussa Sana' },
      { id: 'emp-4', firstName: 'Fati', lastName: 'Bikienga', fullName: 'Fati Bikienga' },
    ],
    assignments: [],
    history: [
      {
        id: 'hist-seed-1',
        module: 'rfid-presence',
        deviceId: 'seed-device-rfid-presence-1',
        employee: 'Aminata Diarra',
        identifier: 'BAD-1001',
        device: 'Boitier Presence #1',
        action: 'Entree employee',
        occurredAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      },
      {
        id: 'hist-seed-2',
        module: 'rfid-porte',
        deviceId: 'seed-device-rfid-porte-1',
        employee: 'Ibrahim Diallo',
        identifier: 'SER-2001',
        device: 'Boitier Porte #1',
        action: 'Ouverture porte principale',
        occurredAt: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
      },
      {
        id: 'hist-seed-3',
        module: 'biometrie',
        deviceId: 'seed-device-biometrie-1',
        employee: 'Moussa Sana',
        identifier: 'EMP-3001',
        device: 'Boitier Biometrie #1',
        action: 'Verification biometrie reussie',
        occurredAt: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
      },
    ],
    feedbackRecords: [],
  };
}

function getDefaultSystemsState() {
  return {
    marketplace: getDefaultMarketplaceState(),
    services: getDefaultServicesState(),
  };
}

function getDefaultDbState() {
  return {
    users: getSeedUsers(),
    otpRequests: [],
    systemsByUser: {},
  };
}

function ensureDbFile() {
  if (!existsSync(__dirname)) {
    mkdirSync(__dirname, { recursive: true });
  }

  if (!existsSync(dbPath)) {
    writeFileSync(dbPath, JSON.stringify(getDefaultDbState(), null, 2));
    return;
  }

  const fileContent = readFileSync(dbPath, 'utf-8').trim();
  if (!fileContent) {
    writeFileSync(dbPath, JSON.stringify(getDefaultDbState(), null, 2));
  }
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\s+/g, '');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidPhone(phone) {
  return /^\+?[1-9]\d{7,14}$/.test(phone);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createId(prefix) {
  return `${prefix}-${randomUUID()}`;
}

function normalizeSystemIdentifier(value) {
  return String(value || '').trim().toUpperCase().replaceAll('-', ':');
}

function isValidSystemIdentifier(value) {
  return macAddressRegex.test(value);
}

function formatHex(value) {
  return value.toString(16).toUpperCase().padStart(2, '0');
}

function buildProvisionedMacAddress(module, sequence) {
  const moduleSegment = moduleMacSegment[module];
  const high = (sequence >> 8) & 0xff;
  const low = sequence & 0xff;

  return ['AA', '70', formatHex(moduleSegment), formatHex(high), formatHex(low), '01'].join(':');
}

function buildDeviceName(module, index) {
  return `Boitier ${moduleLabels[module]} #${index}`;
}

function parseCodeCounter(code, prefix) {
  const normalizedPrefix = `${prefix}-`;
  if (!String(code || '').startsWith(normalizedPrefix)) {
    return null;
  }

  const suffix = String(code).slice(normalizedPrefix.length);
  const parsed = Number.parseInt(suffix, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDeviceNameCounter(name) {
  const match = String(name || '').match(/#(\d+)$/);
  if (!match || !match[1]) {
    return null;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseProvisionedMacSequence(macAddress) {
  const normalized = normalizeSystemIdentifier(macAddress);
  const segments = normalized.split(':');

  if (segments.length !== 6) {
    return null;
  }

  const moduleSegment = Number.parseInt(segments[2] || '', 16);
  const high = Number.parseInt(segments[3] || '', 16);
  const low = Number.parseInt(segments[4] || '', 16);

  if (![moduleSegment, high, low].every(Number.isFinite)) {
    return null;
  }

  const moduleEntry = Object.entries(moduleMacSegment).find(([, value]) => value === moduleSegment);
  if (!moduleEntry) {
    return null;
  }

  return {
    module: moduleEntry[0],
    sequence: (high << 8) + low,
  };
}

function buildGenerationCounters(marketplaceState) {
  const identifierCounters = { ...identifierCounterSeed };
  const deviceCounters = { ...deviceCounterSeed };
  const deviceMacCounters = { ...deviceMacCounterSeed };

  marketplaceState.inventory.forEach((identifier) => {
    const prefix = identifierPrefixes[identifier.type];
    const parsed = parseCodeCounter(identifier.code, prefix);

    if (parsed !== null) {
      identifierCounters[identifier.type] = Math.max(identifierCounters[identifier.type], parsed);
    }
  });

  marketplaceState.devices.forEach((device) => {
    const parsedName = parseDeviceNameCounter(device.name);
    if (parsedName !== null) {
      deviceCounters[device.module] = Math.max(deviceCounters[device.module], parsedName);
    }

    const parsedMac = parseProvisionedMacSequence(device.provisionedMacAddress);
    if (parsedMac) {
      deviceMacCounters[parsedMac.module] = Math.max(deviceMacCounters[parsedMac.module], parsedMac.sequence);
    }
  });

  return {
    nextIdentifierCode(type) {
      identifierCounters[type] += 1;
      return `${identifierPrefixes[type]}-${identifierCounters[type]}`;
    },
    nextDeviceIndex(module) {
      deviceCounters[module] += 1;
      return deviceCounters[module];
    },
    nextProvisionedMacAddress(module) {
      deviceMacCounters[module] += 1;
      return buildProvisionedMacAddress(module, deviceMacCounters[module]);
    },
  };
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function upsertEmployee(servicesState, firstName, lastName) {
  const normalizedFirstName = normalizeName(firstName);
  const normalizedLastName = normalizeName(lastName);

  const existingEmployee = servicesState.employees.find(
    (employee) =>
      normalizeName(employee.firstName) === normalizedFirstName &&
      normalizeName(employee.lastName) === normalizedLastName,
  );

  if (existingEmployee) {
    return existingEmployee;
  }

  const createdEmployee = {
    id: createId('emp'),
    firstName: String(firstName || '').trim(),
    lastName: String(lastName || '').trim(),
    fullName: `${String(firstName || '').trim()} ${String(lastName || '').trim()}`,
  };

  servicesState.employees = [createdEmployee, ...servicesState.employees];
  return createdEmployee;
}

function appendHistoryEvent(servicesState, payload) {
  const event = {
    id: createId('hist'),
    occurredAt: new Date().toISOString(),
    ...payload,
  };

  servicesState.history = [event, ...servicesState.history];
  return event;
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function createToken(subject) {
  return Buffer.from(`${subject}:${Date.now()}:whatsapp`).toString('base64');
}

function toSafeUser(user) {
  const { password: _password, phone: _phone, ...safeUser } = user;
  return safeUser;
}

function getTokenFromAuthorizationHeader(headerValue) {
  const normalizedValue = String(headerValue || '').trim();
  if (!normalizedValue) {
    return '';
  }

  if (normalizedValue.toLowerCase().startsWith('bearer ')) {
    return normalizedValue.slice(7).trim();
  }

  return normalizedValue;
}

function decodeTokenSubject(token) {
  if (!token) {
    return null;
  }

  try {
    const decodedToken = Buffer.from(token, 'base64').toString('utf-8');
    const [subject] = decodedToken.split(':');
    return subject ? subject.trim() : null;
  } catch {
    return null;
  }
}

function decodeGoogleIdToken(idToken) {
  const segments = String(idToken || '').split('.');

  if (segments.length < 2 || !segments[1]) {
    throw new Error('Token Google invalide.');
  }

  const base64Payload = segments[1].replace(/-/g, '+').replace(/_/g, '/');
  const paddedPayload = base64Payload.padEnd(Math.ceil(base64Payload.length / 4) * 4, '=');
  const decodedPayload = Buffer.from(paddedPayload, 'base64').toString('utf-8');

  try {
    return JSON.parse(decodedPayload);
  } catch {
    throw new Error('Impossible de lire les informations Google.');
  }
}

function parseGoogleDisplayName(payload) {
  if (payload.given_name || payload.family_name) {
    return {
      firstName: String(payload.given_name || 'Google').trim() || 'Google',
      lastName: String(payload.family_name || 'User').trim() || 'User',
    };
  }

  if (payload.name) {
    const [firstName, ...rest] = String(payload.name).trim().split(/\s+/);
    return {
      firstName: firstName || 'Google',
      lastName: rest.join(' ') || 'User',
    };
  }

  return {
    firstName: 'Google',
    lastName: 'User',
  };
}

function getRequestUserId(req, res) {
  const authorizationHeader = req.headers?.authorization;
  const token = getTokenFromAuthorizationHeader(authorizationHeader);
  const userId = decodeTokenSubject(token);

  if (!userId) {
    res.status(401).json({ message: 'Session invalide ou expiree. Reconnectez-vous.' });
    return null;
  }

  const userExists = db.data.users.some((entry) => entry.id === userId);

  if (!userExists) {
    res.status(401).json({ message: 'Session invalide ou utilisateur inconnu.' });
    return null;
  }

  return userId;
}

function ensureSystemsStateShape(systemsState) {
  const defaultSystemsState = getDefaultSystemsState();

  systemsState.marketplace ||= cloneJson(defaultSystemsState.marketplace);
  systemsState.services ||= cloneJson(defaultSystemsState.services);
  systemsState.marketplace.productStockById ||= cloneJson(defaultSystemsState.marketplace.productStockById);
  systemsState.marketplace.devices ||= [];
  systemsState.marketplace.inventory ||= [];
  systemsState.services.employees ||= cloneJson(defaultSystemsState.services.employees);
  systemsState.services.assignments ||= [];
  systemsState.services.history ||= cloneJson(defaultSystemsState.services.history);
  systemsState.services.feedbackRecords ||= [];

  Object.entries(defaultMarketplaceStockById).forEach(([productId, stock]) => {
    if (!(productId in systemsState.marketplace.productStockById)) {
      systemsState.marketplace.productStockById[productId] = stock;
    }
  });

  return systemsState;
}

function getOrCreateSystemsStateForUser(userId) {
  db.data.systemsByUser ||= {};

  if (!db.data.systemsByUser[userId]) {
    db.data.systemsByUser[userId] = getDefaultSystemsState();
  }

  return ensureSystemsStateShape(db.data.systemsByUser[userId]);
}

ensureDbFile();

const adapter = new JSONFile(dbPath);
const db = new Low(adapter, {
  users: [],
  otpRequests: [],
  systemsByUser: {},
});
await db.read();

const defaultDbState = getDefaultDbState();

db.data ||= cloneJson(defaultDbState);
db.data.users ||= cloneJson(defaultDbState.users);
db.data.otpRequests ||= cloneJson(defaultDbState.otpRequests);
db.data.systemsByUser ||= {};

if (db.data.users.length === 0) {
  db.data.users = cloneJson(defaultDbState.users);
}

if (
  isPlainObject(db.data.systems) &&
  Object.keys(db.data.systemsByUser).length === 0
) {
  const migrationOwnerId = db.data.users[0]?.id || 'usr-admin';
  db.data.systemsByUser[migrationOwnerId] = ensureSystemsStateShape(cloneJson(db.data.systems));
}

Object.values(db.data.systemsByUser).forEach((systemsState) => {
  ensureSystemsStateShape(systemsState);
});

await db.write();

const app = new App();
const jsonServerApp = createApp(db, { logger: false });

const corsOptions = {
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(json());

app.get('/auth/system/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'auth-mock',
    timestamp: new Date().toISOString(),
  });
});

app.get('/systems/state', (req, res) => {
  const userId = getRequestUserId(req, res);
  if (!userId) {
    return;
  }

  const systemsState = getOrCreateSystemsStateForUser(userId);
  res.json(systemsState);
});

app.get('/systems/marketplace-state', (req, res) => {
  const userId = getRequestUserId(req, res);
  if (!userId) {
    return;
  }

  const systemsState = getOrCreateSystemsStateForUser(userId);
  res.json(systemsState.marketplace);
});

app.put('/systems/marketplace-state', async (req, res) => {
  const userId = getRequestUserId(req, res);
  if (!userId) {
    return;
  }

  const payload = req.body;

  if (
    !isPlainObject(payload) ||
    !isPlainObject(payload.productStockById) ||
    !Array.isArray(payload.devices) ||
    !Array.isArray(payload.inventory)
  ) {
    res.status(400).json({ message: 'Payload marketplace invalide.' });
    return;
  }

  const systemsState = getOrCreateSystemsStateForUser(userId);

  systemsState.marketplace = {
    productStockById: payload.productStockById,
    devices: payload.devices,
    inventory: payload.inventory,
  };
  await db.write();

  res.json(systemsState.marketplace);
});

app.get('/systems/services-state', (req, res) => {
  const userId = getRequestUserId(req, res);
  if (!userId) {
    return;
  }

  const systemsState = getOrCreateSystemsStateForUser(userId);
  res.json(systemsState.services);
});

app.put('/systems/services-state', async (req, res) => {
  const userId = getRequestUserId(req, res);
  if (!userId) {
    return;
  }

  const payload = req.body;

  if (
    !isPlainObject(payload) ||
    !Array.isArray(payload.employees) ||
    !Array.isArray(payload.assignments) ||
    !Array.isArray(payload.history) ||
    !Array.isArray(payload.feedbackRecords)
  ) {
    res.status(400).json({ message: 'Payload services invalide.' });
    return;
  }

  const systemsState = getOrCreateSystemsStateForUser(userId);

  systemsState.services = {
    employees: payload.employees,
    assignments: payload.assignments,
    history: payload.history,
    feedbackRecords: payload.feedbackRecords,
  };
  await db.write();

  res.json(systemsState.services);
});

app.get('/marketplace/catalog', (_req, res) => {
  res.json(marketplaceCatalog);
});

app.get('/marketplace/state', (req, res) => {
  const userId = getRequestUserId(req, res);
  if (!userId) {
    return;
  }

  const systemsState = getOrCreateSystemsStateForUser(userId);
  res.json(systemsState.marketplace);
});

app.post('/marketplace/purchases', async (req, res) => {
  const userId = getRequestUserId(req, res);
  if (!userId) {
    return;
  }

  const productId = String(req.body?.productId || '');
  const quantity = Number.parseInt(String(req.body?.quantity || ''), 10);
  const product = catalogById.get(productId);

  if (!product) {
    res.status(404).json({ message: 'Produit introuvable.' });
    return;
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    res.status(400).json({ message: 'La quantite doit etre superieure a 0.' });
    return;
  }

  const systemsState = getOrCreateSystemsStateForUser(userId);
  const marketplaceState = systemsState.marketplace;
  const remainingStock = marketplaceState.productStockById[product.id] ?? null;

  if (remainingStock !== null && quantity > remainingStock) {
    res.status(400).json({ message: 'Stock materiel insuffisant pour ce boitier.' });
    return;
  }

  const counters = buildGenerationCounters(marketplaceState);
  const createdAt = new Date().toISOString();
  const createdDevices = [];
  const createdIdentifiers = [];

  if (product.kind === 'device') {
    for (let index = 0; index < quantity; index += 1) {
      const deviceNumber = counters.nextDeviceIndex(product.module);
      const deviceId = createId('device');
      const provisionedMacAddress = counters.nextProvisionedMacAddress(product.module);
      const createdDevice = {
        id: deviceId,
        module: product.module,
        name: buildDeviceName(product.module, deviceNumber),
        location: 'A configurer',
        provisionedMacAddress,
        configured: false,
        capacity: product.includedIdentifiers ?? 0,
        createdAt,
      };

      createdDevices.push(createdDevice);

      if (product.identifierType && (product.includedIdentifiers ?? 0) > 0) {
        for (let codeIndex = 0; codeIndex < (product.includedIdentifiers ?? 0); codeIndex += 1) {
          createdIdentifiers.push({
            id: createId('idn'),
            module: product.module,
            type: product.identifierType,
            code: counters.nextIdentifierCode(product.identifierType),
            status: 'available',
            deviceId,
            acquiredAt: createdAt,
          });
        }
      }
    }
  }

  if (product.kind === 'identifier-pack' && product.identifierType && product.quantityPerPack) {
    const count = quantity * product.quantityPerPack;

    for (let index = 0; index < count; index += 1) {
      createdIdentifiers.push({
        id: createId('idn'),
        module: product.module,
        type: product.identifierType,
        code: counters.nextIdentifierCode(product.identifierType),
        status: 'available',
        acquiredAt: createdAt,
      });
    }
  }

  if (remainingStock !== null) {
    marketplaceState.productStockById[product.id] = Math.max(remainingStock - quantity, 0);
  }

  marketplaceState.devices = [...marketplaceState.devices, ...createdDevices];
  marketplaceState.inventory = [...marketplaceState.inventory, ...createdIdentifiers];

  await db.write();

  res.status(201).json({
    purchaseId: createId('purchase'),
    createdDevices,
    createdIdentifiers,
    redirectModule: product.module,
    marketplaceState,
  });
});

app.post('/marketplace/devices/:deviceId/activate', async (req, res) => {
  const userId = getRequestUserId(req, res);
  if (!userId) {
    return;
  }

  const deviceId = String(req.params?.deviceId || '');
  const name = String(req.body?.name || '').trim();
  const location = String(req.body?.location || '').trim();
  const systemIdentifier = normalizeSystemIdentifier(req.body?.systemIdentifier);

  if (!deviceId || !name || !location || !systemIdentifier) {
    res.status(400).json({ message: 'Payload activation incomplet.' });
    return;
  }

  if (!isValidSystemIdentifier(systemIdentifier)) {
    res.status(400).json({ message: 'Identifiant systeme invalide. Utilisez une adresse MAC valide.' });
    return;
  }

  const systemsState = getOrCreateSystemsStateForUser(userId);
  const marketplaceState = systemsState.marketplace;
  const targetDevice = marketplaceState.devices.find((device) => device.id === deviceId);

  if (!targetDevice) {
    res.status(404).json({ message: 'Boitier introuvable.' });
    return;
  }

  if (normalizeSystemIdentifier(targetDevice.provisionedMacAddress) !== systemIdentifier) {
    res.status(400).json({ message: 'La MAC fournie ne correspond pas a la MAC livree pour ce boitier.' });
    return;
  }

  const alreadyUsed = marketplaceState.devices.some(
    (device) =>
      device.id !== targetDevice.id &&
      typeof device.systemIdentifier === 'string' &&
      normalizeSystemIdentifier(device.systemIdentifier) === systemIdentifier,
  );

  if (alreadyUsed) {
    res.status(400).json({ message: 'Cet identifiant systeme est deja lie a un autre boitier.' });
    return;
  }

  const activatedAt = new Date().toISOString();
  targetDevice.configured = true;
  targetDevice.name = name;
  targetDevice.location = location;
  targetDevice.systemIdentifier = systemIdentifier;
  targetDevice.activatedAt = activatedAt;

  await db.write();

  res.json({
    device: targetDevice,
    marketplaceState,
  });
});

app.get('/services/state', (req, res) => {
  const userId = getRequestUserId(req, res);
  if (!userId) {
    return;
  }

  const systemsState = getOrCreateSystemsStateForUser(userId);
  res.json(systemsState.services);
});

app.post('/services/assignments', async (req, res) => {
  const userId = getRequestUserId(req, res);
  if (!userId) {
    return;
  }

  const module = String(req.body?.module || '');
  const deviceId = String(req.body?.deviceId || '');
  const identifierId = String(req.body?.identifierId || '');
  const firstName = String(req.body?.firstName || '').trim();
  const lastName = String(req.body?.lastName || '').trim();
  const systemsState = getOrCreateSystemsStateForUser(userId);
  const marketplaceState = systemsState.marketplace;
  const servicesState = systemsState.services;

  if (!module || !deviceId || !identifierId || !firstName || !lastName) {
    res.status(400).json({ message: 'Payload association incomplet.' });
    return;
  }

  const device = marketplaceState.devices.find((candidate) => candidate.id === deviceId && candidate.module === module);
  if (!device) {
    res.status(404).json({ message: 'Boitier introuvable pour ce module.' });
    return;
  }

  if (!device.configured) {
    res.status(400).json({ message: 'Configurez ce boitier avant l attribution.' });
    return;
  }

  const employee = upsertEmployee(servicesState, firstName, lastName);
  const alreadyAssigned = servicesState.assignments.some(
    (assignment) => assignment.module === module && assignment.employeeId === employee.id,
  );

  if (alreadyAssigned) {
    res.status(400).json({ message: 'Cet employee possede deja un identifiant sur ce module.' });
    return;
  }

  const identifier = marketplaceState.inventory.find((candidate) => candidate.id === identifierId);
  if (!identifier) {
    res.status(404).json({ message: 'Identifiant introuvable dans l inventaire.' });
    return;
  }

  if (identifier.module !== module) {
    res.status(400).json({ message: 'Cet identifiant n est pas compatible avec ce module.' });
    return;
  }

  if (identifier.status === 'assigned') {
    res.status(400).json({ message: 'Cet identifiant est deja attribue.' });
    return;
  }

  identifier.status = 'assigned';
  identifier.employeeId = employee.id;
  identifier.deviceId = deviceId;

  const now = new Date().toISOString();
  const assignment = {
    id: createId('asn'),
    module,
    deviceId,
    identifierId,
    employeeId: employee.id,
    createdAt: now,
    updatedAt: now,
  };

  servicesState.assignments = [assignment, ...servicesState.assignments];
  appendHistoryEvent(servicesState, {
    module,
    deviceId: device.id,
    employee: employee.fullName,
    identifier: identifier.code,
    device: device.name,
    action: moduleActionLabels[module]?.assign || 'Association identifiant',
  });

  await db.write();

  res.status(201).json({
    servicesState,
    marketplaceState,
    meta: {
      module,
      action: 'assign',
      employeeName: employee.fullName,
      identifierCode: identifier.code,
      deviceName: device.name,
    },
  });
});

app.delete('/services/assignments/:assignmentId', async (req, res) => {
  const userId = getRequestUserId(req, res);
  if (!userId) {
    return;
  }

  const assignmentId = String(req.params?.assignmentId || '');
  const systemsState = getOrCreateSystemsStateForUser(userId);
  const marketplaceState = systemsState.marketplace;
  const servicesState = systemsState.services;
  const assignment = servicesState.assignments.find((entry) => entry.id === assignmentId);

  if (!assignment) {
    res.status(404).json({ message: 'Association introuvable.' });
    return;
  }

  const employee = servicesState.employees.find((entry) => entry.id === assignment.employeeId);
  const device = marketplaceState.devices.find((entry) => entry.id === assignment.deviceId);
  const identifier = marketplaceState.inventory.find((entry) => entry.id === assignment.identifierId);

  if (!employee || !device || !identifier) {
    res.status(400).json({ message: 'Donnees incompletes pour retirer cette association.' });
    return;
  }

  identifier.status = 'available';
  identifier.employeeId = undefined;

  servicesState.assignments = servicesState.assignments.filter((entry) => entry.id !== assignmentId);
  appendHistoryEvent(servicesState, {
    module: assignment.module,
    deviceId: device.id,
    employee: employee.fullName,
    identifier: identifier.code,
    device: device.name,
    action: moduleActionLabels[assignment.module]?.remove || 'Retrait identifiant',
  });

  await db.write();

  res.json({
    servicesState,
    marketplaceState,
    meta: {
      module: assignment.module,
      action: 'remove',
      employeeName: employee.fullName,
      identifierCode: identifier.code,
      deviceName: device.name,
    },
  });
});

app.post('/services/assignments/:assignmentId/reassign', async (req, res) => {
  const userId = getRequestUserId(req, res);
  if (!userId) {
    return;
  }

  const assignmentId = String(req.params?.assignmentId || '');
  const deviceId = String(req.body?.deviceId || '');
  const firstName = String(req.body?.firstName || '').trim();
  const lastName = String(req.body?.lastName || '').trim();
  const systemsState = getOrCreateSystemsStateForUser(userId);
  const marketplaceState = systemsState.marketplace;
  const servicesState = systemsState.services;
  const assignment = servicesState.assignments.find((entry) => entry.id === assignmentId);

  if (!assignment) {
    res.status(404).json({ message: 'Association introuvable pour la reattribution.' });
    return;
  }

  const targetDevice = marketplaceState.devices.find((device) => device.id === deviceId);
  if (!targetDevice || !targetDevice.configured || targetDevice.module !== assignment.module) {
    res.status(400).json({ message: 'Boitier cible invalide.' });
    return;
  }

  const employee = upsertEmployee(servicesState, firstName, lastName);
  const duplicateEmployeeAssignment = servicesState.assignments.find(
    (entry) =>
      entry.module === assignment.module &&
      entry.employeeId === employee.id &&
      entry.id !== assignment.id,
  );

  if (duplicateEmployeeAssignment) {
    res.status(400).json({ message: 'Cet employee possede deja un identifiant sur ce module.' });
    return;
  }

  const identifier = marketplaceState.inventory.find((entry) => entry.id === assignment.identifierId);
  if (!identifier) {
    res.status(400).json({ message: 'Identifiant indisponible.' });
    return;
  }

  identifier.status = 'assigned';
  identifier.employeeId = employee.id;
  identifier.deviceId = targetDevice.id;

  assignment.employeeId = employee.id;
  assignment.deviceId = targetDevice.id;
  assignment.updatedAt = new Date().toISOString();

  appendHistoryEvent(servicesState, {
    module: assignment.module,
    deviceId: targetDevice.id,
    employee: employee.fullName,
    identifier: identifier.code,
    device: targetDevice.name,
    action: 'Reattribution identifiant',
  });

  await db.write();

  res.json({
    servicesState,
    marketplaceState,
    meta: {
      module: assignment.module,
      action: 'reassign',
      employeeName: employee.fullName,
      identifierCode: identifier.code,
      deviceName: targetDevice.name,
    },
  });
});

app.get('/auth/session', (req, res) => {
  const userId = getRequestUserId(req, res);
  if (!userId) {
    return;
  }

  const foundUser = db.data.users.find((entry) => entry.id === userId);

  if (!foundUser) {
    res.status(401).json({ message: 'Session invalide ou expiree.' });
    return;
  }

  res.json({
    user: toSafeUser(foundUser),
  });
});

app.post('/auth/google/verify', async (req, res) => {
  const idToken = String(req.body?.idToken || '').trim();

  if (!idToken) {
    res.status(400).json({ message: 'Token Google manquant.' });
    return;
  }

  let decodedPayload;

  try {
    decodedPayload = decodeGoogleIdToken(idToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token Google invalide.';
    res.status(400).json({ message });
    return;
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const validIssuer =
    decodedPayload.iss === 'https://accounts.google.com' || decodedPayload.iss === 'accounts.google.com';

  if (!validIssuer) {
    res.status(400).json({ message: 'Issuer Google invalide.' });
    return;
  }

  if (!decodedPayload.sub) {
    res.status(400).json({ message: 'Identifiant Google manquant.' });
    return;
  }

  if (Number(decodedPayload.exp) <= nowInSeconds) {
    res.status(400).json({ message: 'Le token Google a expire.' });
    return;
  }

  const email = normalizeEmail(decodedPayload.email);

  if (!email || !isValidEmail(email)) {
    res.status(400).json({ message: 'Email Google invalide.' });
    return;
  }

  if (decodedPayload.email_verified === false) {
    res.status(400).json({ message: 'Votre email Google doit etre verifie.' });
    return;
  }

  const existingByGoogleSub = db.data.users.find((entry) => entry.googleSub === decodedPayload.sub);
  const existingByEmail = db.data.users.find((entry) => normalizeEmail(entry.email) === email);
  const mergedUser = existingByGoogleSub || existingByEmail;
  const names = parseGoogleDisplayName(decodedPayload);

  let googleUser = null;

  if (mergedUser) {
    googleUser = {
      ...mergedUser,
      firstName: names.firstName,
      lastName: names.lastName,
      company: mergedUser.company || 'Google Workspace',
      email,
      password: mergedUser.password || 'oauth-google-managed',
      googleSub: decodedPayload.sub,
    };

    db.data.users = db.data.users.map((entry) => (entry.id === googleUser.id ? googleUser : entry));
  } else {
    const userSuffix = String(decodedPayload.sub).slice(-12);
    googleUser = {
      id: `usr-goog-${userSuffix}`,
      firstName: names.firstName,
      lastName: names.lastName,
      company: 'Google Workspace',
      email,
      password: 'oauth-google-managed',
      googleSub: decodedPayload.sub,
    };

    db.data.users = [googleUser, ...db.data.users];
  }

  getOrCreateSystemsStateForUser(googleUser.id);
  await db.write();

  const safeUser = toSafeUser(googleUser);
  const token = createToken(safeUser.id);

  res.json({
    token,
    user: safeUser,
  });
});

app.post('/auth/signup', async (req, res) => {
  const firstName = String(req.body?.firstName || '').trim();
  const lastName = String(req.body?.lastName || '').trim();
  const company = String(req.body?.company || '').trim();
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');

  if (!firstName || !lastName || !company || !email || !password) {
    res.status(400).json({ message: 'Tous les champs sont obligatoires.' });
    return;
  }

  if (!isValidEmail(email)) {
    res.status(400).json({ message: 'Email invalide.' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caracteres.' });
    return;
  }

  const alreadyExists = db.data.users.some((entry) => normalizeEmail(entry.email) === email);

  if (alreadyExists) {
    res.status(409).json({ message: 'Ce compte existe deja.' });
    return;
  }

  const createdUser = {
    id: `usr-${randomUUID()}`,
    firstName,
    lastName,
    company,
    email,
    password,
  };

  db.data.users = [createdUser, ...db.data.users];
  getOrCreateSystemsStateForUser(createdUser.id);
  await db.write();

  const safeUser = toSafeUser(createdUser);
  const token = createToken(safeUser.id);

  res.status(201).json({
    token,
    user: safeUser,
  });
});

app.post('/auth/signin', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');

  if (!email || !password) {
    res.status(400).json({ message: 'Email et mot de passe requis.' });
    return;
  }

  const foundUser = db.data.users.find(
    (entry) => normalizeEmail(entry.email) === email && entry.password === password,
  );

  if (!foundUser) {
    res.status(401).json({ message: 'Email ou mot de passe invalide.' });
    return;
  }

  const safeUser = toSafeUser(foundUser);
  const token = createToken(safeUser.id);
  getOrCreateSystemsStateForUser(safeUser.id);
  await db.write();

  res.json({
    token,
    user: safeUser,
  });
});

app.post('/auth/whatsapp/request', async (req, res) => {
  const phone = normalizePhone(req.body?.phone);

  if (!isValidPhone(phone)) {
    res.status(400).json({ message: 'Numero WhatsApp invalide.' });
    return;
  }

  const requestId = `otp-${randomUUID()}`;
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + otpTtlInMilliseconds).toISOString();

  db.data.otpRequests = [
    {
      id: requestId,
      phone,
      code,
      createdAt: new Date().toISOString(),
      expiresAt,
      consumed: false,
    },
    ...db.data.otpRequests
      .filter((entry) => {
        const expiresAtDate = new Date(entry.expiresAt).getTime();
        return Number.isFinite(expiresAtDate) && expiresAtDate >= Date.now() - otpTtlInMilliseconds;
      })
      .slice(0, 100),
  ];
  await db.write();

  res.status(201).json({
    requestId,
    expiresAt,
    debugCode: code,
  });
});

app.post('/auth/whatsapp/verify', async (req, res) => {
  const requestId = String(req.body?.requestId || '');
  const code = String(req.body?.code || '').trim();
  const phone = normalizePhone(req.body?.phone);

  if (!requestId || !code || !phone) {
    res.status(400).json({ message: 'Payload OTP incomplet.' });
    return;
  }

  const otpRequest = db.data.otpRequests.find((entry) => entry.id === requestId && entry.phone === phone);

  if (!otpRequest) {
    res.status(404).json({ message: 'Demande OTP introuvable.' });
    return;
  }

  if (otpRequest.consumed) {
    res.status(400).json({ message: 'Ce code OTP est deja utilise.' });
    return;
  }

  if (new Date(otpRequest.expiresAt).getTime() < Date.now()) {
    res.status(400).json({ message: 'Code OTP expire.' });
    return;
  }

  if (otpRequest.code !== code) {
    res.status(400).json({ message: 'Code OTP invalide.' });
    return;
  }

  otpRequest.consumed = true;
  otpRequest.verifiedAt = new Date().toISOString();

  let whatsappUser = db.data.users.find((entry) => entry.phone === phone);

  if (!whatsappUser) {
    const suffix = phone.replace(/[^\d]/g, '').slice(-4) || '0000';
    whatsappUser = {
      id: `usr-wa-${randomUUID()}`,
      firstName: 'WhatsApp',
      lastName: `User ${suffix}`,
      company: 'Tech Souveraine',
      email: `whatsapp.${suffix}@techsouveraine.io`,
      password: 'otp-managed',
      phone,
    };
    db.data.users = [whatsappUser, ...db.data.users];
  }

  getOrCreateSystemsStateForUser(whatsappUser.id);
  await db.write();

  const safeUser = toSafeUser(whatsappUser);
  const token = createToken(safeUser.id);

  res.json({
    token,
    user: safeUser,
  });
});

app.use(jsonServerApp);

app.listen(port, () => {
  console.log(`Auth mock API running on http://localhost:${port}`);
  console.log(`Health endpoint: http://localhost:${port}/auth/system/health`);
});
