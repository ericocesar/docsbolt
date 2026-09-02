/**
 * Shared mock providers for unit specs whose tested service gained new
 * constructor dependencies during upstream refactors (WatcherService,
 * TransclusionService, queues, kysely, audit, storage, etc.).
 *
 * `useValue: {}` shortcuts make NestJS skip the constructor resolution, so
 * these mocks can be dropped into any `Test.createTestingModule` without
 * pulling in the real implementation graph.
 */
import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ModuleRef } from '@nestjs/core';

import { AuthService } from '../core/auth/services/auth.service';
import { TokenService } from '../core/auth/services/token.service';
import { SessionService } from '../core/session/session.service';
import { SignupService } from '../core/auth/services/signup.service';
import { BacklinkService } from '../core/page/services/backlink.service';
import { PageHistoryService } from '../core/page/services/page-history.service';
import { PageAccessService } from '../core/page/page-access/page-access.service';
import { LabelService } from '../core/label/label.service';
import { PageService } from '../core/page/services/page.service';
import { TransclusionService } from '../core/page/transclusion/transclusion.service';
import { WatcherService } from '../core/watcher/watcher.service';
import { CollaborationGateway } from '../collaboration/collaboration.gateway';
import { GroupService } from '../core/group/services/group.service';
import { GroupUserService } from '../core/group/services/group-user.service';
import { SearchService } from '../core/search/search.service';
import { SpaceService } from '../core/space/services/space.service';
import { SpaceMemberService } from '../core/space/services/space-member.service';
import { EnvironmentService } from '../integrations/environment/environment.service';
import { StorageService } from '../integrations/storage/storage.service';
import { LicenseCheckService } from '../integrations/environment/license-check.service';
import { MailService } from '../integrations/mail/mail.service';
import { DomainService } from '../integrations/environment/domain.service';
import { WsService } from '../ws/ws.service';

import { PageRepo } from '../database/repos/page/page.repo';
import { PagePermissionRepo } from '../database/repos/page/page-permission.repo';
import { PageHistoryRepo } from '../database/repos/page/page-history.repo';
import { PageTransclusionsRepo } from '../database/repos/page-transclusions/page-transclusions.repo';
import { PageTransclusionReferencesRepo } from '../database/repos/page-transclusions/page-transclusion-references.repo';
import { AttachmentRepo } from '../database/repos/attachment/attachment.repo';
import { BacklinkRepo } from '../database/repos/backlink/backlink.repo';
import { CommentRepo } from '../database/repos/comment/comment.repo';
import { GroupRepo } from '../database/repos/group/group.repo';
import { GroupUserRepo } from '../database/repos/group/group-user.repo';
import { SpaceMemberRepo } from '../database/repos/space/space-member.repo';
import { SpaceRepo } from '../database/repos/space/space.repo';
import { ShareRepo } from '../database/repos/share/share.repo';
import { WorkspaceRepo } from '../database/repos/workspace/workspace.repo';
import { UserRepo } from '../database/repos/user/user.repo';
import { UserTokenRepo } from '../database/repos/user-token/user-token.repo';
import { UserSessionRepo } from '../database/repos/session/user-session.repo';
import { WatcherRepo } from '../database/repos/watcher/watcher.repo';
import { FavoriteRepo } from '../database/repos/favorite/favorite.repo';
import { NotificationRepo } from '../database/repos/notification/notification.repo';
import { LabelRepo } from '../database/repos/label/label.repo';
import { TemplateRepo } from '../database/repos/template/template.repo';

import SpaceAbilityFactory from '../core/casl/abilities/space-ability.factory';
import WorkspaceAbilityFactory from '../core/casl/abilities/workspace-ability.factory';
import { UserThrottlerGuard } from '../integrations/throttle/user-throttler.guard';
import { ThrottlerStorage } from '@nestjs/throttler';

import { AUDIT_SERVICE } from '../integrations/audit/audit.service';
import { STORAGE_DRIVER_TOKEN } from '../integrations/storage/constants/storage.constants';

const stub = (): unknown => ({});

export const mockProviders: Provider[] = [
  // Repos
  { provide: PageRepo, useValue: stub() },
  { provide: PagePermissionRepo, useValue: stub() },
  { provide: PageHistoryRepo, useValue: stub() },
  { provide: PageTransclusionsRepo, useValue: stub() },
  { provide: PageTransclusionReferencesRepo, useValue: stub() },
  { provide: AttachmentRepo, useValue: stub() },
  { provide: BacklinkRepo, useValue: stub() },
  { provide: CommentRepo, useValue: stub() },
  { provide: GroupRepo, useValue: stub() },
  { provide: GroupUserRepo, useValue: stub() },
  { provide: SpaceMemberRepo, useValue: stub() },
  { provide: SpaceRepo, useValue: stub() },
  { provide: ShareRepo, useValue: stub() },
  { provide: WorkspaceRepo, useValue: stub() },
  { provide: UserRepo, useValue: stub() },
  { provide: UserTokenRepo, useValue: stub() },
  { provide: UserSessionRepo, useValue: stub() },
  { provide: WatcherRepo, useValue: stub() },
  { provide: FavoriteRepo, useValue: stub() },
  { provide: NotificationRepo, useValue: stub() },
  { provide: LabelRepo, useValue: stub() },
  { provide: TemplateRepo, useValue: stub() },

  // Casl ability factories
  { provide: SpaceAbilityFactory, useValue: stub() },
  { provide: WorkspaceAbilityFactory, useValue: stub() },

  // Throttler (only required by controllers that use @UseGuards(ThrottlerGuard))
  { provide: UserThrottlerGuard, useValue: stub() },
  { provide: 'THROTTLER:MODULE_OPTIONS', useValue: stub() },
  { provide: ThrottlerStorage, useValue: stub() },

  // Services
  { provide: AuthService, useValue: stub() },
  { provide: TokenService, useValue: stub() },
  { provide: SessionService, useValue: stub() },
  { provide: SignupService, useValue: stub() },
  { provide: PageService, useValue: stub() },
  { provide: PageHistoryService, useValue: stub() },
  { provide: PageAccessService, useValue: stub() },
  { provide: LabelService, useValue: stub() },
  { provide: BacklinkService, useValue: stub() },
  { provide: TransclusionService, useValue: stub() },
  { provide: WatcherService, useValue: stub() },
  { provide: GroupService, useValue: stub() },
  { provide: GroupUserService, useValue: stub() },
  { provide: SearchService, useValue: stub() },
  { provide: SpaceService, useValue: stub() },
  { provide: SpaceMemberService, useValue: stub() },
  { provide: EnvironmentService, useValue: stub() },
  { provide: StorageService, useValue: stub() },
  { provide: LicenseCheckService, useValue: stub() },
  { provide: MailService, useValue: stub() },
  { provide: DomainService, useValue: stub() },
  { provide: WsService, useValue: stub() },

  // Infrastructure
  { provide: ConfigService, useValue: stub() },
  { provide: JwtService, useValue: stub() },
  { provide: EventEmitter2, useValue: stub() },
  { provide: ModuleRef, useValue: stub() },
  { provide: CollaborationGateway, useValue: stub() },

  // Tokens
  { provide: AUDIT_SERVICE, useValue: stub() },
  { provide: STORAGE_DRIVER_TOKEN, useValue: stub() },
  // KyselyModuleConnectionToken() with no namespace resolves to 'KyselyModuleConnectionToken'
  { provide: 'KyselyModuleConnectionToken', useValue: stub() },

  // Bull queues (token strings match getQueueToken('{name}') = 'BullQueue_{name}')
  { provide: 'BullQueue_{attachment-queue}', useValue: stub() },
  { provide: 'BullQueue_{ai-queue}', useValue: stub() },
  { provide: 'BullQueue_{general-queue}', useValue: stub() },
  { provide: 'BullQueue_{billing-queue}', useValue: stub() },
  { provide: 'BullQueue_{notification-queue}', useValue: stub() },
  { provide: 'BullQueue_{email-queue}', useValue: stub() },
  { provide: 'BullQueue_{file-task-queue}', useValue: stub() },
  { provide: 'BullQueue_{search-queue}', useValue: stub() },
  { provide: 'BullQueue_{history-queue}', useValue: stub() },
  { provide: 'BullQueue_{audit-queue}', useValue: stub() },
  { provide: 'BullQueue_{base-queue}', useValue: stub() },
];
