import { describe, expect, it } from 'vitest'
import {
  budgetValuesOf,
  buyerFacts,
  checkPlaceholders,
  confirmsAppointment,
  factConfirms,
  fillPlaceholders,
  firstName,
  hoursIn,
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
  // Como en `index.ts`: datos del propietario sin presupuesto y los
  // valores del presupuesto aparte, sacados de TODOS los datos.
  return validateDraft(raw, 'propietario', {
    facts: ownerFacts(FACTS),
    budgetValues: budgetValuesOf(FACTS),
    clientFullName: 'Ana García',
    placeholders: { ...PLACEHOLDERS, ...overrides },
  })
}

function validateBuyer(
  raw: string,
  overrides: Partial<PlaceholderValues> = {},
) {
  return validateDraft(raw, 'comprador', {
    facts: buyerFacts(FACTS),
    budgetValues: budgetValuesOf(FACTS),
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

/**
 * Datos vivos de la nota de ejemplo tras los cambios de Luis en su
 * revisión de la Fase 5: la cita lleva «a las 17h» (editado) y hay
 * un dato nuevo sobre el informe del administrador. Con estos datos,
 * las 17h y el informe NO son invenciones del modelo: están en los
 * datos y las reglas los aceptan.
 */
const LIVE_FACTS: FactInput[] = [
  {
    category: 'objecion',
    field_name: 'ruido_calle',
    value: 'Ruido de la calle Alcalá por la noche',
  },
  {
    category: 'cita_pendiente',
    field_name: 'proxima_visita',
    value: 'Confirma viernes a las 17h',
  },
  {
    category: 'presupuesto',
    field_name: 'presupuesto_declarado',
    value: '230.000 euros',
  },
  {
    category: 'hecho_declarado',
    field_name: 'acompanante_visita',
    value: 'Su pareja',
  },
  {
    category: 'hecho_declarado',
    field_name: 'peticion_informacion',
    value: 'Gastos de comunidad e IBI',
  },
  {
    category: 'observacion',
    field_name: 'peticion_informacion',
    value: 'Pide informe del administrador de cuotas al dia de pago',
  },
]

const LIVE_PLACEHOLDERS: PlaceholderValues = {
  ...PLACEHOLDERS,
  inmueble: 'V-18 (Calle de Alcalá 120)',
}

function validateLiveBuyer(raw: string, overrides: Partial<PlaceholderValues> = {}) {
  return validateDraft(raw, 'comprador', {
    facts: buyerFacts(LIVE_FACTS),
    budgetValues: budgetValuesOf(LIVE_FACTS),
    clientFullName: 'Ana García',
    placeholders: { ...LIVE_PLACEHOLDERS, ...overrides },
  })
}

function validateLiveOwner(raw: string, overrides: Partial<PlaceholderValues> = {}) {
  return validateDraft(raw, 'propietario', {
    facts: ownerFacts(LIVE_FACTS),
    budgetValues: budgetValuesOf(LIVE_FACTS),
    clientFullName: 'Ana García',
    placeholders: { ...LIVE_PLACEHOLDERS, ...overrides },
  })
}

describe('nombres obligatorios (destinatario y firma)', () => {
  it('rechaza el borrador al comprador dirigido a «Carlos» y firmado «Ana»', () => {
    const result = validateLiveBuyer(
      'Hola Carlos,\n\nMuchas gracias por visitar V-18 junto con tu pareja. Entiendo perfectamente tu preocupación respecto al ruido de la calle Alcalá por la noche.\n\nRespecto a los gastos de comunidad, el IBI y el informe del administrador sobre las cuotas al día de pago, ya estoy recopilando toda la información para enviártela lo antes posible.\n\nSobre nuestra próxima cita, me indicas si te viene bien el viernes a las 17 h para dejarlo cerrado definitivamente.\n\nUn saludo,\n\nAna',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      // Desde la revisión, lo para ya el saludo (antes, la firma).
      expect(result.reason).toContain('saluda al cliente')
    }
  })

  it('rechaza el borrador al comprador dirigido a «Carlos» y sin firma', () => {
    const result = validateLiveBuyer(
      'Hola Carlos, muchas gracias por visitar V-18 junto con tu pareja. Entiendo perfectamente vuestra preocupación sobre el ruido de la calle Alcalá por la noche. Respecto a vuestra petición sobre los gastos de comunidad, el IBI y el informe del administrador de cuotas al día de pago, ya me he puesto en marcha para conseguirlos y compartirlos con vosotros cuanto antes. Sobre nuestra próxima visita, me dijiste que querías confirmar el viernes a las 17h, pero dime si te va bien esa hora exacta para dejarlo cerrado. ¡Un abrazo!',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('cliente')
    }
  })

  it('acepta el borrador bueno al propietario con los datos vivos', () => {
    const result = validateLiveOwner(
      'Hola {propietario},\n\nLe escribo tras la visita a {inmueble} realizada con la persona interesada y su pareja. Durante el recorrido, mostraron interés y han solicitado los gastos de comunidad e IBI, además del informe del administrador sobre las cuotas al día de pago. Asimismo, comentaron la percepción de ruido de la calle Alcalá por la noche.\n\nRespecto a los siguientes pasos, quedo a la espera de que me confirme su disponibilidad para este viernes a las 17h, hora en la que valoramos una nueva cita.\n\nAtentamente,\n{agente}',
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.text).toContain('Hola Carlos,')
      expect(result.text).toContain('Agente A Prueba')
      expect(result.text).not.toContain('Ana')
    }
  })

  it('acepta la hora 17h porque está en los datos (editada por Luis)', () => {
    expect(
      confirmsAppointment(
        '¿Te viene bien el viernes a las 17h?',
        LIVE_FACTS,
      ).confirmed,
    ).toBe(false)
  })

  it('con cliente provisional no exige el nombre del cliente', () => {
    const result = validateLiveBuyer(
      'Hola, te envío los gastos de comunidad e IBI de {inmueble}. Un saludo, {agente}.',
      { clientFirstName: null, isProvisional: true },
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.text).toContain('Hola,')
      expect(result.text).toContain('Agente A Prueba')
    }
  })
})

describe('ajustes de la revisión de Claude (Fase 6)', () => {
  // A-1: en producción el propietario recibe `ownerFacts` (sin el dato
  // de presupuesto); el control del valor usa `budgetValues` aparte.
  it('budgetValuesOf saca el valor del presupuesto de todos los datos', () => {
    expect(budgetValuesOf(FACTS)).toEqual(['230.000 euros'])
    expect(budgetValuesOf(ownerFacts(FACTS))).toEqual([])
  })

  it('rechaza «230000» y «230.000» sin moneda en el borrador al propietario', () => {
    for (const figure of ['230000', '230.000', '230 000']) {
      const result = validateOwner(
        `Hola {propietario}, la persona interesada habló de ${figure}. Un saludo, {agente}`,
      )
      expect(result.ok, figure).toBe(false)
      if (!result.ok) {
        expect(result.reason).toContain('presupuesto')
      }
    }
  })

  it('no confunde otras cifras con el presupuesto', () => {
    const result = validateOwner(
      'Hola {propietario}, la visita a {inmueble} fue bien y la persona interesada volverá. Un saludo, {agente}',
      { inmueble: 'V-18 (calle Alcalá 2300)' },
    )
    expect(result.ok).toBe(true)
  })

  // A-2: todas las horas, con todos sus dígitos.
  it('hoursIn encuentra todas las horas y las normaliza', () => {
    expect(hoursIn('a las 17h o a las 19:30, o 18.00').map((h) => h.key)).toEqual([
      '7:30',
      '6:00',
      '5:00',
    ])
    expect(hoursIn('230.000 euros, V-18, 1.500 €')).toEqual([])
  })

  it('rechaza «a las 18» y «a las 21h» si el dato dice 17h', () => {
    for (const hour of ['a las 18', 'a las 21h', 'a las 19:30']) {
      const result = validateLiveBuyer(
        `Hola {nombre}, ¿te va bien el viernes ${hour}? Un saludo, {agente}`,
      )
      expect(result.ok, hour).toBe(false)
    }
  })

  it('rechaza una segunda hora inventada aunque la primera esté en los datos', () => {
    const result = validateLiveBuyer(
      'Hola {nombre}, ¿el viernes a las 17h o mejor a las 19h? Un saludo, {agente}',
    )
    expect(result.ok).toBe(false)
  })

  it('acepta la misma hora escrita de otra forma (17h = 17:00)', () => {
    const result = validateLiveBuyer(
      'Hola {nombre}, ¿te va bien el viernes a las 17:00? Un saludo, {agente}',
    )
    expect(result.ok).toBe(true)
  })

  // M-2: una negación en el dato no desactiva el control.
  it('«no confirmada» o «por confirmar» no cuentan como cita confirmada', () => {
    for (const value of [
      'Segunda visita el viernes, no confirmada',
      'Viernes, hora por confirmar',
      'Visita sin confirmar',
      'Pendiente de confirmar la visita',
    ]) {
      expect(
        factConfirms({ category: 'cita_pendiente', field_name: 'x', value }),
        value,
      ).toBe(false)
    }
    expect(
      factConfirms({
        category: 'hecho_declarado',
        field_name: 'x',
        value: 'Visita del viernes confirmada por la clienta',
      }),
    ).toBe(true)
  })

  it('rechaza «queda confirmada» aunque un dato diga «no confirmada»', () => {
    const facts: FactInput[] = [
      {
        category: 'cita_pendiente',
        field_name: 'proxima_visita',
        value: 'Segunda visita el viernes, no confirmada',
      },
    ]
    expect(
      confirmsAppointment('La visita del viernes queda confirmada.', facts)
        .confirmed,
    ).toBe(true)
  })

  // M-1: el nombre tiene que ir en el saludo, y el del comprador no
  // nombra al propietario.
  it('rechaza «Hola Carlos» aunque «Ana» aparezca después', () => {
    const result = validateBuyer(
      'Hola Carlos, Ana, te escribo por {inmueble}. ¿Te va bien el viernes? Un saludo, {agente}',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('saluda al cliente')
    }
  })

  it('rechaza el borrador al comprador que nombra al propietario', () => {
    const result = validateBuyer(
      'Hola {nombre}, Carlos, el propietario, te enviará los gastos. Un saludo, {agente}',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('propietario')
    }
  })

  it('rechaza el borrador al propietario que no le saluda por su nombre', () => {
    const result = validateOwner(
      'Buenas tardes, Carlos: la visita a {inmueble} fue bien. Un saludo, {agente}',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('saluda al propietario')
    }
  })

  it('sigue aceptando el borrador bueno del comprador de la v3 (datos vivos)', () => {
    const result = validateLiveBuyer(
      'Hola {nombre}, gracias por visitar {inmueble} junto a tu pareja. Entiendo lo del ruido de la calle Alcalá por la noche. Te enviaré los gastos de comunidad, el IBI y el informe del administrador. Sobre la segunda visita, te propongo confirmar el viernes a las 17h, pero dime si te va bien esa hora o prefieres otro momento. Un saludo, {agente}',
    )
    expect(result.ok).toBe(true)
  })

  it('acepta un borrador al comprador correcto', () => {
    const result = validateBuyer(
      'Hola {nombre}, gracias por visitar {inmueble}. Te enviaré los gastos de comunidad e IBI. ¿Qué hora te va bien el viernes? Un saludo, {agente}',
    )
    expect(result.ok).toBe(true)
  })
})
