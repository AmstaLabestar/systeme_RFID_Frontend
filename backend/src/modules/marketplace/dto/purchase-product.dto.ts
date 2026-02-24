import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';
import { sanitizeString } from '../../../common/utils/security.util';

export class PurchaseProductDto {
  @Transform(({ value }) => sanitizeString(String(value)))
  @IsString()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}
