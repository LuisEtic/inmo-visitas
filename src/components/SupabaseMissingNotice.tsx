/**
 * Aviso que muestran las pantallas de acceso cuando no hay variables de
 * Supabase configuradas: el cliente es null y no se puede intentar
 * ninguna operación de Auth en lugar de fallar.
 */
export function SupabaseMissingNotice() {
  return (
    <p className="rounded-md border border-warning bg-warning/10 px-3 py-2 text-sm text-warning">
      Falta configurar Supabase (.env). Copia .env.example a .env y rellena
      VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY con los del proyecto de
      pruebas.
    </p>
  )
}
