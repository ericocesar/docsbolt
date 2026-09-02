import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EnvironmentService } from './environment.service';

/**
 * Every value of the client's `Feature` enum (apps/client/src/ee/features.ts).
 * Names are colon-separated there, e.g. Feature.AUDIT_LOGS = 'audit:logs'.
 * Returned from resolveFeatures() so the client-side `entitlements.features`
 * list contains every flag the UI may ask about.
 */
const ALL_FEATURES = [
  'sso:custom',
  'sso:google',
  'mfa',
  'api:keys',
  'comment:resolution',
  'page:permissions',
  'ai',
  'import:confluence',
  'import:docx',
  'import:pdf',
  'attachment:indexing',
  'security:settings',
  'mcp',
  'scim',
  'page:verification',
  'audit:logs',
  'retention',
  'sharing:controls',
  'templates',
  'comment:viewer',
  'spaces:personal',
  'export:docx',
  'bases',
  'oauth',
  'ai:controls',
  'mcp:controls',
];

/**
 * Patched LicenseCheckService — license verification bypassed.
 *
 * The original implementation delegates to `ee/licence/license.service`
 * (the Docmost EE module) which is intentionally absent from this
 * OSS distribution. With that module missing, every check fell through
 * to `return false` and EE-only features (SCIM, audit logs, MCP, etc.)
 * were disabled.
 *
 * This override short-circuits every method to grant full enterprise
 * entitlements for self-hosted deployments:
 *   - isValidEELicense: true
 *   - hasFeature: true (any feature)
 *   - resolveFeatures: every feature flag
 *   - resolveTier: 'enterprise'
 *
 * Revert by restoring the original `try { require(...) } catch { false }`
 * bodies below.
 */
@Injectable()
export class LicenseCheckService {
  constructor(
    private moduleRef: ModuleRef,
    private environmentService: EnvironmentService,
  ) {}

  isValidEELicense(_licenseKey: string): boolean {
    return true;
  }

  hasFeature(_licenseKey: string, _feature: string, _plan?: string): boolean {
    return true;
  }

  getFeatures(_licenseKey: string): string[] {
    return [...ALL_FEATURES];
  }

  resolveFeatures(_licenseKey: string, _plan: string): string[] {
    return [...ALL_FEATURES];
  }

  resolveTier(_licenseKey: string, _plan: string): string {
    return 'enterprise';
  }

  private getLicenseType(_licenseKey: string): string | null {
    return 'enterprise';
  }
}
