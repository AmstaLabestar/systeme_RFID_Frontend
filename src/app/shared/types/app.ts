export type PageId =
  | 'dashboard'
  | 'rfid-badge'
  | 'rfid-door'
  | 'fingerprint'
  | 'feedback'
  | 'marketplace'
  | 'settings';

export interface Notifications {
  badgesToAssign: number;
  remainingCapacity: number;
}
