import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';
import type { AccessTokenPayload } from '../../common/interfaces/jwt-payload.interface';
import { AccessService } from './access.service';
import { AssignIdentifierDto } from './dto/assign-identifier.dto';
import { ReassignIdentifierDto } from './dto/reassign-identifier.dto';

@Controller('services')
@UseGuards(JwtAuthGuard, TwoFactorAuthGuard)
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Get('state')
  getServicesState(@CurrentUser() user: AccessTokenPayload) {
    return this.accessService.getServicesState(user.userId);
  }

  @Post('assignments')
  assignIdentifier(@CurrentUser() user: AccessTokenPayload, @Body() dto: AssignIdentifierDto) {
    return this.accessService.assignIdentifier(user.userId, dto);
  }

  @Delete('assignments/:assignmentId')
  removeAssignment(@CurrentUser() user: AccessTokenPayload, @Param('assignmentId') assignmentId: string) {
    return this.accessService.removeAssignment(user.userId, assignmentId);
  }

  @Post('assignments/:assignmentId/reassign')
  reassignIdentifier(
    @CurrentUser() user: AccessTokenPayload,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: ReassignIdentifierDto,
  ) {
    return this.accessService.reassignIdentifier(user.userId, assignmentId, dto);
  }
}
