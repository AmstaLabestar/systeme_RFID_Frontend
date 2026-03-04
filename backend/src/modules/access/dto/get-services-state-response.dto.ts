export interface CursorPageInfoDto {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

export interface ServiceStateEmployeeDto {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

export interface ServiceStateAssignmentDto {
  id: string;
  module: 'rfid-presence' | 'rfid-porte' | 'biometrie' | 'feedback';
  deviceId: string;
  identifierId: string;
  employeeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceStateHistoryEventDto {
  id: string;
  module: 'rfid-presence' | 'rfid-porte' | 'biometrie' | 'feedback';
  deviceId: string;
  employee: string;
  identifier: string;
  device: string;
  action: string;
  occurredAt: string;
}

export interface ServiceStateFeedbackRecordDto {
  id: string;
  deviceId: string;
  module: 'feedback';
  sentiment: string;
  source: string;
  comment?: string;
  createdAt: string;
}

export interface GetServicesStateResponseDto {
  employees: ServiceStateEmployeeDto[];
  assignments: ServiceStateAssignmentDto[];
  history: ServiceStateHistoryEventDto[];
  feedbackRecords: ServiceStateFeedbackRecordDto[];
  pagination: {
    employees: CursorPageInfoDto;
    assignments: CursorPageInfoDto;
    history: CursorPageInfoDto;
    feedbackRecords: CursorPageInfoDto;
  };
}
