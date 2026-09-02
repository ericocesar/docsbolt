import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import {
  generateSecret,
  generateSync,
  generateURI,
  verifySync,
} from 'otplib';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import * as QRCode from 'qrcode';
import { KyselyDB } from '../../database/types/kysely.types';
import { EncryptionService } from '../../integrations/encryption/encryption.service';

@Injectable()
export class MfaService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly encryption: EncryptionService,
  ) {}

  private row(userId: string) {
    return this.db
      .selectFrom('userMfa')
      .selectAll()
      .where('userId', '=', userId)
      .executeTakeFirst();
  }

  async status(userId: string) {
    const r = await this.row(userId);
    return {
      isEnabled: !!r?.isEnabled,
      method: r?.isEnabled ? r.method : null,
      backupCodesCount: r?.backupCodes?.length ?? 0,
    };
  }

  async setup(userId: string, workspaceId: string, email: string) {
    const secret = generateSecret();
    const otpauth = generateURI({ issuer: 'Docmost', label: email, secret });
    const qrCode = await QRCode.toDataURL(otpauth);

    await this.db
      .insertInto('userMfa')
      .values({
        userId,
        workspaceId,
        method: 'totp',
        secret: this.encryption.encrypt(secret),
        isEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .onConflict((oc) =>
        oc.column('userId').doUpdateSet({
          secret: this.encryption.encrypt(secret),
          isEnabled: false,
          updatedAt: new Date(),
        }),
      )
      .execute();

    return { method: 'totp', qrCode, manualKey: secret };
  }

  generateBackupCodes(): string[] {
    return Array.from({ length: 10 }, () => {
      const hex = randomBytes(5).toString('hex').toUpperCase();
      return `${hex.slice(0, 5)}-${hex.slice(5)}`;
    });
  }

  async enable(userId: string, verificationCode: string) {
    const r = await this.row(userId);
    if (!r?.secret) throw new BadRequestException('Run setup first');
    const secret = this.encryption.decrypt(r.secret);
    const result = verifySync({ secret, token: verificationCode });
    if (!result.valid) {
      throw new BadRequestException('Invalid code');
    }
    const backupCodes = this.generateBackupCodes();
    await this.db
      .updateTable('userMfa')
      .set({ isEnabled: true, backupCodes, updatedAt: new Date() })
      .where('userId', '=', userId)
      .execute();
    return { success: true, backupCodes };
  }

  async disable(userId: string, password?: string) {
    const r = await this.row(userId);
    if (!r) return { success: true };
    if (password) {
      const user = await this.db
        .selectFrom('users')
        .select('password')
        .where('id', '=', userId)
        .executeTakeFirst();
      if (user?.password && !(await bcrypt.compare(password, user.password))) {
        throw new BadRequestException('Invalid password');
      }
    }
    await this.db.deleteFrom('userMfa').where('userId', '=', userId).execute();
    return { success: true };
  }

  async regenerateBackupCodes(userId: string) {
    const r = await this.row(userId);
    if (!r?.isEnabled) throw new BadRequestException('MFA is not enabled');
    const codes = this.generateBackupCodes();
    await this.db
      .updateTable('userMfa')
      .set({ backupCodes: codes, updatedAt: new Date() })
      .where('userId', '=', userId)
      .execute();
    return { backupCodes: codes };
  }

  async validateAccess() {
    // Login-challenge enforcement is out of scope for this build; MFA is
    // manageable in Settings but never blocks access.
    return { valid: true };
  }
}
