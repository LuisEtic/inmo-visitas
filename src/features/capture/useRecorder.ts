import { useCallback, useEffect, useRef, useState } from 'react'
import {
  formatRecordingTime,
  MAX_RECORDING_SECONDS,
  pickSupportedMimeType,
} from './audio'

export type RecorderState = 'idle' | 'recording' | 'stopped' | 'error'

/**
 * Grabación de voz en el navegador (Fase 4), con `MediaRecorder`.
 * - Tipo MIME: el primero soportado de la lista de `audio.ts`
 *   (Safari/iOS graba `audio/mp4`).
 * - Límite de 3 minutos: a los 3:00 se para sola.
 * - Al parar (o al salir de la pantalla) se liberan las pistas del
 *   micrófono con `track.stop()`.
 * - El blob grabado queda en el estado para escucharlo y guardarlo.
 */
export function useRecorder() {
  const [state, setState] = useState<RecorderState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [mimeType, setMimeType] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const intervalRef = useRef<number | null>(null)
  const timeoutRef = useRef<number | null>(null)

  const stopTracks = useCallback(() => {
    if (streamRef.current !== null) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }
  }, [])

  const clearTimers = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder !== null && recorder.state !== 'inactive') {
      recorder.stop()
    }
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setBlob(null)
    setMimeType(null)
    setElapsed(0)
    chunksRef.current = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const supported = pickSupportedMimeType((mime) =>
        MediaRecorder.isTypeSupported(mime),
      )
      if (supported === null) {
        stopTracks()
        setError('Este navegador no puede grabar audio. Escribe la nota.')
        setState('error')
        return
      }
      const recorder = new MediaRecorder(stream, { mimeType: supported })
      recorderRef.current = recorder
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }
      recorder.onstop = () => {
        clearTimers()
        stopTracks()
        const recorded = new Blob(chunksRef.current, { type: supported })
        setBlob(recorded)
        setMimeType(supported)
        setState('stopped')
      }
      recorder.onerror = () => {
        clearTimers()
        stopTracks()
        setError('No se ha podido grabar. Inténtalo de nuevo.')
        setState('error')
      }
      recorder.start()
      setState('recording')
      intervalRef.current = window.setInterval(() => {
        setElapsed((previous) => previous + 1)
      }, 1000)
      timeoutRef.current = window.setTimeout(() => {
        stop()
      }, MAX_RECORDING_SECONDS * 1000)
    } catch (err: unknown) {
      clearTimers()
      stopTracks()
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Permite el micrófono para grabar. También puedes escribir la nota.')
      } else {
        setError('No se ha podido acceder al micrófono. También puedes escribir la nota.')
      }
      setState('error')
    }
  }, [clearTimers, stop, stopTracks])

  const reset = useCallback(() => {
    clearTimers()
    stopTracks()
    const recorder = recorderRef.current
    if (recorder !== null && recorder.state !== 'inactive') {
      recorder.stop()
    }
    recorderRef.current = null
    chunksRef.current = []
    setBlob(null)
    setMimeType(null)
    setElapsed(0)
    setError(null)
    setState('idle')
  }, [clearTimers, stopTracks])

  // Al salir de la pantalla, soltar el micrófono y los temporizadores.
  useEffect(
    () => () => {
      clearTimers()
      stopTracks()
      const recorder = recorderRef.current
      if (recorder !== null && recorder.state !== 'inactive') {
        recorder.stop()
      }
    },
    [clearTimers, stopTracks],
  )

  return {
    state,
    /** Segundos grabados hasta ahora. */
    elapsed,
    /** Contador `m:ss / 3:00` para mostrar mientras se graba. */
    elapsedLabel: `${formatRecordingTime(elapsed)} / ${formatRecordingTime(MAX_RECORDING_SECONDS)}`,
    blob,
    mimeType,
    error,
    start,
    stop,
    reset,
  }
}
