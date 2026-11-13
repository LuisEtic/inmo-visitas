/**
 * Tipos de la base de datos, escritos a mano a partir de las migraciones
 * 0001 (columnas de clients y properties) y 0003 (agents).
 * No se genera con supabase-js: el proyecto no usa la CLI de Supabase.
 * `price` es numeric(12,2) en la base y llega como number por PostgREST.
 */

export type ClientRow = {
  id: string
  agent_id: string | null
  full_name: string
  phone: string | null
  email: string | null
  is_temporary: boolean
  created_at: string
}

export type ClientInsert = {
  full_name: string
  phone?: string | null
  email?: string | null
  is_temporary?: boolean
}

export type ClientUpdate = {
  full_name?: string
  phone?: string | null
  email?: string | null
  is_temporary?: boolean
}

export type PropertyStatus = 'disponible' | 'reservado' | 'vendido'

export type PropertyRow = {
  id: string
  agent_id: string | null
  reference: string
  address: string
  city: string
  price: number
  owner_name: string
  owner_phone: string | null
  status: PropertyStatus
  created_at: string
}

export type PropertyInsert = {
  reference: string
  address: string
  city: string
  price: number
  owner_name: string
  owner_phone?: string | null
  status?: PropertyStatus
}

export type PropertyUpdate = {
  reference?: string
  address?: string
  city?: string
  price?: number
  owner_name?: string
  owner_phone?: string | null
  status?: PropertyStatus
}

export type AgentRow = {
  id: string
  full_name: string
  email: string
  phone: string | null
  created_at: string
}

export type VisitNoteStatus = 'draft' | 'transcribed' | 'extracted' | 'reviewed' | 'approved'

export type VisitNoteInputType = 'audio' | 'text'

/**
 * Nota de visita (Fase 4). `client_id` y `property_id` son no nulos
 * desde la migración 0005. `audio_url` guarda la RUTA del objeto en
 * Storage (`<agent_id>/<visit_note_id>.<ext>`), nunca una URL pública;
 * para escuchar el audio se pide una URL firmada de 5 minutos.
 * `transcribed` significa «hay texto listo para la extracción» (la
 * Fase 5 leerá `coalesce(transcript, raw_text)`).
 * `extracted_at` y `approved_at` son de la migración 0007 (Fase 5).
 */
export type VisitNoteRow = {
  id: string
  agent_id: string | null
  client_id: string
  property_id: string
  input_type: VisitNoteInputType
  audio_url: string | null
  raw_text: string | null
  transcript: string | null
  status: VisitNoteStatus
  extracted_at: string | null
  approved_at: string | null
  created_at: string
}

export type VisitNoteInsert = {
  client_id: string
  property_id: string
  input_type: VisitNoteInputType
  audio_url?: string | null
  raw_text?: string | null
  transcript?: string | null
  status?: VisitNoteStatus
}

export type VisitNoteUpdate = {
  audio_url?: string | null
  raw_text?: string | null
  transcript?: string | null
  status?: VisitNoteStatus
  extracted_at?: string | null
  approved_at?: string | null
}

export type FactCategory =
  | 'hecho_declarado'
  | 'observacion'
  | 'desconocido'
  | 'objecion'
  | 'presupuesto'
  | 'cita_pendiente'

export type FactReviewStatus = 'propuesto' | 'aceptado' | 'editado' | 'descartado'

export type FactOrigin = 'ia' | 'agente'

/**
 * Dato extraído de una nota (Fase 5). Columnas de 0001 más las de
 * revisión de 0007: `origin` (quién lo propuso), `review_status`,
 * `original_value` (valor de la IA antes de la primera edición) y
 * `reviewed_at`.
 */
export type ExtractedFactRow = {
  id: string
  visit_note_id: string
  category: FactCategory
  field_name: string
  value: string
  evidence_quote: string | null
  confidence: number | null
  origin: FactOrigin
  review_status: FactReviewStatus
  original_value: string | null
  reviewed_at: string | null
  created_at: string
}

export type ExtractedFactInsert = {
  visit_note_id: string
  category: FactCategory
  field_name: string
  value: string
  evidence_quote?: string | null
  confidence?: number | null
  origin?: FactOrigin
  review_status?: FactReviewStatus
  original_value?: string | null
  reviewed_at?: string | null
}

export type ExtractedFactUpdate = {
  value?: string
  evidence_quote?: string | null
  confidence?: number | null
  review_status?: FactReviewStatus
  original_value?: string | null
  reviewed_at?: string | null
}

export type TaskStatus = 'propuesta' | 'pendiente' | 'completada' | 'descartada'

export type TaskOrigin = 'ia' | 'regla' | 'agente'

/**
 * Tarea de seguimiento (Fase 6). Columnas de 0001 más las de 0009:
 * `origin` (quién la propuso), `source_fact_id` (el dato que la
 * justifica), `original_description` (descripción anterior a la
 * primera edición, para medir correcciones), `completed_at` y
 * `updated_at`. Una tarea a mano (`agente`) nace `pendiente` y puede
 * no tener nota (`visit_note_id` null).
 */
export type TaskRow = {
  id: string
  visit_note_id: string | null
  agent_id: string | null
  description: string
  due_date: string | null
  status: TaskStatus
  origin: TaskOrigin
  source_fact_id: string | null
  original_description: string | null
  completed_at: string | null
  updated_at: string | null
  created_at: string
}

export type TaskInsert = {
  visit_note_id?: string | null
  description: string
  due_date?: string | null
  status?: TaskStatus
  origin?: TaskOrigin
  source_fact_id?: string | null
}

export type TaskUpdate = {
  description?: string
  due_date?: string | null
  status?: TaskStatus
  source_fact_id?: string | null
}

export type DraftAudience = 'comprador' | 'propietario'

export type DraftStatus = 'borrador' | 'aprobado'

/**
 * Borrador de seguimiento (Fase 6). Columnas de 0001 más las de 0009:
 * `status` (`borrador` o `aprobado`, congelado), `original_content`
 * (texto de la IA antes de la primera edición),
 * `generated_at`/`edited_at`/`approved_at`. Un borrador por nota y
 * destinatario. El del propietario solo existe filtrado
 * (`is_sensitive_filtered`).
 */
export type DraftRow = {
  id: string
  visit_note_id: string
  audience: DraftAudience
  content: string
  is_sensitive_filtered: boolean
  status: DraftStatus
  original_content: string | null
  generated_at: string
  edited_at: string | null
  approved_at: string | null
  created_at: string
}

export type DraftInsert = {
  visit_note_id: string
  audience: DraftAudience
  content: string
  is_sensitive_filtered?: boolean
  status?: DraftStatus
}

export type DraftUpdate = {
  content?: string
  status?: DraftStatus
}

export type CrmExportStatus = 'pendiente' | 'enviado' | 'error' | 'entregado'

export type CrmExportKind = 'nota' | 'borrador'

export type CrmExportTarget = 'inmovilla' | 'witei' | 'whatsapp' | 'manual'

/**
 * Exportación de una nota (Fase 7, migración 0010). Registro de solo
 * inserción: cada intento es una fila nueva; una fila cerrada
 * (`enviado`, `error`, `entregado`) no cambia. `kind = 'nota'` lleva
 * la ficha de la visita; `kind = 'borrador'` lleva un borrador
 * aprobado (solo WhatsApp), con su `draft_id` y `audience`.
 * `entregado` = la app se la dio al agente (WhatsApp abierto, ficha
 * copiada); la app NO sabe si llegó a enviarse. `enviado` solo lo usa
 * el CRM. `error_message` es genérico, en español y sin datos
 * personales (≤ 300 caracteres).
 */
export type CrmExportRow = {
  id: string
  visit_note_id: string
  target: CrmExportTarget
  kind: CrmExportKind
  draft_id: string | null
  audience: DraftAudience | null
  payload: Record<string, unknown> | null
  status: CrmExportStatus
  external_id: string | null
  error_message: string | null
  exported_at: string | null
  created_at: string
  updated_at: string | null
}

export type CrmExportInsert = {
  visit_note_id: string
  target: CrmExportTarget
  kind?: CrmExportKind
  draft_id?: string | null
  audience?: DraftAudience | null
  payload?: Record<string, unknown> | null
  status: CrmExportStatus
  external_id?: string | null
  error_message?: string | null
}

export type CrmExportUpdate = {
  status?: CrmExportStatus
  external_id?: string | null
  error_message?: string | null
  payload?: Record<string, unknown> | null
}

export type AudioCleanupReason = 'nota_borrada' | 'nota_aprobada'

/**
 * Fila de la cola de borrado de audios (Fase 8, migración 0012).
 * Guarda solo la ruta del objeto en `visit-audio` y el motivo. El
 * navegador (`flushAudioCleanup`) borra los objetos y vacía la cola.
 * Sin `update`: la cola no se edita, solo se vacía.
 */
export type AudioCleanupRow = {
  id: string
  agent_id: string
  path: string
  reason: AudioCleanupReason
  created_at: string
}

export type AuditEventAction =
  | 'nota_borrada'
  | 'cliente_borrado'
  | 'propietario_borrado'
  | 'datos_entregados'

/**
 * Registro de acciones de privacidad (Fase 8, migración 0012). Solo
 * inserción y sin datos personales (ni nombres, ni textos, ni rutas):
 * sirve para rendir cuentas (art. 5.2 RGPD). Se borra solo con la
 * cuenta del agente (cascada desde `agents`).
 */
export type AuditEventRow = {
  id: string
  agent_id: string
  action: AuditEventAction
  entity_id: string | null
  created_at: string
}

export type AiCallFunction = 'transcribe' | 'extract' | 'drafts'

/**
 * Llamada a la IA (Fase 8, migración 0012): una fila por llamada a
 * `transcribe`, `extract` o `drafts`, para el límite diario por
 * agente. Sin `update` ni `delete`: el agente no puede borrar su
 * cuenta de llamadas.
 */
export type AiCallRow = {
  id: string
  agent_id: string
  fn: AiCallFunction
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: ClientRow
        Insert: ClientInsert
        Update: ClientUpdate
        Relationships: []
      }
      properties: {
        Row: PropertyRow
        Insert: PropertyInsert
        Update: PropertyUpdate
        Relationships: []
      }
      agents: {
        Row: AgentRow
        Insert: {
          id: string
          full_name: string
          email: string
          phone?: string | null
        }
        Update: {
          full_name?: string
          phone?: string | null
        }
        Relationships: []
      }
      visit_notes: {
        Row: VisitNoteRow
        Insert: VisitNoteInsert
        Update: VisitNoteUpdate
        Relationships: [
          {
            foreignKeyName: 'visit_notes_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'visit_notes_property_id_fkey'
            columns: ['property_id']
            isOneToOne: false
            referencedRelation: 'properties'
            referencedColumns: ['id']
          },
        ]
      }
      extracted_facts: {
        Row: ExtractedFactRow
        Insert: ExtractedFactInsert
        Update: ExtractedFactUpdate
        Relationships: [
          {
            foreignKeyName: 'extracted_facts_visit_note_id_fkey'
            columns: ['visit_note_id']
            isOneToOne: false
            referencedRelation: 'visit_notes'
            referencedColumns: ['id']
          },
        ]
      }
      tasks: {
        Row: TaskRow
        Insert: TaskInsert
        Update: TaskUpdate
        Relationships: [
          {
            foreignKeyName: 'tasks_visit_note_id_fkey'
            columns: ['visit_note_id']
            isOneToOne: false
            referencedRelation: 'visit_notes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_source_fact_id_fkey'
            columns: ['source_fact_id']
            isOneToOne: false
            referencedRelation: 'extracted_facts'
            referencedColumns: ['id']
          },
        ]
      }
      drafts: {
        Row: DraftRow
        Insert: DraftInsert
        Update: DraftUpdate
        Relationships: [
          {
            foreignKeyName: 'drafts_visit_note_id_fkey'
            columns: ['visit_note_id']
            isOneToOne: false
            referencedRelation: 'visit_notes'
            referencedColumns: ['id']
          },
        ]
      }
      crm_exports: {
        Row: CrmExportRow
        Insert: CrmExportInsert
        Update: CrmExportUpdate
        Relationships: [
          {
            foreignKeyName: 'crm_exports_visit_note_id_fkey'
            columns: ['visit_note_id']
            isOneToOne: false
            referencedRelation: 'visit_notes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'crm_exports_draft_id_fkey'
            columns: ['draft_id']
            isOneToOne: false
            referencedRelation: 'drafts'
            referencedColumns: ['id']
          },
        ]
      }
      audio_cleanup: {
        Row: AudioCleanupRow
        Insert: {
          agent_id?: string
          path: string
          reason: AudioCleanupReason
        }
        Update: Record<string, never>
        Relationships: []
      }
      audit_events: {
        Row: AuditEventRow
        Insert: {
          agent_id?: string
          action: AuditEventAction
          entity_id?: string | null
        }
        Update: Record<string, never>
        Relationships: []
      }
      ai_calls: {
        Row: AiCallRow
        Insert: {
          agent_id?: string
          fn: AiCallFunction
        }
        Update: Record<string, never>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      erase_client: {
        Args: { p_client_id: string }
        Returns: void
      }
      erase_property_owner: {
        Args: { p_property_id: string }
        Returns: void
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
