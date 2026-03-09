import {
  Body,
  Controller,
  Delete,
  Get,
  MessageEvent,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';
import type { AccessTokenPayload } from '../../common/interfaces/jwt-payload.interface';
import { AccessService } from './access.service';
import { AssignIdentifierDto } from './dto/assign-identifier.dto';
import { DisableIdentifierDto } from './dto/disable-identifier.dto';
import { GetPresenceSnapshotQueryDto } from './dto/get-presence-snapshot-query.dto';
import { GetServicesStateQueryDto } from './dto/get-services-state-query.dto';
import { ReassignIdentifierDto } from './dto/reassign-identifier.dto';
import { RemoveAssignmentQueryDto } from './dto/remove-assignment-query.dto';
import type { Observable } from 'rxjs';

@Controller('services')
@UseGuards(JwtAuthGuard, TwoFactorAuthGuard)
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Get('state')
  getServicesState(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: GetServicesStateQueryDto,
  ) {
    return this.accessService.getServicesState(user.userId, query);
  }

  @Get('presence/snapshot')
  getPresenceSnapshot(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: GetPresenceSnapshotQueryDto,
  ) {
    return this.accessService.getPresenceSnapshot(user.userId, query);
  }

  @Sse('presence/stream')
  streamPresence(@CurrentUser() user: AccessTokenPayload): Observable<MessageEvent> {
    return this.accessService.streamPresenceEvents(user.userId);
  }

  @Post('assignments')
  assignIdentifier(@CurrentUser() user: AccessTokenPayload, @Body() dto: AssignIdentifierDto) {
    return this.accessService.assignIdentifier(user.userId, dto);
  }

  @Delete('assignments/:assignmentId')
  removeAssignment(
    @CurrentUser() user: AccessTokenPayload,
    @Param('assignmentId') assignmentId: string,
    @Query() query: RemoveAssignmentQueryDto,
  ) {
    return this.accessService.removeAssignment(user.userId, assignmentId, query.reason);
  }

  @Post('assignments/:assignmentId/reassign')
  reassignIdentifier(
    @CurrentUser() user: AccessTokenPayload,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: ReassignIdentifierDto,
  ) {
    return this.accessService.reassignIdentifier(user.userId, assignmentId, dto);
  }

  @Post('identifiers/:identifierId/disable')
  disableIdentifier(
    @CurrentUser() user: AccessTokenPayload,
    @Param('identifierId') identifierId: string,
    @Body() dto: DisableIdentifierDto,
  ) {
    return this.accessService.disableIdentifier(user.userId, identifierId, dto);
  }
}
