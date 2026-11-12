import { UnauthorizedException } from '@nestjs/common';
import { OidcLoginService } from './oidc-login.service';

describe('OIDC login', () => {
  it('refuses a disabled provider before beginning authentication', async () => {
    const db: any = {
      selectFrom: () => db,
      selectAll: () => db,
      where: () => db,
      executeTakeFirst: async () => undefined,
    };
    const states = { start: jest.fn() };
    const service = new OidcLoginService(
      db,
      {} as any,
      states as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    await expect(
      service.begin({ id: 'ws' } as any, 'provider'),
    ).rejects.toThrow(UnauthorizedException);
    expect(states.start).not.toHaveBeenCalled();
  });

  it('does not create a session when login state is invalid', async () => {
    const states = {
      consume: jest.fn().mockRejectedValue(new UnauthorizedException()),
    };
    const sessions = { createSessionAndToken: jest.fn() };
    const service = new OidcLoginService(
      {} as any,
      {} as any,
      states as any,
      {} as any,
      {} as any,
      {} as any,
      sessions as any,
      {} as any,
      {} as any,
      {} as any,
    );
    await expect(
      service.complete(
        { id: 'ws' } as any,
        'provider',
        'bad',
        'bad',
        new URL('https://example.org/callback?state=bad'),
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(sessions.createSessionAndToken).not.toHaveBeenCalled();
  });

  it('validates the OIDC response and creates a session for the linked active user', async () => {
    let table = '';
    const db: any = {
      selectFrom: (name: string) => {
        table = name;
        return db;
      },
      selectAll: () => db,
      where: () => db,
      executeTakeFirst: async () =>
        table === 'authProviders'
          ? {
              oidcIssuer: 'https://id.example',
              oidcClientId: 'client',
              oidcClientSecret: 'encrypted',
            }
          : { userId: 'user' },
      transaction: () => ({ execute: (fn: any) => fn(db) }),
    };
    const states = {
      consume: jest
        .fn()
        .mockResolvedValue({ verifier: 'verifier', nonce: 'nonce' }),
    };
    const users = {
      findById: jest.fn().mockResolvedValue({ id: 'user', workspaceId: 'ws' }),
      updateLastLogin: jest.fn(),
    };
    const sessions = {
      createSessionAndToken: jest.fn().mockResolvedValue('session'),
    };
    const oidc = {
      authorizationCodeGrant: jest
        .fn()
        .mockResolvedValue({
          claims: () => ({
            sub: 'subject',
            email: 'user@example.org',
            email_verified: true,
          }),
        }),
    };
    const service = new OidcLoginService(
      db,
      {} as any,
      states as any,
      {} as any,
      {} as any,
      users as any,
      sessions as any,
      {} as any,
      {} as any,
      { setActorId: jest.fn(), log: jest.fn() } as any,
    );
    jest.spyOn(service as any, 'loadClient').mockResolvedValue(oidc);
    jest
      .spyOn(service as any, 'configuration')
      .mockResolvedValue('configuration');
    const callback = new URL(
      'https://example.org/callback?state=state&code=code',
    );
    await expect(
      service.complete(
        { id: 'ws' } as any,
        'provider',
        'state',
        'state',
        callback,
      ),
    ).resolves.toBe('session');
    expect(oidc.authorizationCodeGrant).toHaveBeenCalledWith(
      'configuration',
      callback,
      {
        expectedState: 'state',
        expectedNonce: 'nonce',
        pkceCodeVerifier: 'verifier',
      },
    );
    expect(users.findById).toHaveBeenCalledWith(
      'user',
      'ws',
      expect.objectContaining({ includeUserMfa: true }),
    );
  });
});
