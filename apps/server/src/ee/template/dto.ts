import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

export class ListTemplatesDto extends PaginationOptions {
  @IsUUID()
  @IsOptional()
  spaceId?: string;
}

export class TemplateInfoDto {
  @IsUUID()
  templateId: string;
}

export class CreateTemplateDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsObject()
  @IsOptional()
  content?: any;

  @IsUUID()
  @IsOptional()
  spaceId?: string;
}

export class UpdateTemplateDto {
  @IsUUID()
  templateId: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsObject()
  @IsOptional()
  content?: any;

  @IsUUID()
  @IsOptional()
  spaceId?: string | null;
}

export class DeleteTemplateDto {
  @IsUUID()
  templateId: string;
}

export class UseTemplateDto {
  @IsUUID()
  templateId: string;

  @IsUUID()
  spaceId: string;

  @IsUUID()
  @IsOptional()
  parentPageId?: string;
}
