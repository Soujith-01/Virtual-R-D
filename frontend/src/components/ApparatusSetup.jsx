import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard, Button, Pill, SectionTitle } from './ui'
import { DOMAINS } from '../lib/constants'
import { getPredictionKey, getTargetLabel, getTargetUnit } from '../lib/format'

/**
 * Standard authentic laboratory apparatus specifications by domain.
 */
export const DOMAIN_APPARATUS = {
  'reaction-yield': [
    {
      id: 'autoclave-reactor',
      name: 'High-Pressure Jacketed Autoclave Reactor',
      category: 'Primary Reaction Vessel',
      model: 'Parr 4560 Series / 316L Stainless Steel',
      specs: 'Rated to 35 bar @ 300°C, magnetically coupled overhead drive (0–1200 RPM), internal cooling loop, rupture disc at 25 bar.',
      icon: '⚗️',
      role: 'Holds reaction mixture under controlled thermal ramp and pressurized headspace.',
      calibration: 'Passivated & hydrostatically tested to 1.5x setpoint.',
      criticalFor: 'temperature, pressure',
    },
    {
      id: 'dosing-unit',
      name: 'Automated Catalyst Micro-Dosing Unit',
      category: 'Metering & Dispensing',
      model: 'Teledyne ISCO High-Pressure Syringe Pump',
      specs: 'Flow rate: 0.001 to 50 mL/min, precision ±0.5%, chemical-resistant wetted parts.',
      icon: '🧪',
      role: 'Accurately introduces dissolved catalyst stock solution into the sealed vessel without pressure drop.',
      calibration: 'Calibrated for target catalyst molarity.',
      criticalFor: 'catalyst, concentration',
    },
    {
      id: 'pid-circulator',
      name: 'Dual-Loop Digital PID Thermal Circulator',
      category: 'Thermal Regulation',
      model: 'Julabo Presto Dynamic Temperature Control System',
      specs: 'Operating range: -40°C to +250°C, stability ±0.05°C, fast heating/cooling response.',
      icon: '🔥',
      role: 'Maintains uniform temperature inside reactor jacket to eliminate thermal gradients.',
      calibration: '3-point RTD sensor calibration at 50°C, 85°C, 120°C.',
      criticalFor: 'temperature',
    },
    {
      id: 'ftir-spectrometer',
      name: 'In-Situ ATR-FTIR Reaction Probe',
      category: 'Real-Time Analytical Instrumentation',
      model: 'Mettler Toledo ReactIR 702L with Diamond Probe',
      specs: 'Spectral range: 4000–650 cm⁻¹, sampling interval: 15s, liquid-nitrogen free.',
      icon: '🔬',
      role: 'Tracks real-time disappearance of starting materials and formation of target product.',
      calibration: 'Background solvent spectrum acquired.',
      criticalFor: 'reaction_time',
    },
    {
      id: 'pressure-controller',
      name: 'Electronic Back-Pressure Regulator & Gas Manifold',
      category: 'Pressure Regulation',
      model: 'Bronkhorst EL-PRESS Digital Series',
      specs: 'Control range: 0.5–30 bar, setpoint repeatability ±0.1% FS, ultra-pure N₂/Ar supply.',
      icon: '💨',
      role: 'Maintains exact headspace gas pressure and prevents vapor loss during reaction.',
      calibration: 'Zero-point and span calibrated with digital calibrator.',
      criticalFor: 'pressure',
    },
    {
      id: 'hplc-analyzer',
      name: 'High-Performance Liquid Chromatograph (HPLC-DAD)',
      category: 'Post-Reaction Quantification',
      model: 'Agilent 1260 Infinity II with Diode Array Detector',
      specs: 'C18 reversed-phase column (150 x 4.6 mm, 3.5 µm), autosampler, UV/Vis multi-wavelength.',
      icon: '📊',
      role: 'Quantifies final product yield against standardized calibration curves.',
      calibration: '5-point external standard curve R² > 0.9995.',
      criticalFor: 'yield',
    },
  ],
  'solar-efficiency': [
    {
      id: 'solar-simulator',
      name: 'Class AAA Steady-State Solar Simulator',
      category: 'Illumination Source',
      model: 'Newport Oriel Sol3A (AM1.5G Spectral Match)',
      specs: '1000 W/m² irradiance, temporal stability Class A, spatial uniformity Class A, calibrated Si photodiode reference.',
      icon: '☀️',
      role: 'Provides standardized solar spectrum irradiance for photovoltaic efficiency testing.',
      calibration: 'NREL-certified reference cell calibrated.',
      criticalFor: 'light_intensity_lux',
    },
    {
      id: 'sourcemeter',
      name: 'Precision Source-Measure Unit (SMU)',
      category: 'Electrical Characterization',
      model: 'Keithley 2450 Interactive SourceMeter',
      specs: 'Current range: 10 nA to 1 A, voltage range: 20 mV to 200 V, 4-wire Kelvin probe configuration.',
      icon: '⚡',
      role: 'Sweeps cell J-V curve under illumination to calculate Voc, Jsc, FF, and power conversion efficiency.',
      calibration: 'Keithley factory certified, contact resistance zeroed.',
      criticalFor: 'efficiency',
    },
    {
      id: 'tube-furnace',
      name: 'Vacuum Quartz Tube Annealing Furnace',
      category: 'Thermal Processing',
      model: 'MTI OTF-1200X Split-Hinge Furnace',
      specs: 'Temperature up to 1200°C, heating rate 10°C/min, quartz tube with inert Ar/N₂ purging flange.',
      icon: '🔥',
      role: 'Performs controlled thermal annealing to recrystallize thin films and activate dopants.',
      calibration: 'Type-K thermocouple calibrated to ±1°C.',
      criticalFor: 'annealing_temperature_c',
    },
    {
      id: 'profilometer',
      name: 'Optical Stylus Profilometer & Ellipsometer',
      category: 'Thin-Film Metrology',
      model: 'Bruker Dektak XT / J.A. Woollam M-2000',
      specs: 'Vertical resolution: 0.1 nm, stylus force: 1 mg, spectral range: 245–1000 nm.',
      icon: '📏',
      role: 'Verifies uniform cell absorber layer thickness in nanometers across substrate.',
      calibration: 'Certified 88.0 nm step height standard.',
      criticalFor: 'cell_thickness_nm',
    },
    {
      id: 'hall-bench',
      name: 'Van der Pauw Hall Effect Measurement System',
      category: 'Carrier Concentration Analysis',
      model: 'Ecopia HMS-3000 (0.55 Tesla Magnet)',
      specs: 'Carrier density measurement: 10¹⁰ to 10²¹ cm⁻³, mobility: 1 to 10⁷ cm²/V·s.',
      icon: '🧲',
      role: 'Measures active carrier doping concentration and majority carrier mobility.',
      calibration: 'Standard GaAs calibration wafer checked.',
      criticalFor: 'doping_concentration',
    },
    {
      id: 'cryo-chuck',
      name: 'Peltier Temperature-Controlled Vacuum Test Stage',
      category: 'Environmental Chamber',
      model: 'Instec HCS302 Hot and Cold Microscope Stage',
      specs: 'Range: -20°C to +120°C, precision: ±0.05°C, vacuum chuck holding.',
      icon: '❄️',
      role: 'Holds solar cell at exact target operating temperature during J-V illumination.',
      calibration: 'PT100 platinum resistance sensor verified.',
      criticalFor: 'operating_temperature_c',
    },
  ],
  'plant-growth': [
    {
      id: 'growth-chamber',
      name: 'Micro-Climatic Controlled Phenotyping Chamber',
      category: 'Environmental Enclosure',
      model: 'Conviron A1000 Reach-In Plant Growth Chamber',
      specs: 'Programmable multispectral LED lighting (PAR 0–1200 µmol/m²/s), temperature -10°C to +45°C.',
      icon: '🌱',
      role: 'Provides tightly regulated atmospheric, lighting, and thermal growth conditions.',
      calibration: 'Photosynthetic photon flux density (PPFD) mapped across grid.',
      criticalFor: 'light_intensity_lux, temperature_c',
    },
    {
      id: 'co2-injector',
      name: 'NDIR CO₂ Gas Dosing & Monitoring Manifold',
      category: 'Atmospheric Regulation',
      model: 'Vaisala CARBOCAP GMP252 Sensor with Micro-Solenoid Injector',
      specs: 'Measurement range: 0–3000 ppm, accuracy: ±(1.5% of range + 2% of reading).',
      icon: '💨',
      role: 'Monitors and maintains setpoint CO₂ levels to optimize Calvin cycle fixation.',
      calibration: '2-point span gas calibration with certified zero N₂ and 1000 ppm CO₂.',
      criticalFor: 'co2_concentration_ppm',
    },
    {
      id: 'fertigation-system',
      name: 'Multi-Channel Automated Drip Fertigation Unit',
      category: 'Nutrient & Irrigation Delivery',
      model: 'Netafim Precision Micro-Drip with Peristaltic Dosing Array',
      specs: 'Delivery precision: ±0.5 mL/day, automated EC and pH inline probes.',
      icon: '💧',
      role: 'Dispenses targeted Hoagland nutrient formulation and water volume.',
      calibration: 'Electrochemical EC sensor calibrated to 1.413 mS/cm.',
      criticalFor: 'nutrient_concentration_mm, water_supply_ml_day',
    },
    {
      id: 'pam-fluorometer',
      name: 'PAM Chlorophyll Fluorescence Imaging System',
      category: 'Photochemical Monitoring',
      model: 'Walz Imaging-PAM MAXI Version',
      specs: 'Measures Fv/Fm, Y(II), qP, non-photochemical quenching (NPQ), CCD camera resolution 1392x1040.',
      icon: '🔬',
      role: 'Non-destructively assesses photosystem II efficiency and stress markers.',
      calibration: 'Dark adaptation protocol verified.',
      criticalFor: 'biomass',
    },
    {
      id: 'biomass-oven',
      name: 'Forced-Air Convection Drying Oven & Analytical Balance',
      category: 'Biomass Gravimetric Quantification',
      model: 'Memmert UF55 Oven + Mettler Toledo XSR205 Balance',
      specs: 'Drying temperature: 65°C to 105°C (±0.5°C), analytical balance readability: 0.01 mg.',
      icon: '⚖️',
      role: 'Dries harvested plant tissue to constant mass for accurate dry biomass calculation.',
      calibration: 'OIML Class E2 calibration mass verified.',
      criticalFor: 'biomass',
    },
  ],
  'battery-performance': [
    {
      id: 'battery-cycler',
      name: 'High-Precision Multi-Channel Potentiostat/Galvanostat',
      category: 'Electrochemical Cycler',
      model: 'BioLogic BCS-815 Battery Testing System',
      specs: 'Current range: 1 µA to 15 A, voltage: 0 to 5 V, built-in EIS (10 µHz to 10 kHz).',
      icon: '🔋',
      role: 'Performs high-fidelity constant-current / constant-voltage (CC-CV) charge-discharge cycles.',
      calibration: 'NIST traceable shunt resistor calibration.',
      criticalFor: 'charging_rate_c, discharge_rate_c',
    },
    {
      id: 'thermal-chamber',
      name: 'Environmental Thermal Test Chamber',
      category: 'Thermal Regulation',
      model: 'ESPEC BTL-433 Environmental Chamber',
      specs: 'Temperature range: -40°C to +100°C (±0.3°C), explosion-resistant pressure relief vent.',
      icon: '🌡️',
      role: 'Maintains constant battery operating temperature throughout hundreds of charge cycles.',
      calibration: '9-point thermal uniformity test compliant with IEC 60068.',
      criticalFor: 'operating_temperature_c',
    },
    {
      id: 'glovebox',
      name: 'Inert Argon Atmosphere Glovebox Workstation',
      category: 'Atmospheric Isolation',
      model: 'MBRAUN LABstar Glovebox Workstation',
      specs: 'H₂O < 0.1 ppm, O₂ < 0.1 ppm, automatic pressure control, integrated solvent trap.',
      icon: '🛡️',
      role: 'Enables safe handling and electrolyte wetting of moisture-sensitive lithium metal/ion cells.',
      calibration: 'Zirconia oxygen sensor and P₂O₅ moisture sensor online.',
      criticalFor: 'electrolyte_concentration_m',
    },
    {
      id: 'kelvin-fixture',
      name: 'Four-Terminal Kelvin Battery Test Fixture',
      category: 'Contact Instrumentation',
      model: 'Gold-Plated Pneumatic Kelvin Test Clamps',
      specs: 'Contact resistance < 0.2 mΩ, eliminates cable lead voltage drop at high C-rates.',
      icon: '🔌',
      role: 'Ensures micro-volt measurement precision during fast charge/discharge transients.',
      calibration: 'Zero resistance calibration fixture verified.',
      criticalFor: 'charging_rate_c',
    },
  ],
  'water-purification': [
    {
      id: 'jar-tester',
      name: 'Standardized 6-Paddle Flocculation Jar Tester',
      category: 'Flocculation Apparatus',
      model: 'Phipps & Bird 7790-402 Programmable Jar Tester',
      specs: 'Digital motor 5–300 RPM, illuminated base, synchronized paddle withdrawal, stainless steel flat blades.',
      icon: '🔄',
      role: 'Performs standardized rapid-mix, slow-flocculation, and gravity sedimentation steps.',
      calibration: 'Digital tachometer calibrated to ±1 RPM.',
      criticalFor: 'mixing_speed_rpm, contact_time_min',
    },
    {
      id: 'turbidimeter',
      name: 'USEPA 180.1 Ratio Laboratory Turbidimeter',
      category: 'Turbidity Optical Quantification',
      model: 'Hach 2100N Laboratory Turbidimeter',
      specs: 'Measurement range: 0–4000 NTU, ratio optical system with 90° scattered light detector.',
      icon: '📊',
      role: 'Measures raw vs treated supernatant turbidity with sub-0.01 NTU resolution.',
      calibration: 'Calibrated with Formazin primary standards (<0.1, 20, 100, 800 NTU).',
      criticalFor: 'turbidity',
    },
    {
      id: 'coagulant-doser',
      name: 'Digital Precision Micro-Burette & Pipetting System',
      category: 'Chemical Metering',
      model: 'BrandTech Titrette Digital Bottle-Top Burette',
      specs: 'Dispensing volume: 0.01 to 50 mL, accuracy ±0.07%, chemical inert fluoroplastic piston.',
      icon: '🧪',
      role: 'Accurately delivers coagulant (alum / polyaluminum chloride) in mg/L concentrations.',
      calibration: 'Gravimetrically calibrated with analytical grade water.',
      criticalFor: 'coagulant_dose_mg_l',
    },
    {
      id: 'ph-meter',
      name: 'Research-Grade Double-Junction Glass pH Electrode',
      category: 'Electrochemical Metering',
      model: 'Thermo Scientific Orion Star A211 pH Benchtop Meter',
      specs: 'Range: -2.000 to 20.000 pH, resolution 0.001 pH, automatic temperature compensation (ATC).',
      icon: '🧪',
      role: 'Monitors and adjusts raw water pH to optimize coagulant precipitation and hydrolysis.',
      calibration: '3-point NIST buffer calibration (pH 4.01, 7.00, 10.01).',
      criticalFor: 'ph',
    },
    {
      id: 'filtration-assembly',
      name: 'Vacuum Membrane Filtration Manifold',
      category: 'Filtration Testing',
      model: 'Millipore 47mm All-Glass Vacuum Filter Holder',
      specs: '0.45 µm mixed cellulose ester (MCE) membrane filters, oil-free vacuum pump (24 in. Hg).',
      icon: '🚰',
      role: 'Filters residual micro-flocs to quantify true dissolved vs suspended solids removal.',
      calibration: 'Membrane pore size distribution certified by manufacturer.',
      criticalFor: 'turbidity',
    },
  ],
}

/**
 * Helper to extract or synthesize apparatus from scientific research papers
 */
function extractApparatusFromPapers(papers = [], domainId = 'reaction-yield') {
  if (!papers || papers.length === 0) return []

  const literatureApparatus = []

  papers.forEach((paper) => {
    const title = paper.title || ''
    const abstract = paper.abstract || ''
    const text = `${title} ${abstract}`.toLowerCase()

    // Domain-aware keyword matcher
    if (text.includes('mechanochem') || text.includes('ball-mill') || text.includes('milling')) {
      literatureApparatus.push({
        id: `lit-${paper.paper_id || paper.id}-mill`,
        name: 'Planetary Ball-Mill & In-Situ PXRD Chamber',
        category: 'Literature-Cited Apparatus',
        specs: 'Stainless steel milling jars with zirconia grinding media, solvent-free reaction setup.',
        role: 'Facilitates fast mechanochemical transformation without organic solvent overhead.',
        paperTitle: paper.title,
        paperDoi: paper.doi,
        paperUrl: paper.url || (paper.doi ? `https://doi.org/${paper.doi}` : null),
        citation: paper.citation_count,
        icon: '⚙️',
      })
    }

    if (text.includes('bayesian') || text.includes('optimization') || text.includes('active learning')) {
      literatureApparatus.push({
        id: `lit-${paper.paper_id || paper.id}-ai`,
        name: 'Real-Time Surrogate Model Feedback Loop',
        category: 'Algorithmic Instrumentation',
        specs: 'Automated data acquisition connected to Gaussian Process / Random Forest acquisition function.',
        role: 'Dynamically updates parameter boundary recommendations between sequential runs.',
        paperTitle: paper.title,
        paperDoi: paper.doi,
        paperUrl: paper.url || (paper.doi ? `https://doi.org/${paper.doi}` : null),
        citation: paper.citation_count,
        icon: '🤖',
      })
    }

    if (text.includes('catalyst') || text.includes('yield') || text.includes('kinetics')) {
      literatureApparatus.push({
        id: `lit-${paper.paper_id || paper.id}-flow`,
        name: 'Continuous-Flow Micro-Reactor Platform',
        category: 'Literature-Cited Reactor',
        specs: 'Hastelloy capillary microfluidic channel with inline UV-Vis spectrophotometry.',
        role: 'Precise residence time control with enhanced mass and heat transfer rates.',
        paperTitle: paper.title,
        paperDoi: paper.doi,
        paperUrl: paper.url || (paper.doi ? `https://doi.org/${paper.doi}` : null),
        citation: paper.citation_count,
        icon: '🔄',
      })
    }

    if (text.includes('solar') || text.includes('photovoltaic') || text.includes('perovskite')) {
      literatureApparatus.push({
        id: `lit-${paper.paper_id || paper.id}-solar`,
        name: 'Spectrally Resolved External Quantum Efficiency (EQE) Bench',
        category: 'Literature-Cited Solar Metrology',
        specs: 'Monochromated xenon source (300–1200 nm), lock-in amplifier, calibrated silicon/germanium photodiode.',
        role: 'Directly resolves wavelength-dependent photon-to-electron carrier generation.',
        paperTitle: paper.title,
        paperDoi: paper.doi,
        paperUrl: paper.url || (paper.doi ? `https://doi.org/${paper.doi}` : null),
        citation: paper.citation_count,
        icon: '🔬',
      })
    }

    if (text.includes('battery') || text.includes('impedance') || text.includes('capacity')) {
      literatureApparatus.push({
        id: `lit-${paper.paper_id || paper.id}-eis`,
        name: 'Electrochemical Impedance Spectroscopy (EIS) Frequency Response Analyzer',
        category: 'Literature-Cited Battery Metrology',
        specs: 'Frequency range: 10 µHz to 1 MHz, AC amplitude: 5 mV, multi-sine Fourier transform.',
        role: 'Deconvolutes solid-electrolyte interphase (SEI) growth vs bulk charge transfer resistance.',
        paperTitle: paper.title,
        paperDoi: paper.doi,
        paperUrl: paper.url || (paper.doi ? `https://doi.org/${paper.doi}` : null),
        citation: paper.citation_count,
        icon: '⚡',
      })
    }

    if (text.includes('water') || text.includes('membrane') || text.includes('filtration')) {
      literatureApparatus.push({
        id: `lit-${paper.paper_id || paper.id}-crossflow`,
        name: 'Cross-Flow Membrane Filtration Bench',
        category: 'Literature-Cited Separation System',
        specs: 'SEPA cell with variable feed crossflow velocity (0.1–2.0 m/s) and digital permeate mass balance.',
        role: 'Assesses foulant cake layer resistance and membrane permeability decline.',
        paperTitle: paper.title,
        paperDoi: paper.doi,
        paperUrl: paper.url || (paper.doi ? `https://doi.org/${paper.doi}` : null),
        citation: paper.citation_count,
        icon: '💧',
      })
    }
  })

  // Deduplicate by name
  const seen = new Set()
  return literatureApparatus.filter((item) => {
    if (seen.has(item.name)) return false
    seen.add(item.name)
    return true
  })
}

export default function ApparatusSetup({
  experiment,
  selectedTemplate,
  activeResearchPapers = [],
  research,
  onPerformExperiment,
  onBack,
}) {
  const domainId = selectedTemplate?.id || 'reaction-yield'
  const domain = DOMAINS[domainId] || DOMAINS['reaction-yield']
  const targetLabel = getTargetLabel(domainId, true)
  const targetUnit = getTargetUnit(domainId)
  const predKey = getPredictionKey(domainId)

  const [activeTab, setActiveTab] = useState('all') // 'all' | 'core' | 'literature' | 'reagents'
  const [checkedItems, setCheckedItems] = useState(new Set(['check-1', 'check-2', 'check-3', 'check-4']))

  const toggleCheck = (id) => {
    setCheckedItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Core apparatus list
  const coreApparatus = useMemo(() => {
    return DOMAIN_APPARATUS[domainId] || DOMAIN_APPARATUS['reaction-yield']
  }, [domainId])

  // Literature apparatus derived from active research papers
  const literatureApparatus = useMemo(() => {
    return extractApparatusFromPapers(activeResearchPapers, domainId)
  }, [activeResearchPapers, domainId])

  // Experiment parameters display
  const paramEntries = useMemo(() => {
    if (!experiment) return []
    const keys = domain.featureKeys || []
    return keys.map((k) => {
      const label = domain.variables?.find((v) => v.toLowerCase().includes(k.replace(/_/g, ' '))) || k.replace(/_/g, ' ')
      const unit = domain.units?.[k] || ''
      return {
        key: k,
        label,
        value: experiment[k] !== undefined ? experiment[k] : 'N/A',
        unit,
      }
    })
  }, [experiment, domain])

  // Reagents & Consumables calculated based on the experiment parameters
  const reagentsList = useMemo(() => {
    if (domainId === 'reaction-yield') {
      return [
        { name: `Catalyst (${experiment?.catalyst || 'Standard'})`, role: 'Active homogeneous/heterogeneous catalyst', quantity: `${experiment?.concentration || 0.24} M`, status: 'Pre-weighed in inert vial' },
        { name: 'Starting Material / Substrates', role: 'Reactants A & B stock mixture', quantity: '50.0 mL', status: 'Degassed under N₂' },
        { name: 'Reaction Solvent', role: 'Anhydrous reaction medium', quantity: '100.0 mL', status: 'Purified via solvent column' },
        { name: 'Inert Gas Blanket (N₂ / Ar)', role: 'Headspace pressurization', quantity: `${experiment?.pressure || 2.0} bar`, status: '99.999% Ultra-High Purity' },
        { name: 'Quenching Agent', role: 'Reaction terminator for HPLC assay', quantity: '10.0 mL', status: 'Chilled @ 4°C' },
      ]
    }
    if (domainId === 'solar-efficiency') {
      return [
        { name: 'Substrate & Absorber Layer', role: 'Photovoltaic active thin-film', quantity: `${experiment?.cell_thickness_nm || 350} nm`, status: 'Cleaned via sonication' },
        { name: 'Doping Precursor Solution', role: 'Carrier density optimization', quantity: `${experiment?.doping_concentration || '1e17'} cm⁻³`, status: 'Freshly mixed' },
        { name: 'Inert Annealing Gas (N₂)', role: 'Atmosphere during thermal treatment', quantity: '5.0 L/min', status: 'Oxygen < 1 ppm' },
        { name: 'Gold / Silver Contact Electrodes', role: 'Top contact pads for Kelvin probing', quantity: '8 contacts', status: 'Vacuum evaporated' },
      ]
    }
    if (domainId === 'plant-growth') {
      return [
        { name: 'Enriched Nutrient Solution', role: 'Target mineral feeding', quantity: `${experiment?.nutrient_concentration_mm || 3.5} mM`, status: 'pH balanced @ 6.2' },
        { name: 'Ultra-Pure Irrigation Water', role: 'Hydration schedule', quantity: `${experiment?.water_supply_ml_day || 50} ml/day`, status: 'Reverse Osmosis treated' },
        { name: 'Compressed CO₂ Cylinder', role: 'Atmospheric enrichment', quantity: `${experiment?.co2_concentration_ppm || 450} ppm`, status: 'Regulator connected' },
        { name: 'Growth Substrate Medium', role: 'Root anchoring and aeration', quantity: 'Perlite / Vermiculite (1:1)', status: 'Autoclaved' },
      ]
    }
    if (domainId === 'battery-performance') {
      return [
        { name: 'Liquid Electrolyte Solution', role: 'LiPF₆ in EC/DMC solvent', quantity: `${experiment?.electrolyte_concentration_m || 1.2} M`, status: 'Handled in Ar glovebox' },
        { name: 'Cathode / Anode Cell Stack', role: 'Energy storage electrodes', quantity: 'CR2032 Coin Cell', status: 'Crimped & sealed' },
        { name: 'Gold-Plated Kelvin Leads', role: 'Current and voltage sensing', quantity: '4-Wire Assembly', status: 'Cleaned with isopropyl alcohol' },
        { name: 'Thermal Conductive Paste', role: 'Thermocouple bonding to casing', quantity: '0.5 g', status: 'Applied' },
      ]
    }
    // Water purification
    return [
      { name: 'Coagulant Solution (Alum / PAC)', role: 'Destabilization of colloidal particles', quantity: `${experiment?.coagulant_dose_mg_l || 25} mg/L`, status: 'Stock standard 10 mg/mL' },
      { name: 'Raw Water Sample', role: 'Turbid influent for jar test', quantity: '6 x 1000 mL Beakers', status: 'Homogenized' },
      { name: '0.1 M NaOH / HCl Buffer', role: 'pH adjustment setpoint', quantity: `Target pH: ${experiment?.ph || 7.0}`, status: 'Calibrated' },
      { name: '0.45 µm MCE Membrane Filters', role: 'Supernatant filtration', quantity: '6 Filter Discs', status: 'Pre-rinsed' },
    ]
  }, [domainId, experiment])

  const predictedVal = experiment?.[predKey] || experiment?.predicted_yield || 0

  return (
    <div className="mx-auto max-w-[1500px] px-5 pb-16 space-y-6">
      {/* ===== Header Bar ===== */}
      <GlassCard className="p-6 border-cyan-500/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{domain.icon}</span>
              <SectionTitle
                eyebrow="Step 04 · Laboratory Configuration"
                title="Experimental Apparatus & Equipment Setup"
                description="Review the physical instruments, calibrated hardware, reagents, and safety parameters required before performing this virtual experiment."
              />
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {onBack && (
              <Button variant="ghost" onClick={onBack} className="text-xs">
                ← Back to Candidates
              </Button>
            )}
            <Button
              variant="primary"
              size="lg"
              className="shadow-lg shadow-cyan-500/25 animate-pulse hover:animate-none font-semibold"
              onClick={() => onPerformExperiment && onPerformExperiment(experiment)}
            >
              ⚗ Perform Experiment →
            </Button>
          </div>
        </div>

        {/* Selected Candidate Experiment Summary Strip */}
        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-3">
            <div className="text-[10px] uppercase font-semibold text-cyan-400 tracking-wider">Candidate ID</div>
            <div className="text-lg font-bold text-white mt-0.5 flex items-center gap-2">
              <span>{experiment?.id || 'EXP-01'}</span>
              {experiment?.id === research?.recommended_experiment?.id && (
                <Pill tone="cyan" dot className="!text-[10px] !py-0.5">RECOMMENDED</Pill>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-3">
            <div className="text-[10px] uppercase font-semibold text-emerald-400 tracking-wider">Target Objective</div>
            <div className="text-lg font-bold text-emerald-200 mt-0.5">
              {Number(predictedVal).toFixed(1)} {targetUnit}
            </div>
            <div className="text-[10px] text-slate-400 truncate">{targetLabel}</div>
          </div>

          {paramEntries.slice(0, 4).map((param) => (
            <div key={param.key} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider truncate" title={param.label}>
                {param.label}
              </div>
              <div className="text-base font-semibold text-slate-100 mt-0.5 font-mono">
                {param.value} <span className="text-xs text-slate-400 font-normal">{param.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* ===== Tab Navigation Filter ===== */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'all'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            All Apparatus ({coreApparatus.length + literatureApparatus.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('core')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'core'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Core Laboratory Equipment ({coreApparatus.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('literature')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              activeTab === 'literature'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <span>📚</span> From Research Papers ({literatureApparatus.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reagents')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'reagents'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            🧪 Reagents & Consumables ({reagentsList.length})
          </button>
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>All Instruments Calibrated & Online</span>
        </div>
      </div>

      {/* ===== LITERATURE APPARATUS HIGHLIGHT (if papers selected or activeTab) ===== */}
      {(activeTab === 'all' || activeTab === 'literature') && literatureApparatus.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">📚</span>
              <h3 className="text-sm font-semibold text-cyan-200 uppercase tracking-wider">
                Literature-Derived Apparatus & Experimental Methodology
              </h3>
              <Pill tone="cyan">Extracted from Active Research Papers</Pill>
            </div>
            <span className="text-xs text-slate-400 font-mono">{literatureApparatus.length} specialized configurations</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {literatureApparatus.map((item) => (
              <GlassCard
                key={item.id}
                className="p-4 border-cyan-500/30 bg-cyan-950/20 space-y-3 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl p-2 rounded-xl bg-white/5 border border-white/10">{item.icon}</span>
                    <div>
                      <div className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">
                        {item.category}
                      </div>
                      <h4 className="text-sm font-bold text-slate-100 leading-snug">{item.name}</h4>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-400/20 text-cyan-300 border border-cyan-400/40">
                    Peer-Reviewed
                  </span>
                </div>

                <div className="text-xs text-slate-300 leading-relaxed bg-white/5 p-2.5 rounded-lg border border-white/5">
                  <strong className="text-slate-100">Role:</strong> {item.role}
                </div>

                <div className="text-[11px] text-slate-400">
                  <strong className="text-slate-300">Technical Spec:</strong> {item.specs}
                </div>

                {item.paperTitle && (
                  <div className="pt-2 border-t border-white/10 text-[11px]">
                    <div className="text-slate-500 text-[10px]">CITED IN LITERATURE CONTEXT:</div>
                    <div className="text-slate-300 italic truncate" title={item.paperTitle}>
                      "{item.paperTitle}"
                    </div>
                    {item.paperUrl && (
                      <a
                        href={item.paperUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:underline mt-1 inline-flex items-center gap-1 font-mono text-[10px]"
                      >
                        {item.paperDoi ? `DOI: ${item.paperDoi}` : 'Open Article ↗'}
                      </a>
                    )}
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* ===== CORE LABORATORY APPARATUS GRID ===== */}
      {(activeTab === 'all' || activeTab === 'core') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
              Required Laboratory Apparatus & Instruments
            </h3>
            <span className="text-xs text-slate-400">{coreApparatus.length} standard instruments required</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coreApparatus.map((app) => (
              <GlassCard key={app.id} className="p-4 space-y-3 hover:border-cyan-500/40 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl p-2 rounded-xl bg-white/5 border border-white/10">{app.icon}</span>
                    <div>
                      <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider block">
                        {app.category}
                      </span>
                      <h4 className="text-sm font-bold text-slate-100">{app.name}</h4>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    Calibrated
                  </span>
                </div>

                <div className="text-xs text-slate-300">
                  <strong className="text-slate-200">Model:</strong>{' '}
                  <span className="font-mono text-cyan-200">{app.model}</span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed bg-white/5 p-2.5 rounded-lg border border-white/5">
                  {app.role}
                </p>

                <div className="space-y-1 text-[11px] text-slate-400">
                  <div>
                    <span className="text-slate-500">Specifications:</span> {app.specs}
                  </div>
                  <div>
                    <span className="text-slate-500">Quality Assurance:</span>{' '}
                    <span className="text-slate-300 font-mono">{app.calibration}</span>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* ===== REAGENTS, CONSUMABLES & CHEMICALS TABLE ===== */}
      {(activeTab === 'all' || activeTab === 'reagents') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
              Chemical Reagents & Experimental Consumables
            </h3>
            <span className="text-xs text-slate-400">Calibrated for {experiment?.id || 'this experiment'}</span>
          </div>

          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Material / Chemical</th>
                    <th className="px-4 py-3">Experimental Role</th>
                    <th className="px-4 py-3">Calibrated Quantity</th>
                    <th className="px-4 py-3">Preparation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {reagentsList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-white/2 transition">
                      <td className="px-4 py-3 font-semibold text-slate-100 flex items-center gap-2">
                        <span className="text-cyan-400 font-mono">0{idx + 1}</span>
                        {item.name}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{item.role}</td>
                      <td className="px-4 py-3 font-mono font-medium text-cyan-200">{item.quantity}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          ✓ {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ===== PRE-FLIGHT READINESS CHECKLIST & SAFETY SPECS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GlassCard className="p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">📋</span>
              <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
                Pre-Execution Verification Checklist
              </h3>
            </div>
            <span className="text-xs text-cyan-300 font-mono">
              {checkedItems.size}/4 Ready
            </span>
          </div>

          <div className="space-y-2.5">
            {[
              {
                id: 'check-1',
                title: 'Containment Vessel & Pressure Integrity Verified',
                desc: `Rupture disc inspected, seals leak-tested to withstand ${experiment?.pressure ? (experiment.pressure * 1.5).toFixed(1) : '3.0'} bar.`,
              },
              {
                id: 'check-2',
                title: 'Instrumentation Sensor Calibrations Validated',
                desc: `Thermal RTD probes, pressure transducers, and analytical spectrometers zeroed and synchronized.`,
              },
              {
                id: 'check-3',
                title: 'Inert Atmosphere & Purge Cycle Complete',
                desc: 'Headspace swept with 99.999% inert gas to eliminate ambient oxygen interference.',
              },
              {
                id: 'check-4',
                title: 'AI Telemetry & Real-Time Data Logging Connected',
                desc: 'Continuous bi-directional streaming pipeline initialized to capture physical trajectory.',
              },
            ].map((check) => (
              <label
                key={check.id}
                onClick={() => toggleCheck(check.id)}
                className="flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-white/2 hover:bg-white/5 cursor-pointer transition select-none"
              >
                <input
                  type="checkbox"
                  checked={checkedItems.has(check.id)}
                  onChange={() => {}}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-500 focus:ring-cyan-400 focus:ring-offset-0"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-100">{check.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{check.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </GlassCard>

        {/* Safety & Protocol Card */}
        <GlassCard className="p-5 space-y-3 border-amber-500/20 bg-amber-950/10">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛡️</span>
            <h3 className="text-sm font-semibold text-amber-300 uppercase tracking-wider">
              Safety Specifications
            </h3>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Standard laboratory containment protocol required for this operating envelope:
          </p>

          <ul className="space-y-2 text-xs text-slate-300">
            <li className="flex items-center gap-2">
              <span className="text-amber-400">⚠️</span>
              <span>PPE: Level B chemical goggles, nitrile gloves, flame-retardant lab coat.</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-amber-400">⚠️</span>
              <span>Exhaust: Certified laminar fume hood with VOC scrubber.</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-amber-400">⚠️</span>
              <span>Emergency cutoff: Over-temperature and pressure trip interlocks active.</span>
            </li>
          </ul>

          <div className="pt-4 mt-4 border-t border-white/10">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Ready to begin?</div>
            <p className="text-xs text-slate-300 mt-1">
              Click below to initiate the virtual experiment with live animated stages.
            </p>
            <div className="mt-4">
              <Button
                variant="primary"
                className="w-full justify-center !py-2.5 text-sm font-bold shadow-lg shadow-cyan-500/25"
                onClick={() => onPerformExperiment && onPerformExperiment(experiment)}
              >
                ⚗ Perform Experiment
              </Button>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* ===== Bottom Navigation CTA Bar ===== */}
      <GlassCard className="p-5 flex flex-wrap items-center justify-between gap-4 border-t border-white/10">
        <div>
          <div className="text-sm font-semibold text-slate-100">
            Apparatus setup complete for {experiment?.id || 'candidate'}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Target: {predictedVal.toFixed(1)} {targetUnit} · All instruments configured
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="secondary" onClick={onBack} className="text-xs">
              ← Back to Candidates
            </Button>
          )}
          <Button
            variant="primary"
            size="lg"
            className="shadow-lg shadow-cyan-500/30 text-sm font-bold"
            onClick={() => onPerformExperiment && onPerformExperiment(experiment)}
          >
            ⚗ Perform Experiment →
          </Button>
        </div>
      </GlassCard>
    </div>
  )
}
