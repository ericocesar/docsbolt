import { OidcLoginController } from './oidc-login.controller';

describe('OIDC browser redirects', () => {
  it('sends an HTTP 302 when beginning authorization', async () => {
    const reply: any = {
      header: jest.fn(),
      setCookie: jest.fn(),
      code: jest.fn(),
      redirect: jest.fn(),
    };
    reply.code.mockReturnValue(reply);
    const controller = new OidcLoginController(
      {
        begin: async () => ({
          state: 'state',
          url: 'https://id.example/authorize',
        }),
      } as any,
      { isHttps: () => true } as any,
      {} as any,
    );
    await controller.begin({ id: 'ws' } as any, 'provider', reply);
    expect(reply.code).toHaveBeenCalledWith(302);
    expect(reply.redirect).toHaveBeenCalledWith('https://id.example/authorize');
  });

  it('sends an HTTP 302 after creating the application session', async () => {
    const reply: any = {
      header: jest.fn(),
      clearCookie: jest.fn(),
      setCookie: jest.fn(),
      code: jest.fn(),
      redirect: jest.fn(),
    };
    reply.code.mockReturnValue(reply);
    const controller = new OidcLoginController(
      { complete: async () => 'token' } as any,
      { isHttps: () => true, getCookieExpiresIn: () => new Date() } as any,
      { getUrl: () => 'https://docs.example' } as any,
    );
    await controller.callback(
      { id: 'ws' } as any,
      'provider',
      'state',
      {
        url: '/api/sso/oidc/provider/callback?state=state',
        cookies: { oidcState: 'state' },
      } as any,
      reply,
    );
    expect(reply.code).toHaveBeenCalledWith(302);
    expect(reply.redirect).toHaveBeenCalledWith('/');
  });
});
