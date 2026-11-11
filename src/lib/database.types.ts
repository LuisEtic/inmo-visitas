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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
