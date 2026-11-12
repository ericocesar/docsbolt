import { UnauthorizedException } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { isUserDisabled } from '../../common/helpers';
import { User, Workspace } from '../../database/types/entity.types';

export function requireVerifiedIdentity(claims: Record<string, unknown>) {
  if (
    typeof claims.sub !== 'string' ||
    !claims.sub ||
    claims.sub.length > 255 ||
    typeof claims.email !== 'string' ||
    !isEmail(claims.email) ||
    claims.email_verified !== true
  ) {
    throw new UnauthorizedException(
      'A verified email and subject are required',
    );
  }
  return { sub: claims.sub, email: claims.email.toLowerCase() };
}

export function requireEligibleUser(user: User, workspace: Workspace) {
  if (
    !user ||
    isUserDisabled(user) ||
    workspace.enforceMfa ||
    (user as any).mfa?.isEnabled
  ) {
    throw new UnauthorizedException('SSO is unavailable for this account');
  }
}

export function requireAllowedSignupDomain(
  email: string,
  domains: string[] | null,
) {
  if (
    domains?.length &&
    !domains.some(
      (domain) =>
        domain.toLowerCase() === email.split('@').pop()?.toLowerCase(),
    )
  ) {
    throw new UnauthorizedException('Email domain is not allowed');
  }
}
