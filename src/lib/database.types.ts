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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
