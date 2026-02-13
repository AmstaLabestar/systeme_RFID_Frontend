export const queryKeys = {
  marketplace: {
    catalog: () => ['marketplace', 'catalog'] as const,
    state: (scope: string) => ['marketplace', 'state', scope] as const,
  },
  services: {
    state: (scope: string) => ['services', 'state', scope] as const,
  },
};
