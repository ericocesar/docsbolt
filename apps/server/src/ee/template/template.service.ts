import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TemplateRepo } from '@docmost/db/repos/template/template.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { UserRole } from '../../common/helpers/types/permission';
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import { PageService } from '../../core/page/services/page.service';
import { jsonToText } from '../../collaboration/collaboration.util';
import {
  CreateTemplateDto,
  ListTemplatesDto,
  UpdateTemplateDto,
  UseTemplateDto,
} from './dto';

function isWorkspaceAdmin(user: User): boolean {
  return user.role === UserRole.ADMIN || user.role === UserRole.OWNER;
}

function allowMemberTemplates(workspace: Workspace): boolean {
  const settings = (workspace.settings ?? {}) as any;
  return settings?.templates?.allowMemberTemplates === true;
}

function normalizeSpaceId(spaceId?: string | null): string | null {
  if (!spaceId) return null;
  return spaceId;
}

@Injectable()
export class TemplateService {
  constructor(
    private readonly templateRepo: TemplateRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly spaceRepo: SpaceRepo,
    private readonly pageRepo: PageRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly pageAccessService: PageAccessService,
    private readonly pageService: PageService,
  ) {}

  private async getAccessibleSpaceIds(userId: string): Promise<string[]> {
    return this.spaceMemberRepo.getUserSpaceIds(userId);
  }

  private async assertCanManage(
    user: User,
    workspace: Workspace,
    spaceId: string | null,
  ): Promise<void> {
    if (isWorkspaceAdmin(user)) return;

    if (!allowMemberTemplates(workspace)) {
      throw new ForbiddenException(
        'Only workspace admins can create global templates.',
      );
    }

    if (!spaceId) {
      throw new ForbiddenException(
        'Only workspace admins can create global templates.',
      );
    }

    // member flow: requires edit access to the space
    let ability;
    try {
      ability = await this.spaceAbility.createForUser(user, spaceId);
    } catch {
      throw new ForbiddenException(
        'You need edit access to this space to create templates.',
      );
    }
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page)) {
      throw new ForbiddenException(
        'You need edit access to this space to create templates.',
      );
    }
  }

  private async assertCanReadTemplate(
    userId: string,
    workspaceId: string,
    templateSpaceId: string | null,
  ): Promise<void> {
    if (!templateSpaceId) return;
    const accessible = await this.getAccessibleSpaceIds(userId);
    if (!accessible.includes(templateSpaceId)) {
      throw new NotFoundException('Template not found');
    }
  }

  private async assertSpaceInWorkspace(spaceId: string, workspaceId: string) {
    const space = await this.spaceRepo.findById(spaceId, workspaceId);
    if (!space) {
      throw new NotFoundException('Space not found');
    }
    return space;
  }

  private toTextContent(content: any): string | undefined {
    if (!content) return undefined;
    try {
      return jsonToText(content);
    } catch {
      return undefined;
    }
  }

  async list(workspace: Workspace, user: User, dto: ListTemplatesDto) {
    const accessibleSpaceIds = await this.getAccessibleSpaceIds(user.id);
    const pagination = {
      limit: dto.limit,
      cursor: dto.cursor,
      beforeCursor: dto.beforeCursor,
      query: dto.query,
    };
    return this.templateRepo.findTemplates(
      workspace.id,
      accessibleSpaceIds,
      pagination as any,
      { spaceId: dto.spaceId },
    );
  }

  async info(workspaceId: string, userId: string, templateId: string) {
    const template = await this.templateRepo.findById(templateId, workspaceId, {
      includeContent: true,
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    await this.assertCanReadTemplate(userId, workspaceId, template.spaceId);
    return template;
  }

  async create(user: User, workspace: Workspace, dto: CreateTemplateDto) {
    const spaceId = normalizeSpaceId(dto.spaceId);

    await this.assertCanManage(user, workspace, spaceId);

    if (spaceId) {
      await this.assertSpaceInWorkspace(spaceId, workspace.id);
    }

    if (!dto.title?.trim()) {
      throw new ForbiddenException('Title is required');
    }

    const { id } = await this.templateRepo.insertTemplate({
      title: dto.title.trim(),
      description: dto.description ?? null,
      icon: dto.icon ?? null,
      content: dto.content ?? null,
      textContent: this.toTextContent(dto.content) ?? null,
      spaceId,
      workspaceId: workspace.id,
      creatorId: user.id,
      lastUpdatedById: user.id,
    } as any);

    return this.templateRepo.findById(id, workspace.id, {
      includeContent: true,
    });
  }

  async update(user: User, workspace: Workspace, dto: UpdateTemplateDto) {
    const template = await this.templateRepo.findById(
      dto.templateId,
      workspace.id,
    );
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    await this.assertCanReadTemplate(user.id, workspace.id, template.spaceId);
    await this.assertCanManage(user, workspace, template.spaceId);

    let nextSpaceId: string | null | undefined = undefined;
    if (typeof dto.spaceId !== 'undefined') {
      nextSpaceId = normalizeSpaceId(dto.spaceId);
      if (nextSpaceId !== template.spaceId) {
        // moving scope requires manage rights on the destination scope too
        await this.assertCanManage(user, workspace, nextSpaceId);
        if (nextSpaceId) {
          await this.assertSpaceInWorkspace(nextSpaceId, workspace.id);
        }
      }
    }

    const patch: any = {
      lastUpdatedById: user.id,
    };
    if (typeof dto.title !== 'undefined') patch.title = dto.title;
    if (typeof dto.description !== 'undefined')
      patch.description = dto.description ?? null;
    if (typeof dto.icon !== 'undefined') patch.icon = dto.icon ?? null;
    if (typeof dto.content !== 'undefined') {
      patch.content = dto.content ?? null;
      patch.textContent = this.toTextContent(dto.content) ?? null;
    }
    if (typeof nextSpaceId !== 'undefined') patch.spaceId = nextSpaceId;

    await this.templateRepo.updateTemplate(patch, template.id, workspace.id);

    return this.templateRepo.findById(template.id, workspace.id, {
      includeContent: true,
    });
  }

  async remove(user: User, workspace: Workspace, templateId: string) {
    const template = await this.templateRepo.findById(
      templateId,
      workspace.id,
    );
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    await this.assertCanReadTemplate(user.id, workspace.id, template.spaceId);
    await this.assertCanManage(user, workspace, template.spaceId);

    await this.templateRepo.deleteTemplate(template.id, workspace.id);
  }

  async use(user: User, workspace: Workspace, dto: UseTemplateDto) {
    const template = await this.templateRepo.findById(
      dto.templateId,
      workspace.id,
      { includeContent: true },
    );
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    await this.assertCanReadTemplate(user.id, workspace.id, template.spaceId);

    const destSpace = await this.assertSpaceInWorkspace(
      dto.spaceId,
      workspace.id,
    );

    if (dto.parentPageId) {
      const parentPage = await this.pageRepo.findById(dto.parentPageId);
      if (
        !parentPage ||
        parentPage.deletedAt ||
        parentPage.spaceId !== destSpace.id ||
        parentPage.workspaceId !== workspace.id
      ) {
        throw new NotFoundException('Parent page not found');
      }
      await this.pageAccessService.validateCanEdit(parentPage, user);
    } else {
      const ability = await this.spaceAbility.createForUser(user, destSpace.id);
      if (ability.cannot(SpaceCaslAction.Create, SpaceCaslSubject.Page)) {
        // writer/admin have Manage Page which implies create; keep both checks
        if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page)) {
          throw new ForbiddenException();
        }
      }
    }

    const page = await this.pageService.create(
      user.id,
      workspace.id,
      {
        title: template.title ?? 'Untitled',
        icon: template.icon ?? undefined,
        spaceId: destSpace.id,
        parentPageId: dto.parentPageId ?? undefined,
        content: (template.content as any) ?? undefined,
        format: (template.content ? 'json' : undefined) as any,
      } as any,
    );

    return page;
  }
}
