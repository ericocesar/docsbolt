import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

// Mirrors apps/client/src/ee/security/contants.ts SSO_PROVIDER enum.
const SSO_PROVIDER_VALUES = ['oidc', 'saml', 'google', 'ldap'];

export class CreateSsoProviderDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsIn(SSO_PROVIDER_VALUES)
  type: string;

  @IsString()
  @IsOptional()
  samlUrl?: string;

  @IsString()
  @IsOptional()
  samlCertificate?: string;

  @IsString()
  @IsOptional()
  oidcIssuer?: string;

  @IsString()
  @IsOptional()
  oidcClientId?: string;

  @IsString()
  @IsOptional()
  oidcClientSecret?: string;

  @IsString()
  @IsOptional()
  ldapUrl?: string;

  @IsString()
  @IsOptional()
  ldapBindDn?: string;

  @IsString()
  @IsOptional()
  ldapBindPassword?: string;

  @IsString()
  @IsOptional()
  ldapBaseDn?: string;

  @IsOptional()
  ldapUserSearchFilter?: string;

  @IsOptional()
  ldapUserAttributes?: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  ldapTlsEnabled?: boolean;

  @IsString()
  @IsOptional()
  ldapTlsCaCert?: string;

  @IsBoolean()
  @IsOptional()
  allowSignup?: boolean;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  groupSync?: boolean;
}

export class UpdateSsoProviderDto {
  @IsUUID()
  providerId: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsIn(SSO_PROVIDER_VALUES)
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  samlUrl?: string;

  @IsString()
  @IsOptional()
  samlCertificate?: string;

  @IsString()
  @IsOptional()
  oidcIssuer?: string;

  @IsString()
  @IsOptional()
  oidcClientId?: string;

  @IsString()
  @IsOptional()
  oidcClientSecret?: string;

  @IsString()
  @IsOptional()
  ldapUrl?: string;

  @IsString()
  @IsOptional()
  ldapBindDn?: string;

  @IsString()
  @IsOptional()
  ldapBindPassword?: string;

  @IsString()
  @IsOptional()
  ldapBaseDn?: string;

  @IsOptional()
  ldapUserSearchFilter?: string;

  @IsOptional()
  ldapUserAttributes?: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  ldapTlsEnabled?: boolean;

  @IsString()
  @IsOptional()
  ldapTlsCaCert?: string;

  @IsBoolean()
  @IsOptional()
  allowSignup?: boolean;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  groupSync?: boolean;
}

export class ProviderIdDto {
  @IsUUID()
  providerId: string;
}
