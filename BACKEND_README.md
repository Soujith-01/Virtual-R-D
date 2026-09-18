# Nucleus AI R&D Lab - Multi-Domain ML Implementation

## Overview
This implementation extends the Virtual R&D Lab to support 5 independent research domains, each with its own trained Random Forest ML model.

## Domains

### 1. Reaction Yield Optimization (Existing)
- **Target:** Reaction yield (%)
- **Features:** temperature, pressure, catalyst, concentration, reaction_time
- **Model:** `reaction_yield_model.pkl`
- **R²:** 0.9679, MAE: 2.89%
- Status: Live, working

### 2. Solar Panel Efficiency (New)
- **Target:** Energy conversion efficiency (%)
- **Features:**
  - cell_thickness_nm (50-300 nm)
  - doping_concentration (1e15-1e18 cm⁻³)
  - annealing_temperature_c (500-900°C)
  - light_intensity_lux (20000-120000 lux)
  - operating_temperature_c (15-75°C)
- **Model:** `solar_efficiency_model.pkl`
- **R²:** 0.8799, MAE: 1.18%
- Status: Live, working

### 3. Plant Growth Optimization (New)
- **Target:** Biomass yield (g)
- **Features:**
  - light_intensity_lux (5000-80000 lux)
  - co2_concentration_ppm (400-1200 ppm)
  - nutrient_concentration_mm (0.5-10 mM)
  - temperature_c (15-40°C)
  - water_supply_ml_day (50-500 ml/day)
- **Model:** `plant_growth_model.pkl`
- **R²:** 0.9775, MAE: 4.66g
- Status: Live, working

### 4. Battery Performance (New)
- **Target:** Capacity retention (%)
- **Features:**
  - electrolyte_concentration_m (0.5-2.5 M)
  - charging_rate_c (0.2-3.0 C)
  - operating_temperature_c (0-50°C)
  - discharge_rate_c (0.2-3.0 C)
  - cycle_count (10-500 cycles)
- **Model:** `battery_performance_model.pkl`
- **R²:** 0.9711, MAE: 1.66%
- Status: Live, working

### 5. Water Purification (New)
- **Target:** Turbidity removal (%)
- **Features:**
  - coagulant_dose_mg_l (5-100 mg/L)
  - ph (4.0-10.0)
  - contact_time_min (5-120 min)
  - temperature_c (5-40°C)
  - mixing_speed_rpm (50-300 rpm)
- **Model:** `water_purification_model.pkl`
- **R²:** 0.9770, MAE: 1.83%
- Status: Live, working

## Files Created

### Backend
- `Backend/solar_domain.py` - Solar domain configuration
- `Backend/plant_domain.py` - Plant growth domain configuration
- `Backend/battery_domain.py` - Battery performance domain configuration
- `Backend/water_domain.py` - Water purification domain configuration
- `Backend/training/generate_solar.py` - Solar dataset generator
- `Backend/training/generate_plant.py` - Plant growth dataset generator
- `Backend/training/generate_battery.py` - Battery dataset generator
- `Backend/training/generate_water.py` - Water purification dataset generator
- `Backend/training/train_domain_model.py` - Generalized training pipeline
- `Backend/services/model_registry.py` - Multi-domain model registry
- `Backend/services/domain_generator.py` - Domain-aware candidate generation
- `Backend/services/domain_scoring.py` - Domain-aware scoring
- `Backend/services/domain_simulator.py` - Domain-specific simulators
- `Backend/api/models.py` - Model status/train API endpoints

### Frontend
- Updated `frontend/src/lib/constants.js` - Domain configurations
- Updated `frontend/src/lib/format.js` - Domain-aware formatting
- Updated `frontend/src/components/ChooseExperiment.jsx` - Multi-domain selection UI
- Updated `frontend/src/components/Workspace.jsx` - Domain-specific parameter controls
- Updated `frontend/src/components/ExperimentGrid.jsx` - Domain-aware experiment display
- Updated `frontend/src/components/ExperimentCard.jsx` - Domain-aware experiment cards
- Updated `frontend/src/components/VirtualReactor.jsx` - Domain-specific simulation UI
- Updated `frontend/src/components/ResearchReport.jsx` - Domain-aware report generation
- Updated `frontend/src/components/Sidebar.jsx` - Domain indicator
- Updated `frontend/src/components/Charts.jsx` - Domain-aware charts
- Updated `frontend/src/App.jsx` - Multi-domain routing

## API Endpoints

### New Endpoints
- `GET /models/status` - Status of all 5 models with metrics
- `POST /models/train` - Train a specific model or all models
- `GET /models/{domain}/info` - Detailed info for a specific domain

### Updated Endpoints
- `POST /simulate` - Now supports domain parameter
- `POST /research` - Supports domain via research pipeline

## Running

### Start Backend
```bash
cd Backend
python -m uvicorn main:app --reload --port 8000
```

### Start Frontend
```bash
cd frontend
npm run dev
```

### Train Models (if needed)
```bash
cd Backend
python training/train_domain_model.py --domain all
```

## Model Status

All 5 models are trained and ready:

| Domain | Model File | R² | MAE | Status |
|--------|-----------|-----|-----|--------|
| Reaction Yield | reaction_yield_model.pkl | 0.9679 | 2.89% | Ready |
| Solar Efficiency | solar_efficiency_model.pkl | 0.8799 | 1.18% | Ready |
| Plant Growth | plant_growth_model.pkl | 0.9775 | 4.66g | Ready |
| Battery Performance | battery_performance_model.pkl | 0.9711 | 1.66% | Ready |
| Water Purification | water_purification_model.pkl | 0.9770 | 1.83% | Ready |

## Demo Flow

1. Select a domain from Choose Experiment screen
2. Enter research objective (or use suggested)
3. Generate experiments (1500+ candidates evaluated)
4. View ranked candidates with predictions from trained model
5. Run virtual experiment with domain-specific stages
6. Review research report with model metrics

## Disclaimer

All models are trained on **synthetic prototype datasets** for demonstration purposes only. Predictions are AI-generated hypotheses for experimental prioritization — not validated scientific results.
