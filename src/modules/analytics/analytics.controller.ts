import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get analytics dashboard data (Admin only)' })
  async getDashboard(@Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'max-age=300');
    return this.analyticsService.getDashboard();
  }

  @Get('staff-performance')
  @ApiOperation({ summary: 'Get staff performance metrics (Admin only)' })
  async getStaffPerformance(@Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'max-age=300');
    return this.analyticsService.getStaffPerformance();
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get lead creation trends (Admin only)' })
  async getTrends(
    @Query('period') period: string = '30d',
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'max-age=300');
    const days = parseInt(period.replace('d', '')) || 30;
    return this.analyticsService.getTrends(days);
  }
}
