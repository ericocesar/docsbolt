import { UnauthorizedException } from '@nestjs/common';
import { OidcStateService } from './oidc-state.service';

describe('OIDC state', () => {
  let values: Map<string, string>;
  let state: OidcStateService;

  beforeEach(() => {
    values = new Map();
    const redis = {
      set: async (key: string, value: string) => {
        values.set(key, value);
        return 'OK';
      },
      getdel: async (key: string) => {
        const value = values.get(key);
        values.delete(key);
        return value ?? null;
      },
    };
    state = new OidcStateService({ getOrThrow: () => redis } as any);
  });

  it('requires the browser cookie and consumes state only once', async () => {
    const started = await state.start('workspace', 'provider');
    await expect(
      state.consume(started.state, 'wrong', 'workspace', 'provider'),
    ).rejects.toThrow(UnauthorizedException);
    const result = await state.consume(
      started.state,
      started.state,
      'workspace',
      'provider',
    );
    expect(result.verifier).toBeTruthy();
    expect(result.nonce).toBeTruthy();
    await expect(
      state.consume(started.state, started.state, 'workspace', 'provider'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects callbacks for another workspace or provider', async () => {
    const started = await state.start('workspace', 'provider');
    await expect(
      state.consume(started.state, started.state, 'other', 'provider'),
    ).rejects.toThrow(UnauthorizedException);
  });
});
