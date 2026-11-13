# Registro de actividades de tratamiento (art. 30 RGPD)

> **BORRADOR — revisar con un profesional antes del piloto con datos
> reales.** Los puntos marcados «(decide Luis)» están pendientes de su
> decisión; nada de este documento es asesoramiento legal.

## Responsable

- **Responsable:** Luis (autónomo, formador y consultor de IA).
- **Contacto:** (decide Luis: email de contacto para ejercer derechos).
- **Delegado de Protección de Datos:** no procede / (decide Luis: si
  nombra uno).

## Tratamientos

### 1. Notas de visita (clientes y propietarios)

- **Finalidad:** que el agente inmobiliario registre lo que vio y oyó
  en una visita, lo revise y prepare el seguimiento con el comprador y
  el propietario.
- **Interesados:** clientes (compradores) y propietarios de inmuebles.
- **Categorías de datos:** nombre, teléfono y email del cliente;
  nombre y teléfono del propietario; dirección, referencia y precio
  del inmueble; texto o audio de la nota, transcripción, datos
  extraídos con su cita, tareas, borradores y exportaciones.
- **Base legal:** (decide Luis: p. ej. ejecución del encargo de
  intermediación, interés legítimo del agente, consentimiento del
  cliente para la grabación de voz).
- **Destinatarios:** encargados del apartado «Encargados»
  (`encargados.md`); el CRM de la agencia solo cuando el agente
  exporta la ficha (Inmovilla/Witei, modo simulado en pruebas).
- **Transferencias fuera del EEE:** la transcripción y la extracción
  se hacen con proveedores fuera de la UE (ver `encargados.md`);
  (decide Luis: mecanismo de transferencia y proveedor definitivo
  con DPA y plan de pago).
- **Plazo de conservación:** mientras la nota exista en la app; el
  audio se borra al aprobar la nota; el cliente, el propietario y la
  nota se borran a petición desde la app (ver `riesgos.md`).
- **Medidas de seguridad:** acceso por agente con RLS, audios en
  bucket privado con URL firmada de 5 minutos, claves solo como
  secrets de servidor, sin `service_role` en las funciones.

### 2. Cuentas de agente

- **Finalidad:** identificar al agente que usa la app y separar sus
  datos de los de otros agentes.
- **Interesados:** agentes inmobiliarios usuarios de la app.
- **Categorías de datos:** nombre, email, teléfono.
- **Base legal:** ejecución del contrato de uso de la app.
- **Destinatarios:** Supabase (Auth y base de datos, UE).
- **Plazo de conservación:** mientras la cuenta exista; (decide Luis:
  procedimiento de baja de un agente y borrado de sus datos).

### 3. Registro de acciones de privacidad (`audit_events`)

- **Finalidad:** que cada agente vea qué borrados y entregas de datos
  ha hecho.
- **Interesados:** agentes (no se guarda ningún dato del cliente:
  solo la acción, el id de la entidad y la fecha).
- **Base legal:** interés legítimo (trazabilidad de los derechos
  ejercidos).
- **Plazo de conservación:** (decide Luis).

## Derechos de los interesados

Acceso, rectificación, supresión, limitación, portabilidad y
oposición. En la app: el agente entrega los datos de un cliente en
JSON («Descargar sus datos» en la ficha del cliente) y borra sus
datos («Borrar nota», «Borrar cliente y todos sus datos», «Borrar
datos del propietario»). El canal para ejercerlos fuera de la app:
(decide Luis).
