import type { Employee, FeedbackRecord, HistoryEvent, ModuleKey } from '@/app/types';

export const seedEmployees: Employee[] = [
  { id: 'emp-1', firstName: 'Aminata', lastName: 'Sarr', fullName: 'Aminata Sarr' },
  { id: 'emp-2', firstName: 'Ibrahima', lastName: 'Diallo', fullName: 'Ibrahima Diallo' },
  { id: 'emp-3', firstName: 'Moussa', lastName: 'Ndiaye', fullName: 'Moussa Ndiaye' },
  { id: 'emp-4', firstName: 'Fatou', lastName: 'Traore', fullName: 'Fatou Traore' },
];

export const seedHistory: HistoryEvent[] = [
  {
    id: 'hist-seed-1',
    module: 'rfid-presence',
    employee: 'Aminata Sarr',
    identifier: 'BAD-1001',
    device: 'Boitier Presence #1',
    action: 'Entree employee',
    occurredAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'hist-seed-2',
    module: 'rfid-porte',
    employee: 'Ibrahima Diallo',
    identifier: 'SER-2001',
    device: 'Boitier Porte #1',
    action: 'Ouverture porte principale',
    occurredAt: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
  },
  {
    id: 'hist-seed-3',
    module: 'biometrie',
    employee: 'Moussa Ndiaye',
    identifier: 'EMP-3001',
    device: 'Boitier Biometrie #1',
    action: 'Verification biometrie reussie',
    occurredAt: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
  },
];

export function buildFeedbackSeed(deviceId: string, days = 30): FeedbackRecord[] {
  const sentiments: Array<'negative' | 'neutral' | 'positive'> = ['positive', 'positive', 'neutral', 'negative'];
  const records: FeedbackRecord[] = [];

  for (let day = 0; day < days; day += 1) {
    const entriesToday = 6 + (day % 5);
    for (let index = 0; index < entriesToday; index += 1) {
      const sentiment = sentiments[(day + index) % sentiments.length];
      const createdAt = new Date(
        Date.now() - (day * 24 * 60 * 60 * 1000 + index * 60 * 60 * 1000),
      ).toISOString();

      records.push({
        id: `fb-${deviceId}-${day}-${index}`,
        deviceId,
        module: 'feedback',
        sentiment,
        createdAt,
      });
    }
  }

  return records;
}

export const moduleActionLabels: Record<ModuleKey, { assign: string; remove: string }> = {
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
