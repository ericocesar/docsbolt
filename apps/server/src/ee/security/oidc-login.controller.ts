import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard, SkipThrottle } from '@nestjs/throttler';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { Workspace } from '../../database/types/entity.types';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { DomainService } from '../../integrations/environment/domain.service';
import {
  ALL_NAMED_THROTTLERS_SKIPPED,
  AUTH_THROTTLER,
} from '../../integrations/throttle/throttler-names';
import { OidcLoginService } from './oidc-login.service';

@SkipThrottle({ ...ALL_NAMED_THROTTLERS_SKIPPED, [AUTH_THROTTLER]: false })
@UseGuards(ThrottlerGuard)
@Controller('sso/oidc')
export class OidcLoginController {
  constructor(
    private readonly login: OidcLoginService,
    private readonly environment: EnvironmentService,
    private readonly domains: DomainService,
  ) {}

  @Get(':providerId/login')
  async begin(
    @AuthWorkspace() workspace: Workspace,
    @Param('providerId') providerId: string,
    @Res() reply: FastifyReply,
  ) {
    const result = await this.login.begin(workspace, providerId);
    reply.header('Cache-Control', 'no-store');
    reply.setCookie('oidcState', result.state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.environment.isHttps(),
      path: '/',
      maxAge: 300,
    });
    return reply.redirect(result.url);
  }

  @Get(':providerId/callback')
  async callback(
    @AuthWorkspace() workspace: Workspace,
    @Param('providerId') providerId: string,
    @Query('state') state: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    reply.header('Cache-Control', 'no-store');
    reply.clearCookie('oidcState', { path: '/' });
    const url = new URL(req.url, this.domains.getUrl(workspace.hostname));
    const token = await this.login.complete(
      workspace,
      providerId,
      state,
      req.cookies?.oidcState,
      url,
    );
    reply.setCookie('authToken', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: this.environment.getCookieExpiresIn(),
      secure: this.environment.isHttps(),
    });
    return reply.redirect('/');
  }
}
