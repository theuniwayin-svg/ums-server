import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotesService } from './notes.service';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leads/:leadId/notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notes for a lead' })
  findAll(@Param('leadId') leadId: string, @CurrentUser() user: any) {
    return this.notesService.findByLead(leadId, user);
  }

  @Post()
  @ApiOperation({ summary: 'Add a note to a lead' })
  create(
    @Param('leadId') leadId: string,
    @Body() createNoteDto: CreateNoteDto,
    @CurrentUser() user: any,
  ) {
    return this.notesService.create(
      leadId,
      createNoteDto,
      user._id.toString(),
      user.name,
      user,
    );
  }

  @Patch(':noteId')
  @ApiOperation({ summary: 'Update a note' })
  update(
    @Param('leadId') leadId: string,
    @Param('noteId') noteId: string,
    @Body() updateNoteDto: UpdateNoteDto,
    @CurrentUser() user: any,
  ) {
    return this.notesService.update(
      leadId,
      noteId,
      updateNoteDto,
      user._id.toString(),
      user.role,
      user,
    );
  }

  @Delete(':noteId')
  @ApiOperation({ summary: 'Delete a note' })
  remove(@Param('noteId') noteId: string, @CurrentUser() user: any) {
    return this.notesService.remove(noteId, user._id.toString(), user.role, user);
  }
}
