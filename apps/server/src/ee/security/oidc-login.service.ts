import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '../../database/types/kysely.types';
import { EncryptionService } from '../../integrations/encryption/encryption.service';
import { OidcStateService } from './oidc-state.service';
import { OutboundAgentFactory } from '../../integrations/outbound/outbound-agent.factory';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { UserRepo } from '../../database/repos/user/user.repo';
import { SessionService } from '../../core/session/session.service';
import { SignupService } from '../../core/auth/services/signup.service';
import { DomainService } from '../../integrations/environment/domain.service';
import { Workspace } from '../../database/types/entity.types';
import { fetch as undiciFetch } from 'undici';
import { randomBytes } from 'node:crypto';
import { executeTx } from '../../database/utils';
import {
  requireAllowedSignupDomain,
  requireEligibleUser,
  requireVerifiedIdentity,
} from './oidc-identity';
import { AuditEvent, AuditResource } from '../../common/events/audit-events';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service';

// TypeScript compiles this application to CommonJS; preserve native ESM import.
const loadOidc = new Function(
  'return import("openid-client")',
) as () => Promise<typeof import('openid-client')>;

@Injectable()
export class OidcLoginService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly encryption: EncryptionService,
    private readonly states: OidcStateService,
    private readonly outbound: OutboundAgentFactory,
    private readonly environment: EnvironmentService,
    private readonly users: UserRepo,
    private readonly sessions: SessionService,
    private readonly signup: SignupService,
    private readonly domains: DomainService,
    @Inject(AUDIT_SERVICE) private readonly audit: IAuditService,
  ) {}

  private loadClient() {
    return loadOidc();
  }

  private async provider(workspaceId: string, providerId: string) {
    const provider = await this.db
      .selectFrom('authProviders')
      .selectAll()
      .where('id', '=', providerId)
      .where('workspaceId', '=', workspaceId)
      .where('type', '=', 'oidc')
      .where('isEnabled', '=', true)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
    if (
      !provider ||
      !provider.oidcIssuer ||
      !provider.oidcClientId ||
      !provider.oidcClientSecret
    )
      throw new UnauthorizedException('SSO provider unavailable');
    return provider;
  }

  async begin(workspace: Workspace, providerId: string) {
    const provider = await this.provider(workspace.id, providerId);
    const oidc = await this.loadClient();
    const config = await this.configuration(oidc, provider);
    const state = await this.states.start(workspace.id, providerId);
    const redirectUri = `${this.domains.getUrl(workspace.hostname).replace(/\/$/, '')}/api/sso/oidc/${providerId}/callback`;
    const url = oidc.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      state: state.state,
      nonce: state.nonce,
      code_challenge: await oidc.calculatePKCECodeChallenge(state.verifier),
      code_challenge_method: 'S256',
    });
    return { url: url.href, state: state.state };
  }

  async complete(
    workspace: Workspace,
    providerId: string,
    state: string,
    cookie: string,
    callback: URL,
  ) {
    const transaction = await this.states.consume(
      state,
      cookie,
      workspace.id,
      providerId,
    );
    const provider = await this.provider(workspace.id, providerId);
    const oidc = await this.loadClient();
    const config = await this.configuration(oidc, provider);
    const tokens = await oidc.authorizationCodeGrant(config, callback, {
      expectedState: state,
      expectedNonce: transaction.nonce,
      pkceCodeVerifier: transaction.verifier,
    });
    const claims = tokens.claims();
    if (!claims) throw new UnauthorizedException('Missing ID token');
    const identity = requireVerifiedIdentity(claims);

    const user = await executeTx(this.db, async (trx) => {
      const account = await trx
        .selectFrom('authAccounts')
        .selectAll()
        .where('workspaceId', '=', workspace.id)
        .where('authProviderId', '=', providerId)
        .where('providerUserId', '=', identity.sub)
        .where('deletedAt', 'is', null)
        .executeTakeFirst();
      let user = account
        ? await this.users.findById(account.userId, workspace.id, {
            includeUserMfa: true,
            trx,
          })
        : await this.users.findByEmail(identity.email, workspace.id, {
            includeUserMfa: true,
            trx,
          });
      if (!user && !account && provider.allowSignup) {
        requireAllowedSignupDomain(identity.email, workspace.emailDomains);
        user = await this.signup.signup(
          {
            email: identity.email,
            name: identity.email.split('@')[0].slice(0, 50),
            password: randomBytes(32).toString('base64url'),
          },
          workspace.id,
          trx,
        );
      }
      requireEligibleUser(user, workspace);
      if (!account) {
        await trx
          .insertInto('authAccounts')
          .values({
            userId: user.id,
            workspaceId: workspace.id,
            authProviderId: providerId,
            providerUserId: identity.sub,
          })
          .execute();
      }
      return user;
    });
    await this.users.updateLastLogin(user.id, workspace.id);
    const session = await this.sessions.createSessionAndToken(user);
    this.audit.setActorId(user.id);
    this.audit.log({
      event: AuditEvent.USER_LOGIN,
      resourceType: AuditResource.USER,
      resourceId: user.id,
      metadata: { source: 'oidc' },
    });
    return session;
  }

  private async configuration(
    oidc: typeof import('openid-client'),
    provider: any,
  ) {
    const issuer = new URL(provider.oidcIssuer);
    if (
      issuer.protocol !== 'https:' ||
      issuer.username ||
      issuer.password ||
      issuer.search ||
      issuer.hash
    )
      throw new UnauthorizedException('Invalid issuer');
    const guardedFetch = async (
      input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (new URL(url).protocol !== 'https:')
        throw new UnauthorizedException('Invalid OIDC endpoint');
      const lease = await this.outbound.lease(url);
      try {
        const response = await undiciFetch(url, {
          ...init,
          dispatcher: lease.dispatcher,
          redirect: 'manual',
        } as any);
        if (response.status >= 300 && response.status < 400)
          throw new UnauthorizedException('OIDC endpoint redirected');
        const body = await response.arrayBuffer();
        if (body.byteLength > 1024 * 1024)
          throw new UnauthorizedException('OIDC response too large');
        return new Response(body, {
          status: response.status,
          headers: response.headers as any,
        });
      } finally {
        await lease.release();
      }
    };
    return oidc.discovery(
      issuer,
      provider.oidcClientId,
      this.encryption.decrypt(provider.oidcClientSecret),
      undefined,
      {
        [oidc.customFetch]: guardedFetch as any,
        execute: [oidc.enableNonRepudiationChecks],
      },
    );
  }
}
