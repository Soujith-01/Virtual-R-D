import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import * as api from './api/client'
import { DEMO_QUESTION, PIPELINE_STEPS } from './lib/constants'

import Sidebar from './components/Sidebar'
import Landing from './components/Landing'
import ChooseExperiment from './components/ChooseExperiment'
import Workspace from './components/Workspace'
import ManualWorkspace from './components/ManualWorkspace'
import ExperimentGrid from './components/ExperimentGrid'
import { ScoreBreakdownChart, YieldComparisonChart } from './components/Charts'
import VirtualReactor from './components/VirtualReactor'
import ResearchReport from './components/ResearchReport'
import PipelineOverlay from './components/PipelineOverlay'
import RunHistory from './components/RunHistory'
import { Button, ErrorBanner, GlassCard } from './components/ui'

/** Keep only the five model inputs - the API rejects unknown fields. */
const toParams = (experiment) => ({
  temperature: Number(experiment.temperature),
  pressure: Number(experiment.pressure),
  catalyst: experiment.catalyst,
  concentration: Number(experiment.concentration),
  reaction_time: Number(experiment.reaction_time),
})

export default function App() {
  // step order (ai mode): landing → choose → workspace → experiments → simulation → report
  // step order (manual mode): landing → workspace (ManualWorkspace)
  const [step, setStep] = useState('landing')
  const [mode, setMode] = useState('ai')

  // Template selected from ChooseExperiment screen
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  const [health, setHealth] = useState(null)
  const [designSpace, setDesignSpace] = useState(null)
  const [history, setHistory] = useState({ available: false, runs: [] })

  const [research, setResearch] = useState(null)
  const [simulation, setSimulation] = useState(null)
  const [simulationTitle, setSimulationTitle] = useState('Virtual reactor')
  const [selectedId, setSelectedId] = useState(null)

  const [question, setQuestion] = useState(DEMO_QUESTION)
  const [busy, setBusy] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [activeStage, setActiveStage] = useState(0)
  const [simulating, setSimulating] = useState(false)
  const [error, setError] = useState(null)

  const demoTimers = useRef([])
  const demoRef = useRef(false)

  /* ------------------------------ bootstrap ------------------------------ */

  const loadSystem = useCallback(async () => {
    try {
      const [healthPayload, designPayload] = await Promise.all([api.getHealth(), api.getDesignSpace()])
      setHealth(healthPayload)
      setDesignSpace(designPayload)
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

  /* ------------------------------ pipeline ------------------------------ */

  const runPipeline = async (objective, numExperiments = 5, constraints = null, { demo = false } = {}) => {
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
      const [payload] = await Promise.all([
        api.runResearch({
          research_question: objective,
          num_experiments: numExperiments,
          constraints: constraints || undefined,
          include_simulation: true,
          include_comparison: true,
        }),
        new Promise((resolve) => setTimeout(resolve, 2700)),
      ])

      setActiveStage(PIPELINE_STEPS.length - 1)
      setResearch(payload)
      setSelectedId(payload.recommended_experiment?.id ?? null)
      setStep('experiments')
      api.getHistory(9).then(setHistory).catch(() => {})

      if (demo) later(() => simulateFor(payload.recommended_experiment, payload.simulation), 1900)
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

  const simulateFor = async (experiment, presetSimulation = null) => {
    if (!experiment) return
    clearDemoTimers()

    setSelectedId(experiment.id ?? selectedId)
    setSimulationTitle(
      experiment.id?.startsWith('NEXT')
        ? 'Virtual reactor · next suggested experiment'
        : `Virtual reactor · ${experiment.id ?? 'custom experiment'}`,
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
      const payload = await api.simulate({ ...toParams(experiment), speed: 1 })
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

  /* ------------------------------ navigation ------------------------------ */

  const reset = () => {
    clearDemoTimers()
    demoRef.current = false
    setResearch(null)
    setSimulation(null)
    setSelectedId(null)
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
    setStep('choose')          // AI mode now starts at Choose Experiment
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
    if (step === 'landing') {
      return (
        <Landing
          health={health}
          onStartManual={startManual}
          onStartAI={startAI}
          onStart={() => startAI()}
          onDemo={() => runPipeline(DEMO_QUESTION, 5, null, { demo: true })}
          loadingDemo={busy}
        />
      )
    }

    if (step === 'choose') {
      return (
        <ChooseExperiment
          onSelect={handleTemplateSelect}
          onBack={reset}
        />
      )
    }

    if (step === 'workspace') {
      if (mode === 'manual') {
        return <ManualWorkspace onSwitchToAI={switchToAIFromManual} />
      }

      return (
        <>
          <Workspace
            initialQuestion={question}
            designSpace={designSpace}
            busy={busy}
            template={selectedTemplate}
            onSubmit={(objective, count, constraints) => runPipeline(objective, count, constraints)}
            onSimulate={(params) => simulateFor(params)}
            onChooseTemplate={() => setStep('choose')}
          />
          <div className="mx-auto max-w-[1500px] px-5 pb-16">
            <RunHistory runs={history.runs} available={history.available} onOpen={openRun} />
          </div>
        </>
      )
    }

    if (step === 'experiments') {
      return (
        <div className="mx-auto max-w-[1500px] px-5 pb-16">
          <ExperimentGrid
            experiments={research?.candidate_experiments || []}
            objective={research?.research_objective}
            search={research?.search}
            knowledgeCount={research?.retrieved_knowledge?.length ?? 0}
            selectedId={selectedId}
            recommendedId={research?.recommended_experiment?.id}
            onSimulate={simulateFor}
            template={selectedTemplate}
          >
            <div className="grid gap-5 xl:grid-cols-2">
              <YieldComparisonChart
                experiments={research?.candidate_experiments || []}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
              <ScoreBreakdownChart experiments={research?.candidate_experiments || []} />
            </div>
            <GlassCard className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <div className="text-sm font-medium text-slate-100">
                  Ready to run the recommended experiment?
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  The virtual reactor walks through all six process stages and reports the simulated
                  outcome next to the model prediction.
                </p>
              </div>
              <Button onClick={() => simulateFor(research?.recommended_experiment, research?.simulation)}>
                ⚗ Start virtual experiment
              </Button>
            </GlassCard>
          </ExperimentGrid>
        </div>
      )
    }

    if (step === 'simulation') {
      return (
        <div className="mx-auto max-w-[1500px] px-5 pb-16">
          {simulating && !simulation ? (
            <GlassCard className="p-10 text-center text-sm text-slate-400">
              Preparing the virtual reactor…
            </GlassCard>
          ) : (
            <VirtualReactor
              simulation={simulation}
              title={simulationTitle}
              onComplete={handleSimulationComplete}
              onExit={() => setStep('report')}
            />
          )}
        </div>
      )
    }

    return (
      <div className="mx-auto max-w-[1500px] px-5">
        <ResearchReport research={research} onSimulate={simulateFor} onReset={reset} />
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
              Nucleus AI R&amp;D Lab · AI-powered experimental discovery · prototype for demonstration
            </span>
            <span className="mono">
              Dataset provenance: synthetic_prototype_v1 · model: RandomForestRegressor
            </span>
          </div>
        </footer>
      </div>

      <PipelineOverlay visible={overlayVisible} activeStage={activeStage} question={question} />
    </div>
  )
}
