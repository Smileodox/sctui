import { useCallback, useEffect, useRef, useState } from 'react'

export interface Resource<T> {
  data: T | undefined
  error: Error | undefined
  loading: boolean
  /** When `data` was last successfully replaced. */
  fetchedAt: number | undefined
  /** Re-run the loader. `force` bypasses the client-side cache. */
  reload: (force?: boolean) => void
}

export interface UseResourceOptions {
  /** Skip loading entirely (e.g. a detail pane that is closed). */
  enabled?: boolean
}

/**
 * Loads an async value, keeping the previous data visible while refreshing.
 *
 * Two properties that matter for a dashboard: a failed refresh does not blank
 * out data that is still on screen, and results from a superseded request are
 * discarded rather than overwriting a newer one.
 */
export function useResource<T>(
  loader: (options: { signal: AbortSignal; force: boolean }) => Promise<T>,
  deps: readonly unknown[],
  options: UseResourceOptions = {},
): Resource<T> {
  const enabled = options.enabled ?? true

  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<Error | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [fetchedAt, setFetchedAt] = useState<number | undefined>(undefined)
  const [nonce, setNonce] = useState(0)

  const forceRef = useRef(false)
  const requestRef = useRef(0)
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const reload = useCallback((force = true) => {
    forceRef.current = force
    setNonce((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!enabled) return

    const controller = new AbortController()
    const requestId = ++requestRef.current
    const force = forceRef.current
    forceRef.current = false

    setLoading(true)
    loaderRef
      .current({ signal: controller.signal, force })
      .then((value) => {
        if (controller.signal.aborted || requestRef.current !== requestId) return
        setData(value)
        setError(undefined)
        setFetchedAt(Date.now())
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted || requestRef.current !== requestId) return
        setError(cause instanceof Error ? cause : new Error(String(cause)))
      })
      .finally(() => {
        if (controller.signal.aborted || requestRef.current !== requestId) return
        setLoading(false)
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, ...deps])

  return { data, error, loading, fetchedAt, reload }
}

/** Calls `callback` every `delayMs`. Pass `null` to pause. */
export function useInterval(callback: () => void, delayMs: number | null): void {
  const saved = useRef(callback)
  saved.current = callback

  useEffect(() => {
    if (delayMs === null) return
    const id = setInterval(() => saved.current(), delayMs)
    return () => clearInterval(id)
  }, [delayMs])
}

/** Index into a spinner frame array; only ticks while `active`. */
export function useSpinnerFrame(active: boolean, frameCount: number, intervalMs = 80): number {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setFrame((f) => (f + 1) % frameCount), intervalMs)
    return () => clearInterval(id)
  }, [active, frameCount, intervalMs])

  return active ? frame : 0
}

/** A clock that re-renders once a second — for "aktualisiert vor X". */
export function useTick(intervalMs = 1000): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return tick
}
