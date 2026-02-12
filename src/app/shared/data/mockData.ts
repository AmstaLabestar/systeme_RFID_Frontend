import type { Device, Notifications } from '../types';

export const mockDevices: Device[] = [
  {
    id: 1,
    name: 'Boitier #001',
    type: 'rfid-badge',
    badgesIncluded: 50,
    badgesAdded: 20,
    badgesUsed: 45,
    location: 'Entree principale',
  },
  {
    id: 2,
    name: 'Boitier #002',
    type: 'fingerprint',
    capacity: 100,
    used: 67,
    location: 'Bureau RH',
  },
  {
    id: 3,
    name: 'Boitier #003',
    type: 'rfid-door',
    doors: 3,
    location: 'Acces securises',
  },
  {
    id: 4,
    name: 'Boitier #004',
    type: 'feedback',
    location: 'Reception',
  },
];

export const defaultNotifications: Notifications = {
  badgesToAssign: 5,
  remainingCapacity: 25,
};
