import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard, Pill, Meter, Button } from './ui'
import { num, paramValue, yieldTone, getTargetLabel, getTargetUnit } from '../lib/format'

/**
 * Derives the active sentence, detailed scientific explanation,
 * dynamic reactor contents, timeline sub-steps, and progress
 * for the current simulation frame.
 */
export function getLiveExperimentState({ stage, stageProgress = 0, overallProgress = 0, experiment = {}, domainId = 'reaction-yield', simulation = {} }) {
  const p = stageProgress // 0 to 100
  const op = Math.min(100, Math.max(0, Math.round(overallProgress)))

  if (domainId === 'reaction-yield') {
    const catalyst = experiment.catalyst ? `Catalyst ${experiment.catalyst}` : 'Catalyst B'
    const conc = experiment.concentration ? `${experiment.concentration} M` : '0.24 M'
    const temp = experiment.temperature ? `${experiment.temperature}` : '85'
    const press = experiment.pressure ? `${experiment.pressure}` : '2.0'
    const time = experiment.reaction_time ? `${experiment.reaction_time}` : '25'

    // 9 Granular Timeline Sub-Steps
    const timeline = [
      { id: 'prep', label: 'Preparing materials & vessel' },
      { id: 'solv', label: 'Adding Reaction Solvent' },
      { id: 'reagA', label: 'Adding Reagent A' },
      { id: 'reagB', label: 'Adding Reagent B' },
      { id: 'cat', label: `Adding ${catalyst}` },
      { id: 'mix', label: 'Mixing components' },
      { id: 'heat', label: `Heating to ${temp}°C` },
      { id: 'react', label: 'Monitoring reaction conversion' },
      { id: 'sample', label: 'Sampling & HPLC analysis' },
    ]

    let activeStepIndex = 0
    let currentAction = ''
    let detail = ''
    let contents = []
    let mixtureState = ''

    if (stage === 'INITIALIZING') {
      if (p < 25) {
        activeStepIndex = 0
        currentAction = 'Preparing the experimental vessel and checking sensors...'
        detail = 'Sealing the high-pressure autoclave, running dual-point RTD thermal calibration, and testing pressure transducer baseline.'
        contents = [
          { name: 'Reaction Solvent', status: 'Charging...', tone: 'cyan', icon: '💧' },
          { name: 'Reagent A', status: 'Pending', tone: 'slate', icon: '🧪' },
          { name: 'Reagent B', status: 'Pending', tone: 'slate', icon: '🧪' },
          { name: catalyst, status: 'Pending', tone: 'slate', icon: '⚡' },
        ]
        mixtureState = 'Vessel sealed; initializing inert gas purge'
      } else if (p < 50) {
        activeStepIndex = 1
        currentAction = 'Adding reaction solvent to the reaction vessel...'
        detail = 'Anhydrous degassed solvent is pumped into the vessel under inert atmosphere to establish the base liquid phase.'
        contents = [
          { name: 'Reaction Solvent', status: '✓ Added', tone: 'emerald', icon: '💧' },
          { name: 'Reagent A', status: 'Charging...', tone: 'cyan', icon: '🧪' },
          { name: 'Reagent B', status: 'Pending', tone: 'slate', icon: '🧪' },
          { name: catalyst, status: 'Pending', tone: 'slate', icon: '⚡' },
        ]
        mixtureState = 'Solvent charged; ready for starting substrates'
      } else if (p < 75) {
        activeStepIndex = 2
        currentAction = 'Adding Reagent A to the reaction mixture...'
        detail = 'Primary starting substrate is introduced under positive nitrogen displacement to avoid ambient oxidation.'
        contents = [
          { name: 'Reaction Solvent', status: '✓ Added', tone: 'emerald', icon: '💧' },
          { name: 'Reagent A', status: '✓ Added', tone: 'emerald', icon: '🧪' },
          { name: 'Reagent B', status: 'Charging...', tone: 'cyan', icon: '🧪' },
          { name: catalyst, status: 'Pending', tone: 'slate', icon: '⚡' },
        ]
        mixtureState = 'Reagent A dissolved in solvent'
      } else {
        activeStepIndex = 3
        currentAction = 'Adding Reagent B to the mixture...'
        detail = 'Co-reactant is added at stoichiometric ratio. The two substrates are now in solution awaiting catalytic activation.'
        contents = [
          { name: 'Reaction Solvent', status: '✓ Added', tone: 'emerald', icon: '💧' },
          { name: 'Reagent A', status: '✓ Added', tone: 'emerald', icon: '🧪' },
          { name: 'Reagent B', status: '✓ Added', tone: 'emerald', icon: '🧪' },
          { name: catalyst, status: 'Charging...', tone: 'cyan', icon: '⚡' },
        ]
        mixtureState = 'Substrates dissolved; charging catalyst'
      }
    } else if (stage === 'HEATING') {
      if (p < 45) {
        activeStepIndex = 4
        currentAction = `Adding ${catalyst} to initiate the reaction...`
        detail = `${catalyst} stock solution (${conc}) is injected via precision micro-metering pump into the sealed vessel.`
        contents = [
          { name: 'Reaction Solvent', status: '✓ Added', tone: 'emerald', icon: '💧' },
          { name: 'Reagent A', status: '✓ Added', tone: 'emerald', icon: '🧪' },
          { name: 'Reagent B', status: '✓ Added', tone: 'emerald', icon: '🧪' },
          { name: catalyst, status: '✓ Added', tone: 'emerald', icon: '⚡' },
        ]
        mixtureState = 'All reactants and catalyst charged'
      } else {
        activeStepIndex = 5
        currentAction = `Mixing Reagent A, Reagent B and ${catalyst}...`
        detail = `Overhead magnetic impeller is engaged at 600 RPM to create a uniform, homogeneous reaction slurry before thermal activation.`
        contents = [
          { name: 'Reaction Solvent', status: '✓ Added', tone: 'emerald', icon: '💧' },
          { name: 'Reagent A', status: '✓ Mixed', tone: 'emerald', icon: '🧪' },
          { name: 'Reagent B', status: '✓ Mixed', tone: 'emerald', icon: '🧪' },
          { name: catalyst, status: '✓ Dispersed', tone: 'emerald', icon: '⚡' },
        ]
        mixtureState = 'Homogenized reaction slurry'
      }
    } else if (stage === 'STABILIZING') {
      activeStepIndex = 6
      currentAction = `Heating the reaction mixture to ${temp}°C...`
      detail = `Dual-loop jacket circulator is ramping core temperature to ${temp}°C under ${press} bar pressure. Thermal drift is monitored within ±0.2°C.`
      contents = [
        { name: 'Reaction Solvent', status: '✓ Added', tone: 'emerald', icon: '💧' },
        { name: 'Reagent A', status: '✓ Mixed', tone: 'emerald', icon: '🧪' },
        { name: 'Reagent B', status: '✓ Mixed', tone: 'emerald', icon: '🧪' },
        { name: catalyst, status: '✓ Activated', tone: 'cyan', icon: '⚡' },
      ]
      mixtureState = `Holding at ${temp}°C / ${press} bar equilibrium`
    } else if (stage === 'REACTION') {
      activeStepIndex = 7
      currentAction = `Monitoring the reaction as ${catalyst} promotes conversion...`
      detail = `Catalytic conversion is actively proceeding at ${temp}°C and ${press} bar. In-situ ATR-FTIR spectrometer is tracking reactant consumption over the ${time} min target window.`
      contents = [
        { name: 'Substrates A & B', status: 'Converting...', tone: 'cyan', icon: '🧪' },
        { name: catalyst, status: '✓ Actively Catalyzing', tone: 'cyan', icon: '⚡' },
        { name: 'Reaction Product', status: 'Forming...', tone: 'amber', icon: '✨' },
        { name: 'Inert Atmosphere', status: `✓ ${press} bar`, tone: 'emerald', icon: '💨' },
      ]
      mixtureState = 'Active catalytic conversion in progress'
    } else if (stage === 'ANALYZING') {
      activeStepIndex = 8
      currentAction = 'Cooling the reaction mixture before sampling...'
      detail = 'Reaction is thermally quenched by circulating cooling fluid. An automated needle collects an aliquot for chromatographic quantification.'
      contents = [
        { name: 'Product Aliquot', status: 'Sampling...', tone: 'cyan', icon: '🔬' },
        { name: 'Reaction Mixture', status: '✓ Quenched', tone: 'emerald', icon: '❄️' },
        { name: 'HPLC Column', status: 'Separating...', tone: 'cyan', icon: '📊' },
        { name: 'UV/Vis Detector', status: 'Quantifying...', tone: 'cyan', icon: '📈' },
      ]
      mixtureState = 'Quenched; sample in HPLC autosampler'
    } else {
      // COMPLETE
      activeStepIndex = 8
      currentAction = 'Experiment complete. Final simulated yield recorded.'
      detail = `Virtual experiment successfully executed. Final simulated yield of ${num(simulation.observed_yield || simulation.observed_target || 81.3, 1)}% recorded against model prediction.`
      contents = [
        { name: 'Final Product', status: '✓ Isolated', tone: 'emerald', icon: '✨' },
        { name: 'Yield Quantification', status: '✓ Verified', tone: 'emerald', icon: '📊' },
        { name: 'Data Pipeline', status: '✓ Archived', tone: 'emerald', icon: '💾' },
        { name: 'Reactor Status', status: '✓ Flushed', tone: 'emerald', icon: '🧼' },
      ]
      mixtureState = 'Virtual run finished; ready for report'
    }

    return {
      currentAction,
      detail,
      contents,
      mixtureState,
      timeline,
      activeStepIndex,
      progressPercent: op,
    }
  }

  // Generic Domain Fallback (Solar, Plant, Battery, Water)
  return getGenericDomainLiveState({ stage, stageProgress, overallProgress, experiment, domainId, simulation })
}

/**
 * Dynamic live experiment states for Solar, Plant Growth, Battery, and Water Purification.
 */
function getGenericDomainLiveState({ stage, stageProgress = 0, overallProgress = 0, experiment = {}, domainId, simulation = {} }) {
  const p = stageProgress
  const op = Math.min(100, Math.max(0, Math.round(overallProgress)))

  if (domainId === 'solar-efficiency') {
    const thick = experiment.cell_thickness_nm || 350
    const dop = experiment.doping_concentration || '1.0e17'
    const ann = experiment.annealing_temperature_c || 450
    const light = experiment.light_intensity_lux || 85000
    const opTemp = experiment.operating_temperature_c || 25

    const timeline = [
      { id: 'sub', label: 'Preparing substrate & fixture' },
      { id: 'film', label: `Verifying absorber thickness (${thick} nm)` },
      { id: 'ann', label: `Thermal annealing (${ann}°C)` },
      { id: 'env', label: `Stabilizing at ${opTemp}°C` },
      { id: 'light', label: `Applying solar simulator (${light} lux)` },
      { id: 'jv', label: 'Sweeping J-V electrical characteristics' },
      { id: 'eff', label: 'Calculating energy conversion efficiency' },
    ]

    let activeStepIndex = 0
    let currentAction = ''
    let detail = ''
    let contents = []
    let mixtureState = ''

    if (stage === 'INITIALIZE') {
      activeStepIndex = p < 50 ? 0 : 1
      currentAction = 'Setting up cell substrate and environmental controls...'
      detail = `Mounting ${thick} nm thin-film specimen onto Kelvin 4-wire contact stage. Calibrating Si reference photodiode.`
      contents = [
        { name: 'Substrate', status: '✓ Mounted', tone: 'emerald', icon: '🔲' },
        { name: 'Absorber Layer', status: `${thick} nm Verified`, tone: 'cyan', icon: '📐' },
        { name: 'Dopant Matrix', status: `${dop} cm⁻³`, tone: 'slate', icon: '⚡' },
        { name: 'Kelvin Probes', status: 'Contacted', tone: 'emerald', icon: '🔌' },
      ]
      mixtureState = 'Substrate mounted on test chuck'
    } else if (stage === 'SET_ENVIRONMENT') {
      activeStepIndex = p < 50 ? 2 : 3
      currentAction = `Configuring thermal chuck to ${opTemp}°C operating temperature...`
      detail = `Peltier temperature stage is adjusting thermal envelope to ${opTemp}°C. Annealing pre-history verified at ${ann}°C.`
      contents = [
        { name: 'Thermal Stage', status: `Holding ${opTemp}°C`, tone: 'cyan', icon: '🌡️' },
        { name: 'Vacuum Seal', status: '✓ Sealed', tone: 'emerald', icon: '🛡️' },
        { name: 'Gas Purge', status: '✓ Active', tone: 'emerald', icon: '💨' },
        { name: 'Contact Resistance', status: '< 0.1 Ω', tone: 'emerald', icon: '⚡' },
      ]
      mixtureState = `Environment stable at ${opTemp}°C`
    } else if (stage === 'APPLY_LIGHT') {
      activeStepIndex = 4
      currentAction = `Illuminating cell with Class AAA solar simulator at ${light} lux...`
      detail = `Xenon arc light source with AM1.5G filter engaged. Photons are generating electron-hole pairs across the p-n junction.`
      contents = [
        { name: 'Solar Simulator', status: `✓ ${light} lux`, tone: 'amber', icon: '☀️' },
        { name: 'Carrier Generation', status: 'Active', tone: 'cyan', icon: '⚡' },
        { name: 'Substrate Temp', status: `${opTemp}°C`, tone: 'emerald', icon: '🌡️' },
        { name: 'Photocurrent', status: 'Flowing', tone: 'cyan', icon: '📈' },
      ]
      mixtureState = 'Active photon absorption & carrier generation'
    } else if (stage === 'MEASURE_OUTPUT' || stage === 'ANALYZE') {
      activeStepIndex = p < 50 ? 5 : 6
      currentAction = 'Measuring J-V curve and calculating power conversion efficiency...'
      detail = 'Keithley SourceMeter sweeping voltage from 0 to Voc. Calculating short-circuit current Jsc, open-circuit voltage Voc, and fill factor FF.'
      contents = [
        { name: 'SourceMeter', status: 'Sweeping J-V...', tone: 'cyan', icon: '📊' },
        { name: 'Photodiode Check', status: '✓ Reference Synced', tone: 'emerald', icon: '🔬' },
        { name: 'Fill Factor (FF)', status: 'Computing...', tone: 'cyan', icon: '⚡' },
        { name: 'Efficiency Outcome', status: 'Recording...', tone: 'cyan', icon: '✨' },
      ]
      mixtureState = 'Electrical J-V sweep analysis in progress'
    } else {
      activeStepIndex = 6
      currentAction = 'Photovoltaic test complete. Efficiency results recorded.'
      detail = `Virtual solar efficiency test complete. Observed power conversion efficiency of ${num(simulation.observed_target || 21.4, 1)}% recorded.`
      contents = [
        { name: 'Solar Cell', status: '✓ Characterized', tone: 'emerald', icon: '☀️' },
        { name: 'J-V Curve', status: '✓ Plotted', tone: 'emerald', icon: '📈' },
        { name: 'Efficiency', status: '✓ Archived', tone: 'emerald', icon: '✨' },
        { name: 'System Status', status: '✓ Idle', tone: 'emerald', icon: '🔌' },
      ]
      mixtureState = 'Simulation finished; report available'
    }

    return { currentAction, detail, contents, mixtureState, timeline, activeStepIndex, progressPercent: op }
  }

  // Battery, Plant, Water generic fallbacks
  const timeline = [
    { id: '1', label: 'Preparing environment & sensors' },
    { id: '2', label: 'Applying experimental conditions' },
    { id: '3', label: 'Executing core dynamic transformation' },
    { id: '4', label: 'Sampling simulated outcome' },
    { id: '5', label: 'Analysis & verification complete' },
  ]
  let activeStepIndex = Math.min(timeline.length - 1, Math.floor((op / 100) * timeline.length))
  let currentAction = stage === 'COMPLETE' ? 'Virtual experiment completed and results recorded.' : `Executing ${stage.replace(/_/g, ' ').toLowerCase()} stage...`
  let detail = `Simulation is progressing through ${stage.replace(/_/g, ' ')}. Virtual physics engine is updating state vectors according to candidate parameters.`
  let contents = [
    { name: 'Active Material', status: 'In Process', tone: 'cyan', icon: '🧪' },
    { name: 'Environmental Chamber', status: 'Regulated', tone: 'emerald', icon: '🌡️' },
    { name: 'Sensors & Datalogger', status: 'Streaming', tone: 'emerald', icon: '📊' },
  ]

  return { currentAction, detail, contents, mixtureState: 'Virtual process running', timeline, activeStepIndex, progressPercent: op }
}

/**
 * The full Live Activity Panel rendered alongside the reactor.
 */
export default function LiveActivityPanel({
  stage,
  stageProgress,
  overallProgress,
  experiment,
  simulation,
  domainId,
  onSkipToReport,
}) {
  const targetLabel = getTargetLabel(domainId, true)
  const targetUnit = getTargetUnit(domainId)

  const state = useMemo(() => {
    return getLiveExperimentState({
      stage,
      stageProgress,
      overallProgress,
      experiment,
      domainId,
      simulation,
    })
  }, [stage, stageProgress, overallProgress, experiment, domainId, simulation])

  const isComplete = stage === 'COMPLETE' || overallProgress >= 99

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* 1. "WHAT'S HAPPENING NOW" HERO CARD                                      */}
      {/* ========================================================================= */}
      <GlassCard className="p-5 border-cyan-500/30 bg-cyan-950/20 relative overflow-hidden space-y-4">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Section Title & Live Indicator */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔬</span>
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
              What's Happening Now
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
            </span>
            <span className="text-[11px] font-mono text-cyan-200">LIVE ACTION</span>
          </div>
        </div>

        {/* Prominent Current Action Sentence */}
        <div className="bg-slate-950/60 border border-cyan-500/20 rounded-xl p-4">
          <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider mb-1">
            Current Action
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={state.currentAction}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="text-base sm:text-lg font-bold text-white leading-snug"
            >
              "{state.currentAction}"
            </motion.div>
          </AnimatePresence>

          {/* Scientific Detail Description */}
          <div className="mt-2.5 pt-2.5 border-t border-white/10 text-xs text-slate-300 leading-relaxed">
            <span className="text-cyan-300 font-semibold mr-1">Detail:</span>
            {state.detail}
          </div>
        </div>

        {/* Experiment Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <span>EXPERIMENT PROGRESS</span>
              <span className="text-[10px] text-slate-500 font-mono">
                (Stage: {stage} · Step {state.activeStepIndex + 1}/{state.timeline.length})
              </span>
            </span>
            <span className="font-mono text-cyan-300 font-bold">{state.progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-white/10 p-0.5">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 rounded-full"
              style={{ width: `${state.progressPercent}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
        </div>
      </GlassCard>

      {/* ========================================================================= */}
      {/* 2 & 3. REACTOR CONTENTS + EXPERIMENT ACTIVITY TIMELINE                   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 🧪 REACTOR CONTENTS CARD */}
        <GlassCard className="p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">🧪</span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Reactor Contents
              </h4>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">In-Vessel Phase</span>
          </div>

          <div className="space-y-2">
            {state.contents.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-lg bg-white/2 border border-white/5 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{c.icon}</span>
                  <span className="text-slate-200 font-medium">{c.name}</span>
                </div>
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                    c.tone === 'emerald'
                      ? 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/20'
                      : c.tone === 'cyan'
                      ? 'text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 animate-pulse'
                      : 'text-slate-400 bg-slate-800/40'
                  }`}
                >
                  {c.status}
                </span>
              </div>
            ))}
          </div>

          {/* Current Mixture State */}
          <div className="pt-2 border-t border-white/5 text-xs">
            <span className="text-slate-500 text-[10px] uppercase font-semibold block">Current State:</span>
            <span className="text-slate-200 font-medium text-[11px] italic">
              "{state.mixtureState}"
            </span>
          </div>
        </GlassCard>

        {/* 📋 EXPERIMENT ACTIVITY TIMELINE CARD */}
        <GlassCard className="p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">📋</span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Experiment Activity
              </h4>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              Step {state.activeStepIndex + 1} of {state.timeline.length}
            </span>
          </div>

          <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
            {state.timeline.map((stepItem, idx) => {
              const isDone = idx < state.activeStepIndex
              const isCurrent = idx === state.activeStepIndex
              const isUpcoming = idx > state.activeStepIndex

              return (
                <div
                  key={stepItem.id}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition ${
                    isCurrent
                      ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 font-semibold'
                      : isDone
                      ? 'text-emerald-300/90'
                      : 'text-slate-500'
                  }`}
                >
                  {/* Status Indicator Icon */}
                  <span className="font-mono text-xs w-4 flex justify-center">
                    {isDone && <span className="text-emerald-400 font-bold">✓</span>}
                    {isCurrent && <span className="text-cyan-400 animate-pulse text-sm">●</span>}
                    {isUpcoming && <span className="text-slate-600">○</span>}
                  </span>

                  <span className="truncate">{stepItem.label}</span>
                </div>
              )
            })}
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
            <span>✓ completed</span>
            <span>● current</span>
            <span>○ upcoming</span>
          </div>
        </GlassCard>
      </div>

      {/* ========================================================================= */}
      {/* 5. CURRENT CONDITIONS (Parameters Applied)                                */}
      {/* ========================================================================= */}
      <GlassCard className="p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">⚙️</span>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Current Conditions
            </h4>
          </div>
          <span className="text-[10px] text-cyan-300 font-mono">Selected Candidate Setpoints</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          {domainId === 'reaction-yield' ? (
            <>
              <div className="p-2.5 rounded-lg bg-white/2 border border-white/5">
                <span className="text-slate-500 text-[10px] block">Temperature</span>
                <span className="font-mono font-bold text-slate-100 text-sm">
                  {experiment.temperature || 85} °C
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-white/2 border border-white/5">
                <span className="text-slate-500 text-[10px] block">Pressure</span>
                <span className="font-mono font-bold text-slate-100 text-sm">
                  {experiment.pressure || 2.0} bar
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-white/2 border border-white/5">
                <span className="text-slate-500 text-[10px] block">Concentration</span>
                <span className="font-mono font-bold text-slate-100 text-sm">
                  {experiment.concentration || 0.24} M
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-white/2 border border-white/5">
                <span className="text-slate-500 text-[10px] block">Reaction Time</span>
                <span className="font-mono font-bold text-slate-100 text-sm">
                  {experiment.reaction_time || 25} min
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-white/2 border border-white/5">
                <span className="text-slate-500 text-[10px] block">Catalyst</span>
                <span className="font-mono font-bold text-cyan-300 text-sm">
                  {experiment.catalyst ? `Catalyst ${experiment.catalyst}` : 'Catalyst B'}
                </span>
              </div>
            </>
          ) : (
            Object.entries(experiment).slice(0, 5).map(([key, val]) => (
              <div key={key} className="p-2.5 rounded-lg bg-white/2 border border-white/5">
                <span className="text-slate-500 text-[10px] block truncate">
                  {key.replace(/_/g, ' ')}
                </span>
                <span className="font-mono font-bold text-slate-100 text-sm truncate block">
                  {paramValue(key, val, domainId)}
                </span>
              </div>
            ))
          )}
        </div>
      </GlassCard>

      {/* ========================================================================= */}
      {/* 10. FINAL RESULT BANNER (Shown at completion)                            */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <GlassCard className="p-5 border-emerald-500/40 bg-emerald-950/20 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">✓</span>
                  <div>
                    <h3 className="text-base font-bold text-emerald-300">
                      VIRTUAL EXPERIMENT COMPLETE
                    </h3>
                    <div className="text-[11px] text-slate-400">
                      Simulated reaction finished. Verified against surrogate physics model.
                    </div>
                  </div>
                </div>

                <Button
                  variant="primary"
                  onClick={onSkipToReport}
                  className="shadow-lg shadow-cyan-500/25 font-semibold text-xs whitespace-nowrap"
                >
                  View Research Report →
                </Button>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Predicted Result
                  </span>
                  <span className="text-xl font-bold font-mono text-cyan-200">
                    {num(simulation.predicted_yield || simulation.predicted_target || 81.3, 1)} {targetUnit}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Model prediction prior to run</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Uncertainty
                  </span>
                  <span className="text-xl font-bold font-mono text-amber-300">
                    ±{num(simulation.uncertainty_sd || 3.54, 2)} {targetUnit}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Surrogate variance interval</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/30">
                  <span className="text-[10px] uppercase font-semibold text-emerald-400 block">
                    Simulated Result
                  </span>
                  <span className="text-xl font-bold font-mono text-emerald-300">
                    {num(simulation.observed_yield || simulation.observed_target || 81.3, 1)} {targetUnit}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Measured in virtual reactor</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Simulation completed. Review the research report for candidate comparison and model-based results.
              </p>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
