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
        Relationships: []
      }
      extracted_facts: {
        Row: ExtractedFactRow
        Insert: ExtractedFactInsert
        Update: ExtractedFactUpdate
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
