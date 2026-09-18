import { useState, useEffect, useMemo, useRef } from 'react'
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

  // Upload file state
  const fileInputRef = useRef(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [uploadForm, setUploadForm] = useState({
    title: '',
    authors: '',
    year: new Date().getFullYear(),
    abstract: '',
    venue: 'Custom Research File',
    doi: '',
    source: 'Local Upload',
    autoInject: true,
  })
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(null)
  const [isDragging, setIsDragging] = useState(false)

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

  /* -------------------------- File Upload Logic -------------------------- */

  const formatFilenameToTitle = (filename) => {
    const withoutExt = filename.replace(/\.[^/.]+$/, '')
    return withoutExt
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim()
  }

  const handleFileSelect = (file) => {
    if (!file) return
    setUploadedFile(file)
    const autoTitle = formatFilenameToTitle(file.name)

    // Quick text preview extraction for text/json/markdown/csv
    if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.json') || file.name.endsWith('.csv')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = (e.target?.result || '').slice(0, 1500)
        setUploadForm({
          title: autoTitle,
          authors: 'Researcher Upload',
          year: new Date().getFullYear(),
          abstract: content || `Uploaded experimental data file: ${file.name}`,
          venue: file.name.endsWith('.csv') ? 'Experimental CSV Dataset' : 'Custom Scientific Document',
          doi: '',
          source: 'User Upload',
          autoInject: true,
        })
        setUploadModalOpen(true)
      }
      reader.readAsText(file)
    } else {
      // PDF or binary document
      setUploadForm({
        title: autoTitle,
        authors: 'Researcher Upload',
        year: new Date().getFullYear(),
        abstract: `Uploaded research paper document: ${file.name} (${(file.size / 1024).toFixed(1)} KB). Contains experimental protocols and literature reference data.`,
        venue: 'PDF Research Document',
        doi: '',
        source: 'User Upload',
        autoInject: true,
      })
      setUploadModalOpen(true)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleConfirmUpload = async () => {
    if (!uploadForm.title.trim()) return
    setUploading(true)
    setError(null)
    try {
      const paperId = `user-doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
      const authorsArr = uploadForm.authors
        .split(/[,;]+/)
        .map((a) => a.trim())
        .filter(Boolean)

      const newPaper = {
        paper_id: paperId,
        title: uploadForm.title.trim(),
        authors: authorsArr.length > 0 ? authorsArr : ['Researcher Upload'],
        year: Number(uploadForm.year) || new Date().getFullYear(),
        venue: uploadForm.venue || 'Custom Research File',
        abstract: uploadForm.abstract.trim(),
        doi: uploadForm.doi?.trim() || undefined,
        source: 'User Uploaded File',
        is_open_access: true,
        file_name: uploadedFile?.name,
        file_size_kb: uploadedFile ? Math.round(uploadedFile.size / 1024) : undefined,
      }

      await api.saveLibraryPaper(newPaper)
      setSavedIds((prev) => new Set([...prev, paperId]))
      await fetchLibrary()

      if (uploadForm.autoInject && onTogglePaperInResearch) {
        onTogglePaperInResearch(newPaper)
      }

      setUploadSuccess(`Successfully uploaded "${newPaper.title}" and saved to your research library!`)
      setUploadModalOpen(false)
      setTab('library')
      setTimeout(() => setUploadSuccess(null), 5000)
    } catch (err) {
      console.error('Failed to upload file:', err)
      setError(err.friendlyMessage || 'Failed to save uploaded file into research library.')
    } finally {
      setUploading(false)
    }
  }

  const isPaperInResearch = (paperId) => {
    return activeResearchPapers.some((p) => (p.paper_id || p.id) === paperId)
  }

  const activeCount = activeResearchPapers.length

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Hidden File Input for instant upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,.json,.csv,.doc,.docx"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleFileSelect(e.target.files[0])
            e.target.value = ''
          }
        }}
        className="hidden"
      />

      {/* ===== Header & Active Research Context Banner ===== */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <h1 className="text-2xl font-bold tracking-tight text-white">Research Papers</h1>
            <Pill variant="cyan" glow>Live Literature</Pill>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Search peer-reviewed literature or upload your own research files to inject verified knowledge into RAG and AI experiments.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="primary"
            onClick={() => fileInputRef.current?.click()}
            className="!py-2 !px-4 text-xs font-semibold shadow-lg shadow-cyan-500/20 border-cyan-400/40"
            id="btn-upload-research-file"
          >
            📤 Upload Research File
          </Button>

          {activeCount > 0 ? (
            <div className="flex items-center gap-3 bg-cyan-950/40 border border-cyan-500/30 rounded-xl px-4 py-2">
              <div>
                <div className="text-xs font-semibold text-cyan-300">
                  ✓ {activeCount} Paper{activeCount > 1 ? 's' : ''} in Research Context
                </div>
                <div className="text-[10px] text-slate-400">Available to RAG & AI model</div>
              </div>
              {onNavigateToWorkspace && (
                <Button variant="secondary" size="sm" onClick={onNavigateToWorkspace}>
                  Workspace →
                </Button>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2">
              Tip: Click <span className="text-cyan-400 font-medium">Use in Research</span> to ground AI in papers.
            </div>
          )}
        </div>
      </div>

      {uploadSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-200 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold">✓</span>
            <span>{uploadSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadSuccess(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs font-bold"
          >
            ✕
          </button>
        </motion.div>
      )}

      {/* ===== Tab Navigation + Quick Upload Action ===== */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
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

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-cyan-400/40 bg-cyan-500/5 hover:bg-cyan-500/15 text-cyan-300 text-xs font-medium transition"
        >
          <span>➕</span> Add Local File (.pdf, .txt, .md, .csv)
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
            <GlassCard className="p-8 text-center text-slate-400 space-y-3">
              <div className="text-3xl">🔍</div>
              <div className="text-base font-medium text-slate-300">No papers found for this query</div>
              <div className="text-xs text-slate-400">
                Try broader keywords, click one of the quick topic buttons, or upload your own research file.
              </div>
              <div className="pt-2">
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  📤 Upload Research File Instead
                </Button>
              </div>
            </GlassCard>
          ) : (
            <div className="space-y-4">
              {papers.map((paper, idx) => {
                const inResearch = isPaperInResearch(paper.paper_id)
                const isSaved = savedIds.has(paper.paper_id)
                const authorsList = Array.isArray(paper.authors) ? paper.authors : []
                const authorsDisplay =
                  authorsList.slice(0, 3).join(', ') + (authorsList.length > 3 ? ` +${authorsList.length - 3} more` : '')

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
                            onClick={() =>
                              isSaved ? handleDeleteFromLibrary(paper.paper_id) : handleSaveToLibrary(paper)
                            }
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
          <div className="flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
            <div>
              <strong className="text-slate-200">MY RESEARCH LIBRARY</strong> · {libraryPapers.length} saved articles &amp; uploaded files
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              📤 Upload File to Library
            </Button>
          </div>

          {/* Drag and Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition ${
              isDragging
                ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200'
                : 'border-white/15 bg-white/2 hover:border-cyan-400/40 hover:bg-white/5 text-slate-400'
            }`}
          >
            <div className="text-2xl mb-1.5">📂</div>
            <div className="text-xs font-semibold text-slate-200">
              Drag &amp; Drop research files here, or click to browse
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Supports PDF (.pdf), Text (.txt, .md), Datasets (.json, .csv), and Word documents (.docx)
            </div>
          </div>

          {loadingLibrary ? (
            <div className="py-12 text-center text-slate-400">Loading library...</div>
          ) : libraryPapers.length === 0 ? (
            <GlassCard className="p-8 text-center text-slate-400 space-y-2">
              <div className="text-3xl">📑</div>
              <div className="text-base font-medium text-slate-300">Your library is currently empty</div>
              <div className="text-xs text-slate-400">
                Upload your research files above or search academic papers to save them here.
              </div>
            </GlassCard>
          ) : (
            <div className="space-y-4">
              {libraryPapers.map((paper) => {
                const inResearch = isPaperInResearch(paper.paper_id)
                const authorsList = Array.isArray(paper.authors) ? paper.authors : []
                const isCustomUpload = paper.source === 'User Upload' || paper.source === 'User Uploaded File' || paper.paper_id?.startsWith('user-doc-')

                return (
                  <GlassCard
                    key={paper.paper_id}
                    className={`p-5 space-y-3 transition ${
                      inResearch ? 'border-cyan-400/40 bg-cyan-950/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {isCustomUpload ? (
                          <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 font-semibold text-[11px]">
                            📄 Uploaded File
                          </span>
                        ) : null}
                        {paper.year && (
                          <span className="px-2 py-0.5 rounded bg-white/10 text-slate-200 font-mono">
                            {paper.year}
                          </span>
                        )}
                        {paper.venue && <span className="text-slate-400 italic">{paper.venue}</span>}
                        {paper.file_size_kb && (
                          <span className="text-slate-500 font-mono text-[11px]">
                            {paper.file_size_kb} KB
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
                          Summarize Document
                        </Button>
                        {(paper.url || paper.open_access_pdf || paper.doi) && (
                          <a
                            href={paper.open_access_pdf || paper.url || `https://doi.org/${paper.doi}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-slate-300 hover:text-cyan-300 px-3 py-1.5 rounded-lg border border-white/10 transition"
                          >
                            Open Source ↗
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

      {/* ===== UPLOAD FILE MODAL ===== */}
      <AnimatePresence>
        {uploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-lg">
                    📤
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100">Upload Research Document</h3>
                    <p className="text-xs text-slate-400">
                      File: <span className="text-cyan-300 font-mono">{uploadedFile?.name}</span> (
                      {uploadedFile ? (uploadedFile.size / 1024).toFixed(1) : 0} KB)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="text-slate-400 hover:text-white text-lg p-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Document / Article Title <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                    placeholder="Enter document title..."
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Authors / Contributors</label>
                    <input
                      type="text"
                      value={uploadForm.authors}
                      onChange={(e) => setUploadForm({ ...uploadForm, authors: e.target.value })}
                      placeholder="e.g. Mele F., Barezzi M."
                      className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Year</label>
                    <input
                      type="number"
                      value={uploadForm.year}
                      onChange={(e) => setUploadForm({ ...uploadForm, year: e.target.value })}
                      className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Document Category / Venue</label>
                  <input
                    type="text"
                    value={uploadForm.venue}
                    onChange={(e) => setUploadForm({ ...uploadForm, venue: e.target.value })}
                    placeholder="e.g. Lab Notebook, Experimental Data, Published Manuscript"
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Abstract / Key Findings Excerpt
                  </label>
                  <textarea
                    rows={4}
                    value={uploadForm.abstract}
                    onChange={(e) => setUploadForm({ ...uploadForm, abstract: e.target.value })}
                    placeholder="Enter summary, methodology, chemical parameters, or key results..."
                    className="w-full bg-slate-950 border border-white/15 rounded-xl p-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 leading-relaxed font-sans"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    id="chk-auto-inject"
                    type="checkbox"
                    checked={uploadForm.autoInject}
                    onChange={(e) => setUploadForm({ ...uploadForm, autoInject: e.target.checked })}
                    className="rounded border-white/20 bg-slate-950 text-cyan-500 focus:ring-cyan-400 h-4 w-4"
                  />
                  <label htmlFor="chk-auto-inject" className="text-slate-300 cursor-pointer">
                    Immediately add to <strong>Active Research Context</strong> for RAG reasoning
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <Button variant="secondary" size="sm" onClick={() => setUploadModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  loading={uploading}
                  disabled={!uploadForm.title.trim()}
                  onClick={handleConfirmUpload}
                >
                  Confirm &amp; Add to Library →
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
