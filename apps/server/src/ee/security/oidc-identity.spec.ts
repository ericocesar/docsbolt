import { UnauthorizedException } from '@nestjs/common';
import {
  requireVerifiedIdentity,
  requireEligibleUser,
  requireAllowedSignupDomain,
} from './oidc-identity';

describe('OIDC identity', () => {
  it('requires a verified email and stable subject before account lookup', () => {
    expect(() =>
      requireVerifiedIdentity({
        sub: 's',
        email: 'a@example.org',
        email_verified: false,
      }),
    ).toThrow(UnauthorizedException);
    expect(() =>
      requireVerifiedIdentity({ email: 'a@example.org', email_verified: true }),
    ).toThrow(UnauthorizedException);
    expect(() =>
      requireVerifiedIdentity({
        sub: 's',
        email: 'not an email',
        email_verified: true,
      }),
    ).toThrow(UnauthorizedException);
    expect(
      requireVerifiedIdentity({
        sub: 's',
        email: 'A@example.org',
        email_verified: true,
      }),
    ).toEqual({ sub: 's', email: 'a@example.org' });
  });

  it('does not bypass local MFA or allow disabled users', () => {
    const active = { id: '1', deletedAt: null, deactivatedAt: null };
    expect(() =>
      requireEligibleUser(
        { ...active, mfa: { isEnabled: true } } as any,
        {} as any,
      ),
    ).toThrow(UnauthorizedException);
    expect(() =>
      requireEligibleUser(active as any, { enforceMfa: true } as any),
    ).toThrow(UnauthorizedException);
    expect(() =>
      requireEligibleUser(
        { ...active, deactivatedAt: new Date() } as any,
        {} as any,
      ),
    ).toThrow(UnauthorizedException);
    expect(() => requireEligibleUser(active as any, {} as any)).not.toThrow();
  });

  it('restricts new SSO accounts to configured email domains', () => {
    expect(() =>
      requireAllowedSignupDomain('user@example.org', ['EXAMPLE.ORG']),
    ).not.toThrow();
    expect(() =>
      requireAllowedSignupDomain('user@other.org', ['example.org']),
    ).toThrow(UnauthorizedException);
    expect(() =>
      requireAllowedSignupDomain('user@other.org', []),
    ).not.toThrow();
  });
});
