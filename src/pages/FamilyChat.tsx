import { Lightbulb } from 'lucide-react'
import Chat from '../components/Chat'
import { useTheme } from '../lib/theme'
import Spot from '../components/Spot'

export default function FamilyChat() {
  const { prompts } = useTheme() // this month's questions
  const prompt = prompts[new Date().getDate() % prompts.length]
  return (
    <div className="stack-lg">
      <header className="page-head with-spot">
        <div>
          <h1 className="display">Family chat</h1>
          <p className="muted">Talk about anything, any day. Post a photo or GIF with the image button, or type @ to tag someone (@family tags everybody).</p>
        </div>
        <Spot name="chat" className="page-spot" />
      </header>
      <p className="playground-prompt"><Lightbulb size={17} aria-hidden="true" /><span>Today's question: <b>{prompt}</b></span></p>
      <section className="card gp-chat tall">
        <Chat gatheringId={null} placeholder="Say something to the family…" />
      </section>
    </div>
  )
}
