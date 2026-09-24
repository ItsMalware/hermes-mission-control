import { useEffect, useRef, useState } from 'react'

import { Button, Codicon, Loader } from '@hermes/plugin-sdk'

interface CliChatProps {
  cli: 'claude' | 'codex'
  label: string
  onBack: () => void
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'error'
  text: string
}

export function CliChat({ cli, label, onBack }: CliChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const sessionRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  async function send() {
    const text = input.trim()
    if (!text || busy) return

    const bridge = window.hermesDesktop?.cliChat
    if (!bridge) {
      setMessages(m => [...m, { role: 'error', text: 'CLI chat is unavailable in this build.' }])
      return
    }

    setInput('')
    setMessages(m => [...m, { role: 'user', text }])
    setBusy(true)
    try {
      const res = await bridge.send({ cli, message: text, sessionId: sessionRef.current })
      if (res.sessionId) sessionRef.current = res.sessionId
      if (res.ok) {
        setMessages(m => [...m, { role: 'assistant', text: res.text || '(no output)' }])
      } else {
        setMessages(m => [...m, { role: 'error', text: res.error || 'The CLI returned an error.' }])
      }
    } catch (err) {
      setMessages(m => [...m, { role: 'error', text: err instanceof Error ? err.message : String(err) }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="cli-chat">
      <div className="cli-chat-header">
        <button type="button" className="cli-chat-back" onClick={onBack} aria-label="Back">
          <Codicon name="arrow-left" size="0.85rem" />
        </button>
        <div className="cli-chat-title">
          <strong>{label}</strong>
          <span>Auto-approve · headless {cli}</span>
        </div>
        {sessionRef.current && (
          <button
            type="button"
            className="cli-chat-new"
            onClick={() => {
              sessionRef.current = null
              setMessages([])
            }}
          >
            New chat
          </button>
        )}
      </div>

      <div className="cli-chat-body" ref={scrollRef}>
        {messages.length === 0 && !busy && (
          <div className="cli-chat-empty">Ask {label} anything — it runs with your local tools and auto-approves actions.</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`cli-chat-msg cli-chat-msg-${m.role}`}>
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="cli-chat-msg cli-chat-msg-assistant cli-chat-thinking">
            <Loader type="lemniscate-bloom" />
          </div>
        )}
      </div>

      <div className="cli-chat-composer">
        <textarea
          className="cli-chat-input"
          value={input}
          placeholder={`Message ${label}…`}
          rows={2}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          disabled={busy}
        />
        <Button size="sm" onClick={() => void send()} disabled={busy || !input.trim()}>
          <Codicon name="send" size="0.8rem" />
          Send
        </Button>
      </div>
    </section>
  )
}
