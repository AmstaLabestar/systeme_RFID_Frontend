export type DeviceType = 'rfid-badge' | 'rfid-door' | 'fingerprint' | 'feedback';

interface BaseDevice {
  id: number;
  name: string;
  type: DeviceType;
  location: string;
}

export interface RFIDBadgeDevice extends BaseDevice {
  type: 'rfid-badge';
  badgesIncluded: number;
  badgesAdded: number;
  badgesUsed: number;
}

export interface RFIDDoorDevice extends BaseDevice {
  type: 'rfid-door';
  doors: number;
}

export interface FingerprintDevice extends BaseDevice {
  type: 'fingerprint';
  capacity: number;
  used: number;
}

export interface FeedbackDevice extends BaseDevice {
  type: 'feedback';
}

export type Device =
  | RFIDBadgeDevice
  | RFIDDoorDevice
  | FingerprintDevice
  | FeedbackDevice;

export const isRFIDBadgeDevice = (device: Device): device is RFIDBadgeDevice =>
  device.type === 'rfid-badge';

export const isRFIDDoorDevice = (device: Device): device is RFIDDoorDevice =>
  device.type === 'rfid-door';

export const isFingerprintDevice = (device: Device): device is FingerprintDevice =>
  device.type === 'fingerprint';

export const isFeedbackDevice = (device: Device): device is FeedbackDevice =>
  device.type === 'feedback';
