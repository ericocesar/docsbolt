import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  OAUTH_SCOPE_KEY,
  OAuthRouteScope,
} from '../decorators/oauth-scope.decorator';
import { REQUIRE_SESSION_AUTH_KEY } from '../decorators/require-session-auth.decorator';
import { JwtType } from '../../core/auth/dto/jwt-payload';
import { ModuleRef, Reflector } from '@nestjs/core';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { addDays } from 'date-fns';
import { extractBearerTokenFromHeader } from '../helpers';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private logger = new Logger('JwtAuthGuard');

  constructor(
    private reflector: Reflector,
    private environmentService: EnvironmentService,
    private moduleRef?: ModuleRef,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const bearerToken = req?.headers ? extractBearerTokenFromHeader(req) : undefined;

    if (bearerToken && !this.isJwtToken(bearerToken)) {
      const authResult = await this.validateOpaqueApiKey(bearerToken);
      if (authResult) {
        req.user = {
          user: authResult.user,
          workspace: authResult.workspace,
          authType: JwtType.API_KEY,
        };
        if (req.raw) {
          req.raw.workspaceId = authResult.workspace.id;
          req.raw.workspace = authResult.workspace;
        }
        this.handleRequest(null, req.user, null, context);
        return true;
      }
    }

    return super.canActivate(context) as Promise<boolean>;
  }

  private isJwtToken(token: string): boolean {
    return token.split('.').length === 3;
  }

  private async validateOpaqueApiKey(token: string) {
    if (!this.moduleRef) {
      return null;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ApiKeyService } = require('../../ee/api-key/api-key.service');
      const apiKeyService = this.moduleRef.get(ApiKeyService, { strict: false });
      return await apiKeyService.validateOpaqueToken(token);
    } catch (err: any) {
      this.logger.debug(`Opaque API key validation failed: ${err?.message}`);
      return null;
    }
  }

  handleRequest(err: any, user: any, info: any, ctx: ExecutionContext) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }

    const requiresSession = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_SESSION_AUTH_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (requiresSession && user.authType !== JwtType.ACCESS) {
      this.logger.debug(
        `session-only endpoint ${ctx.getClass()?.name}.${ctx.getHandler()?.name} refused authType ${user.authType}`,
      );
      throw new ForbiddenException(
        'This action requires an interactive user session',
      );
    }

    if (user.oauth) {
      const required = this.reflector.getAllAndOverride<
        OAuthRouteScope | undefined
      >(OAUTH_SCOPE_KEY, [ctx.getHandler(), ctx.getClass()]);
      if (!required) {
        this.logger.warn(
          `oauth scope check: no @OAuthScope metadata on ${ctx.getClass()?.name}.${ctx.getHandler()?.name}`,
        );
        throw new ForbiddenException('OAuth tokens cannot access this endpoint');
      }
      const scopes: string[] = user.oauth.scopes ?? [];
      const satisfied =
        required === 'read'
          ? scopes.includes('read') || scopes.includes('write')
          : scopes.includes('write');
      if (!satisfied) {
        throw new ForbiddenException('insufficient_scope');
      }
    }

    this.setJoinedWorkspacesCookie(user, ctx);
    return user;
  }

  setJoinedWorkspacesCookie(user: any, ctx: ExecutionContext) {
    if (this.environmentService.isCloud()) {
      const req = ctx.switchToHttp().getRequest();
      const res = ctx.switchToHttp().getResponse();

      const workspaceId = user?.workspace?.id;
      let workspaceIds = [];
      try {
        workspaceIds = req.cookies.joinedWorkspaces
          ? JSON.parse(req.cookies.joinedWorkspaces)
          : [];
      } catch (err) {
        /* empty */
      }

      if (!workspaceIds.includes(workspaceId)) {
        workspaceIds.push(workspaceId);
      }

      res.setCookie('joinedWorkspaces', JSON.stringify(workspaceIds), {
        httpOnly: false,
        domain: '.' + this.environmentService.getSubdomainHost(),
        path: '/',
        expires: addDays(new Date(), 365),
        secure: this.environmentService.isHttps(),
      });
    }
  }
}
