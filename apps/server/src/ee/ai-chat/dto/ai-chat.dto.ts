import { IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendChatMessageDto {
  @IsOptional()
  @IsUUID()
  chatId?: string;

  @IsString()
  @MaxLength(32000)
  content: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  mentionedPageIds?: string[];

  @IsOptional()
  @IsUUID()
  contextPageId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  attachmentIds?: string[];
}

export class CreateChatDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}

export class ListChatsDto {
  @IsOptional()
  limit?: number;
  @IsOptional()
  cursor?: string;
}

export class ChatInfoDto {
  @IsUUID()
  chatId: string;
}

export class DeleteChatDto {
  @IsUUID()
  chatId: string;
}

export class UpdateChatDto {
  @IsUUID()
  chatId: string;

  @IsString()
  @MaxLength(255)
  title: string;
}

export class SearchChatsDto {
  @IsString()
  query: string;
}
