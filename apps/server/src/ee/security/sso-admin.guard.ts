import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import WorkspaceAbilityFactory from '../../core/casl/abilities/workspace-ability.factory';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../../core/casl/interfaces/workspace-ability.type';

@Injectable()
export class SsoAdminGuard implements CanActivate {
  constructor(private readonly abilities: WorkspaceAbilityFactory) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { user, workspace } = request.user ?? {};
    if (
      !user ||
      !workspace ||
      !this.abilities
        .createForUser(user, workspace)
        .can(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings)
    ) {
      throw new ForbiddenException();
    }
    return true;
  }
}
