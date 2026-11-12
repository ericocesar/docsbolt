import { Module } from '@nestjs/common';
import { SsoController } from './sso.controller';
import { SsoService } from './sso.service';
import { SsoAdminGuard } from './sso-admin.guard';
import { AuthModule } from '../../core/auth/auth.module';
import { OidcLoginController } from './oidc-login.controller';
import { OidcLoginService } from './oidc-login.service';
import { OidcStateService } from './oidc-state.service';

@Module({
  imports: [AuthModule],
  controllers: [SsoController, OidcLoginController],
  providers: [SsoService, SsoAdminGuard, OidcLoginService, OidcStateService],
  exports: [SsoService],
})
export class SecurityModule {}
