import { IsIn, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class SetupMfaDto {
  @IsString()
  @IsIn(['totp'])
  method: 'totp';
}

export class EnableMfaDto {
  @IsString()
  @MinLength(6)
  @MaxLength(8)
  verificationCode: string;
}

export class DisableMfaDto {
  @IsString()
  @IsOptional()
  confirmPassword?: string;
}

export class RegenerateBackupCodesDto {
  @IsString()
  @IsOptional()
  confirmPassword?: string;
}
