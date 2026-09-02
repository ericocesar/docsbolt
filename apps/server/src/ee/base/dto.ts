import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

const BASE_PROPERTY_TYPES = [
  'text',
  'number',
  'select',
  'status',
  'multiSelect',
  'date',
  'person',
  'file',
  'page',
  'checkbox',
  'url',
  'email',
  'createdAt',
  'lastEditedAt',
  'lastEditedBy',
  'formula',
  'longText',
];

const BASE_VIEW_TYPES = ['table', 'kanban', 'calendar'];

export class CreateBaseDto {
  // Three valid shapes:
  //   1. { name, spaceId }            — brand-new base
  //   2. { pageId }                   — convert an existing page
  //   3. { parentPageId, template? }  — embed flow: create child page under
  //                                     parentPageId and (optionally) seed a
  //                                     kanban template
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsUUID()
  @IsOptional()
  pageId?: string;

  @IsUUID()
  @IsOptional()
  parentPageId?: string;

  @IsIn(['kanban'])
  @IsOptional()
  template?: 'kanban';

  @IsUUID()
  @IsOptional()
  spaceId?: string;
}

export class UpdateBaseDto {
  @IsUUID()
  pageId: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  icon?: string;
}

export class PageIdDto {
  @IsUUID()
  pageId: string;
}

export class ConvertBaseDto {
  @IsUUID()
  pageId: string;

  @IsIn(['kanban'])
  @IsOptional()
  template?: 'kanban';
}

export class SpaceIdCursorDto {
  @IsUUID()
  spaceId: string;

  @IsString()
  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: number;
}

export class CreatePropertyDto {
  @IsUUID()
  pageId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsIn(BASE_PROPERTY_TYPES)
  type: string;

  @IsObject()
  @IsOptional()
  typeOptions?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  requestId?: string;
}

export class UpdatePropertyDto {
  @IsString()
  propertyId: string;

  @IsUUID()
  pageId: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsIn(BASE_PROPERTY_TYPES)
  @IsOptional()
  type?: string;

  @IsObject()
  @IsOptional()
  typeOptions?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  requestId?: string;
}

export class DeletePropertyDto {
  @IsString()
  propertyId: string;

  @IsUUID()
  pageId: string;

  @IsString()
  @IsOptional()
  requestId?: string;
}

export class ReorderPropertyDto {
  @IsString()
  propertyId: string;

  @IsUUID()
  pageId: string;

  @IsString()
  position: string;

  @IsString()
  @IsOptional()
  requestId?: string;
}

export class CreateRowDto {
  @IsUUID()
  pageId: string;

  @IsObject()
  @IsOptional()
  cells?: Record<string, unknown>;

  @IsUUID()
  @IsOptional()
  afterRowId?: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  requestId?: string;
}

export class GetRowDto {
  @IsUUID()
  rowId: string;

  @IsUUID()
  pageId: string;
}

export class UpdateRowDto {
  @IsUUID()
  rowId: string;

  @IsUUID()
  pageId: string;

  @IsObject()
  cells: Record<string, unknown>;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  requestId?: string;
}

export class DeleteRowDto {
  @IsUUID()
  rowId: string;

  @IsUUID()
  pageId: string;

  @IsString()
  @IsOptional()
  requestId?: string;
}

export class DeleteRowsDto {
  @IsUUID()
  pageId: string;

  @IsArray()
  rowIds: string[];

  @IsString()
  @IsOptional()
  requestId?: string;
}

export class ListRowsDto {
  @IsUUID()
  pageId: string;

  @IsString()
  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: number;

  @IsObject()
  @IsOptional()
  filter?: Record<string, unknown>;

  @IsArray()
  @IsOptional()
  sorts?: Array<{ propertyId: string; direction: 'asc' | 'desc' }>;
}

export class ReorderRowDto {
  @IsUUID()
  rowId: string;

  @IsUUID()
  pageId: string;

  @IsString()
  position: string;

  @IsString()
  @IsOptional()
  requestId?: string;
}

export class CreateViewDto {
  @IsUUID()
  pageId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(BASE_VIEW_TYPES)
  @IsOptional()
  type?: 'table' | 'kanban' | 'calendar';

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}

export class UpdateViewDto {
  @IsUUID()
  viewId: string;

  @IsUUID()
  pageId: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsIn(BASE_VIEW_TYPES)
  @IsOptional()
  type?: 'table' | 'kanban' | 'calendar';

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown> | null;

  @IsString()
  @IsOptional()
  position?: string;
}

export class DeleteViewDto {
  @IsUUID()
  viewId: string;

  @IsUUID()
  pageId: string;
}

export class ListViewsDto {
  @IsUUID()
  pageId: string;
}
