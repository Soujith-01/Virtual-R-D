import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard, Pill, Button } from './ui'
import { sendExperimentChatMessage } from '../api/client'

/**
 * Context-aware suggestion bank indexed by application page/step.
 */
const PAGE_SUGGESTIONS = {
  choose: [
    'Why should I choose this experiment?',
    'What parameters can I optimize?',
    'What does the model predict?',
    'What is the standard baseline?',
  ],
  workspace: [
    'Why is this research objective targeted?',
    'How are candidate experiments generated?',
    'What parameter constraints apply here?',
    'What does the confidence score mean?',
  ],
  experiments: [
    'Why is EXP-01 ranked first?',
    'What does the multi-objective score mean?',
    'Which candidate has lower uncertainty?',
    'Why is this catalyst formulation preferred?',
  ],
  apparatus: [
    'What apparatus is currently being used?',
    'Why is the autoclave reactor required?',
    'How does the PID circulator control temperature?',
    'What does the FTIR probe measure?',
  ],
  simulation: [
    'What is happening now?',
    'Why are we heating to this temperature?',
    'What apparatus is being used?',
    'What happens in the next simulation step?',
  ],
  papers: [
    'How is this paper relevant?',
    'What method does this paper describe?',
    'Can this paper inform our experiment?',
    'Which papers support our reaction conditions?',
  ],
  report: [
    'Explain this experimental result.',
    'What are the limitations of this run?',
    'What should we test next?',
    'How does this compare with the baseline?',
  ],
  manual: [
    'What are safe operating ranges for this reaction?',
    'How does catalyst choice alter selectivity?',
    'What happens if I increase pressure?',
    'Explain the uncertainty for these inputs.',
  ],
  landing: [
    'What research questions can I explore?',
    'Which scientific domains are available?',
    'How does the ML surrogate model work?',
    'Explain the end-to-end R&D workflow.',
  ],
}

const EXPERIMENT_ACTIONS = [
  { label: '🔬 Explain current experiment', prompt: 'Explain the current experiment setup and conditions.' },
  { label: '⚡ Explain selected candidate', prompt: 'Why was this candidate experiment selected and ranked?' },
  { label: '🌡️ Explain simulation step', prompt: 'What is happening now inside the reactor simulation?' },
  { label: '📚 Show relevant papers', prompt: 'Which research papers support this experiment?' },
  { label: '📊 Explain prediction', prompt: 'What does the model predict and what is the uncertainty?' },
  { label: '🧭 Suggest next experiment', prompt: 'What should we test next based on active learning?' },
]

export default function ExperimentCopilot({ context = {} }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showActions, setShowActions] = useState(false)

  // Session messages
  const [messages, setMessages] = useState(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Greetings. I am the **NUCLEUS AI Experiment Copilot**, your dedicated experimental research assistant.\n\n' +
        'I am actively grounded in your **current experiment parameters**, **live reactor simulation**, **apparatus setup**, and **local RAG scientific literature**.\n\n' +
        'How can I assist your laboratory investigation today?',
      sources: [],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])

  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom()
    }
  }, [messages, isOpen, isMinimized])

  // Context-derived badge label
  const pageLabel = useMemo(() => {
    const p = context.page || 'overview'
    switch (p) {
      case 'choose':
        return 'Choose Experiment'
      case 'workspace':
        return 'AI Generates'
      case 'experiments':
        return 'Compare & Rank'
      case 'apparatus':
        return 'Apparatus Setup'
      case 'simulation':
        return 'Virtual Experiment'
      case 'papers':
        return 'Research Papers'
      case 'report':
        return 'Research Report'
      case 'manual':
        return 'Manual R&D'
      default:
        return 'Overview'
    }
  }, [context.page])

  // Dynamic suggestions for current page
  const currentSuggestions = useMemo(() => {
    const key = context.page || 'landing'
    return PAGE_SUGGESTIONS[key] || PAGE_SUGGESTIONS.landing
  }, [context.page])

  const handleSendMessage = async (textToSend = null) => {
    const query = (textToSend || input).trim()
    if (!query || loading) return

    setInput('')
    setError(null)

    const userMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    // Build history for multi-turn memory
    const historyPayload = messages
      .filter((m) => m.id !== 'welcome')
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }))

    setMessages((prev) => [...prev, userMessage])
    setLoading(true)

    try {
      const response = await sendExperimentChatMessage({
        question: query,
        context,
        history: historyPayload,
      })

      const botMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: response.answer || 'No response received.',
        sources: response.sources || [],
        contextUsed: response.context_used || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        guardrailTriggered: response.guardrail_triggered || false,
      }

      setMessages((prev) => [...prev, botMessage])
    } catch (err) {
      const msg = err.friendlyMessage || err.message || 'Could not communicate with local Experiment Copilot.'
      setError(msg)
      const errorMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content:
          err?.response?.status === 503
            ? 'The knowledge retrieval service is currently unavailable.'
            : 'Local reasoning model is currently unavailable. Please check that the local backend service is running.',
        sources: [],
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content:
          'Conversation cleared. I am ready to answer any questions regarding your active experiment, simulation, apparatus, or research papers.',
        sources: [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ])
    setError(null)
  }

  return (
    <>
      {/* 1. Persistent Floating Trigger Button */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
        <AnimatePresence>
          {!isOpen && (
            <motion.button
              id="btn-open-copilot"
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setIsOpen(true)
                setIsMinimized(false)
              }}
              className="group relative flex items-center gap-3 rounded-full bg-gradient-to-r from-cyan-600 via-sky-600 to-indigo-600 px-5 py-3.5 text-white shadow-2xl shadow-cyan-500/30 border border-cyan-400/40 backdrop-blur-xl transition-all duration-300 hover:shadow-cyan-500/50 hover:border-cyan-300"
            >
              {/* Pulse ambient halo */}
              <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 opacity-30 blur-md group-hover:opacity-60 transition duration-500" />

              <span className="relative text-xl animate-bounce">🔬</span>
              <div className="relative text-left">
                <div className="text-xs font-bold tracking-wider uppercase text-white flex items-center gap-1.5">
                  Experiment Copilot
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="text-[10px] text-cyan-200 font-medium">
                  {pageLabel}
                </div>
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Chat Drawer Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="panel-copilot-drawer"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              height: isMinimized ? 'auto' : '620px',
            }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed bottom-6 right-6 z-50 w-[95vw] sm:w-[440px] max-w-full rounded-2xl border border-cyan-500/30 bg-slate-950/90 shadow-2xl shadow-cyan-950/60 backdrop-blur-2xl flex flex-col overflow-hidden text-slate-100"
          >
            {/* Header */}
            <div className="relative border-b border-white/10 bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-950/90 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 shadow-lg shadow-cyan-500/30 border border-cyan-400/40">
                  <span className="text-lg">🔬</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-bold tracking-wider text-slate-100 uppercase">
                      EXPERIMENT COPILOT
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-400 font-medium">AI Research Assistant</span>
                    <span className="text-slate-600 text-[10px]">•</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Local Model
                    </span>
                    <span className="text-slate-600 text-[10px]">•</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                      RAG Connected
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  id="btn-copilot-clear"
                  onClick={handleClearChat}
                  title="Clear chat session"
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/5 transition text-xs"
                >
                  🧹
                </button>
                <button
                  type="button"
                  id="btn-copilot-minimize"
                  onClick={() => setIsMinimized((v) => !v)}
                  title={isMinimized ? 'Expand' : 'Minimize'}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/5 transition text-xs"
                >
                  {isMinimized ? '▲' : '▼'}
                </button>
                <button
                  type="button"
                  id="btn-copilot-close"
                  onClick={() => setIsOpen(false)}
                  title="Close Copilot"
                  className="rounded-lg p-1.5 text-slate-400 hover:text-rose-300 hover:bg-white/5 transition text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content body when not minimized */}
            {!isMinimized && (
              <>
                {/* Active Context Banner */}
                <div className="bg-slate-900/60 border-b border-white/5 px-4 py-1.5 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-cyan-300 font-medium truncate">
                    <span className="text-xs">📍</span>
                    <span>Context:</span>
                    <span className="font-semibold text-slate-200">{pageLabel}</span>
                    {context.domain && (
                      <span className="text-slate-400">({context.domain.replace('_', ' ')})</span>
                    )}
                  </div>
                  {context.experiment?.temperature && (
                    <div className="text-[10px] text-slate-400 shrink-0 font-mono">
                      {context.experiment.temperature}°C • Catalyst {context.experiment.catalyst || 'B'}
                    </div>
                  )}
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
                  {messages.map((m) => {
                    const isUser = m.role === 'user'
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                      >
                        <div
                          className={`max-w-[88%] rounded-2xl px-4 py-2.5 leading-relaxed shadow-md ${
                            isUser
                              ? 'bg-gradient-to-r from-cyan-600 to-sky-600 text-white rounded-br-none border border-cyan-400/30'
                              : m.guardrailTriggered
                              ? 'bg-amber-950/40 text-amber-200 border border-amber-500/30 rounded-bl-none'
                              : m.isError
                              ? 'bg-rose-950/40 text-rose-200 border border-rose-500/30 rounded-bl-none'
                              : 'bg-slate-900/85 text-slate-200 border border-white/10 rounded-bl-none'
                          }`}
                        >
                          <div className="prose prose-invert prose-xs max-w-none space-y-1.5 whitespace-pre-wrap font-sans">
                            {m.content}
                          </div>

                          {/* Sources citation shelf */}
                          {m.sources && m.sources.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-white/10 space-y-1">
                              <div className="text-[10px] font-semibold text-cyan-300 uppercase tracking-wider flex items-center gap-1">
                                <span>📚 Sources</span>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {m.sources.map((src, sIdx) => {
                                  let badgeTone = 'bg-slate-800 text-slate-300 border-slate-700'
                                  if (src.type === 'Model prediction') {
                                    badgeTone = 'bg-violet-950/60 text-violet-300 border-violet-500/40'
                                  } else if (src.type === 'Virtual simulation') {
                                    badgeTone = 'bg-sky-950/60 text-sky-300 border-sky-500/40'
                                  } else if (src.type === 'Research Paper') {
                                    badgeTone = 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                                  } else if (src.type === 'RAG Knowledge') {
                                    badgeTone = 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                                  }

                                  return (
                                    <div
                                      key={sIdx}
                                      title={src.reference}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${badgeTone} max-w-full truncate`}
                                    >
                                      <span className="font-semibold">[{src.type}]</span>
                                      <span className="truncate">{src.title}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="text-[9px] text-slate-500 px-1">{m.timestamp}</span>
                      </div>
                    )
                  })}

                  {loading && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs py-1">
                      <div className="h-4 w-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                      <span>Synthesizing answer from local RAG and models...</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Suggestions & Quick Actions Toggle */}
                <div className="border-t border-white/5 bg-slate-900/50 p-2 space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      💡 Suggested for {pageLabel}:
                    </span>
                    <button
                      type="button"
                      id="btn-copilot-toggle-actions"
                      onClick={() => setShowActions((v) => !v)}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium transition"
                    >
                      {showActions ? 'Show Questions' : '⚡ Quick Actions'}
                    </button>
                  </div>

                  {/* Suggestions Carousel / List */}
                  {!showActions ? (
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                      {currentSuggestions.map((sug, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendMessage(sug)}
                          className="shrink-0 rounded-full bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-200 border border-white/10 hover:border-cyan-400/40 px-3 py-1 text-[11px] transition text-left"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5 pb-1">
                      {EXPERIMENT_ACTIONS.map((act, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendMessage(act.prompt)}
                          className="rounded-lg bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-200 border border-white/10 hover:border-cyan-400/40 p-1.5 text-[10px] text-left truncate transition"
                          title={act.prompt}
                        >
                          {act.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Input form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleSendMessage()
                  }}
                  className="p-3 border-t border-white/10 bg-slate-950/80 flex items-center gap-2"
                >
                  <input
                    id="input-copilot-query"
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about this experiment..."
                    disabled={loading}
                    className="flex-1 rounded-xl bg-slate-900 border border-white/10 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition"
                  />
                  <Button
                    id="btn-copilot-send"
                    type="submit"
                    loading={loading}
                    disabled={!input.trim()}
                    className="!py-2.5 !px-4 text-xs font-semibold shrink-0"
                  >
                    SEND →
                  </Button>
                </form>

                {/* Grounding footnote */}
                <div className="px-3 py-1.5 bg-slate-950 text-[10px] text-slate-500 text-center border-t border-white/5">
                  Answers are based on the current experiment, local RAG knowledge, and model outputs.
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
