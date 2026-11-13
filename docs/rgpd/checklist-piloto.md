# Checklist del piloto (antes de usar datos reales)

> **BORRADOR — revisar con un profesional.** Nada de esta lista se
> da por hecho: cada punto se marca solo cuando esté comprobado.

## Decisiones de Luis (bloquean el piloto)

- [ ] Proveedor de IA definitivo + plan de pago con DPA (Groq /
      Gemini u otro). Sin esto, no hay datos reales en transcripción,
      extracción ni borradores.
- [ ] Base legal de cada tratamiento y textos legales (información al
      cliente, consentimiento de la grabación de voz).
- [ ] Plan de Supabase (copias de seguridad y retención).
- [ ] SMTP propio (el correo integrado solo permite 2 emails/hora y
      solo a miembros del equipo).
- [ ] Repo privado + staging en Coolify (hoy el repo es público y
      GitHub Pages es staging temporal).
- [ ] Limpieza de los datos de prueba (solo con su «sí» por escrito;
      script en `docs/deploy/limpieza-pruebas.sql` — **no ejecutar
      sin ese «sí»**).
- [ ] Reescribir el historial de git o no (los emails reales de
      prueba siguen en el historial).

## Comprobaciones técnicas

- [ ] Migración 0012 aplicada en el proyecto de pruebas y Advisors
      de Supabase sin avisos nuevos (ver HANDOFF de la Fase 8).
- [ ] Las cuatro Edge Functions redesplegadas con la Fase 8 (`cors.ts`
      y `limit.ts` incluidos) y los *secrets* `ALLOWED_ORIGINS` y
      `AI_DAILY_LIMIT` creados si se quieren cambiar los valores por
      defecto.
- [ ] Límite diario de IA probado: con `AI_DAILY_LIMIT = 2`, la
      tercera llamada a `transcribe`, `extract` o `drafts` responde
      429 con el mensaje en español.
- [ ] Borrados probados con datos de sacrificio (nunca con la nota de
      ejemplo de Ana): borrar nota, borrar cliente con notas, borrar
      datos del propietario; comprobar que el audio desaparece de
      Storage y que `audit_events` registra cada acción.
- [ ] Descarga de datos probada: el JSON no trae `audio_url` ni el
      `payload` de las exportaciones.
- [ ] Revisar `docs/rgpd/` con un profesional y rellenar los
      «(decide Luis)» de `registro-actividades.md` y la columna «DPA
      firmado» de `encargados.md`.
