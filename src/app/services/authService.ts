import type { AuthUser } from '@/app/types';
import { createId, delay } from './utils';

const USERS_STORAGE_KEY = 'rfid.mock.users';

interface StoredUser extends AuthUser {
  password: string;
}

export interface SignInPayload {
  email: string;
  password: string;
}

export interface SignUpPayload {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

function getSeedUsers(): StoredUser[] {
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

function readUsers(): StoredUser[] {
  const rawUsers = window.localStorage.getItem(USERS_STORAGE_KEY);

  if (!rawUsers) {
    const seedUsers = getSeedUsers();
    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(seedUsers));
    return seedUsers;
  }

  try {
    return JSON.parse(rawUsers) as StoredUser[];
  } catch {
    const seedUsers = getSeedUsers();
    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(seedUsers));
    return seedUsers;
  }
}

function writeUsers(users: StoredUser[]): void {
  window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function buildAuthResponse(user: StoredUser): AuthResponse {
  const { password: _password, ...safeUser } = user;
  const token = btoa(`${safeUser.id}:${Date.now()}`);

  return {
    token,
    user: safeUser,
  };
}

export const authService = {
  async signIn(payload: SignInPayload): Promise<AuthResponse> {
    await delay(300);

    const users = readUsers();
    const user = users.find(
      (item) => item.email.toLowerCase() === payload.email.toLowerCase() && item.password === payload.password,
    );

    if (!user) {
      throw new Error('Email ou mot de passe invalide.');
    }

    return buildAuthResponse(user);
  },

  async signUp(payload: SignUpPayload): Promise<AuthResponse> {
    await delay(350);

    const users = readUsers();
    const alreadyExists = users.some((item) => item.email.toLowerCase() === payload.email.toLowerCase());

    if (alreadyExists) {
      throw new Error('Ce compte existe deja.');
    }

    const newUser: StoredUser = {
      id: createId('usr'),
      firstName: payload.firstName,
      lastName: payload.lastName,
      company: payload.company,
      email: payload.email,
      password: payload.password,
    };

    const nextUsers = [newUser, ...users];
    writeUsers(nextUsers);

    return buildAuthResponse(newUser);
  },
};
