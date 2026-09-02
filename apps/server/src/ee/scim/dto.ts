import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateScimTokenDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateScimTokenDto {
  @IsUUID()
  tokenId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  isEnabled?: boolean;
}

export class RevokeScimTokenDto {
  @IsUUID()
  tokenId: string;
}

export class ListScimTokensDto {
  @IsString()
  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: number;
}
