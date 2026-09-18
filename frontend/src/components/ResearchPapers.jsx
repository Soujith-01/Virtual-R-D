import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard, Button, Pill, ErrorBanner } from './ui'
import * as api from '../api/client'

const QUICK_TOPICS = [
  { label: 'Reaction Yield ML', query: 'reaction yield optimization machine learning' },
  { label: 'Solar Panel Efficiency', query: 'solar panel efficiency machine learning' },
  { label: 'Battery Retention', query: 'battery capacity retention degradation machine learning' },
  { label: 'Water Purification', query: 'water purification membrane filtration optimization' },
  { label: 'Plant Growth Biomass', query: 'plant biomass growth yield optimization machine learning' },
]

export default function ResearchPapers({
  initialQuery = '',
  activeResearchPapers = [],
  onTogglePaperInResearch,
  onNavigateToWorkspace,
  selectedTemplate,
}) {
  const [tab, setTab] = useState('search') // 'search' | 'library'
  const [query, setQuery] = useState(initialQuery || 'reaction yield optimization machine learning')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [papers, setPapers] = useState([])
  const [searchMeta, setSearchMeta] = useState(null)

  // Library state
  const [libraryPapers, setLibraryPapers] = useState([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)

  // Modals / Drawers
  const [detailsPaper, setDetailsPaper] = useState(null)
  const [summaryPaper, setSummaryPaper] = useState(null)
  const [summaryData, setSummaryData] = useState(null)
  const [summarizing, setSummarizing] = useState(false)
  const [savedIds, setSavedIds] = useState(new Set())

  // Load library on mount
  useEffect(() => {
    fetchLibrary()
  }, [])

  // Auto-search if initialQuery changes or on first mount
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery)
      handleSearch(initialQuery)
    } else {
      handleSearch('reaction yield optimization machine learning')
    }
  }, [initialQuery])

  const fetchLibrary = async () => {
    setLoadingLibrary(true)
    try {
      const res = await api.getLibraryPapers()
      const list = res.papers || []
      setLibraryPapers(list)
      const ids = new Set(list.map((p) => p.paper_id || p.id))
      setSavedIds(ids)
    } catch (err) {
      console.error('Failed to load library:', err)
    } finally {
      setLoadingLibrary(false)
    }
  }

  const handleSearch = async (searchQuery) => {
    const q = (searchQuery || query).trim()
    if (!q) return
    setLoading(true)
    setError(null)
    try {
      const domainId = selectedTemplate?.id
      const res = await api.searchPapers(q, 10, domainId)
      setPapers(res.papers || [])
      setSearchMeta({
        count: res.count,
        source: res.source,
        query: res.query,
      })
    } catch (err) {
      console.error('Search failed:', err)
      setError(err.friendlyMessage || 'Unable to connect to academic literature service. Please try again.')
      setPapers([])
    } finally {
      setLoading(false)
    }
  }

  const handleSaveToLibrary = async (paper) => {
    try {
      await api.saveLibraryPaper(paper)
      setSavedIds((prev) => new Set([...prev, paper.paper_id]))
      fetchLibrary()
    } catch (err) {
      console.error('Save failed:', err)
    }
  }

  const handleDeleteFromLibrary = async (paperId) => {
    try {
      await api.deleteLibraryPaper(paperId)
      setSavedIds((prev) => {
        const next = new Set(prev)
        next.delete(paperId)
        return next
      })
      fetchLibrary()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const handleSummarize = async (paper) => {
    setSummaryPaper(paper)
    setSummaryData(null)
    setSummarizing(true)
    try {
      const objective = selectedTemplate?.objective || 'Experimental discovery and parameter optimization'
      const data = await api.summarizePaper(paper, objective)
      setSummaryData(data)
    } catch (err) {
      console.error('Summarize error:', err)
      setSummaryData({
        title: paper.title,
        problem: 'Analysis temporarily unavailable for this article.',
        method: 'Empirical assessment from published dataset.',
        data: 'Experimental conditions as described by authors.',
        result: 'Quantitative findings detailed in source publication.',
        limitation: 'Reflects bounded trial parameters.',
        relevance: 'Provides baseline constraints for research space.',
        is_abstract_only: true,
        context_type: 'Abstract-based research context',
        note: 'Summary based on the available abstract.',
        generated_by: 'system-fallback',
      })
    } finally {
      setSummarizing(false)
    }
  }

  const isPaperInResearch = (paperId) => {
    return activeResearchPapers.some((p) => (p.paper_id || p.id) === paperId)
  }

  const activeCount = activeResearchPapers.length

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* ===== Header & Active Research Context Banner ===== */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <h1 className="text-2xl font-bold tracking-tight text-white">Research Papers</h1>
            <Pill variant="cyan" glow>Live Literature</Pill>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Search peer-reviewed scientific literature and inject verified knowledge directly into RAG and AI experiments.
          </p>
        </div>

        {activeCount > 0 ? (
          <div className="flex items-center gap-3 bg-cyan-950/40 border border-cyan-500/30 rounded-xl px-4 py-2.5">
            <div>
              <div className="text-xs font-semibold text-cyan-300">
                ✓ {activeCount} Paper{activeCount > 1 ? 's' : ''} in Research Context
              </div>
              <div className="text-[11px] text-slate-400">Available to RAG & experiment scoring</div>
            </div>
            {onNavigateToWorkspace && (
              <Button variant="primary" size="sm" onClick={onNavigateToWorkspace}>
                Go to Workspace →
              </Button>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-400 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2">
            Tip: Click <span className="text-cyan-400 font-medium">Use in Research</span> to feed papers into the AI agent.
          </div>
        )}
      </div>

      {/* ===== Tab Navigation ===== */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          type="button"
          onClick={() => setTab('search')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'search'
              ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <span>🔍</span> Search Academic Papers
        </button>
        <button
          type="button"
          onClick={() => setTab('library')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'library'
              ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <span>📑</span> My Research Library
          {libraryPapers.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 font-mono">
              {libraryPapers.length}
            </span>
          )}
        </button>
      </div>

      {/* ===== SEARCH TAB ===== */}
      {tab === 'search' && (
        <div className="space-y-5">
          {/* Search bar & quick chips */}
          <GlassCard className="p-4 space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSearch(query)
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by topic, research question, methodology, or keywords..."
                  className="w-full bg-slate-900/80 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Searching...' : 'Search'}
              </Button>
            </form>

            {/* Quick Topic Chips */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Quick Topics:
              </span>
              {QUICK_TOPICS.map((topic) => (
                <button
                  key={topic.label}
                  type="button"
                  onClick={() => {
                    setQuery(topic.query)
                    handleSearch(topic.query)
                  }}
                  className="text-xs bg-white/5 hover:bg-cyan-500/10 hover:text-cyan-300 hover:border-cyan-500/30 text-slate-300 border border-white/10 rounded-lg px-2.5 py-1 transition"
                >
                  {topic.label}
                </button>
              ))}
            </div>
          </GlassCard>

          {/* Search Metadata & Source Attribution */}
          {searchMeta && !loading && (
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <div>
                Found <span className="text-cyan-300 font-medium">{searchMeta.count}</span> authentic papers for{' '}
                <span className="text-slate-300 italic">"{searchMeta.query}"</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Source: <strong className="text-slate-200">{searchMeta.source}</strong></span>
              </div>
            </div>
          )}

          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

          {/* Paper Results List */}
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="inline-block w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-sm text-slate-400">Querying live scientific literature graph...</div>
            </div>
          ) : papers.length === 0 ? (
            <GlassCard className="p-8 text-center text-slate-400 space-y-2">
              <div className="text-3xl">🔍</div>
              <div className="text-base font-medium text-slate-300">No papers found for this query</div>
              <div className="text-xs text-slate-400">
                Try broader keywords or click one of the quick topic buttons above.
              </div>
            </GlassCard>
          ) : (
            <div className="space-y-4">
              {papers.map((paper, idx) => {
                const inResearch = isPaperInResearch(paper.paper_id)
                const isSaved = savedIds.has(paper.paper_id)
                const authorsList = Array.isArray(paper.authors) ? paper.authors : []
                const authorsDisplay = authorsList.slice(0, 3).join(', ') + (authorsList.length > 3 ? ` +${authorsList.length - 3} more` : '')

                return (
                  <GlassCard
                    key={paper.paper_id || idx}
                    className={`p-5 transition hover:border-cyan-500/30 ${
                      inResearch ? 'border-cyan-400/50 bg-cyan-950/20' : ''
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Top badges */}
                      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          {paper.year && (
                            <span className="px-2 py-0.5 rounded bg-white/10 text-slate-200 font-mono">
                              {paper.year}
                            </span>
                          )}
                          {paper.venue && (
                            <span className="text-slate-400 italic max-w-xs truncate" title={paper.venue}>
                              {paper.venue}
                            </span>
                          )}
                          {paper.citation_count !== undefined && (
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">
                              {paper.citation_count} citations
                            </span>
                          )}
                          {paper.is_open_access ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                              Open Access
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                              Publisher Access
                            </span>
                          )}
                        </div>

                        {inResearch && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 animate-pulse">
                            ✓ Added to Research Context
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h2 className="text-base font-semibold text-slate-100 leading-snug">
                        {paper.title}
                      </h2>

                      {/* Authors */}
                      {authorsDisplay && (
                        <div className="text-xs text-slate-400">
                          Authors: <span className="text-slate-300">{authorsDisplay}</span>
                        </div>
                      )}

                      {/* DOI & Paper link */}
                      {paper.doi && (
                        <div className="text-xs font-mono text-slate-400 flex items-center gap-1">
                          <span>DOI:</span>
                          <a
                            href={`https://doi.org/${paper.doi}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-400 hover:underline truncate max-w-md"
                          >
                            {paper.doi}
                          </a>
                        </div>
                      )}

                      {/* Abstract preview */}
                      {paper.abstract ? (
                        <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                          {paper.abstract}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 italic">
                          Abstract not provided by publisher repository; click Open Paper for full article.
                        </p>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/5 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setDetailsPaper(paper)}
                          >
                            View Details
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSummarize(paper)}
                          >
                            Summarize Paper
                          </Button>
                          {(paper.url || paper.open_access_pdf || paper.doi) && (
                            <a
                              href={paper.open_access_pdf || paper.url || `https://doi.org/${paper.doi}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-cyan-300 px-3 py-1.5 rounded-lg border border-white/10 hover:border-cyan-500/30 transition"
                            >
                              <span>Open Paper ↗</span>
                            </a>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant={isSaved ? 'ghost' : 'secondary'}
                            size="sm"
                            onClick={() => (isSaved ? handleDeleteFromLibrary(paper.paper_id) : handleSaveToLibrary(paper))}
                          >
                            {isSaved ? '✓ Saved' : 'Save'}
                          </Button>

                          <Button
                            variant={inResearch ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={() => onTogglePaperInResearch && onTogglePaperInResearch(paper)}
                          >
                            {inResearch ? 'Remove from Research' : 'Use in Research'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== MY RESEARCH LIBRARY TAB ===== */}
      {tab === 'library' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div>
              <strong className="text-slate-200">MY RESEARCH LIBRARY</strong> · {libraryPapers.length} saved articles stored in SQLite
            </div>
          </div>

          {loadingLibrary ? (
            <div className="py-12 text-center text-slate-400">Loading library...</div>
          ) : libraryPapers.length === 0 ? (
            <GlassCard className="p-8 text-center text-slate-400 space-y-2">
              <div className="text-3xl">📑</div>
              <div className="text-base font-medium text-slate-300">Your library is currently empty</div>
              <div className="text-xs text-slate-400">
                Search for papers above and click <span className="text-cyan-300">"Save"</span> to keep them here.
              </div>
            </GlassCard>
          ) : (
            <div className="space-y-4">
              {libraryPapers.map((paper) => {
                const inResearch = isPaperInResearch(paper.paper_id)
                const authorsList = Array.isArray(paper.authors) ? paper.authors : []

                return (
                  <GlassCard key={paper.paper_id} className="p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {paper.year && (
                          <span className="px-2 py-0.5 rounded bg-white/10 text-slate-200 font-mono">
                            {paper.year}
                          </span>
                        )}
                        {paper.venue && <span className="text-slate-400 italic">{paper.venue}</span>}
                        {paper.citation_count !== undefined && (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">
                            {paper.citation_count} citations
                          </span>
                        )}
                      </div>
                      {inResearch && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-400/20 text-cyan-300 border border-cyan-400/40">
                          ✓ In Current Research
                        </span>
                      )}
                    </div>

                    <h2 className="text-base font-semibold text-slate-100">{paper.title}</h2>
                    {authorsList.length > 0 && (
                      <div className="text-xs text-slate-400">
                        Authors: <span className="text-slate-300">{authorsList.slice(0, 4).join(', ')}</span>
                      </div>
                    )}

                    {paper.abstract && (
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {paper.abstract}
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/5 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setDetailsPaper(paper)}
                        >
                          View Details
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSummarize(paper)}
                        >
                          Summarize Paper
                        </Button>
                        {(paper.url || paper.open_access_pdf || paper.doi) && (
                          <a
                            href={paper.open_access_pdf || paper.url || `https://doi.org/${paper.doi}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-slate-300 hover:text-cyan-300 px-3 py-1.5 rounded-lg border border-white/10 transition"
                          >
                            Open Paper ↗
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteFromLibrary(paper.paper_id)}
                        >
                          Remove
                        </Button>
                        <Button
                          variant={inResearch ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => onTogglePaperInResearch && onTogglePaperInResearch(paper)}
                        >
                          {inResearch ? 'Remove from Research' : 'Use in Research'}
                        </Button>
                      </div>
                    </div>
                  </GlassCard>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== DETAILS MODAL ===== */}
      <AnimatePresence>
        {detailsPaper && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Pill variant="cyan">Authentic Publication Metadata</Pill>
                  <h3 className="text-lg font-bold text-slate-100 mt-2">{detailsPaper.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailsPaper(null)}
                  className="text-slate-400 hover:text-white text-lg p-1"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-white/5 rounded-xl p-3 border border-white/5">
                <div>
                  <span className="text-slate-500">Year:</span>{' '}
                  <span className="text-slate-200 font-mono">{detailsPaper.year || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Citations:</span>{' '}
                  <span className="text-cyan-300 font-mono">{detailsPaper.citation_count ?? 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Venue:</span>{' '}
                  <span className="text-slate-200">{detailsPaper.venue || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Access:</span>{' '}
                  <span className={detailsPaper.is_open_access ? 'text-emerald-400' : 'text-slate-400'}>
                    {detailsPaper.is_open_access ? 'Open Access (Free)' : 'Publisher / Subscription'}
                  </span>
                </div>
                {detailsPaper.doi && (
                  <div className="col-span-2">
                    <span className="text-slate-500">DOI:</span>{' '}
                    <a
                      href={`https://doi.org/${detailsPaper.doi}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:underline"
                    >
                      {detailsPaper.doi}
                    </a>
                  </div>
                )}
                {detailsPaper.source && (
                  <div className="col-span-2">
                    <span className="text-slate-500">Repository:</span>{' '}
                    <span className="text-slate-300">{detailsPaper.source}</span>
                  </div>
                )}
              </div>

              {/* Authors */}
              {Array.isArray(detailsPaper.authors) && detailsPaper.authors.length > 0 && (
                <div className="text-xs space-y-1">
                  <div className="text-slate-500 font-semibold uppercase tracking-wider">Authors</div>
                  <div className="text-slate-300">{detailsPaper.authors.join(', ')}</div>
                </div>
              )}

              {/* Abstract */}
              <div className="space-y-1 text-xs">
                <div className="text-slate-500 font-semibold uppercase tracking-wider">Abstract</div>
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-white/5 text-slate-300 leading-relaxed max-h-60 overflow-y-auto">
                  {detailsPaper.abstract || 'No abstract provided in public metadata.'}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <Button
                    variant={isPaperInResearch(detailsPaper.paper_id) ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => {
                      onTogglePaperInResearch && onTogglePaperInResearch(detailsPaper)
                    }}
                  >
                    {isPaperInResearch(detailsPaper.paper_id) ? '✓ In Research' : 'Use in Research'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const p = detailsPaper
                      setDetailsPaper(null)
                      handleSummarize(p)
                    }}
                  >
                    Summarize Paper
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  {(detailsPaper.url || detailsPaper.open_access_pdf || detailsPaper.doi) && (
                    <a
                      href={detailsPaper.open_access_pdf || detailsPaper.url || `https://doi.org/${detailsPaper.doi}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-4 py-2 rounded-lg transition"
                    >
                      Open Full Article ↗
                    </a>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => setDetailsPaper(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===== SUMMARIZE MODAL ===== */}
      <AnimatePresence>
        {summaryPaper && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Pill variant="cyan">AI Paper Summary</Pill>
                    {summaryData?.context_type && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-white/10 text-cyan-200">
                        {summaryData.context_type}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-100 mt-2">{summaryPaper.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSummaryPaper(null)}
                  className="text-slate-400 hover:text-white text-lg p-1"
                >
                  ✕
                </button>
              </div>

              {summarizing ? (
                <div className="py-12 text-center space-y-3">
                  <div className="inline-block w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                  <div className="text-sm text-slate-400">Extracting scientific findings and methodology...</div>
                </div>
              ) : summaryData ? (
                <div className="space-y-3 text-xs">
                  {summaryData.note && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                      ℹ {summaryData.note}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                      <div className="text-cyan-400 font-semibold uppercase tracking-wider text-[10px]">
                        1. Problem Addressed
                      </div>
                      <div className="text-slate-200 leading-relaxed">{summaryData.problem}</div>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                      <div className="text-cyan-400 font-semibold uppercase tracking-wider text-[10px]">
                        2. Methodology / Technique
                      </div>
                      <div className="text-slate-200 leading-relaxed">{summaryData.method}</div>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                      <div className="text-cyan-400 font-semibold uppercase tracking-wider text-[10px]">
                        3. System / Reagents / Data
                      </div>
                      <div className="text-slate-200 leading-relaxed">{summaryData.data}</div>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                      <div className="text-cyan-400 font-semibold uppercase tracking-wider text-[10px]">
                        4. Core Results
                      </div>
                      <div className="text-slate-200 leading-relaxed">{summaryData.result}</div>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                      <div className="text-cyan-400 font-semibold uppercase tracking-wider text-[10px]">
                        5. Limitations & Boundary
                      </div>
                      <div className="text-slate-200 leading-relaxed">{summaryData.limitation}</div>
                    </div>

                    <div className="bg-cyan-950/40 p-3 rounded-xl border border-cyan-500/20 space-y-1">
                      <div className="text-cyan-300 font-semibold uppercase tracking-wider text-[10px]">
                        6. Relevance to Current Research
                      </div>
                      <div className="text-cyan-100 leading-relaxed">{summaryData.relevance}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <Button
                  variant={isPaperInResearch(summaryPaper.paper_id) ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => {
                    onTogglePaperInResearch && onTogglePaperInResearch(summaryPaper)
                  }}
                >
                  {isPaperInResearch(summaryPaper.paper_id) ? '✓ Added to Research Context' : 'Use in Research'}
                </Button>

                <Button variant="secondary" size="sm" onClick={() => setSummaryPaper(null)}>
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
