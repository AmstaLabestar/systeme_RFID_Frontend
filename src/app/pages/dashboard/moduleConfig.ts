import type { IdentifierType, ModuleKey } from '@/app/types';

export const moduleContent: Record<
  Exclude<ModuleKey, 'feedback'>,
  {
    title: string;
    description: string;
    identifierType: IdentifierType;
    assignmentLabel: string;
  }
> = {
  'rfid-presence': {
    title: 'RFID Presence',
    description:
      'Associez badges RFID et employes, puis suivez les passages entree/sortie par boitier.',
    identifierType: 'badge-rfid',
    assignmentLabel: 'badge',
  },
  'rfid-porte': {
    title: 'RFID Porte',
    description:
      'Controlez les acces de porte, les autorisations et la tracabilite complete par boitier.',
    identifierType: 'serrure-rfid',
    assignmentLabel: 'identifiant serrure',
  },
  biometrie: {
    title: 'Biometrie',
    description:
      'Pilotez la capacite d empreintes, les associations employes et l historique des passages.',
    identifierType: 'empreinte',
    assignmentLabel: 'empreinte',
  },
};
