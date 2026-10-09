import { Injectable } from '@nestjs/common';
import { Prisma, User as UserRow } from '../../../generated/prisma-client';
import { User } from '../../domain/entities/user';
import { EmailAlreadyExistsError } from '../../domain/errors/domain-error';
import type { DomainEvent } from '../../domain/events/user-events';
import type { UserListFilter, UserRepository } from '../../domain/repositories/user.repository';
import { Email } from '../../domain/value-objects/email';
import { PersonName } from '../../domain/value-objects/person-name';
import { toOutboxRecord } from '../messaging/outbox-record';
import { PrismaService } from './prisma.service';

const UNIQUE_VIOLATION = 'P2002';

const toDomain = (row: UserRow): User =>
  User.restore({
    id: row.id,
    email: Email.create(row.email),
    firstName: PersonName.create(row.firstName, 'firstName'),
    lastName: PersonName.create(row.lastName, 'lastName'),
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row && toDomain(row);
  }

  async findByEmail(email: Email): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email: email.value } });
    return row && toDomain(row);
  }

  async list({ page, limit, search, status }: UserListFilter): Promise<{ items: User[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      ...(status && { status }),
      ...(search && {
        OR: ['email', 'firstName', 'lastName'].map((field) => ({
          [field]: { contains: search, mode: 'insensitive' as const },
        })),
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.user.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }

  async save(user: User, events: DomainEvent[] = []): Promise<void> {
    const data = {
      email: user.email.value,
      firstName: user.firstName.value,
      lastName: user.lastName.value,
      status: user.status,
      updatedAt: user.updatedAt,
    };
    try {
      await this.prisma.$transaction([
        this.prisma.user.upsert({
          where: { id: user.id },
          create: { id: user.id, createdAt: user.createdAt, ...data },
          update: data,
        }),
        ...(events.length > 0 ? [this.prisma.outboxEvent.createMany({ data: events.map(toOutboxRecord) })] : []),
      ]);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
        throw new EmailAlreadyExistsError();
      }
      throw error;
    }
  }
}
