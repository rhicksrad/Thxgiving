import { Lightbulb } from 'lucide-react'
import Chat from '../components/Chat'

const PROMPTS = [
  "What are you most thankful for this year?",
  "Best Thanksgiving dish of all time? Defend your answer.",
  "Stuffing or dressing? Inside the bird or in a pan?",
  "Share a favorite Thanksgiving memory from when you were a kid.",
  "Pumpkin, pecan, or apple? Pick one pie.",
  "Who's got the best leftover sandwich recipe?",
  "Drop an old family photo. The older the better.",
]

export default function FamilyChat() {
  const prompt = PROMPTS[new Date().getDate() % PROMPTS.length]
  return (
    <div className="stack-lg">
      <header className="page-head">
        <h1 className="display">Family chat</h1>
        <p className="muted">Talk about anything, any day. Post a photo or GIF with the image button, or type @ to tag someone (@family tags everybody).</p>
      </header>
      <p className="playground-prompt"><Lightbulb size={17} aria-hidden="true" /><span>Today's question: <b>{prompt}</b></span></p>
      <section className="card gp-chat tall">
        <Chat gatheringId={null} placeholder="Say something to the family…" />
      </section>
    </div>
  )
}
