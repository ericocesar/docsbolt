import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '../../database/types/kysely.types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';

const emptyPage = (limit = 50) => ({
  items: [],
  meta: {
    limit,
    hasNextPage: false,
    hasPrevPage: false,
    nextCursor: null,
    prevCursor: null,
  },
});

/**
 * Self-hosted stubs for EE endpoints that have no backing module in this
 * build (SSO, SCIM, MFA, audit, API keys, page verification). They return
 * empty/neutral payloads so the settings UI renders instead of 404ing.
 *
 * The audit endpoint reads from the real `audit` table when rows exist.
 */
@UseGuards(JwtAuthGuard)
@Controller()
export class EeStubController {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  // ---------- Audit ----------

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
    return { items, meta: { limit: 50, hasNextPage: false, hasPrevPage: false, nextCursor: null, prevCursor: null } };
  }

  // ---------- Page verification ----------

  @HttpCode(HttpStatus.OK)
  @Post('pages/verifications')
  async pageVerifications(@AuthWorkspace() workspace: Workspace) {
    return emptyPage();
  }

  @HttpCode(HttpStatus.OK)
  @Post('pages/verification-info')
  async pageVerificationInfo() {
    return null;
  }
}
