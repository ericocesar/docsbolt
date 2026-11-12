import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RedisService } from '@nestjs-labs/nestjs-ioredis';
import { randomBytes, timingSafeEqual } from 'node:crypto';

const random = () => randomBytes(32).toString('base64url');

@Injectable()
export class OidcStateService {
  constructor(private readonly redisService: RedisService) {}

  async start(workspaceId: string, providerId: string) {
    const state = random();
    const verifier = random();
    const nonce = random();
    await this.redisService
      .getOrThrow()
      .set(
        `oidc:state:${state}`,
        JSON.stringify({ workspaceId, providerId, verifier, nonce }),
        'EX',
        300,
      );
    return { state, verifier, nonce };
  }

  async consume(
    state: string,
    cookie: string,
    workspaceId: string,
    providerId: string,
  ) {
    if (
      !/^[A-Za-z0-9_-]{43}$/.test(state ?? '') ||
      !/^[A-Za-z0-9_-]{43}$/.test(cookie ?? '') ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(cookie))
    ) {
      throw new UnauthorizedException('Invalid login state');
    }
    const raw = await this.redisService
      .getOrThrow()
      .getdel(`oidc:state:${state}`);
    if (!raw) throw new UnauthorizedException('Expired login state');
    const value = JSON.parse(raw);
    if (value.workspaceId !== workspaceId || value.providerId !== providerId)
      throw new UnauthorizedException('Invalid login state');
    return value as { verifier: string; nonce: string };
  }
}
