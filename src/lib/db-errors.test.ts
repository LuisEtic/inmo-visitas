import { describe, expect, it } from 'vitest'
import type { PostgrestError } from '@supabase/supabase-js'
import { translateDbError, translateLimitError } from './db-errors'

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

  it('traduce los errores de la migración 0008', () => {
    expect(translateDbError(pgError('P0001', 'transicion_no_valida'))).toBe(
      'La nota no puede pasar a ese estado',
    )
    expect(translateDbError(pgError('P0001', 'nota_sin_datos'))).toBe(
      'La nota necesita al menos un dato no descartado para aprobarla',
    )
  })

  it('traduce los errores de la migración 0009 (Fase 6)', () => {
    expect(translateDbError(pgError('P0001', 'nota_no_aprobada'))).toBe(
      'Aprueba la nota antes de preparar el seguimiento',
    )
    expect(translateDbError(pgError('P0001', 'borrador_aprobado'))).toBe(
      'El borrador está aprobado y ya no se puede cambiar',
    )
    expect(translateDbError(pgError('P0001', 'fuente_no_valida'))).toBe(
      'El dato de origen no pertenece a esta nota',
    )
    // El mismo error, en una tarea, habla de la tarea.
    expect(
      translateDbError(pgError('P0001', 'transicion_no_valida'), {
        task: true,
      }),
    ).toBe('La tarea no puede pasar a ese estado')
  })

  it('traduce los errores de la migración 0010 (Fase 7)', () => {
    expect(translateDbError(pgError('P0001', 'borrador_no_aprobado'))).toBe(
      'Aprueba el borrador antes de enviarlo.',
    )
    expect(translateDbError(pgError('P0001', 'exportacion_no_valida'))).toBe(
      'Esta exportación no es válida.',
    )
    expect(translateDbError(pgError('P0001', 'exportacion_cerrada'))).toBe(
      'Esta exportación ya está cerrada; si quieres, vuelve a exportar.',
    )
    // El mismo error de nota no aprobada, en una exportación, habla
    // de exportar (en el seguimiento sigue el texto de la Fase 6).
    expect(
      translateDbError(pgError('P0001', 'nota_no_aprobada'), {
        exports: true,
      }),
    ).toBe('Aprueba la nota antes de exportarla')
    expect(translateDbError(pgError('P0001', 'nota_no_aprobada'))).toBe(
      'Aprueba la nota antes de preparar el seguimiento',
    )
  })

  it('traduce los errores de la migración 0012 (Fase 8)', () => {
    expect(translateDbError(pgError('P0001', 'cambio_no_permitido'))).toBe(
      'Este cambio no está permitido.',
    )
    expect(translateDbError(pgError('P0001', 'no_encontrado'))).toBe(
      'No se ha encontrado.',
    )
    expect(translateDbError(pgError('P0001', 'limite_diario_ia'))).toBe(
      'Has llegado al límite diario de usos de la IA. Vuelve a intentarlo mañana.',
    )
  })

  it('translateLimitError prefiere el `message` de la función (429)', () => {
    expect(
      translateLimitError({
        error: 'limite_diario_ia',
        message: 'Has llegado al límite diario de usos de la IA. Vuelve a intentarlo mañana.',
      }),
    ).toBe('Has llegado al límite diario de usos de la IA. Vuelve a intentarlo mañana.')
    // Sin `message`, la traducción del código.
    expect(translateLimitError({ error: 'limite_diario_ia' })).toBe(
      'Has llegado al límite diario de usos de la IA. Vuelve a intentarlo mañana.',
    )
    expect(translateLimitError(null)).toBe(
      'Has llegado al límite diario de usos de la IA. Vuelve a intentarlo mañana.',
    )
  })

  it('traduce el formato de contacto no válido (23514) solo con contexto de contacto', () => {
    expect(
      translateDbError(
        pgError('23514', 'new row for relation "clients" violates check constraint "clients_phone_format_check"'),
        { contact: true },
      ),
    ).toBe('El teléfono o el email no tienen un formato válido.')
    // Sin contexto de contacto (otros `check`, p. ej. estados), genérico.
    expect(
      translateDbError(
        pgError('23514', 'new row for relation "tasks" violates check constraint "tasks_status_check"'),
      ),
    ).toBe('Ha ocurrido un error. Inténtalo de nuevo.')
  })

  it('traduce el duplicado de borrador por destinatario (23505)', () => {
    expect(
      translateDbError(
        pgError('23505', 'duplicate key value violates unique constraint'),
        { drafts: true },
      ),
    ).toBe('Ya hay un borrador para este destinatario; vuelve a generarlo')
  })

  it('un P0001 desconocido cae en el mensaje genérico', () => {
    expect(translateDbError(pgError('P0001', 'otro_error'))).toBe(
      'Ha ocurrido un error. Inténtalo de nuevo.',
    )
  })
})
