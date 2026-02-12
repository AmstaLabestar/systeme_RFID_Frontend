import { MARKETPLACE_CATALOG } from '@/app/data';
import type { Product } from '@/app/types';
import { delay } from './utils';

export const marketplaceService = {
  async fetchCatalog(): Promise<Product[]> {
    await delay(200);
    return MARKETPLACE_CATALOG;
  },
};
