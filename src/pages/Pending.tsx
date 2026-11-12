import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { PrivateNav } from '../components/PrivateNav'
import { SupabaseMissingNotice } from '../components/SupabaseMissingNotice'
import { NOTE_STATUS_LABELS } from '../features/extraction/labels'
import {
  getNotesByIds,
  listNotesByStatus,
  type NoteWithClientAndProperty,
} from '../features/notes/api'
import {
  changeTaskDueDate,
  completeTask,
  createTask,
  editTask,
  listDraftedNoteIds,
  listPendingTasks,
  listProposedTasks,
  listRecentCompletedTasks,
  listSourceFacts,
  listUnapprovedDrafts,
  reopenTask,
  type UnapprovedDraft,
} from '../features/tasks/api'
import {
  BUCKET_LABELS,
  groupTasksByBucket,
  type TaskBucket,
} from '../features/tasks/buckets'
import { listNotesToExport } from '../features/export/api'
import { useAuth } from '../lib/auth-context'
import { APP_PHASE_LABEL } from '../lib/app-label'
import type { ExtractedFactRow, TaskRow } from '../lib/database.types'

const dateFormatter = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' })

function dueDateText(dueDate: string | null): string {
  return dueDate === null
    ? 'Sin fecha'
    : dateFormatter.format(new Date(`${dueDate}T12:00:00`))
}

/**
 * /pendientes (privada, Fase 6): bandeja de pendientes del agente.
 * - Tareas `pendiente` agrupadas por fecha (Madrid): Vencidas, Hoy,
 *   Próximos días, Sin fecha. Cada una con cliente e inmueble (enlace
 *   a la nota), dato de origen si lo tiene, «Completar» (un toque, con
 *   deshacer 5 s), «Cambiar fecha» y «Editar».
 * - «Completadas recientes (7 días)» plegadas, con «Reabrir».
 * - «Notas que piden acción»: por revisar, sin transcribir,
 *   seguimiento sin preparar, borradores por aprobar, tareas
 *   propuestas sin revisar y por exportar (Fase 7: notas aprobadas
 *   cuya ficha aún no ha salido de la app), con contador por grupo.
 * - «Nueva tarea» a mano, sin nota.
 */
export default function Pending() {
  const { supabaseConfigured } = useAuth()
  const [pending, setPending] = useState<TaskRow[]>([])
  const [completed, setCompleted] = useState<TaskRow[]>([])
  const [notesById, setNotesById] = useState<
    Map<string, NoteWithClientAndProperty>
  >(new Map())
  const [sourceFacts, setSourceFacts] = useState<
    Map<string, ExtractedFactRow>
  >(new Map())
  const [reviewNotes, setReviewNotes] = useState<NoteWithClientAndProperty[]>([])
  const [draftNotes, setDraftNotes] = useState<NoteWithClientAndProperty[]>([])
  const [noFollowUpNotes, setNoFollowUpNotes] = useState<
    NoteWithClientAndProperty[]
  >([])
  const [unapprovedDrafts, setUnapprovedDrafts] = useState<UnapprovedDraft[]>([])
  const [proposedTasks, setProposedTasks] = useState<TaskRow[]>([])
  const [toExportNotes, setToExportNotes] = useState<NoteWithClientAndProperty[]>([])
  const [loading, setLoading] = useState(supabaseConfigured)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [lastCompleted, setLastCompleted] = useState<TaskRow | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [changingDateId, setChangingDateId] = useState<string | null>(null)
  const [changeDueDate, setChangeDueDate] = useState('')
  const [taskEditError, setTaskEditError] = useState<string | null>(null)
  const [savingTask, setSavingTask] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [showNewTask, setShowNewTask] = useState(false)
  const [newDescription, setNewDescription] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newTaskError, setNewTaskError] = useState<string | null>(null)
  const [addingTask, setAddingTask] = useState(false)

  useEffect(() => {
    if (!supabaseConfigured) {
      return
    }
    let mounted = true
    Promise.all([
      listPendingTasks(),
      listRecentCompletedTasks(),
      listNotesByStatus(['transcribed', 'extracted', 'reviewed']),
      listNotesByStatus(['draft']),
      listNotesByStatus(['approved']),
      listDraftedNoteIds(),
      listUnapprovedDrafts(),
      listProposedTasks(),
      listNotesToExport(),
    ])
      .then(
        ([
          pendingRows,
          completedRows,
          reviewRows,
          draftRows,
          approvedRows,
          draftedIds,
          unapprovedRows,
          proposedRows,
          toExportRows,
        ]) => {
          if (!mounted) return
          setPending(pendingRows)
          setCompleted(completedRows)
          setReviewNotes(reviewRows)
          setDraftNotes(draftRows)
          setNoFollowUpNotes(
            approvedRows.filter((note) => !draftedIds.has(note.id)),
          )
          setUnapprovedDrafts(unapprovedRows)
          setProposedTasks(proposedRows)
          setToExportNotes(toExportRows)
          setLoading(false)
          const noteIds = new Set<string>()
          for (const task of [...pendingRows, ...completedRows, ...proposedRows]) {
            if (task.visit_note_id !== null) {
              noteIds.add(task.visit_note_id)
            }
          }
          const factIds = [...pendingRows, ...completedRows, ...proposedRows]
            .map((task) => task.source_fact_id)
            .filter((factId): factId is string => factId !== null)
          return Promise.all([
            getNotesByIds([...noteIds]),
            listSourceFacts(factIds),
          ]).then(([noteRows, factRows]) => {
            if (!mounted) return
            setNotesById(new Map(noteRows.map((note) => [note.id, note])))
            setSourceFacts(new Map(factRows.map((fact) => [fact.id, fact])))
          })
        },
      )
      .catch((error: unknown) => {
        if (!mounted) return
        setLoadError(error instanceof Error ? error.message : 'Ha ocurrido un error.')
        setLoading(false)
      })
    return () => {
      mounted = false
      if (undoTimerRef.current !== null) {
        clearTimeout(undoTimerRef.current)
      }
    }
  }, [supabaseConfigured])

  const grouped = useMemo(() => groupTasksByBucket(pending), [pending])

  const hasAnything =
    pending.length > 0 ||
    reviewNotes.length > 0 ||
    draftNotes.length > 0 ||
    noFollowUpNotes.length > 0 ||
    unapprovedDrafts.length > 0 ||
    proposedTasks.length > 0 ||
    toExportNotes.length > 0

  function updatePending(updated: TaskRow) {
    setPending((previous) =>
      previous.map((task) => (task.id === updated.id ? updated : task)),
    )
  }

  async function handleComplete(task: TaskRow) {
    setActionError(null)
    try {
      const updated = await completeTask(task.id)
      setPending((previous) =>
        previous.filter((item) => item.id !== task.id),
      )
      setCompleted((previous) => [updated, ...previous])
      setLastCompleted(task)
      if (undoTimerRef.current !== null) {
        clearTimeout(undoTimerRef.current)
      }
      undoTimerRef.current = setTimeout(() => setLastCompleted(null), 5000)
    } catch (error: unknown) {
      setActionError(
        error instanceof Error ? error.message : 'No se ha podido completar la tarea.',
      )
    }
  }

  async function handleUndoComplete() {
    if (lastCompleted === null) {
      return
    }
    const task = lastCompleted
    setLastCompleted(null)
    if (undoTimerRef.current !== null) {
      clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
    setActionError(null)
    try {
      const updated = await reopenTask(task.id)
      setCompleted((previous) =>
        previous.filter((item) => item.id !== task.id),
      )
      setPending((previous) => [...previous, updated])
    } catch (error: unknown) {
      setActionError(
        error instanceof Error ? error.message : 'No se ha podido reabrir la tarea.',
      )
    }
  }

  async function handleReopen(task: TaskRow) {
    setActionError(null)
    try {
      const updated = await reopenTask(task.id)
      setCompleted((previous) =>
        previous.filter((item) => item.id !== task.id),
      )
      setPending((previous) => [...previous, updated])
    } catch (error: unknown) {
      setActionError(
        error instanceof Error ? error.message : 'No se ha podido reabrir la tarea.',
      )
    }
  }

  function handleStartEdit(task: TaskRow) {
    setEditingTaskId(task.id)
    setEditDescription(task.description)
    setEditDueDate(task.due_date ?? '')
    setTaskEditError(null)
    setActionError(null)
  }

  async function handleSaveEdit(id: string) {
    const description = editDescription.trim()
    if (description.length < 3 || description.length > 200) {
      setTaskEditError('La descripción tiene que tener entre 3 y 200 caracteres.')
      return
    }
    setTaskEditError(null)
    setSavingTask(true)
    try {
      updatePending(
        await editTask(id, {
          description,
          due_date: editDueDate === '' ? null : editDueDate,
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

  async function handleChangeDate(id: string) {
    setTaskEditError(null)
    setSavingTask(true)
    try {
      updatePending(
        await changeTaskDueDate(id, changeDueDate === '' ? null : changeDueDate),
      )
      setChangingDateId(null)
    } catch (error: unknown) {
      setTaskEditError(
        error instanceof Error
          ? error.message
          : 'No se ha podido cambiar la fecha.',
      )
    } finally {
      setSavingTask(false)
    }
  }

  async function handleNewTask() {
    const description = newDescription.trim()
    if (description.length < 3 || description.length > 200) {
      setNewTaskError('La descripción tiene que tener entre 3 y 200 caracteres.')
      return
    }
    setNewTaskError(null)
    setAddingTask(true)
    try {
      const created = await createTask({
        description,
        due_date: newDueDate === '' ? null : newDueDate,
      })
      setPending((previous) => [...previous, created])
      setShowNewTask(false)
      setNewDescription('')
      setNewDueDate('')
    } catch (error: unknown) {
      setNewTaskError(
        error instanceof Error ? error.message : 'No se ha podido añadir la tarea.',
      )
    } finally {
      setAddingTask(false)
    }
  }

  function noteLabel(task: TaskRow): { client: string; reference: string } | null {
    if (task.visit_note_id === null) {
      return null
    }
    const note = notesById.get(task.visit_note_id)
    if (note === undefined) {
      return null
    }
    return {
      client: note.clients?.full_name ?? '',
      reference: note.properties?.reference ?? '',
    }
  }

  function renderTaskCard(task: TaskRow) {
    const label = noteLabel(task)
    const sourceFact =
      task.source_fact_id !== null
        ? (sourceFacts.get(task.source_fact_id) ?? null)
        : null
    const isEditing = editingTaskId === task.id
    const isChangingDate = changingDateId === task.id
    return (
      <article
        key={task.id}
        className="rounded-md border border-border px-4 py-3"
      >
        {isEditing ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor={`pendiente-editar-${task.id}`}>Descripción</Label>
              <Input
                id={`pendiente-editar-${task.id}`}
                className="min-h-11"
                value={editDescription}
                onChange={(event) => {
                  setEditDescription(event.target.value)
                  setTaskEditError(null)
                }}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`pendiente-fecha-${task.id}`}>
                Fecha (opcional)
              </Label>
              <Input
                id={`pendiente-fecha-${task.id}`}
                type="date"
                className="min-h-11"
                value={editDueDate}
                onChange={(event) => setEditDueDate(event.target.value)}
              />
            </div>
            {taskEditError !== null && (
              <p className="text-sm text-error">{taskEditError}</p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={() => void handleSaveEdit(task.id)}
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
        ) : (
          <>
            <p className="font-semibold break-words">{task.description}</p>
            <p className="mt-1 text-sm text-text-secondary">
              {dueDateText(task.due_date)}
              {label !== null && task.visit_note_id !== null && (
                <>
                  {' · '}
                  <Link
                    to={`/notas/${task.visit_note_id}`}
                    className="font-semibold underline"
                  >
                    {label.client} · {label.reference}
                  </Link>
                </>
              )}
            </p>
            {sourceFact !== null && (
              <p className="mt-1 break-words text-sm text-text-secondary">
                «{sourceFact.evidence_quote ?? sourceFact.value}»
              </p>
            )}
            {isChangingDate ? (
              <div className="mt-3 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor={`pendiente-cambiar-${task.id}`}>
                    Fecha (opcional)
                  </Label>
                  <Input
                    id={`pendiente-cambiar-${task.id}`}
                    type="date"
                    className="min-h-11"
                    value={changeDueDate}
                    onChange={(event) => setChangeDueDate(event.target.value)}
                  />
                </div>
                {taskEditError !== null && (
                  <p className="text-sm text-error">{taskEditError}</p>
                )}
                <div className="flex flex-wrap gap-3">
                  <Button
                    size="lg"
                    onClick={() => void handleChangeDate(task.id)}
                    disabled={savingTask}
                  >
                    {savingTask ? 'Guardando…' : 'Guardar fecha'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => {
                      setChangingDateId(null)
                      setTaskEditError(null)
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="lg" onClick={() => void handleComplete(task)}>
                  Completar
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => {
                    setChangingDateId(task.id)
                    setChangeDueDate(task.due_date ?? '')
                    setTaskEditError(null)
                  }}
                >
                  Cambiar fecha
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => handleStartEdit(task)}
                >
                  Editar
                </Button>
              </div>
            )}
          </>
        )}
      </article>
    )
  }

  function renderActionNote(note: NoteWithClientAndProperty) {
    return (
      <li key={note.id}>
        <Link
          to={`/notas/${note.id}`}
          className="block min-h-11 rounded-md border border-border bg-bg px-4 py-3 hover:bg-surface"
        >
          <span className="font-semibold break-words">
            {note.clients?.full_name ?? 'Sin cliente'}
          </span>
          <span className="mt-1 block text-sm text-text-secondary">
            {note.properties?.reference ?? ''} ·{' '}
            {NOTE_STATUS_LABELS[note.status]} ·{' '}
            {dateFormatter.format(new Date(note.created_at))}
          </span>
        </Link>
      </li>
    )
  }

  const bucketOrder: TaskBucket[] = ['vencidas', 'hoy', 'proximos', 'sin-fecha']

  return (
    <>
      <PrivateNav />
      <main className="mx-auto max-w-4xl bg-bg px-4 py-8 text-text-primary">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-text-secondary">{APP_PHASE_LABEL}</p>
            <h1 className="mt-2 text-2xl">Pendientes</h1>
            <p className="mt-1 text-sm text-text-secondary">
              {pending.length === 1 ? '1 tarea pendiente' : `${pending.length} tareas pendientes`}
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => {
              setShowNewTask((value) => !value)
              setNewTaskError(null)
            }}
          >
            Nueva tarea
          </Button>
        </div>

        {!supabaseConfigured && (
          <div className="mt-6">
            <SupabaseMissingNotice />
          </div>
        )}

        {loading && <p className="mt-6 text-sm text-text-secondary">Cargando…</p>}
        {loadError !== null && <p className="mt-6 text-sm text-error">{loadError}</p>}

        {lastCompleted !== null && (
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface px-4 py-3">
            <p className="text-sm">Tarea completada.</p>
            <Button variant="secondary" size="lg" onClick={() => void handleUndoComplete()}>
              Deshacer
            </Button>
          </div>
        )}
        {actionError !== null && (
          <p className="mt-3 text-sm text-error">{actionError}</p>
        )}

        {showNewTask && (
          <div className="mt-6 space-y-3 rounded-md border border-border px-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pendiente-nueva">Descripción</Label>
              <Input
                id="pendiente-nueva"
                className="min-h-11"
                value={newDescription}
                onChange={(event) => {
                  setNewDescription(event.target.value)
                  setNewTaskError(null)
                }}
                autoComplete="off"
                maxLength={200}
                placeholder="Llamar al cliente para confirmar"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pendiente-nueva-fecha">Fecha (opcional)</Label>
              <Input
                id="pendiente-nueva-fecha"
                type="date"
                className="min-h-11"
                value={newDueDate}
                onChange={(event) => setNewDueDate(event.target.value)}
              />
            </div>
            {newTaskError !== null && (
              <p className="text-sm text-error">{newTaskError}</p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={() => void handleNewTask()}
                disabled={addingTask}
              >
                {addingTask ? 'Añadiendo…' : 'Añadir tarea'}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  setShowNewTask(false)
                  setNewTaskError(null)
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {!loading && loadError === null && !hasAnything && (
          <p className="mt-6 text-base">No tienes nada pendiente.</p>
        )}

        {!loading &&
          loadError === null &&
          bucketOrder.map((bucket) => {
            const tasks = grouped[bucket]
            if (tasks.length === 0) {
              return null
            }
            return (
              <section key={bucket} className="mt-8" aria-labelledby={`pendientes-${bucket}`}>
                <h2 id={`pendientes-${bucket}`} className="text-lg font-semibold">
                  {BUCKET_LABELS[bucket]} ({tasks.length})
                </h2>
                <div className="mt-3 space-y-3">
                  {tasks.map((task) => renderTaskCard(task))}
                </div>
              </section>
            )
          })}

        {!loading && loadError === null && completed.length > 0 && (
          <section className="mt-8" aria-labelledby="pendientes-completadas">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setShowCompleted((value) => !value)}
              aria-expanded={showCompleted}
            >
              Completadas recientes (7 días) ({completed.length})
            </Button>
            {showCompleted && (
              <div className="mt-3 space-y-3">
                {completed.map((task) => {
                  const label = noteLabel(task)
                  return (
                    <article
                      key={task.id}
                      className="rounded-md border border-border px-4 py-3"
                    >
                      <p className="font-semibold break-words">{task.description}</p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {dueDateText(task.due_date)}
                        {label !== null && task.visit_note_id !== null && (
                          <>
                            {' · '}
                            <Link
                              to={`/notas/${task.visit_note_id}`}
                              className="font-semibold underline"
                            >
                              {label.client} · {label.reference}
                            </Link>
                          </>
                        )}
                      </p>
                      <div className="mt-3">
                        <Button
                          variant="secondary"
                          size="lg"
                          onClick={() => void handleReopen(task)}
                        >
                          Reabrir
                        </Button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {!loading && loadError === null && hasAnything && (
          <section className="mt-8" aria-labelledby="pendientes-accion">
            <h2 id="pendientes-accion" className="text-lg font-semibold">
              Notas que piden acción
            </h2>

            {reviewNotes.length > 0 && (
              <div className="mt-6">
                <h3 className="text-base font-semibold">
                  Por revisar ({reviewNotes.length})
                </h3>
                <ul className="mt-3 space-y-3">
                  {reviewNotes.map((note) => renderActionNote(note))}
                </ul>
              </div>
            )}

            {draftNotes.length > 0 && (
              <div className="mt-6">
                <h3 className="text-base font-semibold">
                  Sin transcribir ({draftNotes.length})
                </h3>
                <ul className="mt-3 space-y-3">
                  {draftNotes.map((note) => renderActionNote(note))}
                </ul>
              </div>
            )}

            {noFollowUpNotes.length > 0 && (
              <div className="mt-6">
                <h3 className="text-base font-semibold">
                  Seguimiento sin preparar ({noFollowUpNotes.length})
                </h3>
                <ul className="mt-3 space-y-3">
                  {noFollowUpNotes.map((note) => renderActionNote(note))}
                </ul>
              </div>
            )}

            {unapprovedDrafts.length > 0 && (
              <div className="mt-6">
                <h3 className="text-base font-semibold">
                  Borradores por aprobar ({unapprovedDrafts.length})
                </h3>
                <ul className="mt-3 space-y-3">
                  {unapprovedDrafts.map((draft) => (
                    <li key={draft.id}>
                      <Link
                        to={`/notas/${draft.note.id}`}
                        className="block min-h-11 rounded-md border border-border bg-bg px-4 py-3 hover:bg-surface"
                      >
                        <span className="font-semibold break-words">
                          {draft.audience === 'comprador'
                            ? 'Para el comprador'
                            : 'Para el propietario'}
                        </span>
                        <span className="mt-1 block text-sm text-text-secondary">
                          {draft.note.clients?.full_name ?? ''} ·{' '}
                          {draft.note.properties?.reference ?? ''}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {proposedTasks.length > 0 && (
              <div className="mt-6">
                <h3 className="text-base font-semibold">
                  Tareas propuestas sin revisar ({proposedTasks.length})
                </h3>
                <ul className="mt-3 space-y-3">
                  {proposedTasks.map((task) => {
                    const label = noteLabel(task)
                    return (
                      <li key={task.id}>
                        <Link
                          to={
                            task.visit_note_id !== null
                              ? `/notas/${task.visit_note_id}`
                              : '/pendientes'
                          }
                          className="block min-h-11 rounded-md border border-border bg-bg px-4 py-3 hover:bg-surface"
                        >
                          <span className="font-semibold break-words">
                            {task.description}
                          </span>
                          {label !== null && (
                            <span className="mt-1 block text-sm text-text-secondary">
                              {label.client} · {label.reference}
                            </span>
                          )}
                          <span className="mt-1 block text-sm text-text-secondary">
                            <Badge variant="neutral">
                              {task.origin === 'regla' ? 'Regla' : 'IA'}
                            </Badge>
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {toExportNotes.length > 0 && (
              <div className="mt-6">
                <h3 className="text-base font-semibold">
                  Por exportar ({toExportNotes.length})
                </h3>
                <ul className="mt-3 space-y-3">
                  {toExportNotes.map((note) => renderActionNote(note))}
                </ul>
              </div>
            )}
          </section>
        )}
      </main>
    </>
  )
}
