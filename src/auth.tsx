import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { useLiveTable } from './lib/realtime'
import type { Profile } from './lib/types'

type AuthState = {
  session: Session | null
  loading: boolean
  member: boolean | null // null = still checking
  me: Profile | null
  profiles: Record<string, Profile>
  refreshMember: () => Promise<void>
  saveProfile: (patch: Partial<Pick<Profile, 'display_name' | 'emoji' | 'avatar_path'>>) => Promise<string | null>
}

const Ctx = createContext<AuthState>(null as unknown as AuthState)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [member, setMember] = useState<boolean | null>(null)
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  const refreshMember = useCallback(async () => {
    if (!userId) return setMember(null)
    const { data, error } = await supabase.rpc('is_member')
    setMember(error ? false : Boolean(data))
  }, [userId])

  useEffect(() => { refreshMember() }, [refreshMember])

  const loadProfiles = useCallback(() => {
    supabase.from('profiles').select('*').then(({ data, error }) => {
      if (error) return // keep what we have rather than blanking every name and avatar
      setProfiles(Object.fromEntries((data ?? []).map((p) => [p.id, p as Profile])))
    })
  }, [])

  useEffect(() => { if (member) loadProfiles() }, [member, loadProfiles])

  useLiveTable<Profile>('profiles', undefined, {
    onUpsert: (p) => setProfiles((all) => ({ ...all, [p.id]: p })),
    onResync: loadProfiles,
  }, Boolean(member))

  const saveProfile = useCallback<AuthState['saveProfile']>(async (patch) => {
    if (!userId) return 'Not signed in'
    // Saving a name finishes onboarding; a photo uploaded mid-onboarding doesn't close the welcome form.
    const changes = 'display_name' in patch ? { ...patch, onboarded: true } : patch
    const { data, error } = await supabase
      .from('profiles').update(changes).eq('id', userId).select().single()
    if (error) return error.message
    setProfiles((all) => ({ ...all, [userId]: data as Profile }))
    return null
  }, [userId])

  const me = userId ? profiles[userId] ?? null : null
  // Every screen reads this, so only hand out a new object when something in it changed.
  const value = useMemo(
    () => ({ session, loading, member, me, profiles, refreshMember, saveProfile }),
    [session, loading, member, me, profiles, refreshMember, saveProfile],
  )

  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  )
}
