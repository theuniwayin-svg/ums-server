import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private authService: AuthService,
    private auditService: AuditService,
  ) {}

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.userModel
        .find()
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(),
    ]);

    return {
      data,
      meta: { total, page, limit },
    };
  }

  async findById(id: string) {
    const user = await this.userModel
      .findById(id)
      .select('-passwordHash')
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async create(createUserDto: CreateUserDto, actor?: any) {
    const existing = await this.userModel.findOne({
      email: createUserDto.email.toLowerCase(),
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(createUserDto.password, 12);

    const user = await this.userModel.create({
      name: createUserDto.name,
      email: createUserDto.email.toLowerCase(),
      passwordHash,
      role: createUserDto.role || 'staff',
    });

    if (actor) {
      await this.auditService.log({
        performedBy: actor._id.toString(),
        performedByName: actor.name,
        action: 'USER_CREATED',
        metadata: { userId: user._id.toString(), email: user.email, role: user.role },
      });
    }

    const { passwordHash: _, ...result } = user.toObject();
    return result;
  }

  async update(id: string, updateUserDto: UpdateUserDto, actor?: any) {
    const user = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .select('-passwordHash')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (actor) {
      await this.auditService.log({
        performedBy: actor._id.toString(),
        performedByName: actor.name,
        action: 'USER_UPDATED',
        metadata: { userId: id, updates: updateUserDto },
      });
    }

    return user;
  }

  async disable(id: string, actor?: any) {
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        { isActive: false, isDeleted: true, deletedAt: new Date() },
        { new: true },
      )
      .select('-passwordHash')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Revoke all refresh tokens
    await this.authService.revokeAllUserTokens(id);

    if (actor) {
      await this.auditService.log({
        performedBy: actor._id.toString(),
        performedByName: actor.name,
        action: 'USER_DISABLED',
        metadata: { userId: id },
      });
    }

    return user;
  }

  async enable(id: string, actor?: any) {
    const user = await this.userModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id) },
        { isActive: true, isDeleted: false, deletedAt: null },
        { new: true },
      )
      .select('-passwordHash')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (actor) {
      await this.auditService.log({
        performedBy: actor._id.toString(),
        performedByName: actor.name,
        action: 'USER_ENABLED',
        metadata: { userId: id },
      });
    }

    return user;
  }
}
