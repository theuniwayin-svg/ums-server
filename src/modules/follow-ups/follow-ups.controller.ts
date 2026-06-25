import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FollowUpsService } from './follow-ups.service';
import { CreateFollowUpDto } from './dto/follow-up.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('follow-ups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class FollowUpsController {
  constructor(private readonly followUpsService: FollowUpsService) {}

  @Get('follow-ups/pending')
  @ApiOperation({ summary: 'Get current user\'s pending follow-ups' })
  findPending(@CurrentUser() user: any) {
    return this.followUpsService.findPending(user);
  }

  @Get('leads/:leadId/follow-ups')
  @ApiOperation({ summary: 'Get all follow-ups for a lead' })
  findByLead(@Param('leadId') leadId: string, @CurrentUser() user: any) {
    return this.followUpsService.findByLead(leadId, user);
  }

  @Post('leads/:leadId/follow-ups')
  @ApiOperation({ summary: 'Create a follow-up reminder for a lead' })
  create(
    @Param('leadId') leadId: string,
    @Body() createFollowUpDto: CreateFollowUpDto,
    @CurrentUser() user: any,
  ) {
    return this.followUpsService.create(
      leadId,
      createFollowUpDto,
      user._id.toString(),
      user.name,
      user,
    );
  }

  @Patch('leads/:leadId/follow-ups/:followUpId/complete')
  @ApiOperation({ summary: 'Mark a follow-up as complete' })
  complete(
    @Param('leadId') leadId: string,
    @Param('followUpId') followUpId: string,
    @CurrentUser() user: any,
  ) {
    return this.followUpsService.complete(
      leadId,
      followUpId,
      user._id.toString(),
      user.name,
      user,
    );
  }
}
