import { IsEnum, IsInt, Max, Min } from 'class-validator';
import { HardwareSystemCode, OrderTargetType } from '@prisma/client';

export class CreateMarketplaceOrderDto {
  @IsEnum(HardwareSystemCode)
  systemCode!: HardwareSystemCode;

  @IsEnum(OrderTargetType)
  targetType!: OrderTargetType;

  @IsInt()
  @Min(1)
  @Max(50)
  quantity!: number;
}
