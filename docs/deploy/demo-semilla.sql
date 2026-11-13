-- =====================================================================
-- DATOS DE DEMOSTRACIÓN — inmo-visitas (Etapa 6)
-- =====================================================================
-- Una semana de trabajo ficticia de un agente, para enseñar la app a un
-- agente real. TODO es inventado: nombres, teléfonos (+34 600 1xx xxx y
-- +34 611 2xx xxx), emails (example.com) y direcciones.
--
-- Cómo se usa:
--   1. Crear la cuenta de demo en la app (/registro), con un nombre de
--      agente ficticio: ese nombre firma los borradores.
--   2. Sustituir __AGENT_ID__ (abajo) por el id de esa cuenta
--      (`public.agents.id`).
--   3. Ejecutar el bloque entero. Si la cuenta ya tiene clientes, se
--      niega a cargar (no duplica nada).
--
-- Respeta las guardas de la base: cada nota nace `transcribed` y avanza
-- `extracted` → datos revisados → `approved`, como en la app. Por eso
-- `approved_at` de las notas aprobadas y las fechas de las fichas
-- compartidas son las del momento de la carga; `created_at` de las
-- notas sí se reparte en los últimos 6 días.
--
-- Qué deja (para recorrer toda la app):
--   - 8 clientes (uno provisional) y 8 inmuebles (disponibles, uno
--     reservado y uno vendido).
--   - 11 notas: 3 por extraer (para «Extraer datos» en vivo), 2 con
--     datos propuestos (para revisar con su cita literal), 1 aprobada
--     sin seguimiento (para «Preparar seguimiento» en vivo), 2
--     aprobadas con borradores por aprobar y tareas propuestas, y 3
--     aprobadas con borradores aprobados y la ficha ya compartida.
--   - Tareas para hoy, mañana, más adelante, una vencida y dos
--     completadas, y una tarea suelta del agente.
--   - Sin audios (no hay archivos que subir): la voz se enseña en vivo.
-- =====================================================================

do $$
declare
  v_agent uuid := '__AGENT_ID__';
  v_name text;
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; c6 uuid; c7 uuid; c8 uuid;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid; p6 uuid; p7 uuid; p8 uuid;
  n uuid;
  f_cita uuid; f_aux uuid;
  d_buyer uuid;
begin
  select full_name into v_name from public.agents where id = v_agent;
  if v_name is null then
    raise exception 'demo: no existe el agente %', v_agent;
  end if;
  if exists (select 1 from public.clients where agent_id = v_agent)
    or exists (select 1 from public.properties where agent_id = v_agent) then
    raise exception 'demo: la cuenta ya tiene datos; no se carga nada';
  end if;

  -- 1. Clientes -------------------------------------------------------
  insert into public.clients (agent_id, full_name, phone, email, created_at)
  values (v_agent, 'Marta Ruiz Peña', '+34600100201', 'marta.ruiz@example.com', now() - interval '9 days')
  returning id into c1;
  insert into public.clients (agent_id, full_name, phone, email, created_at)
  values (v_agent, 'Javier Ortega Sanz', '+34600100202', 'javier.ortega@example.com', now() - interval '8 days')
  returning id into c2;
  insert into public.clients (agent_id, full_name, phone, email, created_at)
  values (v_agent, 'Lucía Fernández Gil', '+34600100203', null, now() - interval '8 days')
  returning id into c3;
  insert into public.clients (agent_id, full_name, phone, email, created_at)
  values (v_agent, 'Andrés Molina Vidal', '+34600100204', 'andres.molina@example.com', now() - interval '20 days')
  returning id into c4;
  insert into public.clients (agent_id, full_name, phone, email, created_at)
  values (v_agent, 'Carmen Navarro López', '+34600100205', null, now() - interval '5 days')
  returning id into c5;
  insert into public.clients (agent_id, full_name, phone, email, created_at)
  values (v_agent, 'Pablo Serrano Díaz', '+34600100206', 'pablo.serrano@example.com', now() - interval '4 days')
  returning id into c6;
  insert into public.clients (agent_id, full_name, phone, email, created_at)
  values (v_agent, 'Elena Castro Romero', '+34600100207', 'elena.castro@example.com', now() - interval '3 days')
  returning id into c7;
  insert into public.clients (agent_id, full_name, phone, email, is_temporary, created_at)
  values (v_agent, 'Señor del 3ºB (Lavapiés)', null, null, true, now() - interval '2 hours')
  returning id into c8;

  -- 2. Inmuebles ------------------------------------------------------
  insert into public.properties (agent_id, reference, address, city, price, owner_name, owner_phone, status, created_at)
  values (v_agent, 'V-101', 'Calle de Embajadores 45, 3º B', 'Madrid', 265000, 'Rosa Delgado Martín', '+34611200301', 'disponible', now() - interval '30 days')
  returning id into p1;
  insert into public.properties (agent_id, reference, address, city, price, owner_name, owner_phone, status, created_at)
  values (v_agent, 'V-102', 'Calle de Bravo Murillo 210, 5º A', 'Madrid', 310000, 'Tomás Herrera Gómez', '+34611200302', 'disponible', now() - interval '25 days')
  returning id into p2;
  insert into public.properties (agent_id, reference, address, city, price, owner_name, owner_phone, status, created_at)
  values (v_agent, 'V-103', 'Paseo de las Delicias 88, 2º izq.', 'Madrid', 289000, 'Isabel Prieto Ramos', '+34611200303', 'disponible', now() - interval '22 days')
  returning id into p3;
  insert into public.properties (agent_id, reference, address, city, price, owner_name, owner_phone, status, created_at)
  values (v_agent, 'V-104', 'Calle de Arturo Soria 150, 1º C', 'Madrid', 415000, 'Manuel Vega Ortiz', '+34611200304', 'reservado', now() - interval '40 days')
  returning id into p4;
  insert into public.properties (agent_id, reference, address, city, price, owner_name, owner_phone, status, created_at)
  values (v_agent, 'V-105', 'Calle de Alcalá 512, 7º D', 'Madrid', 238000, 'Pilar Sáez Moreno', '+34611200305', 'disponible', now() - interval '15 days')
  returning id into p5;
  insert into public.properties (agent_id, reference, address, city, price, owner_name, owner_phone, status, created_at)
  values (v_agent, 'V-106', 'Calle del Doctor Esquerdo 60, 4º A', 'Madrid', 345000, 'Ramón Iglesias Cano', '+34611200306', 'disponible', now() - interval '12 days')
  returning id into p6;
  insert into public.properties (agent_id, reference, address, city, price, owner_name, owner_phone, status, created_at)
  values (v_agent, 'V-107', 'Calle de Fuencarral 120, 3º', 'Madrid', 520000, 'Beatriz Moreno Lara', '+34611200307', 'vendido', now() - interval '90 days')
  returning id into p7;
  insert into public.properties (agent_id, reference, address, city, price, owner_name, owner_phone, status, created_at)
  values (v_agent, 'V-108', 'Avenida de la Albufera 230, 6º B', 'Madrid', 199000, 'Antonio Cano Ruiz', '+34611200308', 'disponible', now() - interval '10 days')
  returning id into p8;

  -- 3. Notas aprobadas con borradores aprobados y ficha compartida -----

  -- N1 · Marta + V-101 (hace 6 días)
  insert into public.visit_notes (agent_id, client_id, property_id, input_type, raw_text, status, created_at)
  values (v_agent, c1, p1, 'text',
    'Visita con Marta en Embajadores 45. Le ha encantado la luz del salón y que la cocina esté reformada. Le preocupa el ruido de la calle por la noche porque el dormitorio principal da a Embajadores. Me pide la nota simple y los gastos de comunidad. Presupuesto de 270.000 euros. Quiere volver con su pareja el sábado por la mañana, falta concretar la hora.',
    'transcribed', now() - interval '6 days')
  returning id into n;
  insert into public.extracted_facts (visit_note_id, category, field_name, value, evidence_quote, confidence) values
    (n, 'hecho_declarado', 'le_gusta', 'La luz del salón y la cocina reformada', 'Le ha encantado la luz del salón', 0.92),
    (n, 'objecion', 'ruido_calle', 'Ruido de la calle por la noche en el dormitorio principal', 'Le preocupa el ruido de la calle por la noche', 0.95),
    (n, 'hecho_declarado', 'documentacion_solicitada', 'Nota simple y gastos de comunidad', 'Me pide la nota simple y los gastos de comunidad', 0.93),
    (n, 'presupuesto', 'presupuesto_declarado', '270.000 euros', 'Presupuesto de 270.000 euros', 0.97),
    (n, 'desconocido', 'hora_visita', 'Hora de la segunda visita por confirmar', 'falta concretar la hora', 0.90);
  insert into public.extracted_facts (visit_note_id, category, field_name, value, evidence_quote, confidence)
  values (n, 'cita_pendiente', 'segunda_visita', 'Sábado por la mañana, con su pareja (hora por confirmar)', 'Quiere volver con su pareja el sábado por la mañana', 0.91)
  returning id into f_cita;
  select id into f_aux from public.extracted_facts where visit_note_id = n and field_name = 'documentacion_solicitada';
  update public.visit_notes set status = 'extracted', extracted_at = created_at + interval '3 minutes' where id = n;
  update public.extracted_facts set review_status = 'aceptado', reviewed_at = now() where visit_note_id = n;
  update public.visit_notes set status = 'approved' where id = n;
  insert into public.drafts (visit_note_id, audience, content, status) values
    (n, 'comprador',
     'Hola Marta, gracias por venir a ver V-101 (Calle de Embajadores 45, 3º B). Me alegra que te gustaran la luz del salón y la cocina reformada. Te preparo la nota simple y los gastos de comunidad y te los envío. Sobre el ruido, si quieres podemos volver a una hora de más tráfico para que lo valores con calma. ¿Os viene bien el sábado por la mañana a ti y a tu pareja? Dime a qué hora os encaja y lo hablo con la propiedad. Un saludo, ' || v_name,
     'aprobado')
  returning id into d_buyer;
  insert into public.drafts (visit_note_id, audience, content, status) values
    (n, 'propietario',
     'Hola Rosa, le cuento cómo fue la visita de esta semana a V-101 (Calle de Embajadores 45, 3º B). A la persona interesada le gustaron mucho la luz del salón y la cocina reformada. Su principal duda es el ruido de la calle en el dormitorio principal. Quiere volver a verlo acompañada; en cuanto tengamos día y hora se lo indico para coordinarlo. Un saludo, ' || v_name,
     'aprobado');
  insert into public.tasks (visit_note_id, agent_id, description, due_date, status, origin, source_fact_id)
  values (n, v_agent, 'Confirmar día y hora: Sábado por la mañana, con su pareja (hora por confirmar)', v_today - 1, 'pendiente', 'regla', f_cita);
  insert into public.tasks (visit_note_id, agent_id, description, due_date, status, origin, source_fact_id)
  values (n, v_agent, 'Enviar a Marta la nota simple y los gastos de comunidad', v_today - 4, 'pendiente', 'ia', f_aux);
  update public.tasks set status = 'completada' where visit_note_id = n and origin = 'ia';
  insert into public.crm_exports (visit_note_id, target, kind, status) values (n, 'whatsapp', 'nota', 'entregado');
  insert into public.crm_exports (visit_note_id, target, kind, draft_id, audience, status)
  values (n, 'whatsapp', 'borrador', d_buyer, 'comprador', 'entregado');

  -- N4 · Andrés + V-104 (hace 3 días; inmueble reservado)
  insert into public.visit_notes (agent_id, client_id, property_id, input_type, raw_text, status, created_at)
  values (v_agent, c4, p4, 'text',
    'Segunda visita de Andrés a Arturo Soria 150, esta vez con su arquitecto. Revisan la instalación eléctrica y el arquitecto dice que habría que cambiarla. Aun así quiere seguir adelante y ha pedido reservar. Presupuesto de 420.000 euros. Necesita el certificado energético antes de firmar.',
    'transcribed', now() - interval '3 days')
  returning id into n;
  insert into public.extracted_facts (visit_note_id, category, field_name, value, evidence_quote, confidence) values
    (n, 'observacion', 'instalacion_electrica', 'Instalación eléctrica a renovar, según su arquitecto', 'habría que cambiarla', 0.86),
    (n, 'hecho_declarado', 'decision', 'Quiere reservar', 'ha pedido reservar', 0.96),
    (n, 'presupuesto', 'presupuesto_declarado', '420.000 euros', 'Presupuesto de 420.000 euros', 0.97);
  insert into public.extracted_facts (visit_note_id, category, field_name, value, evidence_quote, confidence)
  values (n, 'hecho_declarado', 'documento_pendiente', 'Certificado energético antes de firmar', 'Necesita el certificado energético antes de firmar', 0.94)
  returning id into f_aux;
  update public.visit_notes set status = 'extracted', extracted_at = created_at + interval '2 minutes' where id = n;
  update public.extracted_facts set review_status = 'aceptado', reviewed_at = now() where visit_note_id = n;
  update public.visit_notes set status = 'approved' where id = n;
  insert into public.drafts (visit_note_id, audience, content, status) values
    (n, 'comprador',
     'Hola Andrés, gracias por volver a V-104 (Calle de Arturo Soria 150, 1º C) con tu arquitecto. Te preparo el documento de reserva y pido a la propiedad el certificado energético para que lo tengas antes de firmar. Si necesitas algo más sobre la instalación eléctrica, dímelo. Un saludo, ' || v_name,
     'aprobado'),
    (n, 'propietario',
     'Hola Manuel, buenas noticias: la persona interesada ha vuelto a ver V-104 (Calle de Arturo Soria 150, 1º C) y quiere reservar. Para avanzar necesitamos el certificado energético; ¿me lo puede enviar esta semana? Un saludo, ' || v_name,
     'aprobado');
  insert into public.tasks (visit_note_id, agent_id, description, due_date, status, origin, source_fact_id)
  values (n, v_agent, 'Pedir el certificado energético a la propiedad', v_today, 'pendiente', 'ia', f_aux);
  insert into public.tasks (visit_note_id, agent_id, description, due_date, status, origin)
  values (n, v_agent, 'Enviar a Andrés el documento de reserva', v_today - 2, 'pendiente', 'ia');
  update public.tasks set status = 'completada' where visit_note_id = n and description like 'Enviar a Andrés%';
  insert into public.crm_exports (visit_note_id, target, kind, status) values (n, 'whatsapp', 'nota', 'entregado');

  -- N3 · Lucía + V-103 (hace 4 días)
  insert into public.visit_notes (agent_id, client_id, property_id, input_type, raw_text, status, created_at)
  values (v_agent, c3, p3, 'text',
    'Lucía ha visitado Paseo de las Delicias 88. Le gusta mucho la terraza y que esté cerca del metro. Lo que no le convence es que no hay ascensor y es un segundo. Pregunta si la comunidad ha aprobado instalar uno. Volverá a llamarme la semana que viene.',
    'transcribed', now() - interval '4 days')
  returning id into n;
  insert into public.extracted_facts (visit_note_id, category, field_name, value, evidence_quote, confidence) values
    (n, 'hecho_declarado', 'le_gusta', 'La terraza y la cercanía al metro', 'Le gusta mucho la terraza', 0.93),
    (n, 'objecion', 'sin_ascensor', 'Segundo piso sin ascensor', 'no hay ascensor y es un segundo', 0.95),
    (n, 'desconocido', 'dia_llamada', 'Día de la llamada sin concretar', 'la semana que viene', 0.70);
  insert into public.extracted_facts (visit_note_id, category, field_name, value, evidence_quote, confidence)
  values (n, 'hecho_declarado', 'pregunta_ascensor', 'Si la comunidad ha aprobado instalar ascensor', 'Pregunta si la comunidad ha aprobado instalar uno', 0.90)
  returning id into f_aux;
  insert into public.extracted_facts (visit_note_id, category, field_name, value, evidence_quote, confidence)
  values (n, 'cita_pendiente', 'proxima_llamada', 'Llamará la semana que viene', 'Volverá a llamarme la semana que viene', 0.88)
  returning id into f_cita;
  update public.visit_notes set status = 'extracted', extracted_at = created_at + interval '2 minutes' where id = n;
  update public.extracted_facts set review_status = 'descartado', reviewed_at = now() where visit_note_id = n and field_name = 'dia_llamada';
  update public.extracted_facts set review_status = 'aceptado', reviewed_at = now() where visit_note_id = n and review_status = 'propuesto';
  update public.visit_notes set status = 'approved' where id = n;
  insert into public.drafts (visit_note_id, audience, content, status) values
    (n, 'comprador',
     'Hola Lucía, gracias por venir a ver V-103 (Paseo de las Delicias 88, 2º izq.). Me alegra que te gustara la terraza. Sobre el ascensor, pregunto a la administración de la finca si la comunidad lo ha aprobado y te cuento. Quedo pendiente de tu llamada la semana que viene. Un saludo, ' || v_name,
     'aprobado'),
    (n, 'propietario',
     'Hola Isabel, la persona interesada valoró muy bien la terraza y la ubicación de V-103. Su principal duda es el ascensor: ¿sabe si la comunidad ha aprobado instalarlo? Con esa información podré avanzar. Un saludo, ' || v_name,
     'borrador');
  insert into public.tasks (visit_note_id, agent_id, description, due_date, status, origin, source_fact_id)
  values (n, v_agent, 'Preguntar a la administración de la finca por el ascensor', v_today + 1, 'pendiente', 'ia', f_aux);
  insert into public.tasks (visit_note_id, agent_id, description, due_date, status, origin, source_fact_id)
  values (n, v_agent, 'Confirmar día y hora: Llamará la semana que viene', v_today + 4, 'pendiente', 'regla', f_cita);
  insert into public.crm_exports (visit_note_id, target, kind, status) values (n, 'whatsapp', 'nota', 'entregado');

  -- 4. Notas aprobadas con borradores y tareas por revisar ------------

  -- N2 · Javier + V-102 (hace 5 días)
  insert into public.visit_notes (agent_id, client_id, property_id, input_type, raw_text, status, created_at)
  values (v_agent, c2, p2, 'text',
    'Javier ha visto Bravo Murillo 210 con su hermano. Busca tres dormitorios y este tiene tres, pero el tercero es pequeño. Pregunta si se puede hacer una oferta y cuánto pagan de IBI. Su presupuesto es de 300.000 euros. Quedamos en hablar el jueves por la tarde para ver si hace oferta, sin hora fija. Me parece muy interesado, ha medido el salón.',
    'transcribed', now() - interval '5 days')
  returning id into n;
  insert into public.extracted_facts (visit_note_id, category, field_name, value, evidence_quote, confidence) values
    (n, 'hecho_declarado', 'dormitorios_buscados', 'Busca tres dormitorios', 'Busca tres dormitorios', 0.95),
    (n, 'objecion', 'tercer_dormitorio', 'El tercer dormitorio es pequeño', 'el tercero es pequeño', 0.90),
    (n, 'hecho_declarado', 'pregunta_oferta', 'Pregunta si se puede hacer una oferta', 'Pregunta si se puede hacer una oferta', 0.94),
    (n, 'presupuesto', 'presupuesto_declarado', '300.000 euros', 'Su presupuesto es de 300.000 euros', 0.97),
    (n, 'desconocido', 'hora_llamada', 'Hora de la llamada sin fijar', 'sin hora fija', 0.85),
    (n, 'observacion', 'interes', 'Interesado', 'ha medido el salón', 0.75);
  insert into public.extracted_facts (visit_note_id, category, field_name, value, evidence_quote, confidence)
  values (n, 'hecho_declarado', 'informacion_solicitada', 'Importe del IBI', 'cuánto pagan de IBI', 0.92)
  returning id into f_aux;
  insert into public.extracted_facts (visit_note_id, category, field_name, value, evidence_quote, confidence)
  values (n, 'cita_pendiente', 'llamada_seguimiento', 'Jueves por la tarde, sin hora fija', 'hablar el jueves por la tarde', 0.89)
  returning id into f_cita;
  update public.visit_notes set status = 'extracted', extracted_at = created_at + interval '3 minutes' where id = n;
  -- Un dato editado por el agente (se guarda el valor original).
  update public.extracted_facts
     set value = 'Muy interesado: ha medido el salón', original_value = value,
         review_status = 'editado', reviewed_at = now()
   where visit_note_id = n and field_name = 'interes';
  update public.extracted_facts set review_status = 'aceptado', reviewed_at = now() where visit_note_id = n and review_status = 'propuesto';
  update public.visit_notes set status = 'approved' where id = n;
  insert into public.drafts (visit_note_id, audience, content, status) values
    (n, 'comprador',
     'Hola Javier, gracias por la visita a V-102 (Calle de Bravo Murillo 210, 5º A). Te paso el importe del IBI en cuanto me lo facilite la propiedad. Sobre la oferta, lo hablamos con calma: ¿te viene bien que te llame el jueves por la tarde? Dime a qué hora te va mejor. Un saludo, ' || v_name,
     'borrador'),
    (n, 'propietario',
     'Hola Tomás, la visita a V-102 (Calle de Bravo Murillo 210, 5º A) fue bien. A la persona interesada le encaja la distribución, aunque ve pequeño el tercer dormitorio. Ha pedido el importe del IBI; ¿me lo puede facilitar? Le mantendré informado. Un saludo, ' || v_name,
     'borrador');
  insert into public.tasks (visit_note_id, agent_id, description, due_date, status, origin, source_fact_id)
  values (n, v_agent, 'Confirmar día y hora: Jueves por la tarde, sin hora fija', v_today, 'pendiente', 'regla', f_cita);
  insert into public.tasks (visit_note_id, agent_id, description, status, origin, source_fact_id)
  values (n, v_agent, 'Pedir a la propiedad el importe del IBI', 'propuesta', 'ia', f_aux);

  -- N6 · Pablo + V-106 (hace 2 días)
  insert into public.visit_notes (agent_id, client_id, property_id, input_type, raw_text, status, created_at)
  values (v_agent, c6, p6, 'text',
    'Pablo ha visitado Doctor Esquerdo 60. Viene de alquiler y quiere comprar antes de verano. Le gusta que tenga dos baños y el trastero. Pregunta por los gastos de comunidad porque le parecen altos. Su presupuesto es de 350.000 euros. Quiere que le llame el lunes para decidir, falta la hora.',
    'transcribed', now() - interval '2 days')
  returning id into n;
  insert into public.extracted_facts (visit_note_id, category, field_name, value, evidence_quote, confidence) values
    (n, 'hecho_declarado', 'plazo_compra', 'Quiere comprar antes de verano', 'quiere comprar antes de verano', 0.93),
    (n, 'hecho_declarado', 'le_gusta', 'Dos baños y trastero', 'Le gusta que tenga dos baños y el trastero', 0.95),
    (n, 'presupuesto', 'presupuesto_declarado', '350.000 euros', 'Su presupuesto es de 350.000 euros', 0.97),
    (n, 'desconocido', 'hora_llamada', 'Hora de la llamada sin fijar', 'falta la hora', 0.85);
  insert into public.extracted_facts (visit_note_id, category, field_name, value, evidence_quote, confidence)
  values (n, 'objecion', 'gastos_comunidad', 'Le parecen altos los gastos de comunidad', 'Pregunta por los gastos de comunidad porque le parecen altos', 0.91)
  returning id into f_aux;
  insert into public.extracted_facts (visit_note_id, category, field_name, value, evidence_quote, confidence)
  values (n, 'cita_pendiente', 'llamada_decision', 'Lunes, para decidir (hora por confirmar)', 'Quiere que le llame el lunes para decidir', 0.90)
  returning id into f_cita;
  update public.visit_notes set status = 'extracted', extracted_at = created_at + interval '2 minutes' where id = n;
  update public.extracted_facts set review_status = 'aceptado', reviewed_at = now() where visit_note_id = n;
  update public.visit_notes set status = 'approved' where id = n;
  insert into public.drafts (visit_note_id, audience, content, status) values
    (n, 'comprador',
     'Hola Pablo, gracias por la visita a V-106 (Calle del Doctor Esquerdo 60, 4º A). Te envío el desglose de los gastos de comunidad para que veas qué incluyen. Si te parece, te llamo el lunes para comentarlo; dime a qué hora te viene bien. Un saludo, ' || v_name,
     'borrador'),
    (n, 'propietario',
     'Hola Ramón, la persona interesada valoró mucho los dos baños y el trastero de V-106. Le gustaría conocer el desglose de los gastos de comunidad; ¿me lo puede enviar? Le informaré en cuanto decida. Un saludo, ' || v_name,
     'borrador');
  insert into public.tasks (visit_note_id, agent_id, description, status, origin, source_fact_id)
  values (n, v_agent, 'Confirmar día y hora: Lunes, para decidir (hora por confirmar)', 'propuesta', 'regla', f_cita);
  insert into public.tasks (visit_note_id, agent_id, description, status, origin, source_fact_id)
  values (n, v_agent, 'Enviar a Pablo el desglose de gastos de comunidad', 'propuesta', 'ia', f_aux);

  -- 5. Nota aprobada sin seguimiento («Preparar seguimiento» en vivo) --

  -- N5 · Carmen + V-105 (hace 2 días)
  insert into public.visit_notes (agent_id, client_id, property_id, input_type, raw_text, status, created_at)
  values (v_agent, c5, p5, 'text',
    'Carmen ha visto Alcalá 512 con su madre. Le encantan las vistas desde el séptimo y la plaza de garaje incluida. Le parece caro para la zona y cree que habría que pintar todo. Su presupuesto es de 225.000 euros. Quiere verlo otra vez la próxima semana, sin día cerrado.',
    'transcribed', now() - interval '2 days' + interval '3 hours')
  returning id into n;
  insert into public.extracted_facts (visit_note_id, category, field_name, value, evidence_quote, confidence) values
    (n, 'hecho_declarado', 'le_gusta', 'Las vistas y la plaza de garaje incluida', 'Le encantan las vistas desde el séptimo', 0.93),
    (n, 'objecion', 'precio', 'Le parece caro para la zona', 'Le parece caro para la zona', 0.95),
    (n, 'objecion', 'pintura', 'Cree que habría que pintar todo', 'habría que pintar todo', 0.88),
    (n, 'presupuesto', 'presupuesto_declarado', '225.000 euros', 'Su presupuesto es de 225.000 euros', 0.97),
    (n, 'cita_pendiente', 'segunda_visita', 'La próxima semana, sin día cerrado', 'Quiere verlo otra vez la próxima semana', 0.90),
    (n, 'desconocido', 'dia_visita', 'Día de la segunda visita sin cerrar', 'sin día cerrado', 0.86);
  update public.visit_notes set status = 'extracted', extracted_at = created_at + interval '2 minutes' where id = n;
  update public.extracted_facts set review_status = 'aceptado', reviewed_at = now() where visit_note_id = n;
  update public.visit_notes set status = 'approved' where id = n;

  -- 6. Notas con datos propuestos (revisar en vivo) -------------------

  -- N7 · Elena + V-108 (ayer)
  insert into public.visit_notes (agent_id, client_id, property_id, input_type, raw_text, status, created_at)
  values (v_agent, c7, p8, 'text',
    'Elena ha visto Albufera 230. Es su primera compra y viene con su pareja. Le gusta el precio y que esté reformado. Le preocupa que el edificio no tenga portero. Presupuesto de 200.000 euros. Quiere una segunda visita el miércoles, falta confirmar la hora.',
    'transcribed', now() - interval '1 day')
  returning id into n;
  insert into public.extracted_facts (visit_note_id, category, field_name, value, evidence_quote, confidence) values
    (n, 'hecho_declarado', 'primera_compra', 'Primera compra, con su pareja', 'Es su primera compra', 0.92),
    (n, 'hecho_declarado', 'le_gusta', 'El precio y que esté reformado', 'Le gusta el precio y que esté reformado', 0.94),
    (n, 'objecion', 'sin_portero', 'El edificio no tiene portero', 'Le preocupa que el edificio no tenga portero', 0.93),
    (n, 'presupuesto', 'presupuesto_declarado', '200.000 euros', 'Presupuesto de 200.000 euros', 0.97),
    (n, 'cita_pendiente', 'segunda_visita', 'Miércoles, hora por confirmar', 'Quiere una segunda visita el miércoles', 0.90),
    (n, 'desconocido', 'hora_visita', 'Hora de la segunda visita por confirmar', 'falta confirmar la hora', 0.88);
  update public.visit_notes set status = 'extracted', extracted_at = created_at + interval '2 minutes' where id = n;

  -- N8 · Marta + V-106 (hoy): segunda opción de una clienta que ya tiene historial
  insert into public.visit_notes (agent_id, client_id, property_id, input_type, raw_text, status, created_at)
  values (v_agent, c1, p6, 'text',
    'Marta ha visto también Doctor Esquerdo 60 porque Embajadores le parecía ruidoso. Este le parece más tranquilo pero más pequeño. Pregunta si el precio es negociable. Su presupuesto sigue siendo 270.000 euros. Prefiere decidir entre los dos esta semana.',
    'transcribed', now() - interval '5 hours')
  returning id into n;
  insert into public.extracted_facts (visit_note_id, category, field_name, value, evidence_quote, confidence) values
    (n, 'hecho_declarado', 'le_gusta', 'Más tranquilo que Embajadores', 'Este le parece más tranquilo', 0.90),
    (n, 'objecion', 'tamano', 'Más pequeño que Embajadores', 'pero más pequeño', 0.82),
    (n, 'hecho_declarado', 'pregunta_precio', 'Pregunta si el precio es negociable', 'Pregunta si el precio es negociable', 0.95),
    (n, 'presupuesto', 'presupuesto_declarado', '270.000 euros', 'Su presupuesto sigue siendo 270.000 euros', 0.96),
    (n, 'hecho_declarado', 'plazo_decision', 'Decidirá esta semana entre V-101 y V-106', 'Prefiere decidir entre los dos esta semana', 0.89);
  update public.visit_notes set status = 'extracted', extracted_at = created_at + interval '2 minutes' where id = n;

  -- 7. Notas por extraer («Extraer datos» en vivo) ---------------------

  insert into public.visit_notes (agent_id, client_id, property_id, input_type, raw_text, status, created_at) values
    (v_agent, c8, p5, 'text',
     'El señor del tercero B de Lavapiés ha venido a ver Alcalá 512. Busca algo para alquilar a estudiantes y pregunta si se pueden hacer cuatro habitaciones. Dice que su presupuesto ronda los 240.000 euros. Le enviaré los planos y me dirá algo el viernes, sin hora.',
     'transcribed', now() - interval '2 hours'),
    (v_agent, c2, p3, 'text',
     'Javier ha visto Delicias 88 como alternativa a Bravo Murillo. Le gusta la terraza, pero un segundo sin ascensor no le convence. Pide el certificado energético. Hablamos de nuevo el martes, falta la hora.',
     'transcribed', now() - interval '1 hour'),
    (v_agent, c5, p8, 'text',
     'Carmen ha visto Albufera 230. Le parece pequeño el salón, pero el precio le encaja. Quiere saber si el piso tiene calefacción individual. Me llamará mañana para contarme qué piensa.',
     'transcribed', now() - interval '1 day' + interval '2 hours');

  -- 8. Tarea suelta del agente (sin nota) -----------------------------
  insert into public.tasks (visit_note_id, agent_id, description, due_date, status, origin)
  values (null, v_agent, 'Llamar a la notaría para fijar la firma de V-104', v_today + 2, 'pendiente', 'agente');

  raise notice 'demo cargada para % (%)', v_name, v_agent;
end
$$;
