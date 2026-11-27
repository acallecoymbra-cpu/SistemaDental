import { Injectable, NotFoundException } from '@nestjs/common';
import {
  isClinicalContentEmpty,
  normalizeClinicalContent,
  sameClinicalContent,
  type ClinicalContent,
  type ClinicalHistory,
  type ClinicalVersion,
  type ClinicalVersionSummary,
  type SaveClinicalVersionResponse,
} from '@sistema-dental/contracts';
import { DataSource, EntityManager } from 'typeorm';
import { AuditService, RequestContext } from '../audit/audit.service';

const PATIENT_NOT_FOUND = 'El paciente no existe.';
const VERSION_NOT_FOUND = 'Esa versión no existe.';

interface VersionRow {
  id: string;
  version_number: number;
  anamnesis: string;
  dental_index_type: string;
  dental_index_value: string;
  diagnosis: string;
  created_at: Date;
  created_by_name: string;
}

const VERSION_SELECT = `
  SELECT v.id, v.version_number, v.anamnesis, v.dental_index_type, v.dental_index_value,
         v.diagnosis, v.created_at, u.full_name AS created_by_name
    FROM clinical_version v
    JOIN clinical_record r ON r.id = v.clinical_record_id
    JOIN dentist_user u ON u.id = v.created_by`;

function toVersion(row: VersionRow): ClinicalVersion {
  return {
    id: row.id,
    versionNumber: row.version_number,
    anamnesis: row.anamnesis,
    dentalIndexType: row.dental_index_type,
    dentalIndexValue: row.dental_index_value,
    diagnosis: row.diagnosis,
    createdAt: new Date(row.created_at).toISOString(),
    createdByName: row.created_by_name,
  };
}

/**
 * Historia clínica por versiones (T-15). Cada lectura de contenido y cada versión nueva quedan
 * en la auditoría SIN copiar el contenido clínico (solo quién, qué paciente y qué versión).
 * Las versiones no se editan: un cambio crea la siguiente; guardar sin cambios no crea nada.
 */
@Injectable()
export class ClinicalHistoryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  private async assertPatient(manager: EntityManager, patientId: string): Promise<void> {
    const rows = await manager.query<unknown[]>('SELECT 1 FROM patient WHERE id = $1', [patientId]);
    if (rows.length === 0) {
      throw new NotFoundException(PATIENT_NOT_FOUND);
    }
  }

  /** Versión vigente + lista de versiones (sin contenido). Se audita la lectura. */
  async get(patientId: string, actorUserId: string, ctx: RequestContext): Promise<ClinicalHistory> {
    return this.dataSource.transaction(async (manager) => {
      await this.assertPatient(manager, patientId);
      const rows = await manager.query<VersionRow[]>(
        `${VERSION_SELECT} WHERE r.patient_id = $1 ORDER BY v.version_number DESC`,
        [patientId],
      );
      const current = rows[0] ? toVersion(rows[0]) : null;
      await this.audit.record(
        {
          actorKind: 'dentist',
          actorUserId,
          entityType: 'patient',
          entityId: patientId,
          action: 'clinical_history_read',
        },
        ctx,
        manager,
      );
      const versions: ClinicalVersionSummary[] = rows.map((row) => ({
        versionNumber: row.version_number,
        createdAt: new Date(row.created_at).toISOString(),
        createdByName: row.created_by_name,
      }));
      return { current, versions };
    });
  }

  /** Una versión anterior con su contenido. Se audita la lectura. */
  async getVersion(
    patientId: string,
    versionNumber: number,
    actorUserId: string,
    ctx: RequestContext,
  ): Promise<ClinicalVersion> {
    return this.dataSource.transaction(async (manager) => {
      const [row] = await manager.query<VersionRow[]>(
        `${VERSION_SELECT} WHERE r.patient_id = $1 AND v.version_number = $2`,
        [patientId, versionNumber],
      );
      if (!row) {
        throw new NotFoundException(VERSION_NOT_FOUND);
      }
      await this.audit.record(
        {
          actorKind: 'dentist',
          actorUserId,
          entityType: 'clinical_version',
          entityId: row.id,
          action: 'clinical_version_read',
          after: { patientId, versionNumber },
        },
        ctx,
        manager,
      );
      return toVersion(row);
    });
  }

  /** Guarda: crea la versión n+1 solo si el contenido cambió respecto de la vigente. */
  async save(
    patientId: string,
    content: ClinicalContent,
    actorUserId: string,
    ctx: RequestContext,
  ): Promise<SaveClinicalVersionResponse> {
    const next = normalizeClinicalContent(content);
    return this.dataSource.transaction(async (manager) => {
      await this.assertPatient(manager, patientId);
      await manager.query(
        `INSERT INTO clinical_record (patient_id, created_by) VALUES ($1, $2)
         ON CONFLICT (patient_id) DO NOTHING`,
        [patientId, actorUserId],
      );
      // Bloquea la historia del paciente: dos guardados a la vez se numeran en orden.
      const [record] = await manager.query<{ id: string }[]>(
        'SELECT id FROM clinical_record WHERE patient_id = $1 FOR UPDATE',
        [patientId],
      );
      const [latest] = await manager.query<VersionRow[]>(
        `${VERSION_SELECT} WHERE r.id = $1 ORDER BY v.version_number DESC LIMIT 1`,
        [record!.id],
      );
      const currentRow = latest ? toVersion(latest) : null;
      const unchanged = currentRow
        ? sameClinicalContent(currentRow, next)
        : isClinicalContentEmpty(next);
      if (unchanged) {
        return { saved: false, current: currentRow };
      }
      const versionNumber = (currentRow?.versionNumber ?? 0) + 1;
      const [created] = await manager.query<{ id: string }[]>(
        `INSERT INTO clinical_version (clinical_record_id, version_number, anamnesis,
                dental_index_type, dental_index_value, diagnosis, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          record!.id,
          versionNumber,
          next.anamnesis,
          next.dentalIndexType,
          next.dentalIndexValue,
          next.diagnosis,
          actorUserId,
        ],
      );
      await this.audit.record(
        {
          actorKind: 'dentist',
          actorUserId,
          entityType: 'clinical_version',
          entityId: created!.id,
          action: 'clinical_version_created',
          after: { patientId, versionNumber },
        },
        ctx,
        manager,
      );
      const [row] = await manager.query<VersionRow[]>(`${VERSION_SELECT} WHERE v.id = $1`, [
        created!.id,
      ]);
      return { saved: true, current: toVersion(row!) };
    });
  }
}
