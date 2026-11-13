# Riesgos abiertos y aceptados

> **BORRADOR — revisar con un profesional antes del piloto con datos
> reales.**

## Aceptados

### B-6: un agente puede cerrar su propia exportación con un PATCH directo

Un agente puede pasar su propia exportación de `pendiente` a
`enviado` con un PATCH directo a la base, sin pasar por la Edge
Function `crm-export`. **Se acepta y no se arregla:** cerrar la
exportación solo desde el servidor exigiría `service_role` en
`crm-export`, contra la norma del proyecto (nunca `service_role`), y
el único efecto es que un agente falsee sus propias métricas (la
exportación no sale de Supabase en modo simulado, y en modo webhook
la llamada real al CRM la hace la función). Queda anotado aquí para
que no se pierda.

## Abiertos

### Textos libres que nombran a terceros

Los textos de las notas, las transcripciones y los datos extraídos
son texto libre: pueden nombrar a terceros (p. ej. la pareja del
cliente, un vecino, el administrador) que no son el cliente ni el
propietario. Borrar los datos del propietario **no** borra esas
menciones: la app avisa («Los textos de las notas pueden nombrar al
propietario: revísalos o bórralos si lo pide») y es el agente quien
revisa o borra las notas. (Decide Luis: procedimiento cuando un
tercero pide que se borre su mención.)

### Planes gratuitos de IA sin DPA

En pruebas, la transcripción (Groq) y la extracción/borradores
(Gemini) usan planes gratuitos, sin DPA firmado y con tratamiento
fuera de la UE. **No usar con datos reales de clientes hasta elegir
proveedor y plan de pago con DPA** (decisión de Luis, ver
`encargados.md`).

### Copias de seguridad del plan gratuito de Supabase

El proyecto de pruebas está en el plan gratuito de Supabase: las
copias de seguridad y la retención no son las de un plan de pago.
(Decide Luis: plan de Supabase para el piloto.)

### Datos fuera de la app

Borrar una nota, un cliente o un propietario borra sus datos **en la
app**. Lo que ya salió de ella no se borra: mensajes de WhatsApp
enviados, fichas exportadas al CRM, el JSON descargado con «Descargar
sus datos», y cualquier captura o copia que el agente haya hecho.
La app lo dice en cada confirmación de borrado.

### Emails reales en el historial de git

Los emails reales de las cuentas de prueba se quitaron de
`docs/HANDOFF.md` en la Fase 8 (marcadores `<email-agente-a>`,
`<email-agente-b>`, `<email-luis>`, `<email-prueba-fantasma>`), pero
**siguen en el historial de git**. Reescribir el historial es
decisión de Luis (el repo es público).

### Grabación de voz

La app recuerda grabar un resumen al salir de la visita, no la
conversación con el cliente. La base legal de la grabación y el
consentimiento del cliente son decisión de Luis (ver
`registro-actividades.md`).
