import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  HttpStatus,
  HttpCode,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { LeadsService } from './leads.service';
import {
  CreateLeadDto,
  UpdateLeadDto,
  BulkUpdateLeadDto,
  BulkAssignLeadDto,
  DuplicateOverrideDto,
} from './dto/lead.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  // ⚠️ Must be before :id routes
  @Get('suggestions')
  @ApiOperation({ summary: 'Get autocomplete suggestions for course/college' })
  @ApiQuery({ name: 'field', enum: ['course', 'preferredCollege'] })
  @ApiQuery({ name: 'q', type: String })
  getSuggestions(
    @Query('field') field: 'course' | 'preferredCollege',
    @Query('q') q: string,
  ) {
    return this.leadsService.getSuggestions(field, q || '');
  }

  @Get('export')
  @Roles('admin')
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiOperation({ summary: 'Export leads as CSV (Admin only)' })
  async exportCsv(
    @Query('status') status: string,
    @Query('temperature') temperature: string,
    @Query('source') source: string,
    @Query('preferredCollege') preferredCollege: string,
    @Res() res: Response,
    @CurrentUser() user: any,
  ) {
    const leads = await this.leadsService.exportLeads({
      status,
      temperature,
      source,
      preferredCollege,
    }, user);

    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=leads-export-${date}.csv`,
    );

    const activeFilters = [status, temperature, source]
      .filter(Boolean)
      .join(', ');
    res.write(
      `// Exported by: ${user.email} | Date: ${new Date().toISOString()} | Filters: ${activeFilters || 'none'}\n`,
    );
    res.write(
      'Student Name,Phone,Parent Phone,Email,City,State,Course,College,Source,Status,Temperature,Tags,Created At\n',
    );

    for (const lead of leads) {
      const row = [
        (lead as any).studentName,
        (lead as any).phone,
        (lead as any).parentPhone || '',
        (lead as any).email || '',
        (lead as any).city || '',
        (lead as any).state || '',
        (lead as any).course || '',
        (lead as any).preferredCollege || '',
        (lead as any).source,
        (lead as any).status,
        (lead as any).temperature,
        ((lead as any).tags || []).join(';'),
        (lead as any).createdAt.toISOString(),
      ]
        .map((v) => {
          let str = String(v).replace(/"/g, '""');
          // Prevent CSV formula injection
          if (/^[=+\-@\t\r]/.test(str)) {
            str = "'" + str;
          }
          return `"${str}"`;
        })
        .join(',');
      res.write(row + '\n');
    }

    res.end();
  }

  @Get()
  @ApiOperation({ summary: 'List leads with filters and pagination' })
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  findAll(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('temperature') temperature?: string,
    @Query('source') source?: string,
    @Query('createdBy') createdBy?: string,
    @Query('q') q?: string,
    @Query('city') city?: string,
    @Query('course') course?: string,
    @Query('preferredCollege') preferredCollege?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: string,
  ) {
    return this.leadsService.findAll({
      status,
      temperature,
      source,
      createdBy,
      q,
      city,
      course,
      preferredCollege,
      dateFrom,
      dateTo,
      page,
      limit,
      sortBy,
      order,
    }, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lead by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.leadsService.findById(id, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new lead' })
  @ApiResponse({ status: 409, description: 'Duplicate phone number' })
  create(@Body() createLeadDto: CreateLeadDto, @CurrentUser() user: any) {
    return this.leadsService.create(
      createLeadDto,
      user._id.toString(),
      user.name,
    );
  }

  @Patch('bulk')
  @Roles('admin')
  @ApiOperation({ summary: 'Bulk update leads (Admin only)' })
  bulkUpdate(
    @Body() bulkUpdateDto: BulkUpdateLeadDto,
    @CurrentUser() user: any,
  ) {
    return this.leadsService.bulkUpdate(
      bulkUpdateDto,
      user._id.toString(),
      user.name,
      user,
    );
  }

  @Patch('bulk/assign')
  @Roles('admin')
  @ApiOperation({ summary: 'Bulk assign leads to a staff member (Admin only)' })
  bulkAssign(
    @Body() bulkAssignDto: BulkAssignLeadDto,
    @CurrentUser() user: any,
  ) {
    return this.leadsService.bulkAssign(
      bulkAssignDto,
      user._id.toString(),
      user.name,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update lead with optimistic locking' })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  update(
    @Param('id') id: string,
    @Body() updateLeadDto: UpdateLeadDto,
    @CurrentUser() user: any,
  ) {
    return this.leadsService.update(
      id,
      updateLeadDto,
      user._id.toString(),
      user.name,
      user,
    );
  }

  @Patch(':id/close')
  @Roles('admin')
  @ApiOperation({ summary: 'Close and soft-delete a lead (Admin only)' })
  close(@Param('id') id: string, @CurrentUser() user: any) {
    return this.leadsService.closeLead(id, user._id.toString(), user.name, user);
  }

  @Post(':id/duplicate-override')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin override for duplicate lead' })
  overrideDuplicate(
    @Param('id') duplicateLeadId: string,
    @Body() body: { createLead: CreateLeadDto; override: DuplicateOverrideDto },
    @CurrentUser() user: any,
  ) {
    return this.leadsService.overrideDuplicate(
      duplicateLeadId,
      body.createLead,
      body.override,
      user._id.toString(),
      user.name,
      user.role,
    );
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Soft delete a lead (Admin only)' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.leadsService.softDelete(id, user._id.toString(), user.name, user);
  }
}
