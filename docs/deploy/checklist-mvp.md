# Checklist «listo para probar» (cierre del MVP)

Checklist de la Etapa 6 de la skill `app-mvp`, con el estado real de
cada punto a 2026-11-13 (Fase 9 construida, pendiente de revisión y
cierre). La skill no está en este workspace: los puntos se redactan
con lo que el prompt de la Fase 9 nombra y con la evidencia del
proyecto (`docs/ESTADO.md`, `docs/HANDOFF.md`, `docs/rgpd/`).

## Estado del MVP

- [x] **1. Las 9 fases están construidas.** Fases 1–8 cerradas y
      revisadas por Claude; Fase 9 construida (este HANDOFF),
      pendiente de revisión de Claude y de cierre por Luis.
- [x] **2. RLS aguanta la prueba negativa.** Agente B y anónimo no
      leen ni editan filas del agente A (verificado en la Fase 2 y
      re-verificado en las revisiones; Fase 8: criterios 26/26 + 1).
- [x] **3. Sin claves en el repo.** URL y clave anon solo en el
      `.env` local (gitignored); las claves de IA solo viven como
      *secrets* de las Edge Functions; el PAT de GitHub y las claves
      de Supabase se usan solo de forma transitoria y se borran al
      momento.
- [ ] **4. Despliegue de producción.** PARCIAL: proyecto de pruebas
      de Supabase en la UE, sí; GitHub Pages como staging temporal,
      sí. **Falta: Coolify + subdominio en Hostinger y previsualizaciones
      por PR** (decisión de Luis).
- [x] **5. La nota de ejemplo se reproduce de principio a fin.**
      Ana García + V-18: captura por voz, transcripción, extracción,
      revisión, aprobación, borradores y exportación, verificada por
      API y en el navegador de Luis.

## Lo que falta de Luis (bloquea el piloto con datos reales)

- [ ] **Protección de contraseñas filtradas en Auth**, si el plan lo
      permite (único aviso real de los *Advisors* de Supabase).
- [ ] **Limpieza de los datos de prueba** (solo con su «sí» por
      escrito; script en `docs/deploy/limpieza-pruebas.sql` — **no
      ejecutar sin ese «sí»**).
- [ ] **Decisiones jurídicas:** base legal de cada tratamiento,
      textos legales (información al cliente, consentimiento de la
      grabación de voz), proveedor de IA + plan de pago con DPA, plan
      de Supabase (copias y retención), SMTP propio. Ver
      `docs/rgpd/checklist-piloto.md`.
- [ ] **Coolify + subdominio en Hostinger** (punto 4).
- [ ] **Repo privado** (hoy es público; los emails reales de prueba
      siguen en el historial de git — reescribirlo o no es decisión
      de Luis).

## Plan del piloto (pendiente de Luis)

- 3–5 usuarios reales, 1–2 semanas, con datos reales solo cuando lo
  de arriba esté resuelto.
- Antes del piloto: redesplegar `drafts` y `crm-export` con los
  cambios de la Fase 9 (Claude, con el conector de Supabase) y
  desplegar Pages desde `main`; probar con datos de sacrificio los
  criterios 1, 2, 5 y 7 de la Fase 9 y el repaso móvil a 360 px en
  un móvil real.
