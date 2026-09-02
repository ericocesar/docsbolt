import {
  Body,
  Controller,
  ForbiddenException,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OAuthScope } from '../../common/decorators/oauth-scope.decorator';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { BaseService } from './base.service';
import {
  ConvertBaseDto,
  CreateBaseDto,
  CreatePropertyDto,
  CreateRowDto,
  CreateViewDto,
  DeletePropertyDto,
  DeleteRowDto,
  DeleteRowsDto,
  DeleteViewDto,
  GetRowDto,
  ListRowsDto,
  ListViewsDto,
  PageIdDto,
  ReorderPropertyDto,
  ReorderRowDto,
  SpaceIdCursorDto,
  UpdateBaseDto,
  UpdatePropertyDto,
  UpdateRowDto,
  UpdateViewDto,
} from './dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class BaseController {
  constructor(private readonly baseService: BaseService) {}

  // ---------- bases ----------

  @HttpCode(HttpStatus.OK)
  @Post('bases/create')
  @OAuthScope('write')
  async create(
    @Body() body: CreateBaseDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.baseService.createBase(user.id, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('bases/info')
  @OAuthScope('read')
  async info(
    @Body() body: PageIdDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.baseService.getBaseInfo(workspace.id, body.pageId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('bases/update')
  @OAuthScope('write')
  async update(
    @Body() body: UpdateBaseDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.baseService.updateBase(user.id, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('bases/delete')
  @OAuthScope('write')
  async delete(
    @Body() body: PageIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.baseService.deleteBase(user.id, workspace.id, body.pageId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('bases/convert')
  @OAuthScope('write')
  async convert(
    @Body() body: ConvertBaseDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.baseService.convertPageToBase(user.id, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('bases/export-csv')
  @OAuthScope('read')
  async exportCsv(
    @Body() body: PageIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const result = await this.baseService.exportBaseToCsv(
      user.id,
      workspace.id,
      body.pageId,
    );
    return {
      filename: result.filename,
      body: result.body,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('bases')
  @OAuthScope('read')
  async list(
    @Body() body: SpaceIdCursorDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (!body.spaceId) throw new ForbiddenException('Missing space');
    const items = await this.baseService.listBases(workspace.id, body.spaceId);
    return {
      items,
      meta: {
        limit: body.limit ?? 50,
        hasNextPage: false,
        hasPrevPage: !!body.cursor,
        nextCursor: null,
        prevCursor: body.cursor ?? null,
      },
    };
  }

  // ---------- properties ----------

  @HttpCode(HttpStatus.OK)
  @Post('bases/properties/create')
  @OAuthScope('write')
  async createProperty(
    @Body() body: CreatePropertyDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.baseService.createProperty(user.id, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('bases/properties/update')
  @OAuthScope('write')
  async updateProperty(
    @Body() body: UpdatePropertyDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.baseService.updateProperty(user.id, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('bases/properties/delete')
  @OAuthScope('write')
  async deleteProperty(
    @Body() body: DeletePropertyDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.baseService.deleteProperty(user.id, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('bases/properties/reorder')
  @OAuthScope('write')
  async reorderProperty(
    @Body() body: ReorderPropertyDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.baseService.reorderProperty(user.id, workspace.id, body);
  }

  // ---------- rows ----------

  @HttpCode(HttpStatus.OK)
  @Post('bases/rows/create')
  @OAuthScope('write')
  async createRow(
    @Body() body: CreateRowDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.baseService.createRow(user.id, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('bases/rows/info')
  @OAuthScope('read')
  async rowInfo(
    @Body() body: GetRowDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.baseService.getRow(workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('bases/rows/update')
  @OAuthScope('write')
  async updateRow(
    @Body() body: UpdateRowDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.baseService.updateRow(user.id, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('bases/rows/delete')
  @OAuthScope('write')
  async deleteRow(
    @Body() body: DeleteRowDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.baseService.deleteRow(user.id, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('bases/rows/delete-many')
  @OAuthScope('write')
  async deleteRows(
    @Body() body: DeleteRowsDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.baseService.deleteRows(user.id, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('bases/rows')
  @OAuthScope('read')
  async listRows(
    @Body() body: ListRowsDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.baseService.listRows(workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('bases/rows/reorder')
  @OAuthScope('write')
  async reorderRow(
    @Body() body: ReorderRowDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.baseService.reorderRow(user.id, workspace.id, body);
  }

  // ---------- views ----------

  @HttpCode(HttpStatus.OK)
  @Post('bases/views/create')
  @OAuthScope('write')
  async createView(
    @Body() body: CreateViewDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.baseService.createView(user.id, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('bases/views/update')
  @OAuthScope('write')
  async updateView(
    @Body() body: UpdateViewDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.baseService.updateView(user.id, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('bases/views/delete')
  @OAuthScope('write')
  async deleteView(
    @Body() body: DeleteViewDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.baseService.deleteView(user.id, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('bases/views')
  @OAuthScope('read')
  async listViews(
    @Body() body: ListViewsDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.baseService.listViews(workspace.id, body);
  }
}
