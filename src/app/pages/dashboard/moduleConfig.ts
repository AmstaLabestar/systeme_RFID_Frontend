import type { IdentifierType, ModuleKey } from '@/app/types';

export const moduleContent: Record<
  Exclude<ModuleKey, 'feedback'>,
  {
    titleKey: string;
    descriptionKey: string;
    identifierType: IdentifierType;
    assignmentLabelKey: string;
  }
> = {
  'rfid-presence': {
    titleKey: 'module.rfid-presence',
    descriptionKey: 'access.module.rfidPresence.description',
    identifierType: 'badge-rfid',
    assignmentLabelKey: 'access.assignment.badge',
  },
  'rfid-porte': {
    titleKey: 'module.rfid-porte',
    descriptionKey: 'access.module.rfidPorte.description',
    identifierType: 'serrure-rfid',
    assignmentLabelKey: 'access.assignment.lockIdentifier',
  },
  biometrie: {
    titleKey: 'module.biometrie',
    descriptionKey: 'access.module.biometrie.description',
    identifierType: 'empreinte',
    assignmentLabelKey: 'access.assignment.fingerprint',
  },
};
