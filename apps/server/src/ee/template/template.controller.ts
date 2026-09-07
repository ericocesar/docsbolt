import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { TemplateService } from './template.service';
import {
  CreateTemplateDto,
  DeleteTemplateDto,
  ListTemplatesDto,
  TemplateInfoDto,
  UpdateTemplateDto,
  UseTemplateDto,
} from './dto';

@UseGuards(JwtAuthGuard)
@Controller('templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  list(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() dto: ListTemplatesDto,
  ) {
    return this.templateService.list(workspace, user, (dto ?? {}) as any);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  info(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() dto: TemplateInfoDto,
  ) {
    return this.templateService.info(workspace.id, user.id, dto.templateId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  create(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.templateService.create(user, workspace, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  update(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templateService.update(user, workspace, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  remove(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() dto: DeleteTemplateDto,
  ) {
    return this.templateService.remove(user, workspace, dto.templateId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('use')
  use(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() dto: UseTemplateDto,
  ) {
    return this.templateService.use(user, workspace, dto);
  }
}
