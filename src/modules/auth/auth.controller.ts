import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtRefreshGuard } from '../../common/guards/jwt-refresh.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConfigService } from '@nestjs/config';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Returns access token' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.login(loginDto);

    const isProduction = this.configService.get('NODE_ENV') === 'production';

    // When running in production behind a separate frontend origin (e.g. Render),
    // browsers require cross-site cookies to use `SameSite=None` and `Secure`.
    // Use the presence of a FRONTEND_URL env to decide.
    const frontendUrl = this.configService.get('FRONTEND_URL');
    const sameSite = isProduction ? (frontendUrl ? 'none' : 'strict') : 'lax';

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction, // secure should be true in production
      sameSite: sameSite as 'lax' | 'strict' | 'none',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return { accessToken, user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  @ApiOperation({ summary: 'Refresh access token using refresh cookie' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = req.user as any;
    const rawRefreshToken = req.cookies?.refresh_token;

    const { accessToken, refreshToken } = await this.authService.refreshTokens(
      user.sub,
      rawRefreshToken,
    );

    const isProduction = this.configService.get('NODE_ENV') === 'production';

    const frontendUrl = this.configService.get('FRONTEND_URL');
    const sameSite = isProduction ? (frontendUrl ? 'none' : 'strict') : 'lax';

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: sameSite as 'lax' | 'strict' | 'none',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: any,
  ) {
    const rawRefreshToken = req.cookies?.refresh_token;
    if (rawRefreshToken) {
      await this.authService.logout(user._id.toString(), rawRefreshToken);
    }

    res.clearCookie('refresh_token', { path: '/' });
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user info' })
  getMe(@CurrentUser() user: any) {
    return user;
  }
}
