import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class PageIdDto {
  @IsUUID()
  pageId: string;
}

export class SetupVerificationDto {
  @IsUUID()
  pageId: string;

  @IsString()
  @IsIn(['expiring', 'qms'])
  @IsOptional()
  type?: 'expiring' | 'qms';

  @IsString()
  @IsIn(['period', 'fixed', 'indefinite'])
  @IsOptional()
  mode?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  periodAmount?: number;

  @IsString()
  @IsIn(['day', 'week', 'month', 'year'])
  @IsOptional()
  periodUnit?: string;

  @IsString()
  @IsOptional()
  fixedExpiresAt?: string;

  @IsUUID('all', { each: true })
  verifierIds: string[];
}

export class UpdateVerificationDto extends SetupVerificationDto {}

export class RejectApprovalDto {
  @IsUUID()
  pageId: string;

  @IsString()
  @IsOptional()
  comment?: string;
}

export class ListVerificationsDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsUUID()
  @IsOptional()
  spaceId?: string;

  @IsString()
  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: number;
}
