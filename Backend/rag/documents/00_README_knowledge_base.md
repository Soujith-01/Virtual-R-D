# Virtual R&D Lab - Prototype Knowledge Base

> **PROTOTYPE CONTENT - AUTHORED FOR THIS DEMO. NOT A PUBLICATION.**
> The notes in this folder were written for the Virtual R&D Lab hackathon
> project. They are **not** excerpts from real papers, they have no authors,
> no journal, no DOI, and they must not be cited as scientific literature.
> Replace this folder with real, licensed source material before making any
> scientific claim.

## Purpose

The retrieval layer gives the AI agent process-chemistry context so its
explanations are grounded in something other than the numbers it just produced.
Each note is a short, self-contained "lab handbook" style entry covering one
dimension of a catalysed liquid-phase batch reaction.

## Files

| File | Topic | Primary variables covered |
| --- | --- | --- |
| `01_reaction_yield_optimization_basics.md` | Yield landscape, trade-offs, what "good" looks like | all |
| `02_temperature_effects.md` | Optimal temperature window, degradation pathways | temperature |
| `03_pressure_and_headspace.md` | Saturating pressure benefit, equipment cost | pressure |
| `04_catalyst_selection.md` | Activity vs selectivity of catalysts A-D | catalyst |
| `05_concentration_and_feed_ratio.md` | Optimal concentration region, side products | concentration |
| `06_reaction_time_and_kinetics.md` | First-order kinetics, throughput vs conversion | reaction_time |
| `07_design_of_experiments_and_ml.md` | DoE, surrogate models, uncertainty, active learning | method |
| `08_safety_and_scale_up.md` | Thermal risk, pressure ratings, operational envelope | all |

## Supported formats

The loader reads `.md` and `.txt` natively. `.pdf` is supported when `pypdf` is
installed (`pip install -r requirements-rag.txt`); otherwise PDFs are skipped
with a warning instead of crashing the API.
