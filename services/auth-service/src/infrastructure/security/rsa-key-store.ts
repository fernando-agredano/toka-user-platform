import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  JWK,
  KeyLike,
  calculateJwkThumbprint,
  exportJWK,
  exportPKCS8,
  exportSPKI,
  generateKeyPair,
  importPKCS8,
  importSPKI,
} from 'jose';
import { AUTH_CONFIG, AuthConfig } from '../config/auth-config';

const PRIVATE_KEY_FILE = 'private.pem';
const PUBLIC_KEY_FILE = 'public.pem';
export const SIGNING_ALG = 'RS256';

/** Loads the RSA signing keys from JWT_KEYS_DIR, generating them on first boot. */
@Injectable()
export class RsaKeyStore implements OnModuleInit {
  private readonly logger = new Logger(RsaKeyStore.name);
  private privateKey!: KeyLike;
  private publicJwk!: JWK;

  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  async onModuleInit(): Promise<void> {
    const dir = this.config.jwt.keysDir;
    await mkdir(dir, { recursive: true });

    let [privatePem, publicPem] = await Promise.all([
      readFile(join(dir, PRIVATE_KEY_FILE), 'utf8').catch(() => null),
      readFile(join(dir, PUBLIC_KEY_FILE), 'utf8').catch(() => null),
    ]);

    if (!privatePem || !publicPem) {
      const pair = await generateKeyPair(SIGNING_ALG, { modulusLength: 2048, extractable: true });
      privatePem = await exportPKCS8(pair.privateKey);
      publicPem = await exportSPKI(pair.publicKey);
      await writeFile(join(dir, PRIVATE_KEY_FILE), privatePem, { mode: 0o600 });
      await writeFile(join(dir, PUBLIC_KEY_FILE), publicPem);
      this.logger.warn(`No signing keys found in ${dir}; generated a new RSA key pair`);
    }

    this.privateKey = await importPKCS8(privatePem, SIGNING_ALG);
    const jwk = await exportJWK(await importSPKI(publicPem, SIGNING_ALG));
    this.publicJwk = { ...jwk, kid: await calculateJwkThumbprint(jwk), alg: SIGNING_ALG, use: 'sig' };
  }

  get signingKey(): KeyLike {
    return this.privateKey;
  }

  get keyId(): string {
    return this.publicJwk.kid as string;
  }

  getJwks(): { keys: JWK[] } {
    return { keys: [this.publicJwk] };
  }
}
