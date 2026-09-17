export const DEMO_QUESTION = 'Maximize reaction yield while minimizing reaction time.'

export const EXAMPLE_OBJECTIVES = [
  {
    label: 'Yield vs time',
    objective: 'Maximize reaction yield while minimizing reaction time.',
    hint: 'The classic throughput compromise',
  },
  {
    label: 'Maximum yield',
    objective: 'Maximise yield at any cost, favouring the highest conversion achievable.',
    hint: 'Yield-dominated weighting',
  },
  {
    label: 'Low energy',
    objective: 'Maximize yield while minimizing temperature and energy demand.',
    hint: 'Milder operating conditions',
  },
  {
    label: 'Mild pressure',
    objective: 'Maximize reaction yield while minimizing pressure and equipment cost.',
    hint: 'Cheaper reactor requirements',
  },
  {
    label: 'Robust process',
    objective: 'Maximize yield while minimizing risk and keeping the process robust and stable.',
    hint: 'Safety-weighted ranking',
  },
]

/** The agent pipeline as reported by the backend agent_trace. */
export const PIPELINE_STEPS = [
  { key: 'objective', label: 'Interpret objective', detail: 'Parse the research question into explicit priorities and weights' },
  { key: 'variables', label: 'Identify variables', detail: 'Decide which experimental variables drive the objective' },
  { key: 'knowledge', label: 'Retrieve knowledge', detail: 'Semantic search across the scientific knowledge base' },
  { key: 'generate', label: 'Generate experiments', detail: 'Model-guided search over the design space' },
  { key: 'predict', label: 'Predict outcomes', detail: 'Random Forest surrogate predicts yield for every candidate' },
  { key: 'compare', label: 'Compare outcomes', detail: 'Score candidates against baseline conditions' },
  { key: 'rank', label: 'Rank candidates', detail: 'Transparent objective-weighted scoring' },
  { key: 'explain', label: 'Explain result', detail: 'Generate the grounded research narrative' },
  { key: 'next', label: 'Propose next run', detail: 'Suggest the follow-up experiment' },
  { key: 'simulate', label: 'Virtual experiment', detail: 'Run the recommendation through the virtual reactor' },
]

export const STAGE_META = {
  INITIALIZING: { label: 'Initializing', tone: 'slate', icon: '❄', description: 'Sealing vessel, purging headspace, sensor checks' },
  HEATING: { label: 'Heating', tone: 'amber', icon: '🔥', description: 'Ramping jacket temperature to set-point' },
  STABILIZING: { label: 'Stabilizing', tone: 'violet', icon: '◎', description: 'Holding set-point, checking thermal drift' },
  REACTION: { label: 'Reaction', tone: 'cyan', icon: '⚗', description: 'Catalyst charged, monitoring conversion' },
  ANALYZING: { label: 'Analyzing', tone: 'sky', icon: '🔍', description: 'Quenching, sampling, quantifying product' },
  COMPLETE: { label: 'Complete', tone: 'emerald', icon: '✓', description: 'Run finished, results archived' },
}

export const STAGE_ORDER = ['INITIALIZING', 'HEATING', 'STABILIZING', 'REACTION', 'ANALYZING', 'COMPLETE']

export const CATALYST_LABELS = {
  A: 'Catalyst A',
  B: 'Catalyst B',
  C: 'Catalyst C',
  D: 'Catalyst D',
  None: 'Uncatalysed',
}

export const PARAM_META = [
  { key: 'temperature', label: 'Temperature', unit: '°C', step: 5, min: 40, max: 160, decimals: 0 },
  { key: 'pressure', label: 'Pressure', unit: 'bar', step: 0.5, min: 1, max: 10, decimals: 1 },
  { key: 'catalyst', label: 'Catalyst', unit: '', options: ['A', 'B', 'C', 'D', 'None'] },
  { key: 'concentration', label: 'Concentration', unit: 'M', step: 0.01, min: 0.05, max: 0.5, decimals: 2 },
  { key: 'reaction_time', label: 'Reaction time', unit: 'min', step: 5, min: 5, max: 180, decimals: 0 },
]

/**
 * Experiment templates for the Choose Experiment screen.
 * status: 'live'      → uses the trained Random Forest model (reaction yield only)
 * status: 'prototype' → UI placeholder; shows domain-extension info, no fake predictions
 * status: 'custom'    → free-text research objective entry
 */
export const EXPERIMENT_TEMPLATES = [
  {
    id: 'reaction-yield',
    icon: '🧪',
    status: 'live',
    label: 'Reaction Yield Optimization',
    tagline: 'Optimize reaction conditions to maximize predicted yield.',
    description:
      'The AI generates 5 candidate experiments by searching the design space, predicts yield for each using the trained Random Forest model, then ranks them by a transparent scoring function.',
    domain: 'Chemical reaction engineering',
    variables: ['Temperature (°C)', 'Pressure (bar)', 'Catalyst (A/B/C/D)', 'Concentration (M)', 'Reaction time (min)'],
    target: 'Predicted Yield (%)',
    model: 'RandomForestRegressor — trained on synthetic_prototype_v1',
    defaultObjective: 'Maximize reaction yield while minimizing reaction time.',
    objectives: [
      { label: 'Yield vs time', objective: 'Maximize reaction yield while minimizing reaction time.' },
      { label: 'Max yield', objective: 'Maximise yield at any cost, favouring the highest conversion achievable.' },
      { label: 'Low energy', objective: 'Maximize yield while minimizing temperature and energy demand.' },
      { label: 'Mild pressure', objective: 'Maximize reaction yield while minimizing pressure and equipment cost.' },
      { label: 'Robust process', objective: 'Maximize yield while minimizing risk and keeping the process robust and stable.' },
    ],
    accentColor: 'cyan',
  },
  {
    id: 'solar-panel',
    icon: '☀️',
    status: 'prototype',
    label: 'Solar Panel Efficiency',
    tagline: 'Explore conditions that affect solar energy conversion efficiency.',
    description:
      'This template demonstrates how the platform could be extended to photovoltaic research. A domain-specific trained model — such as one trained on cell manufacturing parameters — would be required for validated predictions.',
    domain: 'Photovoltaic engineering',
    variables: ['Cell thickness (nm)', 'Doping concentration', 'Annealing temperature (°C)', 'Coating material', 'Exposure time (h)'],
    target: 'Energy conversion efficiency (%)',
    model: 'Domain-specific model required — not yet trained',
    accentColor: 'amber',
  },
  {
    id: 'plant-growth',
    icon: '🌱',
    status: 'prototype',
    label: 'Plant Growth Optimization',
    tagline: 'Explore growth-condition optimization for agricultural research.',
    description:
      'This template demonstrates how the platform could be extended to agronomy. A model trained on greenhouse or field trial data would be required for validated predictions.',
    domain: 'Agricultural science / agronomy',
    variables: ['Light intensity (lux)', 'CO₂ concentration (ppm)', 'Nutrient concentration (mM)', 'Temperature (°C)', 'Humidity (%)'],
    target: 'Biomass yield (g)',
    model: 'Domain-specific model required — not yet trained',
    accentColor: 'emerald',
  },
  {
    id: 'battery-performance',
    icon: '🔋',
    status: 'prototype',
    label: 'Battery Performance',
    tagline: 'Explore battery operating conditions for energy storage research.',
    description:
      'This template demonstrates how the platform could be extended to battery science. A model trained on electrochemical cell data would be required for validated predictions.',
    domain: 'Electrochemical engineering',
    variables: ['Electrolyte concentration (M)', 'Charging rate (C)', 'Operating temperature (°C)', 'Electrode material', 'Cycle count'],
    target: 'Capacity retention (%)',
    model: 'Domain-specific model required — not yet trained',
    accentColor: 'violet',
  },
  {
    id: 'water-purification',
    icon: '💧',
    status: 'prototype',
    label: 'Water Purification',
    tagline: 'Explore purification-condition optimization for water treatment.',
    description:
      'This template demonstrates how the platform could be extended to environmental engineering. A model trained on filtration or coagulation data would be required for validated predictions.',
    domain: 'Environmental / water engineering',
    variables: ['Coagulant dose (mg/L)', 'pH', 'Contact time (min)', 'Filtration rate (m/h)', 'Membrane pore size (μm)'],
    target: 'Turbidity removal (%)',
    model: 'Domain-specific model required — not yet trained',
    accentColor: 'sky',
  },
  {
    id: 'custom',
    icon: '🔬',
    status: 'custom',
    label: 'Custom Research',
    tagline: 'Enter your own research objective and explore the AI workflow.',
    description:
      'Enter any research objective in plain language. The AI reasoning pipeline and virtual simulation will run using the reaction yield model. Results are valid only for reaction-yield optimization — other domains would need a domain-specific trained model.',
    domain: 'User defined',
    variables: ['Temperature', 'Pressure', 'Catalyst', 'Concentration', 'Reaction time'],
    target: 'Predicted Yield (%) — reaction yield model only',
    model: 'RandomForestRegressor — reaction yield only',
    defaultObjective: '',
    accentColor: 'slate',
  },
]
