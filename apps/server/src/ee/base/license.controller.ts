import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { Workspace } from '@docmost/db/types/entity.types';

/**
 * Self-hosted enterprise license stub. Accepts any non-empty key as a
 * valid enterprise license; the bundled LicenseCheckService is patched to
 * return full entitlements regardless of the key.
 *
 * Response shape matches `ILicenseInfo` on the client:
 *   { id, customerName, seatCount, licenseType, issuedAt, expiresAt, trial }
 * Date fields are serialised as ISO 8601 strings so date-fns `new Date(...)`
 * rebuilds them correctly (numeric seconds were being interpreted as
 * milliseconds-since-epoch and showed as 21 Jan 1970).
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class LicenseController {
  private static formatLicense(workspace: Workspace) {
    const now = new Date();
    const issuedAt = new Date(now.getTime() - 86400 * 1000); // yesterday
    const expiresAt = new Date(now.getTime() + 365 * 10 * 86400 * 1000); // +10 years
    return {
      id: workspace.id,
      customerName: workspace.name ?? 'Self-hosted',
      seatCount: 9999,
      licenseType: 'enterprise' as const,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      trial: false,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('license/activate')
  async activate(
    @Body() body: { licenseKey: string },
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (!body?.licenseKey) {
      return { ok: false };
    }
    return LicenseController.formatLicense(workspace);
  }

  @HttpCode(HttpStatus.OK)
  @Post('license/info')
  async info(@AuthWorkspace() workspace: Workspace) {
    return LicenseController.formatLicense(workspace);
  }

  @HttpCode(HttpStatus.OK)
  @Post('license/remove')
  async remove() {
    return { ok: true };
  }
}
