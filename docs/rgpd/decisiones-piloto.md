# Decisiones jurídicas para el piloto (Etapa 6)

> **BORRADOR — no es asesoramiento jurídico.** Recoge lo que dicen las
> fuentes oficiales consultadas el 2026-11-13 y propone opciones. Las
> decisiones son de Luis y conviene que las revise un profesional
> antes de usar datos reales. Las condiciones de los proveedores
> cambian: hay que volver a comprobarlas el día de contratar.

## 1. Acción inmediata (antes de enseñar la demo a un agente real)

Las condiciones adicionales de la API de Gemini dicen que **solo se
pueden usar los servicios de pago cuando se pone un cliente de la API
a disposición de usuarios del Espacio Económico Europeo, Suiza o el
Reino Unido** (Google, 2026). La app de pruebas usa hoy la cuota
gratuita de Gemini para `extract` y `drafts`. Enseñársela a un agente
en España es ponerla a su disposición, **aunque los datos sean
inventados**. Para los servicios gratuitos, además, Google se reserva
usar el contenido para mejorar sus productos, con revisión humana
(Google, 2026).

- **Recomendación:** antes de la demo, asociar el proyecto de Google
  Cloud de la clave `EXTRACT_API_KEY` a una **cuenta de facturación
  activa**. Así esa clave pasa a ser «servicio de pago» (Google,
  2026), sin tocar código ni *secrets*. Con el volumen de una demo,
  el coste esperable es de céntimos.
- **Groq (transcripción):** activar **Zero Data Retention** en *Data
  Controls*. Con ZDR, Groq no guarda los audios ni para fiabilidad
  ni para control de abusos (Groq, s. f.-b). Sus condiciones dicen
  «clientes elegibles», así que hay que comprobar que la cuenta lo
  permite (Groq, s. f.-a).

## 2. Quién es responsable y quién encargado

El registro de la Fase 8 pone a Luis como **responsable** de las
notas de visita. Según el Comité Europeo de Protección de Datos, los
papeles son **funcionales**: dependen de quién decide los fines y los
medios en cada tratamiento, no del tipo de empresa (EDPB, 2021).

- **Notas de visita (clientes y propietarios):** quien decide para
  qué se usan es la **agencia o el agente** que atiende a sus
  clientes. Leytonia/Luis presta la herramienta y trata los datos
  **por cuenta de** ellos. Encaja como **encargado del tratamiento**
  (art. 28 RGPD), y la agencia como **responsable**.
- **Cuentas de agente (nombre, email):** aquí Luis sí decide (alta,
  acceso, soporte). Es **responsable** frente a sus clientes, los
  agentes.
- **Consecuencias prácticas:**
  - Firmar con cada agencia del piloto un **contrato de encargo del
    tratamiento** (art. 28.3 RGPD) que vaya más allá de copiar el
    artículo (EDPB, 2021).
  - Anotar como **subencargados** a Supabase y a los proveedores de
    IA, y pedir la autorización de la agencia (art. 28.2 RGPD).
  - El **deber de informar** a compradores y propietarios (arts. 13
    y 14 RGPD) es de la agencia, como responsable. Leytonia puede
    darle un texto modelo.
  - Rehacer `registro-actividades.md` en dos registros: el de Luis
    como encargado (art. 30.2) y el de Luis como responsable de las
    cuentas (art. 30.1).

## 3. Proveedor de IA: opciones

Hoy: Groq (transcripción) y Gemini (extracción y borradores). Las
funciones usan la API compatible con OpenAI y leen proveedor, modelo
y clave de *secrets* (`TRANSCRIBE_*`, `EXTRACT_*`, `DRAFT_*`), así que
cambiar de proveedor no debería exigir código. **Hay que probarlo.**

| | **A. Google (de pago) + Groq (ZDR)** | **B. Mistral (UE) para todo** |
| --- | --- | --- |
| Dónde se tratan los datos | Groq: EE. UU. (Google Cloud), con cláusulas contractuales tipo (Groq, s. f.-b). Gemini: sin región UE comprobada en esta revisión | UE por defecto; con cambios puntuales fuera de la UE según subencargados (Mistral AI, s. f.-b) |
| Transferencia internacional | Sí: marco de privacidad UE-EE. UU. si la empresa está certificada (Comisión Europea, 2023) o cláusulas tipo | Por defecto no; cláusulas tipo para los subencargados de fuera de la UE (Mistral AI, s. f.-a) |
| Contratos | Dos DPA (Google y Groq) | Un DPA (Mistral AI, s. f.-a) |
| Uso de los datos para entrenar | Gemini de pago: no; solo registro limitado para detectar abusos (Google, 2026). Groq: sin retención con ZDR | Comprobar en su DPA y en la configuración de la organización |
| Trabajo técnico | Ninguno (activar la facturación y ZDR) | Probar con datos ficticios que la transcripción (Voxtral) y el chat funcionan con nuestras funciones y en español |
| Riesgo | Datos de compradores fuera de la UE | Calidad y compatibilidad por comprobar |

**Recomendación:**
- **Para la demo y los primeros días del piloto con datos
  ficticios:** opción **A**, con las dos acciones del punto 1. Es
  inmediata.
- **Antes de meter datos reales:** probar la **opción B** con los
  datos de la demo. Si la calidad en español es comparable, quedarse
  con ella: un solo encargado, datos en la UE y sin transferencias
  por defecto. Es lo más fácil de explicar a una agencia.

## 4. Base legal y deber de información (decide la agencia; propuesta)

- **Base legal de las notas.** Hay dos candidatas:
  - **Medidas precontractuales a petición del interesado** (art.
    6.1.b RGPD): el comprador pide visitar el inmueble.
  - **Interés legítimo** del agente en documentar la visita y hacer
    el seguimiento (art. 6.1.f RGPD), con su ponderación por escrito.

  Elegir una u otra es decisión de la agencia con su asesor.
- **Grabación de voz.** La app graba el **resumen del agente**, no la
  conversación con el cliente: la pantalla de captura lo recuerda
  (B-12, Fase 9). No hace falta consentimiento para grabar al
  cliente porque no se le graba. Si un agente lo hiciera, sería un
  tratamiento distinto, sin cubrir.
- **Datos especialmente protegidos (art. 9).** Las reglas de
  `extract` descartan salud, origen, religión, etc. Es una medida
  técnica, pero no sustituye a la instrucción al agente de no
  dictarlos.
- **Información al interesado** (arts. 13 y 14 RGPD): la agencia
  informa al comprador, por ejemplo en la hoja de visita, de que el
  agente toma notas y de que un proveedor tecnológico las procesa
  con IA. Al propietario, en el contrato de encargo de venta.

## 5. Evaluación de impacto (EIPD)

La AEPD indica que, en la mayoría de los casos, un tratamiento que
cumple **dos o más** criterios de su lista orientativa requiere una
EIPD. Su lista incluye, entre otros, el uso de **tecnologías nuevas
o innovadoras** y el tratamiento **a gran escala** (AEPD, 2019).

- En un piloto de 3–5 agentes se cumple, como mucho, el criterio de
  tecnología innovadora (IA generativa). No es gran escala ni hay
  decisiones automatizadas: **el agente revisa y aprueba todo**.
- **Propuesta:** para el piloto, un **análisis de riesgos
  documentado** (ampliar `riesgos.md`). Hacer la EIPD **antes de
  comercializar** a escala. La conclusión final es de Luis y de la
  agencia con su asesor.

## 6. Supabase

- El DPA de Supabase forma parte de sus condiciones de servicio (o
  del acuerdo que se firme con ellos) (Supabase, s. f.). Hay que
  guardar la versión vigente y la lista de subencargados el día de
  contratar el plan del piloto.
- El proyecto está en `eu-central-1` (Fráncfort).
- El plan Free no tiene copias de seguridad automáticas: para datos
  reales, plan de pago (decisión de Luis, ya anotada en
  `checklist-piloto.md`).

## 7. Decisiones de Luis (resumen)

1. [ ] Activar la facturación en el proyecto de Google Cloud de la
       clave de Gemini (antes de la demo).
2. [ ] Activar ZDR en Groq (antes de la demo).
3. [ ] Aceptar el planteamiento «agencia = responsable, Leytonia =
       encargado» y encargar el modelo de contrato del art. 28.
4. [ ] Probar la opción B (Mistral UE) con datos ficticios y elegir
       el proveedor definitivo.
5. [ ] Texto modelo de información para la hoja de visita (para la
       agencia).
6. [ ] Plan de pago de Supabase y SMTP propio.
7. [ ] Revisión por un profesional de `docs/rgpd/` antes de usar
       datos reales.

## Referencias

Agencia Española de Protección de Datos. (2019). *Listas de tipos de
tratamientos de datos que requieren evaluación de impacto relativa a
protección de datos (art. 35.4)*.
https://www.aepd.es/documento/listas-dpia-es-35-4.pdf

Comisión Europea. (2023). *Decisión de Ejecución (UE) 2023/1795 de la
Comisión, de 10 de julio de 2023, relativa a la adecuación del nivel
de protección de los datos personales en el marco de privacidad de
datos UE-EE. UU.* Diario Oficial de la Unión Europea, L 231.
https://eur-lex.europa.eu/eli/dec_impl/2023/1795/oj

European Data Protection Board. (2021). *Guidelines 07/2020 on the
concepts of controller and processor in the GDPR* (versión 2.0,
adoptada el 7 de julio de 2021).
https://www.edpb.europa.eu/our-work-tools/documents/public-consultations/2020/guidelines-072020-concepts-controller-and_en

Google. (2026). *Gemini API additional terms of service*. Google AI
for Developers. https://ai.google.dev/gemini-api/terms

Groq. (s. f.-a). *Groq services agreement*. GroqDocs.
https://console.groq.com/docs/legal/services-agreement

Groq. (s. f.-b). *Your data in GroqCloud*. GroqDocs.
https://console.groq.com/docs/your-data

Mistral AI. (s. f.-a). *Where can I find your DPA (Data Processing
Agreement)?* Mistral AI Help Center.
https://help.mistral.ai/en/articles/347641-where-can-i-find-your-dpa-data-processing-agreement

Mistral AI. (s. f.-b). *Where do you store my data or my
Organization's data?* Mistral AI Help Center.
https://help.mistral.ai/en/articles/347629-where-do-you-store-my-data-or-my-organization-s-data

Reglamento (UE) 2016/679 del Parlamento Europeo y del Consejo, de 27
de abril de 2016, relativo a la protección de las personas físicas en
lo que respecta al tratamiento de datos personales y a la libre
circulación de estos datos (Reglamento general de protección de
datos). (2016). Diario Oficial de la Unión Europea, L 119.
https://eur-lex.europa.eu/eli/reg/2016/679/oj

Supabase. (s. f.). *Data processing addendum*.
https://supabase.com/legal/dpa
