import { describe, expect, it } from 'vitest'
import {
  buyerFacts,
  checkPlaceholders,
  confirmsAppointment,
  fillPlaceholders,
  firstName,
  ownerFacts,
  ownerLeaks,
  parseBuyerResponse,
  parseOwnerResponse,
  requiredTasks,
  validateDraft,
  type FactInput,
  type PlaceholderValues,
} from './rules'

/**
 * Datos de la nota de ejemplo (Ana García + V-18, aprobada): los
 * cinco datos no descartados, sin id ni cita, tal como se envían al
 * modelo.
 */
const FACTS: FactInput[] = [
  {
    category: 'objecion',
    field_name: 'ruido_calle',
    value: 'Ruido de la calle Alcalá por la noche',
  },
  {
    category: 'cita_pendiente',
    field_name: 'proxima_visita',
    value: 'Viernes, hora por confirmar',
  },
  {
    category: 'desconocido',
    field_name: 'hora_cita',
    value: 'Hora de la segunda visita por confirmar',
  },
  {
    category: 'presupuesto',
    field_name: 'presupuesto_declarado',
    value: '230.000 euros',
  },
  {
    category: 'hecho_declarado',
    field_name: 'informacion_solicitada',
    value: 'Gastos de comunidad e IBI',
  },
]

const PLACEHOLDERS: PlaceholderValues = {
  clientFirstName: 'Ana',
  isProvisional: false,
  ownerFirstName: 'Carlos',
  inmueble: 'V-18 (calle Alcalá 120)',
  agente: 'Agente A Prueba',
}

function validateOwner(
  raw: string,
  overrides: Partial<PlaceholderValues> = {},
) {
  return validateDraft(raw, 'propietario', {
    facts: FACTS,
    clientFullName: 'Ana García',
    placeholders: { ...PLACEHOLDERS, ...overrides },
  })
}

function validateBuyer(
  raw: string,
  overrides: Partial<PlaceholderValues> = {},
) {
  return validateDraft(raw, 'comprador', {
    facts: FACTS,
    clientFullName: 'Ana García',
    placeholders: { ...PLACEHOLDERS, ...overrides },
  })
}

describe('buyerFacts / ownerFacts', () => {
  it('el comprador recibe todos los datos no descartados', () => {
    expect(buyerFacts(FACTS)).toHaveLength(5)
    expect(buyerFacts(FACTS)).toEqual(FACTS)
    expect(buyerFacts(FACTS)[0]).toEqual({
      category: 'objecion',
      field_name: 'ruido_calle',
      value: 'Ruido de la calle Alcalá por la noche',
    })
  })

  it('el propietario no recibe el presupuesto ni datos económicos', () => {
    const owner = ownerFacts(FACTS)
    expect(owner.map((fact) => fact.field_name)).not.toContain(
      'presupuesto_declarado',
    )
    expect(owner).toHaveLength(4)
    expect(
      owner.every((fact) => fact.category !== 'presupuesto'),
    ).toBe(true)
  })

  it('el propietario no recibe un dato con cifra de dinero', () => {
    const withMoney = [
      ...FACTS,
      {
        category: 'hecho_declarado',
        field_name: 'precio_venta',
        value: 'Se vende por 285.000 euros',
      },
    ]
    expect(ownerFacts(withMoney).map((fact) => fact.field_name)).not.toContain(
      'precio_venta',
    )
    expect(buyerFacts(withMoney)).toHaveLength(6)
  })

  it('el propietario no recibe un dato con un término financiero', () => {
    const withFinance = [
      ...FACTS,
      {
        category: 'hecho_declarado',
        field_name: 'financiacion',
        value: 'Necesita hipoteca',
      },
    ]
    expect(ownerFacts(withFinance).map((fact) => fact.field_name)).not.toContain(
      'financiacion',
    )
  })
})

describe('checkPlaceholders', () => {
  it('acepta los marcadores de cada destinatario', () => {
    expect(
      checkPlaceholders('Hola {nombre}, te paso {inmueble}. {agente}', 'comprador'),
    ).toEqual({ ok: true })
    expect(
      checkPlaceholders(
        'Hola {propietario}, la visita a {inmueble}. {agente}',
        'propietario',
      ),
    ).toEqual({ ok: true })
  })

  it('rechaza un marcador desconocido', () => {
    const result = checkPlaceholders('Hola {nombre}, tu {telefono}.', 'comprador')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('{telefono}')
    }
  })

  it('rechaza {nombre} en el borrador al propietario', () => {
    const result = checkPlaceholders(
      'Hola {propietario}, Ana {nombre} visitó {inmueble}.',
      'propietario',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('{nombre}')
    }
  })
})

describe('fillPlaceholders', () => {
  it('sustituye nombre, inmueble y agente', () => {
    expect(
      fillPlaceholders(
        'Hola {nombre}, te escribo por {inmueble}. Un saludo, {agente}.',
        PLACEHOLDERS,
      ),
    ).toBe(
      'Hola Ana, te escribo por V-18 (calle Alcalá 120). Un saludo, Agente A Prueba.',
    )
  })

  it('sin nombre (cliente provisional) el saludo queda en «Hola,»', () => {
    expect(
      fillPlaceholders('Hola {nombre}, te escribo.', {
        ...PLACEHOLDERS,
        clientFirstName: null,
        isProvisional: true,
      }),
    ).toBe('Hola, te escribo.')
  })

  it('sustituye {propietario} por el nombre de pila', () => {
    expect(
      fillPlaceholders('Hola {propietario}, gracias por {inmueble}.', PLACEHOLDERS),
    ).toBe('Hola Carlos, gracias por V-18 (calle Alcalá 120).')
  })
})

describe('ownerLeaks', () => {
  const ctx = { budgetValues: ['230.000 euros'], clientFullName: 'Ana García' }

  it('rechaza «230.000 €»', () => {
    expect(
      ownerLeaks('El presupuesto es de 230.000 €.', ctx).leaks,
    ).toBe(true)
  })

  it('rechaza «230000» sin puntos', () => {
    expect(
      ownerLeaks('El presupuesto es de 230000 euros.', ctx).leaks,
    ).toBe(true)
  })

  it('rechaza «presupuesto» y «hipoteca»', () => {
    expect(ownerLeaks('Su presupuesto es alto.', ctx).leaks).toBe(true)
    expect(ownerLeaks('Necesita una hipoteca.', ctx).leaks).toBe(true)
  })

  it('rechaza el nombre y los apellidos del cliente', () => {
    expect(ownerLeaks('Ana comentó el ruido.', ctx).leaks).toBe(true)
    expect(ownerLeaks('La señora García lo vio.', ctx).leaks).toBe(true)
  })

  it('acepta un borrador limpio al propietario', () => {
    expect(
      ownerLeaks(
        'La persona interesada comentó el ruido de la calle. Quedamos en confirmar la segunda visita del viernes.',
        ctx,
      ).leaks,
    ).toBe(false)
  })
})

describe('confirmsAppointment', () => {
  it('rechaza «queda confirmada la visita del viernes a las 18:00»', () => {
    const result = confirmsAppointment(
      'Te confirmo que queda confirmada la visita del viernes a las 18:00.',
      FACTS,
    )
    expect(result.confirmed).toBe(true)
    if (result.confirmed) {
      expect(result.reason).toContain('confirmada')
    }
  })

  it('rechaza una hora inventada aunque no confirme la cita', () => {
    const result = confirmsAppointment(
      '¿Te viene bien el viernes a las 18:00?',
      FACTS,
    )
    expect(result.confirmed).toBe(true)
    if (result.confirmed) {
      expect(result.reason).toContain('18:00')
    }
  })

  it('acepta proponer confirmar sin hora ni confirmación', () => {
    expect(
      confirmsAppointment(
        '¿Qué hora te vendría bien para la segunda visita del viernes? Quedamos en confirmarlo.',
        FACTS,
      ).confirmed,
    ).toBe(false)
  })

  it('acepta una hora que sí está en los datos', () => {
    const factsWithHour = [
      ...FACTS,
      {
        category: 'cita_pendiente',
        field_name: 'hora_acordada',
        value: 'Viernes a las 18:00',
      },
    ]
    expect(
      confirmsAppointment('¿Te viene bien el viernes a las 18:00?', factsWithHour)
        .confirmed,
    ).toBe(false)
  })

  it('acepta «confirmada» si un dato dice que está confirmada', () => {
    const factsConfirmed = [
      {
        category: 'cita_pendiente',
        field_name: 'proxima_visita',
        value: 'Viernes a las 18:00, cita confirmada por el cliente',
      },
    ]
    expect(
      confirmsAppointment('Nos vemos el viernes a las 18:00.', factsConfirmed)
        .confirmed,
    ).toBe(false)
  })
})

describe('validateDraft (de principio a fin)', () => {
  it('acepta un borrador bueno al comprador y sustituye los marcadores', () => {
    const result = validateBuyer(
      'Hola {nombre}, te envío los gastos de comunidad e IBI de {inmueble}. El viernes quedamos en confirmar la hora. Un saludo, {agente}.',
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.text).toContain('Hola Ana,')
      expect(result.text).toContain('V-18 (calle Alcalá 120)')
      expect(result.text).toContain('Agente A Prueba')
    }
  })

  it('acepta un borrador bueno al propietario', () => {
    const result = validateOwner(
      'Hola {propietario}, la visita a {inmueble} se hizo. La persona interesada mencionó el ruido de la calle. Quedamos en confirmar una segunda visita el viernes. Un saludo, {agente}.',
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.text).toContain('Hola Carlos,')
      expect(result.text).not.toContain('Ana')
      expect(result.text).not.toContain('230.000')
    }
  })

  it('rechaza un borrador al propietario con el presupuesto', () => {
    const result = validateOwner(
      'Hola {propietario}, la clienta tiene un presupuesto de 230.000 €. Un saludo, {agente}.',
    )
    expect(result.ok).toBe(false)
  })

  it('rechaza un borrador al propietario que nombra a la clienta', () => {
    const result = validateOwner(
      'Hola {propietario}, Ana comentó el ruido. Un saludo, {agente}.',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('nombre')
    }
  })

  it('rechaza un borrador que confirma la cita del viernes a las 18:00', () => {
    const result = validateBuyer(
      'Hola {nombre}, queda confirmada la visita del viernes a las 18:00. Un saludo, {agente}.',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('confirmada')
    }
  })

  it('rechaza un marcador desconocido', () => {
    const result = validateBuyer('Hola {nombre}, tu {telefono}.')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('{telefono}')
    }
  })
})

describe('parseBuyerResponse / parseOwnerResponse', () => {
  it('acepta una respuesta válida del comprador con tareas', () => {
    const parsed = parseBuyerResponse(
      JSON.stringify({
        draft: 'Hola {nombre}, te envío los gastos.',
        tasks: [{ description: 'Enviar los gastos', fact_index: 4 }],
      }),
    )
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.data.tasks).toHaveLength(1)
    }
  })

  it('acepta una respuesta del comprador sin tareas', () => {
    const parsed = parseBuyerResponse(
      JSON.stringify({ draft: 'Hola {nombre}, gracias.' }),
    )
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.data.tasks).toEqual([])
    }
  })

  it('rechaza JSON no válido', () => {
    expect(parseBuyerResponse('no es json').ok).toBe(false)
    expect(parseOwnerResponse('{').ok).toBe(false)
  })

  it('rechaza un borrador vacío o de más de 1500 caracteres', () => {
    expect(
      parseBuyerResponse(JSON.stringify({ draft: '' })).ok,
    ).toBe(false)
    expect(
      parseOwnerResponse(JSON.stringify({ draft: 'x'.repeat(1501) })).ok,
    ).toBe(false)
  })

  it('rechaza tareas con descripción corta o fact_index negativo', () => {
    expect(
      parseBuyerResponse(
        JSON.stringify({
          draft: 'Hola {nombre}.',
          tasks: [{ description: 'x', fact_index: 0 }],
        }),
      ).ok,
    ).toBe(false)
    expect(
      parseBuyerResponse(
        JSON.stringify({
          draft: 'Hola {nombre}.',
          tasks: [{ description: 'Enviar los gastos', fact_index: -1 }],
        }),
      ).ok,
    ).toBe(false)
  })

  it('rechaza más de 10 tareas', () => {
    const tasks = Array.from({ length: 11 }, (_, i) => ({
      description: `Tarea ${i}`,
      fact_index: 0,
    }))
    expect(
      parseBuyerResponse(JSON.stringify({ draft: 'Hola {nombre}.', tasks })).ok,
    ).toBe(false)
  })
})

describe('requiredTasks', () => {
  it('añade la tarea de regla si falta la de confirmar la cita', () => {
    const tasks = requiredTasks(FACTS, [
      { description: 'Enviar a Ana los gastos de comunidad e IBI', fact_index: 4 },
    ])
    expect(tasks).toHaveLength(2)
    expect(tasks[1]).toEqual({
      description: 'Confirmar día y hora: Viernes, hora por confirmar',
      fact_index: 1,
      origin: 'regla',
    })
  })

  it('no añade la tarea de regla si la IA ya propuso una para la cita', () => {
    const tasks = requiredTasks(FACTS, [
      { description: 'Confirmar la hora de la segunda visita del viernes', fact_index: 1 },
    ])
    expect(tasks).toHaveLength(1)
    expect(tasks[0].origin).toBe('ia')
  })

  it('descarta tareas con fact_index inválido y duplicados', () => {
    const tasks = requiredTasks(FACTS, [
      { description: 'Enviar a Ana los gastos de comunidad e IBI', fact_index: 4 },
      { description: 'Enviar a Ana los gastos de comunidad e IBI', fact_index: 4 },
      { description: 'Tarea sin dato', fact_index: 99 },
    ])
    expect(tasks).toHaveLength(2)
    expect(tasks[0].origin).toBe('ia')
    expect(tasks[1].origin).toBe('regla')
  })

  it('sin cita pendiente no hay tareas de regla', () => {
    const facts = FACTS.filter((fact) => fact.category !== 'cita_pendiente')
    const tasks = requiredTasks(facts, [
      { description: 'Enviar los gastos', fact_index: 3 },
    ])
    expect(tasks).toHaveLength(1)
    expect(tasks[0].origin).toBe('ia')
  })
})

describe('firstName', () => {
  it('devuelve el nombre de pila', () => {
    expect(firstName('Ana García')).toBe('Ana')
    expect(firstName('  Luis  ')).toBe('Luis')
  })
})
