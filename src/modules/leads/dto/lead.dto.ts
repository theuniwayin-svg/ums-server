import {
  IsString,
  IsOptional,
  IsEnum,
  IsEmail,
  IsArray,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  LeadSource,
  LeadStatus,
  LeadTemperature,
} from '../schemas/lead.schema';

export class CreateLeadDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  studentName: string;

  @ApiProperty()
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Invalid phone number format' })
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Invalid parent phone number' })
  parentPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  course?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  preferredCollege?: string;

  @ApiProperty({ enum: LeadSource })
  @IsEnum(LeadSource)
  source: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => o.source === LeadSource.OTHER)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  otherSourceDescription?: string;

  @ApiPropertyOptional({ enum: LeadStatus })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: string;

  @ApiPropertyOptional({ enum: LeadTemperature })
  @IsOptional()
  @IsEnum(LeadTemperature)
  temperature?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateLeadDto {
  @ApiPropertyOptional()
  @IsNumber()
  version: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  studentName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\+?[0-9]{10,15}$/)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\+?[0-9]{10,15}$/)
  parentPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  course?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  preferredCollege?: string;

  @ApiPropertyOptional({ enum: LeadSource })
  @IsOptional()
  @IsEnum(LeadSource)
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  otherSourceDescription?: string;

  @ApiPropertyOptional({ enum: LeadStatus })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: string;

  @ApiPropertyOptional({ enum: LeadTemperature })
  @IsOptional()
  @IsEnum(LeadTemperature)
  temperature?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  tags?: string[];
}

export class BulkUpdateLeadDto {
  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  leadIds: string[];

  @ApiProperty({ enum: ['status', 'temperature'] })
  @IsString()
  action: string;

  @ApiProperty()
  @IsString()
  value: string;
}

export class BulkAssignLeadDto {
  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  leadIds: string[];

  @ApiProperty()
  @IsString()
  assignedTo: string;
}

export class DuplicateOverrideDto {
  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  reason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  duplicateLeadId?: string;
}

export class LeadFiltersDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  temperature?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  course?: string;

  @IsOptional()
  @IsString()
  preferredCollege?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  limit?: number;

  @IsOptional()
  page?: number;

  @IsOptional()
  sortBy?: string;

  @IsOptional()
  order?: string;
}
