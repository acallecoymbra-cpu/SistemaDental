import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { DataSource } from 'typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { hashPassword, temporaryPassword } from '../auth/passwords';
import { buildDataSourceOptions } from '../database/data-source-options';
import { DentistUser } from '../users/dentist-user.entity';

/**
 * Crea la cuenta del dentista (B-04). No hay registro público de personal: la
 * primera cuenta se crea solo por consola, con una contraseña temporal que se
 * muestra UNA vez y debe cambiarse en el primer acceso.
 *
 * Uso: pnpm --filter @sistema-dental/api dentist:create --username dra.perez --name "Dra. Pérez"
 */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { username: { type: 'string' }, name: { type: 'string' } },
  });
  const username = values.username?.trim();
  const fullName = values.name?.trim();
  if (!username || !/^[a-zA-Z0-9._-]{3,64}$/.test(username) || !fullName) {
    console.error(
      'Uso: dentist:create --username <3-64 letras, números, . _ -> --name "<nombre completo>"',
    );
    process.exitCode = 1;
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL no está definida (ver .env.example).');
    process.exitCode = 1;
    return;
  }

  const ds = new DataSource(buildDataSourceOptions(url));
  await ds.initialize();
  try {
    const password = temporaryPassword();
    const passwordHash = await hashPassword(password);
    const created = await ds.transaction(async (manager) => {
      const users = manager.getRepository(DentistUser);
      if (await users.exists({ where: { active: true } })) {
        return 'active-exists' as const;
      }
      const taken = await users
        .createQueryBuilder('u')
        .where('lower(u.username) = lower(:username)', { username })
        .getExists();
      if (taken) {
        return 'username-taken' as const;
      }
      const user = await users.save({ username, fullName, passwordHash, mustChangePassword: true });
      await manager.getRepository(AuditLog).insert({
        actorKind: 'system',
        actorUserId: null,
        entityType: 'dentist_user',
        entityId: user.id,
        action: 'dentist_created',
        afterJson: { username, fullName },
      });
      return user;
    });

    if (created === 'active-exists') {
      console.error('Ya existe un dentista activo. El sistema admite uno solo (ADR-004).');
      process.exitCode = 1;
      return;
    }
    if (created === 'username-taken') {
      console.error(`El usuario "${username}" ya existe (aunque esté inactivo). Use otro nombre.`);
      process.exitCode = 1;
      return;
    }
    console.warn(`Dentista creado: ${username}`);
    console.warn(`Contraseña temporal (se muestra una sola vez): ${password}`);
    console.warn('Deberá cambiarla en el primer inicio de sesión.');
  } finally {
    await ds.destroy();
  }
}

void main();
