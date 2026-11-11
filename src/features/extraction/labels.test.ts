import { describe, expect, it } from 'vitest'
import {
  CATEGORY_ORDER,
  CATEGORY_TITLES,
  NOTE_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  confidenceLevel,
  confidenceText,
  fieldLabel,
  toFieldName,
} from './labels'

describe('CATEGORY_ORDER y CATEGORY_TITLES', () => {
  it('agrupan en el orden del prompt', () => {
    expect(CATEGORY_ORDER).toEqual([
      'objecion',
      'presupuesto',
      'cita_pendiente',
      'desconocido',
      'hecho_declarado',
      'observacion',
    ])
    expect(CATEGORY_TITLES.objecion).toBe('Objeciones')
    expect(CATEGORY_TITLES.presupuesto).toBe('Presupuesto declarado')
    expect(CATEGORY_TITLES.cita_pendiente).toBe('Citas pendientes (sin confirmar)')
    expect(CATEGORY_TITLES.desconocido).toBe('Por confirmar')
    expect(CATEGORY_TITLES.hecho_declarado).toBe('Hechos declarados')
    expect(CATEGORY_TITLES.observacion).toBe('Observaciones')
  })
})

describe('fieldLabel', () => {
  it('segunda_visita → «Segunda visita»', () => {
    expect(fieldLabel('segunda_visita')).toBe('Segunda visita')
    expect(fieldLabel('ruido_nocturno')).toBe('Ruido nocturno')
    expect(fieldLabel('presupuesto_declarado')).toBe('Presupuesto declarado')
  })
})

describe('confidenceLevel y confidenceText', () => {
  it('alta ≥ 0,8 · media ≥ 0,5 · baja < 0,5', () => {
    expect(confidenceLevel(0.95)).toBe('alta')
    expect(confidenceLevel(0.8)).toBe('alta')
    expect(confidenceLevel(0.79)).toBe('media')
    expect(confidenceLevel(0.5)).toBe('media')
    expect(confidenceLevel(0.49)).toBe('baja')
    expect(confidenceLevel(0)).toBe('baja')
    expect(confidenceText(0.9)).toBe('Confianza alta')
    expect(confidenceText(0.6)).toBe('Confianza media')
    expect(confidenceText(0.2)).toBe('Confianza baja')
  })

  it('sin confianza → null (dato añadido por el agente)', () => {
    expect(confidenceLevel(null)).toBe(null)
    expect(confidenceText(null)).toBe(null)
  })
})

describe('toFieldName', () => {
  it('convierte a snake_case sin acentos', () => {
    expect(toFieldName('Segunda visita')).toBe('segunda_visita')
    expect(toFieldName('Teléfono del propietario')).toBe('telefono_del_propietario')
    expect(toFieldName('  ruido   nocturno  ')).toBe('ruido_nocturno')
    expect(toFieldName('V-18')).toBe('v_18')
    expect(toFieldName('!!!')).toBe('')
  })
})

describe('etiquetas de estado', () => {
  it('estados de revisión y de nota', () => {
    expect(REVIEW_STATUS_LABELS.propuesto).toBe('Propuesto')
    expect(REVIEW_STATUS_LABELS.aceptado).toBe('Aceptado')
    expect(REVIEW_STATUS_LABELS.editado).toBe('Editado')
    expect(REVIEW_STATUS_LABELS.descartado).toBe('Descartado')
    expect(NOTE_STATUS_LABELS.draft).toBe('Pendiente de transcribir')
    expect(NOTE_STATUS_LABELS.transcribed).toBe('Transcrita')
    expect(NOTE_STATUS_LABELS.extracted).toBe('Datos extraídos')
    expect(NOTE_STATUS_LABELS.reviewed).toBe('En revisión')
    expect(NOTE_STATUS_LABELS.approved).toBe('Aprobada')
  })
})
