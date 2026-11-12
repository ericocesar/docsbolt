// Run after `pnpm --filter server build`: node apps/server/test/oidc-protocol-smoke.cjs
// Exercises the real openid-client authorization-code and signature validation
// against an isolated local HTTPS issuer, with in-memory application services.
const assert = require('node:assert/strict');
const https = require('node:https');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Agent } = require('undici');
const { OidcLoginService } = require('../dist/ee/security/oidc-login.service');
const { OidcStateService } = require('../dist/ee/security/oidc-state.service');

async function run() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'docsplan-oidc-'));
  let server;
  try {
    const keyFile = path.join(temp, 'tls.key');
    const certFile = path.join(temp, 'tls.crt');
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        keyFile,
        '-out',
        certFile,
        '-subj',
        '/CN=localhost',
        '-days',
        '1',
      ],
      { stdio: 'ignore' },
    );
    const signing = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = {
      ...signing.publicKey.export({ format: 'jwk' }),
      kid: 'test-key',
      use: 'sig',
      alg: 'RS256',
    };
    let issuer,
      expectedNonce,
      expectedChallenge,
      badNonce = false,
      badSignature = false;
    server = https.createServer(
      { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) },
      (req, res) => {
        res.setHeader('content-type', 'application/json');
        if (req.url === '/.well-known/openid-configuration')
          return res.end(
            JSON.stringify({
              issuer,
              authorization_endpoint: `${issuer}/authorize`,
              token_endpoint: `${issuer}/token`,
              jwks_uri: `${issuer}/jwks`,
              response_types_supported: ['code'],
              subject_types_supported: ['public'],
              id_token_signing_alg_values_supported: ['RS256'],
              code_challenge_methods_supported: ['S256'],
              token_endpoint_auth_methods_supported: ['client_secret_basic'],
            }),
          );
        if (req.url === '/jwks')
          return res.end(JSON.stringify({ keys: [jwk] }));
        if (req.url !== '/token') {
          res.statusCode = 404;
          return res.end('{}');
        }
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          const data = new URLSearchParams(body);
          const challenge = crypto
            .createHash('sha256')
            .update(data.get('code_verifier') || '')
            .digest('base64url');
          if (
            challenge !== expectedChallenge ||
            data.get('code') !== 'valid-code'
          ) {
            res.statusCode = 400;
            return res.end('{}');
          }
          const now = Math.floor(Date.now() / 1000);
          const encode = (v) =>
            Buffer.from(JSON.stringify(v)).toString('base64url');
          const unsigned = `${encode({ alg: 'RS256', kid: 'test-key', typ: 'JWT' })}.${encode({ iss: issuer, aud: 'client-id', sub: 'subject', email: 'member@example.org', email_verified: true, iat: now, exp: now + 120, nonce: badNonce ? 'wrong' : expectedNonce })}`;
          const signature = crypto
            .sign(
              'RSA-SHA256',
              Buffer.from(badSignature ? 'different-message' : unsigned),
              signing.privateKey,
            )
            .toString('base64url');
          res.end(
            JSON.stringify({
              access_token: 'dummy',
              token_type: 'Bearer',
              id_token: `${unsigned}.${signature}`,
            }),
          );
        });
      },
    );
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    issuer = `https://127.0.0.1:${server.address().port}`;
    const values = new Map();
    const redis = {
      set: async (key, value) => (values.set(key, value), 'OK'),
      getdel: async (key) => {
        const value = values.get(key);
        values.delete(key);
        return value ?? null;
      },
    };
    const state = new OidcStateService({ getOrThrow: () => redis });
    let table;
    const db = {
      selectFrom: (name) => ((table = name), db),
      selectAll: () => db,
      where: () => db,
      executeTakeFirst: async () =>
        table === 'authProviders'
          ? {
              oidcIssuer: issuer,
              oidcClientId: 'client-id',
              oidcClientSecret: 'encrypted',
            }
          : { userId: 'user' },
      transaction: () => ({ execute: (fn) => fn(db) }),
    };
    const outbound = {
      lease: async () => {
        const dispatcher = new Agent({
          connect: { rejectUnauthorized: false },
        });
        return { dispatcher, release: () => dispatcher.close() };
      },
    };
    let sessions = 0;
    const service = new OidcLoginService(
      db,
      { decrypt: () => 'client-secret' },
      state,
      outbound,
      {},
      {
        findById: async () => ({ id: 'user', workspaceId: 'ws' }),
        updateLastLogin: async () => {},
      },
      { createSessionAndToken: async () => (sessions++, 'session-token') },
      {},
      { getUrl: () => 'https://docs.example.org' },
      { setActorId() {}, log() {} },
    );
    const start = async () => {
      const result = await service.begin({ id: 'ws' }, 'provider');
      const url = new URL(result.url);
      expectedNonce = url.searchParams.get('nonce');
      expectedChallenge = url.searchParams.get('code_challenge');
      assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
      return result;
    };
    const callback = (s) =>
      new URL(
        `https://docs.example.org/api/sso/oidc/provider/callback?code=valid-code&state=${s}`,
      );
    const valid = await start();
    assert.equal(
      await service.complete(
        { id: 'ws' },
        'provider',
        valid.state,
        valid.state,
        callback(valid.state),
      ),
      'session-token',
    );
    await assert.rejects(() =>
      service.complete(
        { id: 'ws' },
        'provider',
        valid.state,
        valid.state,
        callback(valid.state),
      ),
    );
    badNonce = true;
    const invalid = await start();
    await assert.rejects(() =>
      service.complete(
        { id: 'ws' },
        'provider',
        invalid.state,
        invalid.state,
        callback(invalid.state),
      ),
    );
    badNonce = false;
    badSignature = true;
    const forged = await start();
    await assert.rejects(() =>
      service.complete(
        { id: 'ws' },
        'provider',
        forged.state,
        forged.state,
        callback(forged.state),
      ),
    );
    assert.equal(sessions, 1);
    console.log(
      'OIDC protocol smoke passed: signature, PKCE, nonce and replay protection',
    );
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
