import { NavLink } from 'react-router'
import { LockKeyhole } from 'lucide-react'
import { useAuth } from '../auth'
import { useDmUnread } from '../lib/dm'

/** Family / Private, at the top of both chat screens. */
export default function ChatSwitch() {
  const { me } = useAuth()
  const unread = useDmUnread(me?.id)
  return (
    <nav className="seg chat-switch" aria-label="Which chat">
      <NavLink to="/chat" end>Family</NavLink>
      <NavLink to="/chat/private"><LockKeyhole size={14} aria-hidden="true" />Private{unread > 0 && <span className="dm-count">{unread}</span>}</NavLink>
    </nav>
  )
}

