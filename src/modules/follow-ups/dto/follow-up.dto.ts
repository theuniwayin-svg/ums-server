import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FollowUpType } from '../schemas/follow-up.schema';

export class CreateFollowUpDto {
  @ApiProperty({ enum: FollowUpType })
  @IsEnum(FollowUpType)
  type: string;

  @ApiProperty()
  @IsDateString()
  scheduledFor: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
