import { describe, expect, it } from 'vitest'
import type { PostgrestError } from '@supabase/supabase-js'
import { translateDbError } from './db-errors'

function pgError(code: string, message: string): PostgrestError {
  return { code, message, details: '', hint: '' } as PostgrestError
}

describe('translateDbError', () => {
  it('traduce las excepciones de revisión de la migración 0007 (P0001)', () => {
    expect(translateDbError(pgError('P0001', 'nota_aprobada'))).toBe(
      'La nota está aprobada y ya no se puede cambiar',
    )
    expect(translateDbError(pgError('P0001', 'datos_sin_revisar'))).toBe(
      'Revisa todos los datos antes de aprobar la nota',
    )
    expect(translateDbError(pgError('P0001', 'texto_bloqueado'))).toBe(
      'El texto ya no se puede corregir: tiene datos extraídos',
    )
  })

  it('un P0001 desconocido cae en el mensaje genérico', () => {
    expect(translateDbError(pgError('P0001', 'otro_error'))).toBe(
      'Ha ocurrido un error. Inténtalo de nuevo.',
    )
  })
})
