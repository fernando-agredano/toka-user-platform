import { Injectable } from '@nestjs/common';
import { Prisma, Credential as CredentialRow } from '../../../generated/prisma-client';
import { Credential } from '../../domain/entities/credential';
import type { DomainEvent } from '../../domain/events/auth-events';
import { EmailAlreadyRegisteredError } from '../../domain/errors/domain-error';
import type { CredentialRepository } from '../../domain/repositories/credential.repository';
import { Email } from '../../domain/value-objects/email';
import { toOutboxRecord } from '../messaging/outbox-record';
import { PrismaService } from './prisma.service';

const UNIQUE_VIOLATION = 'P2002';

const toDomain = (row: CredentialRow): Credential =>
  Credential.restore({
    id: row.id,
    email: Email.create(row.email),
    passwordHash: row.passwordHash,
    active: row.active,
    createdAt: row.createdAt,
  });

@Injectable()
export class PrismaCredentialRepository implements CredentialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Credential | null> {
    const row = await this.prisma.credential.findUnique({ where: { id } });
    return row && toDomain(row);
  }

  async findByEmail(email: Email): Promise<Credential | null> {
    const row = await this.prisma.credential.findUnique({ where: { email: email.value } });
    return row && toDomain(row);
  }

  async save(credential: Credential, events: DomainEvent[] = []): Promise<void> {
    const data = { email: credential.email.value, passwordHash: credential.passwordHash, active: credential.isActive };
    try {
      await this.prisma.$transaction([
        this.prisma.credential.upsert({ where: { id: credential.id }, create: { id: credential.id, ...data }, update: data }),
        ...(events.length > 0 ? [this.prisma.outboxEvent.createMany({ data: events.map(toOutboxRecord) })] : []),
      ]);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
        throw new EmailAlreadyRegisteredError();
      }
      throw error;
    }
  }
}
