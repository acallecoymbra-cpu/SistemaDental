import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESSION_MAX_HOURS, type AuthUserResponse } from '@sistema-dental/contracts';
import type { CookieOptions, Request, Response } from 'express';
import type { RequestContext } from '../audit/audit.service';
import { getRequestId } from '../common/request-id';
import { AllowPendingPasswordChange, CurrentAuth, Public } from './auth.decorators';
import { ChangePasswordDto, LoginDto } from './auth.dto';
import { AuthService } from './auth.service';
import { SESSION_COOKIE, toAuthUserResponse, type AuthContext } from './auth.types';

function requestContext(req: Request): RequestContext {
  return { requestId: getRequestId(req), ip: req.ip };
}

@Controller('auth')
export class AuthController {
  private readonly cookieOptions: CookieOptions;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    // httpOnly: JavaScript no puede leerla. SameSite=Lax: no viaja en peticiones
    // de otros sitios que modifican datos (segunda capa contra CSRF, ADR-011).
    this.cookieOptions = {
      httpOnly: true,
      secure: config.get<boolean>('COOKIE_SECURE') ?? config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/api',
      maxAge: SESSION_MAX_HOURS * 60 * 60 * 1000,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUserResponse> {
    const { token, user } = await this.auth.login(dto.username, dto.password, requestContext(req));
    res.cookie(SESSION_COOKIE, token, this.cookieOptions);
    return toAuthUserResponse(user);
  }

  @AllowPendingPasswordChange()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(auth, requestContext(req));
    res.clearCookie(SESSION_COOKIE, { ...this.cookieOptions, maxAge: undefined });
  }

  @AllowPendingPasswordChange()
  @Get('me')
  me(@CurrentAuth() auth: AuthContext): AuthUserResponse {
    return toAuthUserResponse(auth.user);
  }

  @AllowPendingPasswordChange()
  @Post('change-password')
  @HttpCode(204)
  async changePassword(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.auth.changePassword(auth, dto.currentPassword, dto.newPassword, requestContext(req));
  }
}
