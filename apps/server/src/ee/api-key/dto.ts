import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  expiresAt?: string;
}

export class UpdateApiKeyDto {
  @IsUUID()
  apiKeyId: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}

export class RevokeApiKeyDto {
  @IsUUID()
  apiKeyId: string;
}

export class ListApiKeysDto {
  @IsString()
  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: number;
}
