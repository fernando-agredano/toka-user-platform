import { Injectable } from '@nestjs/common';
import { Prisma, Role as RoleRow, RolePermission } from '../../../generated/prisma-client';
import { Role } from '../../domain/entities/role';
import { RoleAlreadyExistsError } from '../../domain/errors/domain-error';
import type { DomainEvent } from '../../domain/events/role-events';
import type { RoleRepository } from '../../domain/repositories/role.repository';
import type { Permission } from '../../domain/value-objects/permission';
import { RoleName } from '../../domain/value-objects/role-name';
import { toOutboxRecord } from '../messaging/outbox-record';
import { PrismaService } from './prisma.service';

const UNIQUE_VIOLATION = 'P2002';
const WITH_PERMISSIONS = { permissions: true } as const;

type RoleWithPermissions = RoleRow & { permissions: RolePermission[] };

const toDomain = (row: RoleWithPermissions): Role =>
  Role.restore({
    id: row.id,
    name: RoleName.create(row.name),
    description: row.description,
    permissions: row.permissions.map((entry) => entry.permission as Permission).sort(),
    createdAt: row.createdAt,
  });

const outboxOps = (prisma: Prisma.TransactionClient, events: DomainEvent[]) =>
  events.length > 0 ? [prisma.outboxEvent.createMany({ data: events.map(toOutboxRecord) })] : [];

@Injectable()
export class PrismaRoleRepository implements RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Role | null> {
    const row = await this.prisma.role.findUnique({ where: { id }, include: WITH_PERMISSIONS });
    return row && toDomain(row);
  }

  async findByName(name: RoleName): Promise<Role | null> {
    const row = await this.prisma.role.findUnique({ where: { name: name.value }, include: WITH_PERMISSIONS });
    return row && toDomain(row);
  }

  async list(): Promise<Role[]> {
    const rows = await this.prisma.role.findMany({ include: WITH_PERMISSIONS, orderBy: { name: 'asc' } });
    return rows.map(toDomain);
  }

  async findByUser(userId: string): Promise<Role[]> {
    const rows = await this.prisma.role.findMany({
      where: { holders: { some: { userId } } },
      include: WITH_PERMISSIONS,
      orderBy: { name: 'asc' },
    });
    return rows.map(toDomain);
  }

  countHolders(roleId: string): Promise<number> {
    return this.prisma.userRole.count({ where: { roleId } });
  }

  async findHolderIds(roleId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({ where: { roleId }, select: { userId: true } });
    return rows.map((row) => row.userId);
  }

  async save(role: Role, events: DomainEvent[] = []): Promise<void> {
    try {
      await this.prisma.$transaction([
        // The name is immutable, so only the description is updated on conflict.
        this.prisma.role.upsert({
          where: { id: role.id },
          create: { id: role.id, name: role.name.value, description: role.description, createdAt: role.createdAt },
          update: { description: role.description },
        }),
        this.prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
        this.prisma.rolePermission.createMany({
          data: role.permissions.map((permission) => ({ roleId: role.id, permission })),
        }),
        ...outboxOps(this.prisma, events),
      ]);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
        throw new RoleAlreadyExistsError();
      }
      throw error;
    }
  }

  async assign(userId: string, role: Role, events: DomainEvent[] = []): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.userRole.createMany({ data: [{ userId, roleId: role.id }], skipDuplicates: true }),
      ...outboxOps(this.prisma, events),
    ]);
  }

  async revoke(userId: string, role: Role, events: DomainEvent[] = []): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Row lock serializes concurrent revocations of the same role, so the holder count below cannot go stale.
      await tx.$queryRaw`SELECT id FROM roles WHERE id = ${role.id}::uuid FOR UPDATE`;
      role.assertRevocable(await tx.userRole.count({ where: { roleId: role.id } }));
      await tx.userRole.deleteMany({ where: { userId, roleId: role.id } });
      if (events.length > 0) await tx.outboxEvent.createMany({ data: events.map(toOutboxRecord) });
    });
  }
}
