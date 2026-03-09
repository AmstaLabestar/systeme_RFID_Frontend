import type {
  AssignIdentifierInput,
  ModuleKey,
  PresenceRealtimeScanEvent,
  ReassignIdentifierInput,
} from '@/app/types';
import {
  SERVICES_ROUTES,
  toAssignIdentifierPayload,
  toDisableIdentifierPayload,
  toPresenceRealtimeScanEvent,
  toPresenceSnapshot,
  toReassignIdentifierPayload,
  toServicesState,
  toServiceMutationResponse,
} from './contracts';
import { systemApiClient, toApiErrorMessage } from './httpClient';
import type {
  MarketplaceStatePayload,
  PresenceSnapshotPayload,
  ServicesStatePayload,
} from './types';

export interface ServiceMutationMeta {
  module: ModuleKey;
  action: 'assign' | 'remove' | 'reassign' | 'disable';
  employeeName: string;
  identifierCode: string;
  deviceName: string;
}

export interface ServiceMutationResponse {
  servicesState: ServicesStatePayload;
  marketplaceState: MarketplaceStatePayload;
  meta: ServiceMutationMeta;
}

export interface FetchPresenceSnapshotOptions {
  lookbackHours?: number;
  lastEventsLimit?: number;
}

export interface PresenceStreamHandlers {
  onScan: (event: PresenceRealtimeScanEvent) => void;
  onHeartbeat?: (event: { emittedAt: string }) => void;
  onError?: (event: Event) => void;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function getSystemApiBaseUrl(): string {
  const fallback = 'http://localhost:4012';
  const envBaseUrl = import.meta.env.VITE_SYSTEM_API_URL || import.meta.env.VITE_AUTH_API_URL;
  return normalizeBaseUrl(envBaseUrl || fallback);
}

function parseSseEventData(rawData: unknown): unknown {
  if (typeof rawData !== 'string') {
    return rawData;
  }

  try {
    return JSON.parse(rawData);
  } catch {
    return rawData;
  }
}

export const accessService = {
  async fetchServicesState(): Promise<ServicesStatePayload> {
    try {
      const response = await systemApiClient.get<unknown>(SERVICES_ROUTES.state);
      return toServicesState(response.data);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Impossible de charger l etat Services.'));
    }
  },

  async fetchPresenceSnapshot(
    options: FetchPresenceSnapshotOptions = {},
  ): Promise<PresenceSnapshotPayload> {
    try {
      const params: Record<string, number> = {};
      if (typeof options.lookbackHours === 'number') {
        params.lookbackHours = options.lookbackHours;
      }
      if (typeof options.lastEventsLimit === 'number') {
        params.lastEventsLimit = options.lastEventsLimit;
      }

      const response = await systemApiClient.get<unknown>(
        SERVICES_ROUTES.presenceSnapshot,
        Object.keys(params).length > 0 ? { params } : undefined,
      );
      return toPresenceSnapshot(response.data);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Impossible de charger le snapshot de presence.'));
    }
  },

  openPresenceStream(handlers: PresenceStreamHandlers): { close: () => void } {
    if (typeof EventSource === 'undefined') {
      throw new Error('EventSource indisponible dans cet environnement.');
    }

    const streamUrl = `${getSystemApiBaseUrl()}${SERVICES_ROUTES.presenceStream}`;
    const source = new EventSource(streamUrl, { withCredentials: true });

    source.addEventListener('presence.scan', (event) => {
      if (!(event instanceof MessageEvent)) {
        return;
      }

      try {
        const parsed = parseSseEventData(event.data);
        handlers.onScan(toPresenceRealtimeScanEvent(parsed));
      } catch {
        // Ignore malformed events to keep stream alive.
      }
    });

    source.addEventListener('presence.heartbeat', (event) => {
      if (!(event instanceof MessageEvent) || !handlers.onHeartbeat) {
        return;
      }

      const parsed = parseSseEventData(event.data) as Record<string, unknown>;
      const emittedAt =
        typeof parsed?.emittedAt === 'string' && parsed.emittedAt.trim().length > 0
          ? parsed.emittedAt
          : new Date().toISOString();
      handlers.onHeartbeat({ emittedAt });
    });

    source.onerror = (event) => {
      handlers.onError?.(event);
    };

    return {
      close: () => source.close(),
    };
  },

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

  async removeAssignment(
    assignmentId: string,
    options?: {
      reason?: string;
    },
  ): Promise<ServiceMutationResponse> {
    try {
      const response = await systemApiClient.delete<unknown>(
        SERVICES_ROUTES.assignmentById(assignmentId),
        {
          params: options?.reason
            ? {
                reason: options.reason,
              }
            : undefined,
        },
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

  async disableIdentifier(payload: {
    identifierId: string;
    reason: string;
  }): Promise<ServiceMutationResponse> {
    try {
      const response = await systemApiClient.post<unknown>(
        SERVICES_ROUTES.disableIdentifier(payload.identifierId),
        toDisableIdentifierPayload(payload),
      );
      return toServiceMutationResponse(response.data);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Desactivation impossible.'));
    }
  },
};
