import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B-04: cuenta del dentista, sesiones revocables y auditoría inmutable
 * (DATA-MODEL.md: dentist_user, auth_session, audit_log).
 */
export class AuthAndAudit1764200000000 implements MigrationInterface {
  name = 'AuthAndAudit1764200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE dentist_user (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        username varchar(64) NOT NULL,
        password_hash text NOT NULL,
        full_name varchar(120) NOT NULL,
        active boolean NOT NULL DEFAULT true,
        must_change_password boolean NOT NULL DEFAULT true,
        failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
        locked_until timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX dentist_user_username_uq ON dentist_user (lower(username))',
    );
    // Regla de negocio: un solo dentista activo (ADR-004).
    await queryRunner.query(
      'CREATE UNIQUE INDEX dentist_user_single_active_uq ON dentist_user ((true)) WHERE active',
    );

    await queryRunner.query(`
      CREATE TABLE auth_session (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES dentist_user(id),
        secret_hash char(64) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_activity_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX auth_session_user_expires_idx ON auth_session (user_id, expires_at)',
    );

    await queryRunner.query(`
      CREATE TABLE audit_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_user_id uuid NULL REFERENCES dentist_user(id),
        actor_kind varchar(16) NOT NULL CHECK (actor_kind IN ('dentist', 'system', 'anonymous')),
        entity_type varchar(64) NOT NULL,
        entity_id uuid NULL,
        action varchar(64) NOT NULL,
        before_json jsonb NULL,
        after_json jsonb NULL,
        request_id varchar(64) NULL,
        ip_hash char(64) NULL,
        occurred_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      'CREATE INDEX audit_log_entity_idx ON audit_log (entity_type, entity_id, occurred_at)',
    );
    await queryRunner.query('CREATE INDEX audit_log_occurred_idx ON audit_log (occurred_at)');

    // La auditoría es solo de inserción (RF-27, RNF-08): se prohíbe UPDATE y DELETE.
    await queryRunner.query(`
      CREATE FUNCTION audit_log_reject_change() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'audit_log es solo de inserción';
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER audit_log_no_update_delete
      BEFORE UPDATE OR DELETE ON audit_log
      FOR EACH ROW EXECUTE FUNCTION audit_log_reject_change()
    `);
    await queryRunner.query(`
      CREATE TRIGGER audit_log_no_truncate
      BEFORE TRUNCATE ON audit_log
      FOR EACH STATEMENT EXECUTE FUNCTION audit_log_reject_change()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE audit_log');
    await queryRunner.query('DROP FUNCTION audit_log_reject_change()');
    await queryRunner.query('DROP TABLE auth_session');
    await queryRunner.query('DROP TABLE dentist_user');
  }
}
