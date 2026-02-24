import { IsArray, IsObject } from 'class-validator';

export class UpdateMarketplaceStateDto {
  @IsObject()
  productStockById!: Record<string, number | null>;

  @IsArray()
  devices!: unknown[];

  @IsArray()
  inventory!: unknown[];
}
