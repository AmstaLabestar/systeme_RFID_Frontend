export const queryKeys = {
  marketplace: {
    catalog: () => ['marketplace', 'catalog'] as const,
    state: (scope: string) => ['marketplace', 'state', scope] as const,
  },
  services: {
    state: (scope: string) => ['services', 'state', scope] as const,
    presenceSnapshot: (scope: string, lookbackHours = 24, lastEventsLimit = 50) =>
      ['services', 'presence-snapshot', scope, lookbackHours, lastEventsLimit] as const,
  },
};
