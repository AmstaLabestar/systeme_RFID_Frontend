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

function getDefaultDbState() {
  return {
    users: getSeedUsers(),
    otpRequests: [],
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

ensureDbFile();

const adapter = new JSONFile(dbPath);
const db = new Low(adapter, {
  users: [],
  otpRequests: [],
});
await db.read();

db.data ||= {
  users: [],
  otpRequests: [],
};
db.data.users ||= [];
db.data.otpRequests ||= [];

if (db.data.users.length === 0) {
  db.data.users = getSeedUsers();
  await db.write();
}

const app = new App();
const jsonServerApp = createApp(db, { logger: false });

app.use(cors());
app.options('*', cors());
app.use(json());

app.get('/auth/system/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'auth-mock',
    timestamp: new Date().toISOString(),
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
  await db.write();

  const safeUser = toSafeUser(createdUser);
  const token = createToken(safeUser.id);

  res.status(201).json({
    token,
    user: safeUser,
  });
});

app.post('/auth/signin', (req, res) => {
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
