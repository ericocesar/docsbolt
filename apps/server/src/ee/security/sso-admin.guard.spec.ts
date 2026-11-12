import { ForbiddenException } from '@nestjs/common';
import { SsoAdminGuard } from './sso-admin.guard';
import WorkspaceAbilityFactory from '../../core/casl/abilities/workspace-ability.factory';

describe('SsoAdminGuard', () => {
  const guard = new SsoAdminGuard(new WorkspaceAbilityFactory());
  const context = (role: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user: { user: { role }, workspace: {} } }),
      }),
    }) as any;

  it('refuses members access to provider credentials and configuration', () => {
    expect(() => guard.canActivate(context('member'))).toThrow(
      ForbiddenException,
    );
  });

  it('allows workspace administrators to manage providers', () => {
    expect(guard.canActivate(context('admin'))).toBe(true);
  });
});
