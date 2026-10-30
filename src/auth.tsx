import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, getToken, setToken, whenSignedOut } from './lib/api'
import { resetLive, useLiveTable } from './lib/realtime'
import type { Profile } from './lib/types'

type AuthState = {
  signedIn: boolean
  loading: boolean
  member: boolean | null // null = still checking
  me: Profile | null
  profiles: Record<string, Profile>
  refreshMember: () => Promise<void>
  saveProfile: (patch: Partial<Pick<Profile, 'display_name' | 'emoji' | 'avatar_path'>>) => Promise<string | null>
  signIn: (token: string, user: Profile) => void
  signOut: () => void
}

const Ctx = createContext<AuthState>(null as unknown as AuthState)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTok] = useState<string | null>(() => getToken())
  const [user, setUser] = useState<Profile | null>(null)
  const [member, setMember] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(Boolean(token))
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})

  const forget = useCallback(() => {
    setToken(null)
    setTok(null); setUser(null); setMember(null); setProfiles({}); setLoading(false)
    resetLive()
  }, [])
  useEffect(() => { whenSignedOut(forget); return () => whenSignedOut(null) }, [forget])

  const refreshMember = useCallback(async () => {
    if (!getToken()) return
    const { data, error } = await api.get<{ user: Profile; member: boolean }>('/me')
    if (data) { setUser(data.user); setMember(data.member) }
    else if (error?.status !== 401) setMember((m) => m ?? false) // offline: let them retry from the "not on the list" screen
    setLoading(false)
  }, [])

  useEffect(() => { if (token) refreshMember() }, [token, refreshMember])

  const loadProfiles = useCallback(() => {
    api.get<Profile[]>('/profiles').then(({ data }) => {
      if (!data) return // keep what we have rather than blanking every name and avatar
      setProfiles(Object.fromEntries(data.map((p) => [p.id, p])))
    })
  }, [])

  useEffect(() => { if (member) loadProfiles() }, [member, loadProfiles])

  useLiveTable<Profile>('profiles', undefined, {
    onUpsert: (p) => setProfiles((all) => ({ ...all, [p.id]: p })),
    onResync: loadProfiles,
  }, Boolean(member))

  const userId = user?.id
  const saveProfile = useCallback<AuthState['saveProfile']>(async (patch) => {
    if (!userId) return 'Not signed in'
    const { data, error } = await api.patch<Profile>('/me', patch)
    if (error || !data) return error?.message ?? 'Could not save'
    setProfiles((all) => ({ ...all, [userId]: data }))
    setUser(data)
    return null
  }, [userId])

  const signIn = useCallback((t: string, u: Profile) => {
    setToken(t)
    setUser(u); setMember(null); setLoading(true)
    setTok(t)
    resetLive()
  }, [])

  const signOut = useCallback(() => {
    api.post('/auth/logout').finally(forget)
  }, [forget])

  const me = userId ? profiles[userId] ?? user : null
  // Every screen reads this, so only hand out a new object when something in it changed.
  const value = useMemo(
    () => ({ signedIn: Boolean(token), loading, member, me, profiles, refreshMember, saveProfile, signIn, signOut }),
    [token, loading, member, me, profiles, refreshMember, saveProfile, signIn, signOut],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
