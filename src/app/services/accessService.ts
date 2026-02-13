import type { AssignIdentifierInput, ModuleKey, ReassignIdentifierInput } from '@/app/types';
import {
  SERVICES_ROUTES,
  toAssignIdentifierPayload,
  toReassignIdentifierPayload,
  toServiceMutationResponse,
} from './contracts';
import { systemApiClient, toApiErrorMessage } from './httpClient';
import type { MarketplaceStatePayload, ServicesStatePayload } from './types';

export interface ServiceMutationMeta {
  module: ModuleKey;
  action: 'assign' | 'remove' | 'reassign';
  employeeName: string;
  identifierCode: string;
  deviceName: string;
}

export interface ServiceMutationResponse {
  servicesState: ServicesStatePayload;
  marketplaceState: MarketplaceStatePayload;
  meta: ServiceMutationMeta;
}

export const accessService = {
  async assignIdentifier(payload: AssignIdentifierInput): Promise<ServiceMutationResponse> {
    try {
      const response = await systemApiClient.post<unknown>(
        SERVICES_ROUTES.assignments,
        toAssignIdentifierPayload(payload),
      );
      return toServiceMutationResponse(response.data);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Association impossible.'));
    }
  },

  async removeAssignment(assignmentId: string): Promise<ServiceMutationResponse> {
    try {
      const response = await systemApiClient.delete<unknown>(
        SERVICES_ROUTES.assignmentById(assignmentId),
      );
      return toServiceMutationResponse(response.data);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Suppression impossible.'));
    }
  },

  async reassignIdentifier(payload: ReassignIdentifierInput): Promise<ServiceMutationResponse> {
    try {
      const response = await systemApiClient.post<unknown>(
        SERVICES_ROUTES.reassignAssignment(payload.assignmentId),
        toReassignIdentifierPayload(payload),
      );
      return toServiceMutationResponse(response.data);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Reattribution impossible.'));
    }
  },
};
