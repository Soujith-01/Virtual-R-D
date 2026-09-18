import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import * as api from './api/client'
import { DEMO_QUESTION, PIPELINE_STEPS, DOMAINS } from './lib/constants'
import { getPredictionKey, getTargetLabel, getTargetUnit, paramValue } from './lib/format'

import Sidebar from './components/Sidebar'
import Landing from './components/Landing'
import ChooseExperiment from './components/ChooseExperiment'
import Workspace from './components/Workspace'
import ExperimentGrid from './components/ExperimentGrid'
import { ScoreBreakdownChart, YieldComparisonChart } from './components/Charts'
import VirtualReactor from './components/VirtualReactor'
import ResearchReport from './components/ResearchReport'
import PipelineOverlay from './components/PipelineOverlay'
import RunHistory from './components/RunHistory'
import ManualWorkspace from './components/ManualWorkspace'
import ResearchPapers from './components/ResearchPapers'
import ApparatusSetup, { DOMAIN_APPARATUS } from './components/ApparatusSetup'
import { getLiveExperimentState } from './components/LiveActivityPanel'
import ExperimentCopilot from './components/ExperimentCopilot'
import { LoginPage, RegisterPage } from './components/AuthPages'
import AdminDashboard from './components/AdminDashboard'
import { Button, ErrorBanner, GlassCard, Spinner } from './components/ui'

/** Convert hyphenated domain id (react router style) to underscore (backend style) */
const toBackendDomain = (domainId) => (domainId || 'reaction-yield').replace(/-/g, '_')

/** Keep only the domain-specific model inputs */
const toParams = (experiment, domainId) => {
  const params = {}
  const domain = DOMAINS[domainId]

  if (!domain) {
    // Fallback to reaction yield params
    return {
      temperature: Number(experiment.temperature),
      pressure: Number(experiment.pressure),
      catalyst: experiment.catalyst,
      concentration: Number(experiment.concentration),
      reaction_time: Number(experiment.reaction_time),
    }
  }

  for (const key of domain.featureKeys) {
    if (key === 'catalyst') {
      params[key] = experiment[key]
    } else {
      params[key] = Number(experiment[key])
    }
  }

  return params
}

const getPredictionValue = (experiment, domainId) => {
  const key = getPredictionKey(domainId)
  return experiment[key]
}

const getTargetUnitForDomain = (domainId) => {
  return getTargetUnit(domainId)
}

const STEP_TO_PATH = {
  login: '/login',
  register: '/register',
  admin: '/admin',
  landing: '/',
  papers: '/papers',
  choose: '/choose',
  workspace: '/workspace',
  experiments: '/experiments',
  apparatus: '/apparatus',
  simulation: '/simulation',
  report: '/report',
}

const PATH_TO_STEP = {
  '/login': 'login',
  '/register': 'register',
  '/admin': 'admin',
  '/': 'landing',
  '/papers': 'papers',
  '/choose': 'choose',
  '/workspace': 'workspace',
  '/experiments': 'experiments',
  '/apparatus': 'apparatus',
  '/simulation': 'simulation',
  '/report': 'report',
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const getInitialStep = () => {
    if (typeof window === 'undefined') return 'login'
    const path = window.location.pathname.replace(/\/$/, '') || '/'
    return PATH_TO_STEP[path] || 'login'
  }

  // step order (ai mode): login/register/admin or landing → choose → workspace → experiments → simulation → report
  const [step, _setStepState] = useState(getInitialStep)
  const [mode, setMode] = useState('ai')

  const setStep = useCallback((newStep, pushHistory = true) => {
    _setStepState(newStep)
    if (typeof window !== 'undefined') {
      const path = STEP_TO_PATH[newStep] || '/'
      if (pushHistory && window.location.pathname !== path) {
        window.history.pushState({ step: newStep }, '', path)
      }
    }
  }, [])

  // Check auth session on startup
  useEffect(() => {
    const initAuth = async () => {
      const token = api.getStoredAuthToken()
      const currentPath = window.location.pathname.replace(/\/$/, '') || '/'

      if (!token) {
        setAuthLoading(false)
        if (currentPath === '/register') {
          setStep('register', false)
        } else {
          setStep('login', false)
        }
        return
      }

      try {
        const user = await api.getCurrentUser()
        if (user && user.status === 'approved') {
          setCurrentUser(user)
          if (currentPath === '/login' || currentPath === '/register') {
            if (user.role === 'admin') {
              setStep('admin', false)
            } else {
              setStep('landing', false)
            }
          } else {
            const target = PATH_TO_STEP[currentPath] || (user.role === 'admin' ? 'admin' : 'landing')
            setStep(target, false)
          }
        } else {
          api.clearAuthToken()
          setCurrentUser(null)
          setStep('login', false)
        }
      } catch (err) {
        api.clearAuthToken()
        setCurrentUser(null)
        setStep('login', false)
      } finally {
        setAuthLoading(false)
      }
    }

    initAuth()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePopState = (event) => {
      const path = window.location.pathname.replace(/\/$/, '') || '/'
      const targetStep = event.state?.step || PATH_TO_STEP[path] || 'login'

      // Protection check on back/forward
      if (!api.getStoredAuthToken() && targetStep !== 'login' && targetStep !== 'register') {
        _setStepState('login')
      } else {
        _setStepState(targetStep)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Template selected from ChooseExperiment screen
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  const [health, setHealth] = useState(null)
  const [designSpace, setDesignSpace] = useState(null)
  const [modelStatus, setModelStatus] = useState(null)
  const [history, setHistory] = useState({ available: false, runs: [] })

  const [research, setResearch] = useState(null)
  const [simulation, setSimulation] = useState(null)
  const [simulationTitle, setSimulationTitle] = useState('Virtual experiment')
  const [selectedId, setSelectedId] = useState(null)
  const [selectedExperimentForApparatus, setSelectedExperimentForApparatus] = useState(null)

  // Research papers context
  const [activeResearchPapers, setActiveResearchPapers] = useState([])
  const [papersQuery, setPapersQuery] = useState('')

  const [question, setQuestion] = useState(DEMO_QUESTION)
  const [busy, setBusy] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [activeStage, setActiveStage] = useState(0)
  const [simulating, setSimulating] = useState(false)
  const [error, setError] = useState(null)

  const demoTimers = useRef([])
  const demoRef = useRef(false)

  /* ---------------------- Experiment Copilot Context ---------------------- */

  const currentDomainId = selectedTemplate?.domain || 'reaction-yield'

  const currentCandidate = useMemo(() => {
    if (!research?.candidates?.length) return null
    if (selectedId) {
      return research.candidates.find((c) => c.id === selectedId) || research.candidates[0]
    }
    return research.candidates[0]
  }, [research, selectedId])

  const currentExperiment = useMemo(() => {
    return (
      selectedExperimentForApparatus?.experiment ||
      currentCandidate?.experiment ||
      currentCandidate ||
      selectedTemplate?.params ||
      {}
    )
  }, [selectedExperimentForApparatus, currentCandidate, selectedTemplate])

  const liveSimState = useMemo(() => {
    if (!simulation) {
      return { stage: 'STANDBY', current_action: 'Reaction system ready.' }
    }
    try {
      const derived = getLiveExperimentState({
        stage: simulation.stages?.[activeStage]?.name || 'REACTION',
        stageProgress: 50,
        overallProgress: Math.min(100, Math.round(((activeStage + 1) / (simulation.stages?.length || 1)) * 100)),
        experiment: currentExperiment,
        domainId: currentDomainId,
        simulation,
      })
      return {
        stage: simulation.stages?.[activeStage]?.name || 'RUNNING',
        current_action: derived.currentAction,
        detail: derived.detail,
        mixture_state: derived.mixtureState,
        contents: derived.contents,
        overall_progress: derived.overallProgress,
      }
    } catch {
      return { stage: 'RUNNING', current_action: 'Monitoring active experiment reaction.' }
    }
  }, [simulation, activeStage, currentExperiment, currentDomainId])

  const currentApparatusList = useMemo(() => {
    return DOMAIN_APPARATUS[currentDomainId] || DOMAIN_APPARATUS['reaction-yield'] || []
  }, [currentDomainId])

  const copilotContext = useMemo(() => {
    return {
      page: step,
      mode,
      domain: toBackendDomain(currentDomainId),
      objective: question,
      experiment: currentExperiment,
      selected_experiment: currentExperiment,
      candidate_experiments: research?.candidates || [],
      selected_candidate: currentCandidate,
      predicted_result: currentCandidate
        ? {
            predicted_yield: currentCandidate.predicted_yield,
            uncertainty_std: currentCandidate.uncertainty_std,
            confidence: currentCandidate.confidence,
          }
        : null,
      simulation: liveSimState,
      simulation_stage: liveSimState,
      current_apparatus: currentApparatusList,
      papers: activeResearchPapers || [],
      research_papers: activeResearchPapers || [],
      research_report: research
        ? {
            recommended: research.recommended,
            metrics: research.metrics,
            findings: research.findings,
          }
        : null,
    }
  }, [
    step,
    mode,
    currentDomainId,
    question,
    currentExperiment,
    research,
    currentCandidate,
    liveSimState,
    currentApparatusList,
    activeResearchPapers,
  ])

  /* ------------------------------ bootstrap ------------------------------ */

  const loadSystem = useCallback(async () => {
    try {
      const [healthPayload, designPayload, modelStatusPayload] = await Promise.all([
        api.getHealth(),
        api.getDesignSpace(),
        api.getModelStatus ? api.getModelStatus() : Promise.resolve({ models: {} }),
      ])
      setHealth(healthPayload)
      setDesignSpace(designPayload)
      setModelStatus(modelStatusPayload)
      setError(null)
    } catch (error) {
      setError(error.friendlyMessage || 'Could not reach the backend.')
    }
    try {
      setHistory(await api.getHistory(9))
    } catch {
      setHistory({ available: false, runs: [] })
    }
  }, [])

  useEffect(() => {
    loadSystem()
  }, [loadSystem])

  useEffect(() => () => demoTimers.current.forEach(clearTimeout), [])

  const clearDemoTimers = () => {
    demoTimers.current.forEach(clearTimeout)
    demoTimers.current = []
  }

  const later = (callback, delay) => {
    const id = setTimeout(callback, delay)
    demoTimers.current.push(id)
    return id
  }

  const handleTogglePaperInResearch = useCallback((paper) => {
    const pId = paper.paper_id || paper.id
    setActiveResearchPapers((prev) => {
      const exists = prev.some((p) => (p.paper_id || p.id) === pId)
      if (exists) {
        return prev.filter((p) => (p.paper_id || p.id) !== pId)
      }
      return [...prev, paper]
    })
  }, [])

  const handleFindPapers = useCallback((searchQuery) => {
    if (searchQuery) {
      // Synthesize clean search query keywords
      const clean = searchQuery
        .toLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
        .replace(/\b(maximize|minimize|optimise|optimize|while|with|and|the|for|in|of|a|an|to)\b/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 6)
        .join(' ')
      setPapersQuery(clean ? `${clean} machine learning` : searchQuery)
    }
    setStep('papers')
  }, [setStep])

  /* ------------------------------ pipeline ------------------------------ */

  const runPipeline = async (objective, numExperiments = 5, constraints = null, { demo = false, domainId = 'reaction-yield' } = {}) => {
    clearDemoTimers()
    demoRef.current = demo

    setError(null)
    setBusy(true)
    setResearch(null)
    setSimulation(null)
    setSelectedId(null)
    setQuestion(objective)
    setStep('workspace')
    setOverlayVisible(true)
    setActiveStage(0)

    const ticker = setInterval(
      () => setActiveStage((value) => Math.min(value + 1, PIPELINE_STEPS.length - 1)),
      340,
    )

    try {
      // Use domain-specific research endpoint or fallback to generic
      const researchPayload = {
        research_question: objective,
        num_experiments: numExperiments,
        constraints: constraints || undefined,
        include_simulation: true,
        include_comparison: true,
        domain: toBackendDomain(domainId),
        papers: activeResearchPapers.length > 0 ? activeResearchPapers : undefined,
      }

      const [payload] = await Promise.all([
        api.runResearch(researchPayload),
        new Promise((resolve) => setTimeout(resolve, 2700)),
      ])

      setActiveStage(PIPELINE_STEPS.length - 1)
      setResearch(payload)
      setSelectedId(payload.recommended_experiment?.id ?? null)
      setStep('experiments')
      api.getHistory(9).then(setHistory).catch(() => {})

      if (demo) later(() => simulateFor(payload.recommended_experiment, payload.simulation, domainId), 1900)
    } catch (error) {
      setError(error.friendlyMessage || 'The research pipeline failed.')
      setStep('workspace')
    } finally {
      clearInterval(ticker)
      setBusy(false)
      setOverlayVisible(false)
    }
  }

  /* ------------------------------ simulation ------------------------------ */

  const simulateFor = async (experiment, presetSimulation = null, domainId = 'reaction-yield') => {
    if (!experiment) return
    clearDemoTimers()

    setSelectedId(experiment.id ?? selectedId)

    const domain = DOMAINS[domainId] || DOMAINS['reaction-yield']
    setSimulationTitle(
      experiment.id?.startsWith('NEXT')
        ? `${domain.label} · virtual experiment · next suggested`
        : `${domain.label} · virtual experiment · ${experiment.id ?? 'custom'}`,
    )

    const isRecommended = presetSimulation && research?.recommended_experiment?.id === experiment.id
    if (isRecommended) {
      setSimulation(presetSimulation)
      setStep('simulation')
      return
    }

    setSimulating(true)
    setError(null)
    try {
      const payload = await api.simulate({
        ...toParams(experiment, domainId),
        speed: 1,
        domain: toBackendDomain(domainId),
      })
      setSimulation(payload)
      setStep('simulation')
    } catch (error) {
      setError(error.friendlyMessage || 'The virtual simulation failed.')
    } finally {
      setSimulating(false)
    }
  }

  const handleSimulationComplete = () => {
    if (demoRef.current) later(() => setStep('report'), 1500)
  }

  /* ------------------------------ auth & navigation ------------------------------ */

  const handleLoginSuccess = (data) => {
    api.setAuthToken(data.access_token)
    setCurrentUser(data.user)
    if (data.user?.role === 'admin') {
      setStep('admin')
    } else {
      setStep('landing')
    }
  }

  const handleLogout = async () => {
    try {
      await api.logoutUser()
    } catch {
      // ignore
    }
    api.clearAuthToken()
    setCurrentUser(null)
    reset()
    setStep('login')
  }

  const reset = () => {
    clearDemoTimers()
    demoRef.current = false
    setResearch(null)
    setSimulation(null)
    setSelectedId(null)
    setSelectedExperimentForApparatus(null)
    setSelectedTemplate(null)
    setError(null)
    setStep('landing')
  }

  const openRun = async (runId) => {
    try {
      const record = await api.getRun(runId)
      if (record?.payload) {
        setResearch(record.payload)
        setSelectedId(record.payload.recommended_experiment?.id ?? null)
        setStep('report')
      }
    } catch (error) {
      setError(error.friendlyMessage || 'Could not load that run.')
    }
  }

  const navigate = (target) => {
    if (!currentUser) {
      setStep(target === 'register' ? 'register' : 'login')
      return
    }
    if (target === 'admin') {
      if (currentUser.role === 'admin') setStep('admin')
      return
    }
    if (target === 'landing') { reset(); return }
    if (target === 'choose') { setStep('choose'); return }
    setStep(target)
  }

  /* ------------------------------ mode switch ------------------------------ */

  const startManual = () => {
    setMode('manual')
    setStep('workspace')
    setSelectedTemplate(null)
    setError(null)
  }

  const startAI = () => {
    setMode('ai')
    setStep('choose')
    setSelectedTemplate(null)
    setError(null)
  }

  const switchToAIFromManual = () => {
    setMode('ai')
    setStep('choose')
  }

  /* ------------------------------ template selection ------------------------------ */

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template)
    setStep('workspace')
    if (template.defaultObjective) setQuestion(template.defaultObjective)
  }

  /* -------------------------------- render -------------------------------- */

  const renderStep = () => {
    if (step === 'login') {
      return (
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onNavigateToRegister={() => setStep('register')}
        />
      )
    }

    if (step === 'register') {
      return (
        <RegisterPage
          onRegisterSuccess={() => {}}
          onNavigateToLogin={() => setStep('login')}
        />
      )
    }

    // Protected routes: require authenticated user
    if (!currentUser) {
      return (
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onNavigateToRegister={() => setStep('register')}
        />
      )
    }

    if (step === 'admin') {
      if (currentUser.role !== 'admin') {
        // Non-admins cannot access /admin
        return (
          <div className="mx-auto max-w-[1500px] px-5 py-12">
            <GlassCard strong className="p-8 text-center max-w-lg mx-auto border-rose-400/30">
              <div className="text-3xl mb-3">⛔</div>
              <h2 className="text-lg font-bold text-rose-200">Access Denied</h2>
              <p className="mt-2 text-xs text-slate-400">
                You do not have administrative privileges to view this section.
              </p>
              <div className="mt-5">
                <Button onClick={() => setStep('landing')}>
                  ← Return to R&amp;D Lab
                </Button>
              </div>
            </GlassCard>
          </div>
        )
      }

      return (
        <AdminDashboard
          currentUser={currentUser}
          onLogout={handleLogout}
          onNavigateToApp={() => setStep('landing')}
        />
      )
    }
    if (step === 'landing') {
      return (
        <Landing
          health={health}
          onStartManual={startManual}
          onStartAI={startAI}
          onStart={() => startAI()}
          onDemo={() => runPipeline(DEMO_QUESTION, 5, null, { demo: true, domainId: 'reaction-yield' })}
          loadingDemo={busy}
        />
      )
    }

    if (step === 'papers') {
      return (
        <div className="mx-auto max-w-[1500px] px-5 pb-16">
          <ResearchPapers
            initialQuery={papersQuery}
            activeResearchPapers={activeResearchPapers}
            onTogglePaperInResearch={handleTogglePaperInResearch}
            onNavigateToWorkspace={() => setStep('workspace')}
            selectedTemplate={selectedTemplate}
          />
        </div>
      )
    }

    if (step === 'choose') {
      return (
        <ChooseExperiment
          onSelect={handleTemplateSelect}
          onBack={reset}
          onFindPapers={handleFindPapers}
        />
      )
    }

    if (step === 'workspace') {
      if (mode === 'manual') {
        return (
          <div className="mx-auto max-w-[1500px] px-5 pb-16">
            <ManualWorkspace onSwitchToAI={switchToAIFromManual} />
          </div>
        )
      }

      const domainId = selectedTemplate?.id || 'reaction-yield'
      const domain = DOMAINS[domainId] || DOMAINS['reaction-yield']

      return (
        <>
          <Workspace
            initialQuestion={question}
            designSpace={designSpace}
            busy={busy}
            template={selectedTemplate}
            domain={domain}
            activeResearchPapers={activeResearchPapers}
            onFindPapers={handleFindPapers}
            onTogglePaperInResearch={handleTogglePaperInResearch}
            onSubmit={(objective, count, constraints) => runPipeline(objective, count, constraints, { domainId })}
            onSimulate={(params) => simulateFor(params, null, domainId)}
            onChooseTemplate={() => setStep('choose')}
          />
          <div className="mx-auto max-w-[1500px] px-5 pb-16">
            <RunHistory runs={history.runs} available={history.available} onOpen={openRun} />
          </div>
        </>
      )
    }

    if (step === 'experiments') {
      if (!research || !research.candidate_experiments || research.candidate_experiments.length === 0) {
        return (
          <div className="mx-auto max-w-[1500px] px-5 pb-16">
            <GlassCard className="p-10 text-center max-w-xl mx-auto my-12 space-y-4">
              <div className="text-4xl">📊</div>
              <div className="text-lg font-semibold text-slate-100">No Candidate Experiments Yet</div>
              <p className="text-xs leading-relaxed text-slate-400">
                Run an AI research pipeline or pick an experiment domain from the workspace to generate candidate experiments.
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <Button onClick={() => setStep('choose')}>
                  🔬 Choose Experiment Domain
                </Button>
                <Button variant="secondary" onClick={() => setStep('workspace')}>
                  📝 Go to Workspace
                </Button>
              </div>
            </GlassCard>
          </div>
        )
      }

      const domainId = selectedTemplate?.id || 'reaction-yield'
      const domain = DOMAINS[domainId] || DOMAINS['reaction-yield']
      const predKey = getPredictionKey(domainId)

      // Transform experiments to use generic field names for the grid
      const transformedExperiments = (research?.candidate_experiments || []).map(exp => ({
        ...exp,
        predicted_yield: exp[predKey] || exp.predicted_yield || 0,
        predicted_efficiency: exp[predKey] || exp.predicted_efficiency || 0,
        predicted_biomass_yield: exp[predKey] || exp.predicted_biomass_yield || 0,
        predicted_capacity_retention: exp[predKey] || exp.predicted_capacity_retention || 0,
        predicted_turbidity_removal: exp[predKey] || exp.predicted_turbidity_removal || 0,
      }))

      return (
        <div className="mx-auto max-w-[1500px] px-5 pb-16">
          <ExperimentGrid
            experiments={transformedExperiments}
            objective={research?.research_objective}
            search={research?.search}
            knowledgeCount={research?.retrieved_knowledge?.length ?? 0}
            selectedId={selectedId}
            recommendedId={research?.recommended_experiment?.id}
            onSimulate={(params) => {
              setSelectedExperimentForApparatus(params)
              setSelectedId(params?.id ?? null)
              setStep('apparatus')
            }}
            template={selectedTemplate}
            domain={domain}
          >
            <div className="grid gap-5 xl:grid-cols-2">
              <YieldComparisonChart
                experiments={transformedExperiments}
                selectedId={selectedId}
                onSelect={setSelectedId}
                predictionKey={predKey}
              />
              <ScoreBreakdownChart experiments={transformedExperiments} />
            </div>
            <GlassCard className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <div className="text-sm font-medium text-slate-100">
                  Ready to configure apparatus & run the recommended experiment?
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Review the laboratory setup, instruments, and reagents for this candidate before initiating
                  the virtual experiment.
                </p>
              </div>
              <Button onClick={() => {
                const rec = research?.recommended_experiment || transformedExperiments[0]
                setSelectedExperimentForApparatus(rec)
                setSelectedId(rec?.id ?? null)
                setStep('apparatus')
              }}>
                ⚗ Start virtual experiment
              </Button>
            </GlassCard>
          </ExperimentGrid>
        </div>
      )
    }

    if (step === 'apparatus') {
      const domainId = selectedTemplate?.id || 'reaction-yield'
      const exp =
        selectedExperimentForApparatus ||
        research?.recommended_experiment ||
        (research?.candidate_experiments || [])[0]

      return (
        <ApparatusSetup
          experiment={exp}
          selectedTemplate={selectedTemplate}
          activeResearchPapers={activeResearchPapers}
          research={research}
          onPerformExperiment={(targetExp) => simulateFor(targetExp || exp, null, domainId)}
          onBack={() => setStep('experiments')}
        />
      )
    }

    if (step === 'simulation') {
      const domainId = selectedTemplate?.id || 'reaction-yield'
      return (
        <div className="mx-auto max-w-[1500px] px-5 pb-16">
          {simulating && !simulation ? (
            <GlassCard className="p-10 text-center text-sm text-slate-400">
              Preparing the virtual experiment…
            </GlassCard>
          ) : simulation ? (
            <VirtualReactor
              simulation={simulation}
              title={simulationTitle}
              onComplete={handleSimulationComplete}
              onExit={() => setStep('report')}
              domainId={domainId}
            />
          ) : (
            <GlassCard className="p-10 text-center max-w-xl mx-auto my-12 space-y-4">
              <div className="text-4xl">⚗️</div>
              <div className="text-lg font-semibold text-slate-100">No Virtual Experiment Active</div>
              <p className="text-xs leading-relaxed text-slate-400">
                Start a research pipeline or design an experiment to launch the interactive virtual reactor simulation.
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <Button onClick={() => setStep('choose')}>
                  🔬 Choose Experiment
                </Button>
                <Button variant="secondary" onClick={() => setStep('workspace')}>
                  📝 Open Workspace
                </Button>
              </div>
            </GlassCard>
          )}
        </div>
      )
    }

    return (
      <div className="mx-auto max-w-[1500px] px-5">
        <ResearchReport
          research={research}
          activeResearchPapers={activeResearchPapers}
          onSimulate={(exp) => simulateFor(exp, null, selectedTemplate?.id || 'reaction-yield')}
          onReset={reset}
        />
      </div>
    )
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="lab-background" />
        <div className="lab-grid" />
        <div className="relative z-10 flex flex-col items-center gap-3 text-center">
          <Spinner className="!h-8 !w-8 border-cyan-400" />
          <div className="text-xs tracking-wider uppercase font-semibold text-cyan-300">
            Initializing NUCLEUS AI...
          </div>
        </div>
      </div>
    )
  }

  if (step === 'login' || step === 'register') {
    return (
      <div className="min-h-screen flex flex-col justify-between">
        <div className="lab-background" />
        <div className="lab-grid" />
        <div className="flex-1 flex flex-col justify-center">
          {renderStep()}
        </div>
        <footer className="mx-auto max-w-[1500px] w-full px-5 pb-8 pt-4 text-center text-[10px] text-slate-500">
          Nucleus AI R&amp;D Lab · Secure Authentication &amp; Admin Approval System
        </footer>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="lab-background" />
      <div className="lab-grid" />

      <Sidebar
        step={step}
        mode={mode}
        health={health}
        selectedTemplate={selectedTemplate}
        onReset={reset}
        onNavigate={navigate}
        currentUser={currentUser}
        onLogout={handleLogout}
        onSwitchMode={(newMode) => {
          if (newMode === 'manual') startManual()
          else startAI()
        }}
      />

      <div className="lab-content flex-1 min-w-0 flex flex-col justify-between">
        <main className="pt-5">
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mx-auto max-w-[1500px] px-5 pb-3"
              >
                <ErrorBanner message={error} onRetry={loadSystem} onDismiss={() => setError(null)} />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${step}-${mode}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="mx-auto max-w-[1500px] w-full px-5 pb-10 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-5 text-[10px] leading-relaxed text-slate-500">
            <span>
              Nucleus AI R&D Lab · Multi-domain AI-powered experimental discovery · prototype for demonstration
            </span>
            <span className="mono">
              Models: RandomForestRegressor · Data: synthetic_prototype_v1 · All domains model-backed
            </span>
          </div>
        </footer>
      </div>

      <PipelineOverlay visible={overlayVisible} activeStage={activeStage} question={question} />
      <ExperimentCopilot context={copilotContext} />
    </div>
  )
}
