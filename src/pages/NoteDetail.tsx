import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { PrivateNav } from '../components/PrivateNav'
import { SupabaseMissingNotice } from '../components/SupabaseMissingNotice'
import { getClient } from '../features/clients/api'
import { getProperty } from '../features/properties/api'
import { validateNoteText } from '../features/capture/audio'
import {
  exportToCrm,
  listNoteExports,
  loadExportContext,
  type ExportContext,
} from '../features/export/api'
import { recordDelivery } from '../features/export/deliveries'
import {
  addFact,
  approveNote,
  extractNote,
  listFacts,
  reviewFact,
  type ReviewAction,
} from '../features/extraction/api'
import {
  approveDraft,
  createManualDraft,
  createTask,
  acceptTask,
  discardTask,
  DraftsRulesError,
  editTask,
  listDrafts,
  listNoteTasks,
  prepareFollowUp,
  restoreTask,
  saveDraft,
} from '../features/followup/api'
import { listSourceFacts } from '../features/tasks/api'
import { findEvidenceRange, hasEvidence } from '../features/extraction/evidence'
import {
  CATEGORY_ORDER,
  CATEGORY_TITLES,
  NOTE_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  confidenceText,
  fieldLabel,
  toFieldName,
} from '../features/extraction/labels'
import {
  getNote,
  getSignedAudioUrl,
  removeNote,
  transcribeNote,
  updateNoteText,
} from '../features/notes/api'
import { flushAudioCleanup } from '../features/privacy/audio-cleanup'
import { clientConfig } from '../config/client'
import { getCrmAdapter } from '../integrations/crm'
import type { CrmExportResult } from '../integrations/crm/types'
import { formatPhone, whatsappHref } from '../lib/contact'
import { openBlankWindow } from '../lib/popup'
import { useSlowWait } from '../lib/use-slow-wait'
import type {
  ClientRow,
  CrmExportRow,
  CrmExportStatus,
  DraftAudience,
  DraftRow,
  ExtractedFactRow,
  FactCategory,
  PropertyRow,
  TaskRow,
  VisitNoteRow,
} from '../lib/database.types'
import { useAuth } from '../lib/auth-context'
import { APP_PHASE_LABEL } from '../lib/app-label'

const noteDateFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

/** Estados legibles del historial de exportaciones (Fase 7). */
const EXPORT_STATUS_LABELS: Record<CrmExportStatus, string> = {
  pendiente: 'En curso',
  enviado: 'Enviada',
  error: 'Error',
  entregado: 'Entregada al agente',
}

/** Qué se llevó fuera en cada fila del historial. */
function exportKindLabel(row: CrmExportRow): string {
  if (row.kind === 'nota') {
    return 'Ficha'
  }
  return row.audience === 'comprador'
    ? 'Borrador al comprador'
    : 'Borrador al propietario'
}

function countText(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/**
 * /notas/:id (privada): ficha de la nota de visita (Fases 4 y 5).
 * - Cabecera: cliente (con enlace y badge «Provisional»), inmueble
 *   (referencia + dirección, con enlace), fecha y estado.
 * - Audio: reproductor con URL firmada de 5 minutos. Si la nota es
 *   `draft` con audio, lanza la transcripción al abrir una sola vez.
 * - Texto: la transcripción (o `raw_text`) en modo lectura, con botón
 *   «Corregir» (máx. 5.000 caracteres, estado `draft` o `transcribed`).
 * - Extracción (Fase 5): «Extraer datos» en `transcribed`; cada dato
 *   junto a su cita resaltada en el texto; aceptar, editar, descartar,
 *   recuperar y añadir; «Volver a extraer» y «Aprobar nota». Tras
 *   aprobar, todo queda en solo lectura (también «Corregir»).
 * - Seguimiento (Fase 6): borradores y tareas de la nota aprobada.
 * - Exportación (Fase 7): «Abrir en WhatsApp» en cada borrador
 *   aprobado y sección «Exportar» con la ficha, el botón del CRM y el
 *   historial.
 * - Id inexistente o de otro agente → «No encontrado» (RLS).
 */
export default function NoteDetail() {
  // La `key` fuerza un montaje nuevo al pasar de una ficha a otra, para
  // no arrastrar el estado anterior (lección de la Fase 3).
  const { id } = useParams<{ id: string }>()
  return <NoteDetailView key={id ?? 'sin-id'} id={id} />
}

function NoteDetailView({ id }: { id: string | undefined }) {
  const { supabaseConfigured } = useAuth()
  const navigate = useNavigate()

  const [note, setNote] = useState<VisitNoteRow | null>(null)
  const [client, setClient] = useState<ClientRow | null>(null)
  const [property, setProperty] = useState<PropertyRow | null>(null)
  const [loading, setLoading] = useState(supabaseConfigured)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [transcribeError, setTranscribeError] = useState<string | null>(null)
  const transcribeStartedRef = useRef(false)

  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  const [facts, setFacts] = useState<ExtractedFactRow[] | null>(null)
  const [factsError, setFactsError] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [extractNotice, setExtractNotice] = useState<string | null>(null)
  const [selectedFactId, setSelectedFactId] = useState<string | null>(null)
  const [editingFactId, setEditingFactId] = useState<string | null>(null)
  const [editFactValue, setEditFactValue] = useState('')
  const [editFactError, setEditFactError] = useState<string | null>(null)
  const [savingFact, setSavingFact] = useState(false)
  const [factActionError, setFactActionError] = useState<string | null>(null)
  const [showAddFact, setShowAddFact] = useState(false)
  const [addCategory, setAddCategory] = useState<FactCategory>('hecho_declarado')
  const [addName, setAddName] = useState('')
  const [addValue, setAddValue] = useState('')
  const [addQuote, setAddQuote] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [addingFact, setAddingFact] = useState(false)
  const [showDiscarded, setShowDiscarded] = useState(false)
  const [showReextractConfirm, setShowReextractConfirm] = useState(false)
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)
  const markRef = useRef<HTMLElement | null>(null)

  // Borrar la nota (Fase 8): con confirmación; el trigger de borrado
  // encola su audio y registra `nota_borrada`.
  const [confirmingDeleteNote, setConfirmingDeleteNote] = useState(false)
  const [deletingNote, setDeletingNote] = useState(false)
  const [deleteNoteError, setDeleteNoteError] = useState<string | null>(null)

  // Seguimiento (Fase 6): borradores duales y tareas, solo nota aprobada.
  const [drafts, setDrafts] = useState<DraftRow[] | null>(null)
  const [noteTasks, setNoteTasks] = useState<TaskRow[] | null>(null)
  const [sourceFacts, setSourceFacts] = useState<Map<string, ExtractedFactRow>>(
    new Map(),
  )
  const [followUpError, setFollowUpError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [prepareError, setPrepareError] = useState<string | null>(null)
  // Avisos de espera lenta (Fase 9): a los 10 s de espera, cada aviso
  // añade «Puede tardar hasta un minuto.»; sin reintento automático.
  const slowTranscribing = useSlowWait(transcribing)
  const slowExtracting = useSlowWait(extracting)
  const slowPreparing = useSlowWait(preparing)
  // Destinatario de la última llamada a `drafts` (undefined = los dos
  // borradores y las tareas): «Reintentar» repite esa misma llamada, sin
  // regenerar el otro borrador.
  const [retryAudience, setRetryAudience] = useState<
    DraftAudience | undefined
  >(undefined)
  const [regenerating, setRegenerating] = useState(false)
  const [showRegenConfirm, setShowRegenConfirm] =
    useState<DraftAudience | null>(null)
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [editDraftContent, setEditDraftContent] = useState('')
  const [draftEditError, setDraftEditError] = useState<string | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)
  const [copyNotice, setCopyNotice] = useState<string | null>(null)
  const [showApproveDraftConfirm, setShowApproveDraftConfirm] = useState<
    string | null
  >(null)
  const [approvingDraft, setApprovingDraft] = useState(false)
  const [showManualDraft, setShowManualDraft] =
    useState<DraftAudience | null>(null)
  const [manualDraftContent, setManualDraftContent] = useState('')
  const [manualDraftError, setManualDraftError] = useState<string | null>(null)
  const [savingManualDraft, setSavingManualDraft] = useState(false)
  const [acceptingTaskId, setAcceptingTaskId] = useState<string | null>(null)
  const [acceptDueDate, setAcceptDueDate] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editTaskDescription, setEditTaskDescription] = useState('')
  const [editTaskDueDate, setEditTaskDueDate] = useState('')
  const [taskEditError, setTaskEditError] = useState<string | null>(null)
  const [savingTask, setSavingTask] = useState(false)
  const [taskActionError, setTaskActionError] = useState<string | null>(null)
  const [showDiscardedTasks, setShowDiscardedTasks] = useState(false)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTaskDescription, setNewTaskDescription] = useState('')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const [addTaskError, setAddTaskError] = useState<string | null>(null)
  const [addingTask, setAddingTask] = useState(false)

  // Exportación (Fase 7): WhatsApp de los borradores aprobados y ficha
  // al CRM (o copiada, o por WhatsApp). Solo con la nota aprobada.
  const [exports, setExports] = useState<CrmExportRow[] | null>(null)
  const [exportContext, setExportContext] = useState<ExportContext | null>(null)
  const [exportLoadError, setExportLoadError] = useState<string | null>(null)
  const [whatsappNotice, setWhatsappNotice] = useState<{
    draftId: string
    message: string
  } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportResult, setExportResult] = useState<CrmExportResult | null>(null)
  const [exportSharedHref, setExportSharedHref] = useState<string | null>(null)
  const [showSummaryPreview, setShowSummaryPreview] = useState(false)
  const [showExportsHistory, setShowExportsHistory] = useState(false)
  const [copySummaryNotice, setCopySummaryNotice] = useState(false)
  const [copySummaryError, setCopySummaryError] = useState<string | null>(null)

  async function loadFollowUp(noteId: string) {
    try {
      const [draftRows, taskRows] = await Promise.all([
        listDrafts(noteId),
        listNoteTasks(noteId),
      ])
      setDrafts(draftRows)
      setNoteTasks(taskRows)
      const factIds = taskRows
        .map((task) => task.source_fact_id)
        .filter((factId): factId is string => factId !== null)
      const factRows = await listSourceFacts(factIds)
      setSourceFacts(new Map(factRows.map((fact) => [fact.id, fact])))
    } catch (error: unknown) {
      setFollowUpError(
        error instanceof Error
          ? error.message
          : 'No se ha podido cargar el seguimiento.',
      )
    }
  }

  async function loadExport(noteId: string) {
    try {
      const [rows, context] = await Promise.all([
        listNoteExports(noteId),
        loadExportContext(noteId),
      ])
      setExports(rows)
      setExportContext(context)
      setExportLoadError(null)
    } catch (error: unknown) {
      setExportLoadError(
        error instanceof Error
          ? error.message
          : 'No se ha podido cargar la exportación.',
      )
    }
  }

  /**
   * Muestra al momento la fila que acaba de registrar un adaptador
   * (`manual` o `whatsapp`), para que «Exportada» y el historial no
   * esperen a la recarga (revisión de la Fase 7).
   */
  function showRecordedExport(row: CrmExportRow | undefined) {
    if (row === undefined) {
      return
    }
    setExports((previous) =>
      previous === null
        ? [row]
        : [row, ...previous.filter((item) => item.id !== row.id)],
    )
  }

  async function refreshExports() {
    if (note === null) {
      return
    }
    try {
      setExports(await listNoteExports(note.id))
    } catch {
      // Se mantiene el historial anterior; el error ya se vio al exportar.
    }
  }

  useEffect(() => {
    if (!supabaseConfigured || id === undefined) {
      return
    }
    let mounted = true
    getNote(id)
      .then(async (row) => {
        if (!mounted) return
        if (row === null) {
          setNotFound(true)
          setLoading(false)
          return
        }
        setNote(row)
        const [clientRow, propertyRow] = await Promise.all([
          getClient(row.client_id),
          getProperty(row.property_id),
        ])
        if (!mounted) return
        setClient(clientRow)
        setProperty(propertyRow)
        setLoading(false)
        listFacts(row.id)
          .then((rows) => {
            if (mounted) {
              setFacts(rows)
            }
          })
          .catch((error: unknown) => {
            if (!mounted) return
            setFactsError(
              error instanceof Error
                ? error.message
                : 'No se han podido cargar los datos.',
            )
          })
        if (row.status === 'approved') {
          void loadFollowUp(row.id)
          void loadExport(row.id)
        }
      })
      .catch((error: unknown) => {
        if (!mounted) return
        setLoadError(error instanceof Error ? error.message : 'Ha ocurrido un error.')
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [id, supabaseConfigured])

  // URL firmada para el audio (solo si la nota tiene audio). Depende
  // solo de la ruta del audio: si cambia cualquier otro campo de la
  // nota (p. ej. el estado al aprobar), no se pide otra URL firmada.
  const audioPath = note?.audio_url ?? null
  useEffect(() => {
    if (audioPath === null) {
      return
    }
    let mounted = true
    getSignedAudioUrl(audioPath)
      .then((url) => {
        if (mounted) {
          setAudioUrl(url)
        }
      })
      .catch((error: unknown) => {
        if (!mounted) return
        setAudioError(
          error instanceof Error ? error.message : 'No se ha podido cargar el audio.',
        )
      })
    return () => {
      mounted = false
    }
  }, [audioPath])

  // Transcripción automática una sola vez, al abrir una nota `draft`
  // con audio (no en cada render).
  useEffect(() => {
    if (
      note === null ||
      note.status !== 'draft' ||
      note.audio_url === null ||
      transcribeStartedRef.current
    ) {
      return
    }
    transcribeStartedRef.current = true
    let mounted = true
    setTranscribing(true)
    setTranscribeError(null)
    transcribeNote(note.id)
      .then((transcript) => {
        if (!mounted) return
        setNote((previous) =>
          previous === null
            ? previous
            : { ...previous, transcript, status: 'transcribed' },
        )
        setTranscribing(false)
      })
      .catch((error: unknown) => {
        if (!mounted) return
        setTranscribeError(
          error instanceof Error
            ? error.message
            : 'No se ha podido transcribir. Inténtalo de nuevo.',
        )
        setTranscribing(false)
      })
    return () => {
      mounted = false
    }
  }, [note])

  // Al elegir un dato, desplaza el texto hasta su cita resaltada.
  useEffect(() => {
    if (selectedFactId !== null) {
      markRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [selectedFactId])

  async function handleRetryTranscription() {
    if (note === null) {
      return
    }
    setTranscribing(true)
    setTranscribeError(null)
    try {
      const transcript = await transcribeNote(note.id)
      setNote((previous) =>
        previous === null
          ? previous
          : { ...previous, transcript, status: 'transcribed' },
      )
    } catch (error: unknown) {
      setTranscribeError(
        error instanceof Error
          ? error.message
          : 'No se ha podido transcribir. Inténtalo de nuevo.',
      )
    } finally {
      setTranscribing(false)
    }
  }

  function handleStartEdit() {
    if (note === null) {
      return
    }
    setEditText(note.transcript ?? note.raw_text ?? '')
    setEditError(null)
    setEditing(true)
  }

  async function handleSaveEdit() {
    if (note === null) {
      return
    }
    const validation = validateNoteText(editText)
    if (!validation.ok) {
      setEditError(validation.error)
      return
    }
    const field = note.input_type === 'audio' ? 'transcript' : 'raw_text'
    setEditError(null)
    setSavingEdit(true)
    try {
      await updateNoteText(note.id, field, validation.value)
      setNote((previous) =>
        previous === null ? previous : { ...previous, [field]: validation.value },
      )
      setEditing(false)
    } catch (error: unknown) {
      setEditError(error instanceof Error ? error.message : 'Ha ocurrido un error.')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleExtract() {
    if (note === null) {
      return
    }
    setExtracting(true)
    setExtractError(null)
    setExtractNotice(null)
    setShowReextractConfirm(false)
    try {
      const result = await extractNote(note.id)
      if (result.discarded_no_evidence > 0) {
        setExtractNotice(
          `La IA propuso ${countText(result.discarded_no_evidence, 'dato', 'datos')} sin cita en el texto y se han descartado.`,
        )
      }
      const rows = await listFacts(note.id)
      setFacts(rows)
      setNote((previous) =>
        previous === null
          ? previous
          : {
              ...previous,
              status: 'extracted',
              extracted_at: new Date().toISOString(),
            },
      )
    } catch (error: unknown) {
      setExtractError(
        error instanceof Error
          ? error.message
          : 'No se han podido extraer los datos. Inténtalo de nuevo.',
      )
    } finally {
      setExtracting(false)
    }
  }

  async function handleReview(id: string, action: ReviewAction, value?: string) {
    if (note === null) {
      return
    }
    setFactActionError(null)
    setSavingFact(true)
    try {
      const updated = await reviewFact(id, action, value)
      setFacts((previous) =>
        previous === null
          ? previous
          : previous.map((fact) => (fact.id === id ? updated : fact)),
      )
      setNote((previous) =>
        previous !== null && previous.status === 'extracted'
          ? { ...previous, status: 'reviewed' }
          : previous,
      )
      if (action === 'editar') {
        setEditingFactId(null)
        setEditFactValue('')
        setEditFactError(null)
      }
    } catch (error: unknown) {
      setFactActionError(
        error instanceof Error ? error.message : 'No se ha podido revisar el dato.',
      )
    } finally {
      setSavingFact(false)
    }
  }

  function handleStartEditFact(fact: ExtractedFactRow) {
    setEditingFactId(fact.id)
    setEditFactValue(fact.value)
    setEditFactError(null)
    setFactActionError(null)
  }

  async function handleSaveEditFact(id: string) {
    const value = editFactValue.trim()
    if (value.length < 1 || value.length > 300) {
      setEditFactError('El valor tiene que tener entre 1 y 300 caracteres.')
      return
    }
    setEditFactError(null)
    await handleReview(id, 'editar', value)
  }

  async function handleAddFact() {
    if (note === null) {
      return
    }
    const fieldName = toFieldName(addName)
    if (fieldName === '' || fieldName.length > 40) {
      setAddError('Escribe un nombre para el dato (letras y números).')
      return
    }
    const value = addValue.trim()
    if (value.length < 1 || value.length > 300) {
      setAddError('El valor tiene que tener entre 1 y 300 caracteres.')
      return
    }
    const quote = addQuote.trim()
    if (quote !== '' && !hasEvidence(quote, displayText)) {
      setAddError('La cita tiene que estar en el texto de la nota.')
      return
    }
    setAddError(null)
    setAddingFact(true)
    try {
      const created = await addFact(note.id, {
        category: addCategory,
        field_name: fieldName,
        value,
        evidence_quote: quote === '' ? null : quote,
      })
      setFacts((previous) => [...(previous ?? []), created])
      setNote((previous) =>
        previous !== null && previous.status === 'extracted'
          ? { ...previous, status: 'reviewed' }
          : previous,
      )
      setShowAddFact(false)
      setAddName('')
      setAddValue('')
      setAddQuote('')
    } catch (error: unknown) {
      setAddError(
        error instanceof Error ? error.message : 'No se ha podido añadir el dato.',
      )
    } finally {
      setAddingFact(false)
    }
  }

  async function handleApprove() {
    if (note === null) {
      return
    }
    setApproving(true)
    setApproveError(null)
    try {
      await approveNote(note.id)
      setNote((previous) =>
        previous === null
          ? previous
          : {
              ...previous,
              status: 'approved',
              approved_at: new Date().toISOString(),
              // Al aprobar, el audio se borra (Fase 8): la base encola
              // su ruta y el navegador la vacía; el reproductor se
              // oculta de inmediato.
              audio_url: null,
            },
      )
      setAudioUrl(null)
      void flushAudioCleanup()
      setShowApproveConfirm(false)
      void loadFollowUp(note.id)
    } catch (error: unknown) {
      setApproveError(
        error instanceof Error ? error.message : 'No se ha podido aprobar la nota.',
      )
    } finally {
      setApproving(false)
    }
  }

  async function handleDeleteNote() {
    if (note === null) {
      return
    }
    setDeletingNote(true)
    setDeleteNoteError(null)
    try {
      await removeNote(note.id)
      navigate('/notas', { replace: true })
    } catch (error: unknown) {
      setDeleteNoteError(
        error instanceof Error ? error.message : 'No se ha podido borrar la nota.',
      )
      setDeletingNote(false)
      setConfirmingDeleteNote(false)
    }
  }

  // --- Seguimiento (Fase 6) ---

  async function handlePrepare(audience?: DraftAudience) {
    if (note === null) {
      return
    }
    setPreparing(true)
    setPrepareError(null)
    setRetryAudience(undefined)
    try {
      await prepareFollowUp(note.id, audience)
      await loadFollowUp(note.id)
    } catch (error: unknown) {
      if (error instanceof DraftsRulesError) {
        setPrepareError(error.message)
        // Aunque un borrador falló, el otro puede haberse guardado.
        await loadFollowUp(note.id)
      } else {
        setPrepareError(
          error instanceof Error
            ? error.message
            : 'No se ha podido preparar el seguimiento. Inténtalo de nuevo.',
        )
      }
    } finally {
      setPreparing(false)
    }
  }

  async function handleRegenerate(audience: DraftAudience) {
    if (note === null) {
      return
    }
    setRegenerating(true)
    setPrepareError(null)
    setRetryAudience(audience)
    setShowRegenConfirm(null)
    try {
      await prepareFollowUp(note.id, audience)
      await loadFollowUp(note.id)
    } catch (error: unknown) {
      if (error instanceof DraftsRulesError) {
        setPrepareError(error.message)
        await loadFollowUp(note.id)
      } else {
        setPrepareError(
          error instanceof Error
            ? error.message
            : 'No se ha podido preparar el seguimiento. Inténtalo de nuevo.',
        )
      }
    } finally {
      setRegenerating(false)
    }
  }

  function updateTaskInList(updated: TaskRow) {
    setNoteTasks((previous) =>
      previous === null
        ? previous
        : previous.map((task) => (task.id === updated.id ? updated : task)),
    )
  }

  async function handleAcceptTask(task: TaskRow) {
    setTaskActionError(null)
    setSavingTask(true)
    try {
      const updated = await acceptTask(
        task.id,
        acceptDueDate === '' ? null : acceptDueDate,
      )
      updateTaskInList(updated)
      setAcceptingTaskId(null)
      setAcceptDueDate('')
    } catch (error: unknown) {
      setTaskActionError(
        error instanceof Error ? error.message : 'No se ha podido añadir la tarea.',
      )
    } finally {
      setSavingTask(false)
    }
  }

  async function handleDiscardTask(task: TaskRow) {
    setTaskActionError(null)
    setSavingTask(true)
    try {
      updateTaskInList(await discardTask(task.id))
    } catch (error: unknown) {
      setTaskActionError(
        error instanceof Error ? error.message : 'No se ha podido descartar la tarea.',
      )
    } finally {
      setSavingTask(false)
    }
  }

  async function handleRestoreTask(task: TaskRow) {
    setTaskActionError(null)
    setSavingTask(true)
    try {
      updateTaskInList(await restoreTask(task.id))
    } catch (error: unknown) {
      setTaskActionError(
        error instanceof Error ? error.message : 'No se ha podido recuperar la tarea.',
      )
    } finally {
      setSavingTask(false)
    }
  }

  function handleStartEditTask(task: TaskRow) {
    setEditingTaskId(task.id)
    setEditTaskDescription(task.description)
    setEditTaskDueDate(task.due_date ?? '')
    setTaskEditError(null)
    setTaskActionError(null)
  }

  async function handleSaveEditTask(id: string) {
    const description = editTaskDescription.trim()
    if (description.length < 3 || description.length > 200) {
      setTaskEditError('La descripción tiene que tener entre 3 y 200 caracteres.')
      return
    }
    setTaskEditError(null)
    setSavingTask(true)
    try {
      updateTaskInList(
        await editTask(id, {
          description,
          due_date: editTaskDueDate === '' ? null : editTaskDueDate,
        }),
      )
      setEditingTaskId(null)
    } catch (error: unknown) {
      setTaskEditError(
        error instanceof Error ? error.message : 'No se ha podido editar la tarea.',
      )
    } finally {
      setSavingTask(false)
    }
  }

  async function handleAddTask() {
    if (note === null) {
      return
    }
    const description = newTaskDescription.trim()
    if (description.length < 3 || description.length > 200) {
      setAddTaskError('La descripción tiene que tener entre 3 y 200 caracteres.')
      return
    }
    setAddTaskError(null)
    setAddingTask(true)
    try {
      const created = await createTask({
        visit_note_id: note.id,
        description,
        due_date: newTaskDueDate === '' ? null : newTaskDueDate,
      })
      setNoteTasks((previous) => [...(previous ?? []), created])
      setShowAddTask(false)
      setNewTaskDescription('')
      setNewTaskDueDate('')
    } catch (error: unknown) {
      setAddTaskError(
        error instanceof Error ? error.message : 'No se ha podido añadir la tarea.',
      )
    } finally {
      setAddingTask(false)
    }
  }

  function handleStartEditDraft(draft: DraftRow) {
    setEditingDraftId(draft.id)
    setEditDraftContent(draft.content)
    setDraftEditError(null)
    setCopyNotice(null)
  }

  async function handleSaveDraft(id: string) {
    const content = editDraftContent.trim()
    if (content.length < 1 || content.length > 1500) {
      setDraftEditError('El borrador tiene que tener entre 1 y 1.500 caracteres.')
      return
    }
    setDraftEditError(null)
    setSavingDraft(true)
    try {
      const updated = await saveDraft(id, content)
      setDrafts((previous) =>
        previous === null
          ? previous
          : previous.map((draft) => (draft.id === id ? updated : draft)),
      )
      setEditingDraftId(null)
    } catch (error: unknown) {
      setDraftEditError(
        error instanceof Error ? error.message : 'No se ha podido guardar el borrador.',
      )
    } finally {
      setSavingDraft(false)
    }
  }

  async function handleCopyDraft(draft: DraftRow) {
    try {
      await navigator.clipboard.writeText(draft.content)
      setCopyNotice(draft.id)
    } catch {
      // Sin permiso de portapapeles: selecciona el texto para copiarlo a mano.
      const textarea = document.getElementById(
        `borrador-${draft.id}`,
      ) as HTMLTextAreaElement | null
      if (textarea !== null) {
        textarea.focus()
        textarea.select()
        setCopyNotice(draft.id)
        return
      }
      const textElement = document.getElementById(`borrador-texto-${draft.id}`)
      if (textElement !== null) {
        const range = document.createRange()
        range.selectNodeContents(textElement)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
        setCopyNotice(draft.id)
      }
    }
  }

  /**
   * Registra que el agente abrió WhatsApp con un borrador aprobado.
   * No bloquea la apertura: el enlace ya se está abriendo; si el
   * registro falla, aviso discreto en la tarjeta.
   */
  async function handleOpenDraftWhatsApp(draft: DraftRow) {
    if (note === null) {
      return
    }
    try {
      const row = await recordDelivery({
        noteId: note.id,
        target: 'whatsapp',
        kind: 'borrador',
        draftId: draft.id,
        audience: draft.audience,
      })
      setExports((previous) => (previous === null ? [row] : [row, ...previous]))
      setWhatsappNotice(null)
    } catch {
      setWhatsappNotice({
        draftId: draft.id,
        message: 'No se pudo registrar el envío',
      })
    }
  }

  /** Botón principal de «Exportar» según el CRM configurado. */
  async function handleExportMain() {
    if (note === null) {
      return
    }
    setExporting(true)
    setExportError(null)
    setExportResult(null)
    setExportSharedHref(null)
    setCopySummaryNotice(false)
    // WhatsApp (B-8): la ventana se abre ANTES del await, en el gesto
    // del usuario, para que el bloqueador de ventanas no la cierre.
    // Si la exportación falla o no devuelve enlace, se cierra. Sin
    // `'noopener'`: con él no habría ventana (ver `lib/popup.ts`).
    const whatsappWindow = openBlankWindow(clientConfig.crmTarget === 'whatsapp')
    try {
      const result = await exportToCrm(note.id, clientConfig.crmTarget)
      setExportResult(result)
      if (!result.ok) {
        whatsappWindow?.close()
        setExportError(result.error ?? 'No se ha podido exportar la ficha.')
        return
      }
      if (result.href !== undefined) {
        // WhatsApp: se abre el enlace devuelto por el adaptador. Si el
        // navegador lo bloquea, queda el enlace en el estado de éxito.
        setExportSharedHref(result.href)
        if (whatsappWindow !== null) {
          whatsappWindow.location.href = result.href
        } else {
          window.open(result.href, '_blank', 'noopener')
        }
      } else {
        // Sin enlace no hay nada que abrir: se cierra la ventana en blanco.
        whatsappWindow?.close()
      }
      showRecordedExport(result.row)
      await refreshExports()
    } catch (error: unknown) {
      whatsappWindow?.close()
      setExportError(
        error instanceof Error
          ? error.message
          : 'No se ha podido exportar la ficha.',
      )
    } finally {
      setExporting(false)
    }
  }

  /** Acción secundaria «Copiar ficha»: copia y registra `manual`. */
  async function handleCopySummary() {
    if (note === null) {
      return
    }
    setExporting(true)
    setCopySummaryError(null)
    setCopySummaryNotice(false)
    try {
      const result = await exportToCrm(note.id, 'manual')
      if (result.ok) {
        setCopySummaryNotice(true)
        showRecordedExport(result.row)
        await refreshExports()
      } else {
        // La ficha no se pudo copiar: se muestra para copiarla a mano.
        setCopySummaryError(
          result.error ?? 'No se ha podido copiar la ficha.',
        )
        setShowSummaryPreview(true)
      }
    } catch (error: unknown) {
      setCopySummaryError(
        error instanceof Error
          ? error.message
          : 'No se ha podido copiar la ficha.',
      )
      setShowSummaryPreview(true)
    } finally {
      setExporting(false)
    }
  }

  async function handleApproveDraft(draft: DraftRow) {
    setApprovingDraft(true)
    setDraftEditError(null)
    try {
      const updated = await approveDraft(draft.id)
      setDrafts((previous) =>
        previous === null
          ? previous
          : previous.map((item) => (item.id === draft.id ? updated : item)),
      )
      setShowApproveDraftConfirm(null)
      setEditingDraftId(null)
    } catch (error: unknown) {
      setDraftEditError(
        error instanceof Error ? error.message : 'No se ha podido aprobar el borrador.',
      )
    } finally {
      setApprovingDraft(false)
    }
  }

  async function handleManualDraft(audience: DraftAudience) {
    if (note === null) {
      return
    }
    const content = manualDraftContent.trim()
    if (content.length < 1 || content.length > 1500) {
      setManualDraftError('El borrador tiene que tener entre 1 y 1.500 caracteres.')
      return
    }
    setManualDraftError(null)
    setSavingManualDraft(true)
    try {
      const created = await createManualDraft(note.id, audience, content)
      setDrafts((previous) => [...(previous ?? []), created])
      setShowManualDraft(null)
      setManualDraftContent('')
      setPrepareError(null)
    } catch (error: unknown) {
      setManualDraftError(
        error instanceof Error ? error.message : 'No se ha podido guardar el borrador.',
      )
    } finally {
      setSavingManualDraft(false)
    }
  }

  const displayText = note?.transcript ?? note?.raw_text ?? ''
  const normalizedDisplayText = displayText.normalize('NFC')
  const canEdit =
    note !== null && (note.status === 'draft' || note.status === 'transcribed')

  const factsList = facts ?? []
  const isApproved = note?.status === 'approved'
  const proposedCount = factsList.filter(
    (fact) => fact.review_status === 'propuesto',
  ).length
  const acceptedCount = factsList.filter(
    (fact) => fact.review_status === 'aceptado',
  ).length
  const editedCount = factsList.filter(
    (fact) => fact.review_status === 'editado',
  ).length
  const discardedFacts = factsList.filter(
    (fact) => fact.review_status === 'descartado',
  )
  const addedCount = factsList.filter((fact) => fact.origin === 'agente').length
  // «Añadir dato» solo tras la extracción: una nota `transcribed` con un
  // dato añadido a mano se podría aprobar sin pasar por la extracción, y
  // la base (migración 0008) no deja aprobar desde `transcribed`.
  const canAddFact =
    note?.status === 'extracted' || note?.status === 'reviewed'
  const canReextract =
    note?.status === 'extracted' &&
    facts !== null &&
    factsList.every((fact) => fact.review_status === 'propuesto')
  const canApprove =
    !isApproved &&
    factsList.length > 0 &&
    proposedCount === 0 &&
    factsList.some((fact) => fact.review_status !== 'descartado')

  // Seguimiento (Fase 6): solo hay borradores y tareas en notas aprobadas.
  const tasksList = noteTasks ?? []
  const proposedTasks = tasksList.filter((task) => task.status === 'propuesta')
  const acceptedTasks = tasksList.filter(
    (task) => task.status === 'pendiente' || task.status === 'completada',
  )
  const discardedTasks = tasksList.filter(
    (task) => task.status === 'descartada',
  )
  const manualTasks = tasksList.filter((task) => task.origin === 'agente')
  const draftsList = drafts ?? []
  const buyerDraft =
    draftsList.find((draft) => draft.audience === 'comprador') ?? null
  const ownerDraft =
    draftsList.find((draft) => draft.audience === 'propietario') ?? null
  const editedDrafts = draftsList.filter(
    (draft) => draft.original_content !== null,
  )
  const approvedDrafts = draftsList.filter(
    (draft) => draft.status === 'aprobado',
  )
  const hasFollowUp = draftsList.length > 0 || tasksList.length > 0

  // Exportación (Fase 7): el historial llega en orden descendente,
  // así que `find` da la última fila de cada tipo.
  const exportsList = exports ?? []
  const noteExported = exportsList.some(
    (row) =>
      row.kind === 'nota' &&
      (row.status === 'enviado' || row.status === 'entregado'),
  )
  const lastWhatsappByAudience = (audience: DraftAudience) =>
    exportsList.find(
      (row) =>
        row.target === 'whatsapp' &&
        row.kind === 'borrador' &&
        row.audience === audience,
    )
  const buyerWhatsappOpened =
    lastWhatsappByAudience('comprador') !== undefined
  const ownerWhatsappOpened =
    lastWhatsappByAudience('propietario') !== undefined
  const latestExportRow =
    exportResult?.exportId !== undefined
      ? exportsList.find((row) => row.id === exportResult.exportId)
      : undefined

  const selectedFact =
    factsList.find((fact) => fact.id === selectedFactId) ?? null
  const highlightRange =
    selectedFact?.evidence_quote !== null &&
    selectedFact?.evidence_quote !== undefined
      ? findEvidenceRange(normalizedDisplayText, selectedFact.evidence_quote)
      : null

  function renderFactCard(fact: ExtractedFactRow) {
    const selected = fact.id === selectedFactId
    const hasQuote =
      fact.evidence_quote !== null &&
      fact.evidence_quote !== '' &&
      findEvidenceRange(normalizedDisplayText, fact.evidence_quote) !== null
    const confidence = confidenceText(fact.confidence)
    return (
      <article
        key={fact.id}
        className={`rounded-md border px-4 py-3 ${
          selected ? 'border-accent' : 'border-border'
        }`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-semibold">{fieldLabel(fact.field_name)}</h4>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">
              {REVIEW_STATUS_LABELS[fact.review_status]}
            </Badge>
            <Badge variant="neutral">
              {fact.origin === 'ia' ? 'IA' : 'Añadido por ti'}
            </Badge>
          </div>
        </div>
        <p className="mt-2 break-words text-base">{fact.value}</p>
        {fact.evidence_quote !== null && fact.evidence_quote !== '' && (
          <p className="mt-1 break-words text-sm text-text-secondary">
            «{fact.evidence_quote}»
          </p>
        )}
        {confidence !== null && (
          <p className="mt-1 text-sm text-text-secondary">{confidence}</p>
        )}
        {fact.original_value !== null && fact.original_value !== fact.value && (
          <p className="mt-1 break-words text-sm text-text-secondary">
            Valor de la IA: {fact.original_value}
          </p>
        )}
        {editingFactId === fact.id ? (
          <div className="mt-3">
            <Label htmlFor={`dato-editar-${fact.id}`}>Valor</Label>
            <textarea
              id={`dato-editar-${fact.id}`}
              value={editFactValue}
              onChange={(event) => {
                setEditFactValue(event.target.value)
                setEditFactError(null)
              }}
              rows={3}
              maxLength={300}
              className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 py-2 text-base text-text-primary placeholder:text-text-secondary focus-visible:outline-2 focus-visible:outline-info"
            />
            <p className="mt-1 text-right font-mono text-xs text-text-secondary">
              {editFactValue.length} / 300
            </p>
            {editFactError !== null && (
              <p className="mt-1 text-sm text-error">{editFactError}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={() => void handleSaveEditFact(fact.id)}
                disabled={savingFact}
              >
                {savingFact ? 'Guardando…' : 'Guardar'}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  setEditingFactId(null)
                  setEditFactError(null)
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {hasQuote && (
              <Button
                variant="secondary"
                size="lg"
                onClick={() =>
                  setSelectedFactId(selected ? null : fact.id)
                }
              >
                {selected ? 'Quitar resaltado' : 'Ver cita'}
              </Button>
            )}
            {!isApproved && fact.review_status !== 'descartado' && (
              <>
                {fact.review_status === 'propuesto' && (
                  <Button
                    size="lg"
                    onClick={() => void handleReview(fact.id, 'aceptar')}
                    disabled={savingFact}
                  >
                    Aceptar
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => handleStartEditFact(fact)}
                  disabled={savingFact}
                >
                  Editar
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => void handleReview(fact.id, 'descartar')}
                  disabled={savingFact}
                >
                  Descartar
                </Button>
              </>
            )}
            {!isApproved && fact.review_status === 'descartado' && (
              <Button
                size="lg"
                onClick={() => void handleReview(fact.id, 'recuperar')}
                disabled={savingFact}
              >
                Recuperar
              </Button>
            )}
          </div>
        )}
      </article>
    )
  }

  function renderDraftCard(audience: DraftAudience, draft: DraftRow | null) {
    const title =
      audience === 'comprador' ? 'Para el comprador' : 'Para el propietario'
    const isOwner = audience === 'propietario'
    const isEditing = draft !== null && editingDraftId === draft.id
    const showApproveConfirm = draft !== null && showApproveDraftConfirm === draft.id
    const showRegen = showRegenConfirm === audience

    // Sin borrador para este destinatario (p. ej. no pasó los controles
    // y se respondió 422): se puede generar solo ese o escribirlo a mano
    // («Escribir yo»). No depende de un estado en memoria: tras recargar
    // la página sigue disponible.
    if (draft === null) {
      return (
        <article
          key={audience}
          className="rounded-md border border-border px-4 py-3"
        >
          <h4 className="font-semibold">{title}</h4>
          {isOwner && (
            <p className="mt-1 text-sm text-text-secondary">
              Sin presupuesto ni datos económicos del comprador
            </p>
          )}
          {showManualDraft === audience ? (
            <div className="mt-3">
              <Label htmlFor={`borrador-manual-${audience}`}>Borrador</Label>
              <textarea
                id={`borrador-manual-${audience}`}
                value={manualDraftContent}
                onChange={(event) => {
                  setManualDraftContent(event.target.value)
                  setManualDraftError(null)
                }}
                rows={6}
                maxLength={1500}
                className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 py-2 text-base text-text-primary placeholder:text-text-secondary focus-visible:outline-2 focus-visible:outline-info"
              />
              <p className="mt-1 text-right font-mono text-xs text-text-secondary">
                {manualDraftContent.length} / 1.500
              </p>
              {manualDraftError !== null && (
                <p className="mt-1 text-sm text-error">{manualDraftError}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  onClick={() => void handleManualDraft(audience)}
                  disabled={savingManualDraft}
                >
                  {savingManualDraft ? 'Guardando…' : 'Guardar borrador'}
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => {
                    setShowManualDraft(null)
                    setManualDraftError(null)
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-text-secondary">
                Todavía no hay borrador para este destinatario.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  onClick={() => void handleRegenerate(audience)}
                  disabled={regenerating || preparing}
                >
                  {regenerating ? 'Generando…' : 'Generar borrador'}
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => {
                    setShowManualDraft(audience)
                    setManualDraftContent('')
                    setManualDraftError(null)
                  }}
                >
                  Escribir yo
                </Button>
              </div>
            </>
          )}
        </article>
      )
    }

    const isApproved = draft.status === 'aprobado'
    // WhatsApp (Fase 7): solo con el borrador aprobado. Comprador →
    // teléfono del cliente; propietario → teléfono del propietario.
    // Sin teléfono válido no hay enlace: botón desactivado y enlace a
    // la ficha para añadirlo.
    const draftPhone =
      audience === 'comprador'
        ? (client?.phone ?? null)
        : (property?.owner_phone ?? null)
    const draftWhatsappHref = isApproved
      ? whatsappHref(draftPhone, draft.content)
      : null
    const lastWhatsapp = isApproved
      ? lastWhatsappByAudience(audience)
      : undefined
    return (
      <article
        key={draft.id}
        className="rounded-md border border-border px-4 py-3"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-semibold">{title}</h4>
          <div className="flex flex-wrap gap-2">
            {draft.original_content !== null && (
              <Badge variant="neutral">Editado por ti</Badge>
            )}
            {isApproved && <Badge variant="neutral">Aprobado</Badge>}
          </div>
        </div>
        {isOwner && (
          <p className="mt-1 text-sm text-text-secondary">
            Sin presupuesto ni datos económicos del comprador
          </p>
        )}
        {isApproved ? (
          <p
            id={`borrador-texto-${draft.id}`}
            className="mt-2 whitespace-pre-wrap break-words text-base"
          >
            {draft.content}
          </p>
        ) : isEditing ? (
          <div className="mt-3">
            <Label htmlFor={`borrador-${draft.id}`}>Borrador</Label>
            <textarea
              id={`borrador-${draft.id}`}
              value={editDraftContent}
              onChange={(event) => {
                setEditDraftContent(event.target.value)
                setDraftEditError(null)
              }}
              rows={6}
              maxLength={1500}
              className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 py-2 text-base text-text-primary placeholder:text-text-secondary focus-visible:outline-2 focus-visible:outline-info"
            />
            <p className="mt-1 text-right font-mono text-xs text-text-secondary">
              {editDraftContent.length} / 1.500
            </p>
            {draftEditError !== null && (
              <p className="mt-1 text-sm text-error">{draftEditError}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={() => void handleSaveDraft(draft.id)}
                disabled={savingDraft}
              >
                {savingDraft ? 'Guardando…' : 'Guardar cambios'}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  setEditingDraftId(null)
                  setDraftEditError(null)
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-2 whitespace-pre-wrap break-words text-base">
              {draft.content}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => handleStartEditDraft(draft)}
              >
                Editar
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => void handleCopyDraft(draft)}
              >
                Copiar
              </Button>
              {copyNotice === draft.id && (
                <span className="self-center text-sm text-text-secondary">
                  Copiado
                </span>
              )}
            </div>
          </>
        )}
        {isApproved && draft.approved_at !== null && (
          <p className="mt-2 text-sm text-text-secondary">
            Aprobado el {noteDateFormatter.format(new Date(draft.approved_at))}
          </p>
        )}
        {isApproved && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => void handleCopyDraft(draft)}
            >
              Copiar
            </Button>
            {copyNotice === draft.id && (
              <span className="self-center text-sm text-text-secondary">
                Copiado
              </span>
            )}
            {draftWhatsappHref !== null ? (
              <Button asChild variant="secondary" size="lg">
                <a
                  href={draftWhatsappHref}
                  target="_blank"
                  rel="noopener"
                  onClick={() => void handleOpenDraftWhatsApp(draft)}
                >
                  Abrir en WhatsApp
                </a>
              </Button>
            ) : (
              <>
                <Button variant="secondary" size="lg" disabled>
                  Falta el teléfono
                </Button>
                {audience === 'comprador' && client !== null && (
                  <Link
                    to={`/clientes/${client.id}`}
                    className="self-center text-sm font-semibold underline"
                  >
                    Añadir teléfono en la ficha del cliente
                  </Link>
                )}
                {audience === 'propietario' && property !== null && (
                  <Link
                    to={`/inmuebles/${property.id}`}
                    className="self-center text-sm font-semibold underline"
                  >
                    Añadir teléfono en la ficha del inmueble
                  </Link>
                )}
              </>
            )}
          </div>
        )}
        {isApproved && lastWhatsapp !== undefined && (
          <p className="mt-2 text-sm text-text-secondary">
            Abierto en WhatsApp el{' '}
            {noteDateFormatter.format(new Date(lastWhatsapp.created_at))}
          </p>
        )}
        {isApproved && (
          <p className="mt-2 text-sm text-text-secondary">
            Revisa y pulsa Enviar en WhatsApp: la app no lo envía por ti.
          </p>
        )}
        {whatsappNotice?.draftId === draft.id && (
          <p className="mt-2 text-sm text-error">{whatsappNotice.message}</p>
        )}
        {!isApproved && (
          <div className="mt-4 flex flex-wrap gap-2">
            {!showApproveConfirm && (
              <Button
                size="lg"
                onClick={() => setShowApproveDraftConfirm(draft.id)}
              >
                Aprobar borrador
              </Button>
            )}
            {showApproveConfirm && (
              <div className="rounded-md border border-border bg-bg px-4 py-4">
                <p className="font-semibold">
                  Una vez aprobado no se podrá cambiar.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    size="lg"
                    onClick={() => void handleApproveDraft(draft)}
                    disabled={approvingDraft}
                  >
                    {approvingDraft ? 'Aprobando…' : 'Aprobar'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => setShowApproveDraftConfirm(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
            {!showRegen && (
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setShowRegenConfirm(audience)}
                disabled={regenerating}
              >
                Volver a generar
              </Button>
            )}
            {showRegen && (
              <div className="rounded-md border border-border bg-bg px-4 py-4">
                <p className="font-semibold">Se sustituirá el texto actual.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    size="lg"
                    onClick={() => void handleRegenerate(audience)}
                    disabled={regenerating}
                  >
                    {regenerating ? 'Generando…' : 'Volver a generar'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => setShowRegenConfirm(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        {draftEditError !== null && !isEditing && (
          <p className="mt-3 text-sm text-error">{draftEditError}</p>
        )}
      </article>
    )
  }

  function renderProposedTaskCard(task: TaskRow) {
    const sourceFact =
      task.source_fact_id !== null
        ? (sourceFacts.get(task.source_fact_id) ?? null)
        : null
    const isEditing = editingTaskId === task.id
    const isAccepting = acceptingTaskId === task.id
    return (
      <article
        key={task.id}
        className="rounded-md border border-border px-4 py-3"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-semibold">{task.description}</h4>
          <Badge variant="neutral">
            {task.origin === 'regla' ? 'Regla' : 'IA'}
          </Badge>
        </div>
        {sourceFact !== null && (
          <p className="mt-1 break-words text-sm text-text-secondary">
            {fieldLabel(sourceFact.field_name)}: «
            {sourceFact.evidence_quote ?? sourceFact.value}»
          </p>
        )}
        {task.original_description !== null && (
          <p className="mt-1 break-words text-sm text-text-secondary">
            Propuesta de la IA: {task.original_description}
          </p>
        )}
        {isEditing ? (
          <div className="mt-3 space-y-3">
            <div className="space-y-2">
              <Label htmlFor={`tarea-editar-${task.id}`}>Descripción</Label>
              <Input
                id={`tarea-editar-${task.id}`}
                className="min-h-11"
                value={editTaskDescription}
                onChange={(event) => {
                  setEditTaskDescription(event.target.value)
                  setTaskEditError(null)
                }}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`tarea-fecha-${task.id}`}>
                Fecha (opcional)
              </Label>
              <Input
                id={`tarea-fecha-${task.id}`}
                type="date"
                className="min-h-11"
                value={editTaskDueDate}
                onChange={(event) => setEditTaskDueDate(event.target.value)}
              />
            </div>
            {taskEditError !== null && (
              <p className="text-sm text-error">{taskEditError}</p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={() => void handleSaveEditTask(task.id)}
                disabled={savingTask}
              >
                {savingTask ? 'Guardando…' : 'Guardar'}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  setEditingTaskId(null)
                  setTaskEditError(null)
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : isAccepting ? (
          <div className="mt-3 space-y-3">
            <div className="space-y-2">
              <Label htmlFor={`tarea-aceptar-${task.id}`}>
                Fecha (opcional)
              </Label>
              <Input
                id={`tarea-aceptar-${task.id}`}
                type="date"
                className="min-h-11"
                value={acceptDueDate}
                onChange={(event) => setAcceptDueDate(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={() => void handleAcceptTask(task)}
                disabled={savingTask}
              >
                {savingTask ? 'Añadiendo…' : 'Añadir a pendientes'}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  setAcceptingTaskId(null)
                  setAcceptDueDate('')
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="lg"
              onClick={() => {
                setAcceptingTaskId(task.id)
                setAcceptDueDate('')
                setTaskActionError(null)
              }}
              disabled={savingTask}
            >
              Añadir a pendientes
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => handleStartEditTask(task)}
              disabled={savingTask}
            >
              Editar
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => void handleDiscardTask(task)}
              disabled={savingTask}
            >
              Descartar
            </Button>
          </div>
        )}
      </article>
    )
  }

  return (
    <>
      <PrivateNav />
      <main className="mx-auto max-w-4xl bg-bg px-4 py-8 text-text-primary">
        <p className="font-mono text-xs text-text-secondary">{APP_PHASE_LABEL}</p>

        {!supabaseConfigured && (
          <div className="mt-6">
            <SupabaseMissingNotice />
          </div>
        )}

        {loading && <p className="mt-6 text-sm text-text-secondary">Cargando…</p>}
        {loadError !== null && <p className="mt-6 text-sm text-error">{loadError}</p>}

        {!loading && loadError === null && notFound && (
          <div className="mt-6">
            <h1 className="text-2xl">No encontrado</h1>
            <p className="mt-2 text-sm text-text-secondary">
              Esta nota no existe o no tienes permiso para verla.
            </p>
            <Button asChild size="lg" className="mt-6">
              <Link to="/capturar">Nueva captura</Link>
            </Button>
          </div>
        )}

        {!loading && loadError === null && !notFound && note !== null && (
          <>
            <h1 className="mt-2 text-2xl">Nota de visita</h1>
            <div className="mt-3 space-y-1 text-sm">
              {client !== null && (
                <p>
                  Cliente:{' '}
                  <Link
                    to={`/clientes/${client.id}`}
                    className="font-semibold underline"
                  >
                    {client.full_name}
                  </Link>{' '}
                  {client.is_temporary && <Badge variant="neutral">Provisional</Badge>}
                  {client.phone !== null && client.phone !== '' && (
                    <span className="text-text-secondary">
                      {' '}
                      · {formatPhone(client.phone)}
                    </span>
                  )}
                </p>
              )}
              {property !== null && (
                <p>
                  Inmueble:{' '}
                  <Link
                    to={`/inmuebles/${property.id}`}
                    className="font-semibold break-words underline"
                  >
                    <span className="font-mono">{property.reference}</span> ·{' '}
                    {property.address}
                  </Link>
                </p>
              )}
              <p className="text-text-secondary">
                {noteDateFormatter.format(new Date(note.created_at))}
              </p>
              <p>
                Estado:{' '}
                <span className="font-semibold">
                  {NOTE_STATUS_LABELS[note.status]}
                </span>
              </p>
              {isApproved && note.approved_at !== null && (
                <p className="text-text-secondary">
                  Aprobada el{' '}
                  {noteDateFormatter.format(new Date(note.approved_at))}
                </p>
              )}
            </div>

            {note.audio_url !== null && (
              <section className="mt-8" aria-labelledby="nota-audio">
                <h2 id="nota-audio" className="text-lg font-semibold">
                  Audio
                </h2>
                {audioUrl !== null && (
                  <audio controls src={audioUrl} className="mt-3 w-full" />
                )}
                {audioError !== null && (
                  <p className="mt-3 text-sm text-error">{audioError}</p>
                )}
                {transcribing && (
                  <p className="mt-3 text-sm text-text-secondary">
                    Transcribiendo…
                    {slowTranscribing ? ' Puede tardar hasta un minuto.' : ''}
                  </p>
                )}
                {transcribeError !== null && (
                  <div className="mt-3">
                    <p className="text-sm text-error">{transcribeError}</p>
                    <Button
                      variant="secondary"
                      size="lg"
                      className="mt-3"
                      onClick={() => void handleRetryTranscription()}
                      disabled={transcribing}
                    >
                      Reintentar transcripción
                    </Button>
                  </div>
                )}
              </section>
            )}

            <section className="mt-8" aria-labelledby="nota-texto">
              <h2 id="nota-texto" className="text-lg font-semibold">
                {note.input_type === 'audio' ? 'Transcripción' : 'Nota'}
              </h2>
              {!editing && (
                <>
                  <p className="mt-3 whitespace-pre-wrap break-words text-base">
                    {highlightRange === null ? (
                      normalizedDisplayText
                    ) : (
                      <>
                        {normalizedDisplayText.slice(0, highlightRange.start)}
                        <mark ref={markRef} className="bg-surface underline">
                          {normalizedDisplayText.slice(
                            highlightRange.start,
                            highlightRange.end,
                          )}
                        </mark>
                        {normalizedDisplayText.slice(highlightRange.end)}
                      </>
                    )}
                  </p>
                  {canEdit && (
                    <Button
                      variant="secondary"
                      size="lg"
                      className="mt-4"
                      onClick={handleStartEdit}
                    >
                      Corregir
                    </Button>
                  )}
                </>
              )}
              {editing && (
                <div className="mt-3">
                  <Label htmlFor="nota-correccion">Corrige el texto</Label>
                  <textarea
                    id="nota-correccion"
                    value={editText}
                    onChange={(event) => {
                      setEditText(event.target.value)
                      setEditError(null)
                    }}
                    rows={6}
                    maxLength={5000}
                    className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 py-2 text-base text-text-primary placeholder:text-text-secondary focus-visible:outline-2 focus-visible:outline-info"
                  />
                  <p className="mt-1 text-right font-mono text-xs text-text-secondary">
                    {editText.length} / 5.000
                  </p>
                  {editError !== null && (
                    <p className="mt-1 text-sm text-error">{editError}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Button
                      size="lg"
                      onClick={() => void handleSaveEdit()}
                      disabled={savingEdit}
                    >
                      {savingEdit ? 'Guardando…' : 'Guardar corrección'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() => setEditing(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </section>

            {note.status !== 'draft' && (
              <section className="mt-8" aria-labelledby="nota-datos">
                <h2 id="nota-datos" className="text-lg font-semibold">
                  Datos extraídos
                </h2>

                {note.status === 'transcribed' && (
                  <div className="mt-3">
                    <Button
                      size="lg"
                      onClick={() => void handleExtract()}
                      disabled={extracting}
                    >
                      {extracting ? 'Extrayendo…' : 'Extraer datos'}
                    </Button>
                    {extracting && slowExtracting && (
                      <p className="mt-3 text-sm text-text-secondary">
                        Puede tardar hasta un minuto.
                      </p>
                    )}
                    {extractError !== null && (
                      <p className="mt-3 text-sm text-error">{extractError}</p>
                    )}
                  </div>
                )}

                {extractNotice !== null && (
                  <p className="mt-3 text-sm text-text-secondary">
                    {extractNotice}
                  </p>
                )}
                {factsError !== null && (
                  <p className="mt-3 text-sm text-error">{factsError}</p>
                )}
                {factActionError !== null && (
                  <p className="mt-3 text-sm text-error">{factActionError}</p>
                )}

                {facts !== null && factsList.length > 0 && (
                  <p className="mt-4 text-sm text-text-secondary">
                    IA: {countText(proposedCount, 'propuesto', 'propuestos')} ·{' '}
                    {countText(acceptedCount, 'aceptado', 'aceptados')} ·{' '}
                    {countText(editedCount, 'editado', 'editados')} ·{' '}
                    {countText(discardedFacts.length, 'descartado', 'descartados')}{' '}
                    · {countText(addedCount, 'añadido por ti', 'añadidos por ti')}
                  </p>
                )}

                {facts !== null &&
                  factsList.length === 0 &&
                  note.status !== 'transcribed' && (
                    <p className="mt-3 text-sm text-text-secondary">
                      No se extrajo ningún dato de esta nota.
                    </p>
                  )}

                {facts !== null &&
                  CATEGORY_ORDER.map((category) => {
                    const group = factsList.filter(
                      (fact) =>
                        fact.category === category &&
                        fact.review_status !== 'descartado',
                    )
                    if (group.length === 0) {
                      return null
                    }
                    return (
                      <div key={category} className="mt-6">
                        <h3 className="text-base font-semibold">
                          {CATEGORY_TITLES[category]}
                        </h3>
                        <div className="mt-3 space-y-3">
                          {group.map((fact) => renderFactCard(fact))}
                        </div>
                      </div>
                    )
                  })}

                {facts !== null && discardedFacts.length > 0 && (
                  <div className="mt-6">
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() => setShowDiscarded((value) => !value)}
                      aria-expanded={showDiscarded}
                    >
                      Descartados ({discardedFacts.length})
                    </Button>
                    {showDiscarded && (
                      <div className="mt-3 space-y-3">
                        {discardedFacts.map((fact) => renderFactCard(fact))}
                      </div>
                    )}
                  </div>
                )}

                {canAddFact && (
                  <div className="mt-6">
                    {!showAddFact && (
                      <Button
                        variant="secondary"
                        size="lg"
                        onClick={() => {
                          setShowAddFact(true)
                          setAddError(null)
                        }}
                      >
                        Añadir dato
                      </Button>
                    )}
                    {showAddFact && (
                      <div className="mt-3 space-y-5 rounded-md border border-border px-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="dato-categoria">Categoría</Label>
                          <select
                            id="dato-categoria"
                            value={addCategory}
                            onChange={(event) =>
                              setAddCategory(event.target.value as FactCategory)
                            }
                            className="flex min-h-11 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
                          >
                            {CATEGORY_ORDER.map((category) => (
                              <option key={category} value={category}>
                                {CATEGORY_TITLES[category]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dato-nombre">Nombre del dato</Label>
                          <Input
                            id="dato-nombre"
                            className="min-h-11"
                            value={addName}
                            onChange={(event) => {
                              setAddName(event.target.value)
                              setAddError(null)
                            }}
                            autoComplete="off"
                            placeholder="segunda_visita"
                          />
                          <p className="text-xs text-text-secondary">
                            Se convierte a minúsculas y guiones bajos.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dato-valor">Valor</Label>
                          <Input
                            id="dato-valor"
                            className="min-h-11"
                            value={addValue}
                            onChange={(event) => {
                              setAddValue(event.target.value)
                              setAddError(null)
                            }}
                            autoComplete="off"
                            maxLength={300}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dato-cita">Cita (opcional)</Label>
                          <Input
                            id="dato-cita"
                            className="min-h-11"
                            value={addQuote}
                            onChange={(event) => {
                              setAddQuote(event.target.value)
                              setAddError(null)
                            }}
                            autoComplete="off"
                            placeholder="Fragmento literal de la nota"
                          />
                        </div>
                        {addError !== null && (
                          <p className="text-sm text-error">{addError}</p>
                        )}
                        <div className="flex flex-wrap gap-3">
                          <Button
                            size="lg"
                            onClick={() => void handleAddFact()}
                            disabled={addingFact}
                          >
                            {addingFact ? 'Añadiendo…' : 'Añadir dato'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="lg"
                            onClick={() => {
                              setShowAddFact(false)
                              setAddError(null)
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {canReextract && (
                  <div className="mt-6">
                    {!showReextractConfirm && (
                      <Button
                        variant="secondary"
                        size="lg"
                        onClick={() => setShowReextractConfirm(true)}
                        disabled={extracting}
                      >
                        Volver a extraer
                      </Button>
                    )}
                    {showReextractConfirm && (
                      <div className="mt-3 rounded-md border border-border bg-bg px-4 py-4">
                        <p className="font-semibold">
                          Se sustituirán los datos propuestos por la IA.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <Button
                            size="lg"
                            onClick={() => void handleExtract()}
                            disabled={extracting}
                          >
                            {extracting ? 'Extrayendo…' : 'Volver a extraer'}
                          </Button>
                          {extracting && slowExtracting && (
                            <p className="mt-3 text-sm text-text-secondary">
                              Puede tardar hasta un minuto.
                            </p>
                          )}
                          <Button
                            variant="secondary"
                            size="lg"
                            onClick={() => setShowReextractConfirm(false)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                    {extractError !== null && (
                      <p className="mt-3 text-sm text-error">{extractError}</p>
                    )}
                  </div>
                )}

                {!isApproved && factsList.length > 0 && (
                  <div className="mt-6">
                    {canApprove ? (
                      <>
                        {!showApproveConfirm && (
                          <Button
                            size="lg"
                            onClick={() => setShowApproveConfirm(true)}
                          >
                            Aprobar nota
                          </Button>
                        )}
                        {showApproveConfirm && (
                          <div className="mt-3 rounded-md border border-border bg-bg px-4 py-4">
                            <p className="font-semibold">
                              Una vez aprobada, la nota y sus datos no se
                              podrán cambiar.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-3">
                              <Button
                                size="lg"
                                onClick={() => void handleApprove()}
                                disabled={approving}
                              >
                                {approving ? 'Aprobando…' : 'Aprobar'}
                              </Button>
                              <Button
                                variant="secondary"
                                size="lg"
                                onClick={() => setShowApproveConfirm(false)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-text-secondary">
                        {proposedCount > 0
                          ? 'Revisa todos los datos propuestos antes de aprobar.'
                          : 'Añade al menos un dato para aprobar la nota.'}
                      </p>
                    )}
                    {approveError !== null && (
                      <p className="mt-3 text-sm text-error">{approveError}</p>
                    )}
                  </div>
                )}
              </section>
            )}

            {isApproved && (
              <section className="mt-8" aria-labelledby="nota-seguimiento">
                <h2 id="nota-seguimiento" className="text-lg font-semibold">
                  Seguimiento
                </h2>

                {followUpError !== null && (
                  <p className="mt-3 text-sm text-error">{followUpError}</p>
                )}

                {!hasFollowUp && (
                  <div className="mt-3">
                    <Button
                      size="lg"
                      onClick={() => void handlePrepare()}
                      disabled={preparing}
                    >
                      {preparing ? 'Preparando…' : 'Preparar seguimiento'}
                    </Button>
                    {preparing && (
                      <p className="mt-3 text-sm text-text-secondary">
                        Preparando borradores y tareas…
                        {slowPreparing ? ' Puede tardar hasta un minuto.' : ''}
                      </p>
                    )}
                    {prepareError !== null && (
                      <div className="mt-3">
                        <p className="text-sm text-error">{prepareError}</p>
                        <Button
                          variant="secondary"
                          size="lg"
                          className="mt-3"
                          onClick={() => void handlePrepare()}
                          disabled={preparing}
                        >
                          Reintentar
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {hasFollowUp && (
                  <>
                    {prepareError !== null && (
                      <div className="mt-3">
                        <p className="text-sm text-error">{prepareError}</p>
                        <Button
                          variant="secondary"
                          size="lg"
                          className="mt-3"
                          onClick={() =>
                            void (retryAudience === undefined
                              ? handlePrepare()
                              : handleRegenerate(retryAudience))
                          }
                          disabled={preparing || regenerating}
                        >
                          Reintentar
                        </Button>
                      </div>
                    )}

                    {proposedTasks.length > 0 && (
                      <div className="mt-6">
                        <h3 className="text-base font-semibold">
                          Tareas propuestas
                        </h3>
                        <div className="mt-3 space-y-3">
                          {proposedTasks.map((task) =>
                            renderProposedTaskCard(task),
                          )}
                        </div>
                      </div>
                    )}
                    {taskActionError !== null && (
                      <p className="mt-3 text-sm text-error">
                        {taskActionError}
                      </p>
                    )}

                    {discardedTasks.length > 0 && (
                      <div className="mt-6">
                        <Button
                          variant="secondary"
                          size="lg"
                          onClick={() =>
                            setShowDiscardedTasks((value) => !value)
                          }
                          aria-expanded={showDiscardedTasks}
                        >
                          Descartadas ({discardedTasks.length})
                        </Button>
                        {showDiscardedTasks && (
                          <div className="mt-3 space-y-3">
                            {discardedTasks.map((task) => (
                              <article
                                key={task.id}
                                className="rounded-md border border-border px-4 py-3"
                              >
                                <p className="font-semibold">
                                  {task.description}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {task.origin !== 'agente' && (
                                    <Button
                                      size="lg"
                                      onClick={() =>
                                        void handleRestoreTask(task)
                                      }
                                      disabled={savingTask}
                                    >
                                      Recuperar
                                    </Button>
                                  )}
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-6">
                      {!showAddTask && (
                        <Button
                          variant="secondary"
                          size="lg"
                          onClick={() => {
                            setShowAddTask(true)
                            setAddTaskError(null)
                          }}
                        >
                          Añadir tarea
                        </Button>
                      )}
                      {showAddTask && (
                        <div className="mt-3 space-y-3 rounded-md border border-border px-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="tarea-nueva">Descripción</Label>
                            <Input
                              id="tarea-nueva"
                              className="min-h-11"
                              value={newTaskDescription}
                              onChange={(event) => {
                                setNewTaskDescription(event.target.value)
                                setAddTaskError(null)
                              }}
                              autoComplete="off"
                              maxLength={200}
                              placeholder="Llamar al cliente para confirmar"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="tarea-nueva-fecha">
                              Fecha (opcional)
                            </Label>
                            <Input
                              id="tarea-nueva-fecha"
                              type="date"
                              className="min-h-11"
                              value={newTaskDueDate}
                              onChange={(event) =>
                                setNewTaskDueDate(event.target.value)
                              }
                            />
                          </div>
                          {addTaskError !== null && (
                            <p className="text-sm text-error">{addTaskError}</p>
                          )}
                          <div className="flex flex-wrap gap-3">
                            <Button
                              size="lg"
                              onClick={() => void handleAddTask()}
                              disabled={addingTask}
                            >
                              {addingTask ? 'Añadiendo…' : 'Añadir tarea'}
                            </Button>
                            <Button
                              variant="secondary"
                              size="lg"
                              onClick={() => {
                                setShowAddTask(false)
                                setAddTaskError(null)
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 space-y-3">
                      {renderDraftCard('comprador', buyerDraft)}
                      {renderDraftCard('propietario', ownerDraft)}
                    </div>

                    <p className="mt-6 text-sm text-text-secondary">
                      Tareas: {countText(proposedTasks.length, 'propuesta', 'propuestas')} ·{' '}
                      {countText(acceptedTasks.length, 'aceptada', 'aceptadas')} ·{' '}
                      {countText(discardedTasks.length, 'descartada', 'descartadas')} ·{' '}
                      {countText(manualTasks.length, 'añadida por ti', 'añadidas por ti')}
                      {' · '}Borradores: {countText(editedDrafts.length, 'editado', 'editados')} ·{' '}
                      {countText(approvedDrafts.length, 'aprobado', 'aprobados')}
                    </p>
                    <p className="mt-2 text-sm text-text-secondary">
                      Exportada: {noteExported ? 'sí' : 'no'} · WhatsApp
                      abierto: comprador {buyerWhatsappOpened ? 'sí' : 'no'},
                      propietario {ownerWhatsappOpened ? 'sí' : 'no'}
                    </p>
                    {acceptedTasks.length > 0 && (
                      <p className="mt-2 text-sm">
                        <Link to="/pendientes" className="font-semibold underline">
                          Ver en Pendientes
                        </Link>
                      </p>
                    )}
                  </>
                )}
              </section>
            )}

            {isApproved && (
              <section className="mt-8" aria-labelledby="nota-exportar">
                <h2 id="nota-exportar" className="text-lg font-semibold">
                  Exportar
                </h2>

                {exportLoadError !== null && (
                  <p className="mt-3 text-sm text-error">{exportLoadError}</p>
                )}

                {exportContext !== null && (
                  <>
                    <div className="mt-3">
                      <Button
                        variant="secondary"
                        size="lg"
                        onClick={() =>
                          setShowSummaryPreview((value) => !value)
                        }
                        aria-expanded={showSummaryPreview}
                      >
                        Vista previa de la ficha
                      </Button>
                      {showSummaryPreview && (
                        <pre className="mt-3 overflow-x-auto rounded-md border border-border px-4 py-3 text-sm whitespace-pre-wrap break-words">
                          {exportContext.summary.text}
                        </pre>
                      )}
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                      {clientConfig.crmTarget === 'manual' ? (
                        <Button
                          size="lg"
                          onClick={() => void handleCopySummary()}
                          disabled={exporting}
                        >
                          {exporting
                            ? 'Copiando…'
                            : copySummaryNotice
                              ? 'Ficha copiada'
                              : 'Copiar ficha'}
                        </Button>
                      ) : clientConfig.crmTarget === 'whatsapp' ? (
                        <Button
                          size="lg"
                          onClick={() => void handleExportMain()}
                          disabled={exporting}
                        >
                          {exporting
                            ? 'Compartiendo…'
                            : 'Compartir ficha por WhatsApp'}
                        </Button>
                      ) : exportResult?.ok === true &&
                        latestExportRow !== undefined ? (
                        <>
                          <p className="text-base">
                            Exportada a{' '}
                            {getCrmAdapter(clientConfig.crmTarget).label} el{' '}
                            {noteDateFormatter.format(
                              new Date(
                                latestExportRow.exported_at ??
                                  latestExportRow.created_at,
                              ),
                            )}
                            {latestExportRow.external_id !== null &&
                              latestExportRow.external_id !== '' &&
                              ` (ID ${latestExportRow.external_id})`}
                          </p>
                          {exportResult.simulated === true && (
                            <Badge variant="neutral">Simulado</Badge>
                          )}
                          <Button
                            variant="secondary"
                            size="lg"
                            onClick={() => void handleExportMain()}
                            disabled={exporting}
                          >
                            Volver a exportar
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="lg"
                          onClick={() => void handleExportMain()}
                          disabled={exporting}
                        >
                          {exporting
                            ? 'Exportando…'
                            : `Exportar a ${getCrmAdapter(clientConfig.crmTarget).label}`}
                        </Button>
                      )}
                      {clientConfig.crmTarget !== 'manual' && (
                        <Button
                          variant="secondary"
                          size="lg"
                          onClick={() => void handleCopySummary()}
                          disabled={exporting}
                        >
                          {copySummaryNotice ? 'Ficha copiada' : 'Copiar ficha'}
                        </Button>
                      )}
                    </div>

                    {exportResult?.ok === true &&
                      clientConfig.crmTarget === 'whatsapp' &&
                      exportSharedHref !== null && (
                        <p className="mt-3 text-sm">
                          Compartida por WhatsApp.{' '}
                          <a
                            href={exportSharedHref}
                            target="_blank"
                            rel="noopener"
                            className="font-semibold underline"
                          >
                            Abrir WhatsApp
                          </a>
                        </p>
                      )}

                    {exportError !== null && (
                      <div className="mt-3">
                        <p className="text-sm text-error">{exportError}</p>
                        <Button
                          variant="secondary"
                          size="lg"
                          className="mt-3"
                          onClick={() => void handleExportMain()}
                          disabled={exporting}
                        >
                          Reintentar
                        </Button>
                      </div>
                    )}
                    {copySummaryError !== null && (
                      <p className="mt-3 text-sm text-error">
                        {copySummaryError}
                      </p>
                    )}

                    <div className="mt-6">
                      <Button
                        variant="secondary"
                        size="lg"
                        onClick={() =>
                          setShowExportsHistory((value) => !value)
                        }
                        aria-expanded={showExportsHistory}
                      >
                        Exportaciones ({exportsList.length})
                      </Button>
                      {showExportsHistory && (
                        <ul className="mt-3 space-y-3">
                          {exportsList.length === 0 && (
                            <li className="rounded-md border border-border px-4 py-3">
                              <p className="text-sm text-text-secondary">
                                Todavía no hay exportaciones.
                              </p>
                            </li>
                          )}
                          {exportsList.map((row) => (
                            <li
                              key={row.id}
                              className="rounded-md border border-border px-4 py-3"
                            >
                              <p className="font-semibold">
                                {getCrmAdapter(row.target).label} ·{' '}
                                {exportKindLabel(row)}
                              </p>
                              <p className="mt-1 text-sm text-text-secondary">
                                {noteDateFormatter.format(
                                  new Date(row.created_at),
                                )}{' '}
                                · {EXPORT_STATUS_LABELS[row.status]}
                                {row.external_id !== null &&
                                  row.external_id !== '' &&
                                  ` · ID ${row.external_id}`}
                              </p>
                              {row.error_message !== null &&
                                row.error_message !== '' && (
                                  <p className="mt-1 text-sm text-error">
                                    {row.error_message}
                                  </p>
                                )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </section>
            )}

            <section
              className="mt-8 border-t border-border pt-6"
              aria-labelledby="nota-borrar"
            >
              <h2 id="nota-borrar" className="text-lg font-semibold">
                Borrar nota
              </h2>
              {!confirmingDeleteNote && (
                <Button
                  variant="secondary"
                  size="lg"
                  className="mt-3 border-error text-error"
                  onClick={() => setConfirmingDeleteNote(true)}
                >
                  Borrar nota
                </Button>
              )}
              {confirmingDeleteNote && (
                <div className="mt-3 rounded-md border border-error bg-bg px-4 py-4">
                  <p className="font-semibold">¿Borrar esta nota?</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Se borrarán la nota, su audio, sus datos, tareas,
                    borradores y exportaciones.
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Lo que ya enviaste por WhatsApp o exportaste al CRM
                    hay que borrarlo allí.
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Esta acción no se puede deshacer.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      variant="secondary"
                      size="lg"
                      className="border-error text-error"
                      onClick={() => void handleDeleteNote()}
                      disabled={deletingNote}
                    >
                      {deletingNote ? 'Borrando…' : 'Borrar nota'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() => setConfirmingDeleteNote(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
              {deleteNoteError !== null && (
                <p className="mt-3 text-sm text-error">{deleteNoteError}</p>
              )}
            </section>

            <div className="mt-8 border-t border-border pt-6">
              <Button asChild size="lg">
                <Link to="/capturar">Nueva captura</Link>
              </Button>
            </div>
          </>
        )}
      </main>
    </>
  )
}
