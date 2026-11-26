import { useCallback, useEffect, useRef, useState } from 'react'
import { api, seg } from './api'

/**
 * Something a private page remembers for its owner (a list, notes, a setting), saved on the server under a name.
 * Only the signed-in person can read or change their own. Saves a moment after the last change.
 *   const [notes, setNotes, ready] = usePrivateData('notes', '')
 */
export function usePrivateData<T>(key: string, initial: T): [T, (next: T) => void, boolean] {
  const [value, setValue] = useState<T>(initial)
  const [ready, setReady] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    let live = true
    api.get<T | null>(`/me/data/${seg(key)}`).then(({ data }) => {
      if (!live) return
      if (data !== null) setValue(data)
      setReady(true)
    })
    return () => { live = false }
  }, [key])

  const set = useCallback((next: T) => {
    setValue(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { api.put(`/me/data/${seg(key)}`, { value: next }) }, 600)
  }, [key])

  return [value, set, ready]
}
