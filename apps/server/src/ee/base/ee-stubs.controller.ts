import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '../../database/types/kysely.types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { Workspace } from '@docmost/db/types/entity.types';

/**
 * Legacy stub controller — only the audit log reader remains (the writer is
 * the NoopAuditService; this reads whatever rows exist). All other EE
 * endpoints now live in their own modules (api-key, scim, security, audit
 * retention, mfa, page-verification).
 */
@UseGuards(JwtAuthGuard)
@Controller()
export class EeStubController {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  @HttpCode(HttpStatus.OK)
  @Post('audit')
  async auditLogs(@AuthWorkspace() workspace: Workspace) {
    let items: unknown[] = [];
    try {
      items = await this.db
        .selectFrom('audit')
        .selectAll()
        .where('workspaceId', '=', workspace.id)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .execute();
    } catch {
      items = [];
    }
    return {
      items,
      meta: {
        limit: 50,
        hasNextPage: false,
        hasPrevPage: false,
        nextCursor: null,
        prevCursor: null,
      },
    };
  }
}
