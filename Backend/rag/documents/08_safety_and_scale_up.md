# Safety Envelope and Scale-Up Considerations

> PROTOTYPE NOTE authored for the Virtual R&D Lab demo. Not a publication.
> This is general engineering context, not a substitute for a formal hazard
> review, and it describes no specific real process.

## The operating envelope comes first

Every optimisation campaign should define a **comfortable operating window** before
the search starts, and treat excursions as risk rather than opportunity. A useful
shape for the window in this design space:

| Variable | Comfortable | Requires justification |
| --- | --- | --- |
| Temperature | 60-140 degrees C | > 150 degrees C (thermal degradation, runaway severity) |
| Pressure | 1-8 bar | > 8 bar (vessel rating, sealing, relief design) |
| Concentration | 0.08-0.42 M | > 0.45 M (heat release per unit volume, hot spots) |
| Reaction time | 10-150 min | > 150 min (particularly when combined with high temperature) |

The important point is that the envelope is a property of the **combination**. A
harsh temperature is tolerable at short hold; a long hold is tolerable at mild
temperature; the two together are not.

## Thermal risk

The severity of a thermal event scales with the accumulated energy, the reaction
order and the heat-removal capacity of the vessel. Screening calorimetry
(differential scanning, accelerating rate calorimetry) is the standard route to
quantifying onset temperature and adiabatic temperature rise before scale-up.

Two practical signals that a candidate is drifting into riskier territory:

- **Concentration and temperature rising together.** Both increase the volumetric
  heat release rate, and both reduce the margin between the jacket set-point and
  the onset of decomposition.
- **Time at temperature increasing.** Cumulative thermal exposure drives
  degradation, catalyst deactivation and (eventually) autocatalytic behaviour.

## Scale-up is not a linear extension

Reaction time, mixing, heat transfer and mass transfer all behave differently in a
production-scale vessel:

- **Heat removal scales with area, heat release with volume.** A condition that is
  comfortably isothermal in a 100 mL flask can be effectively adiabatic in a
  cubic metre.
- **Mixing times lengthen.** Fast reactions become mass-transfer limited and the
  apparent kinetics change.
- **Volatile components behave differently.** The pressure that worked in a sealed
  small vessel may be inadequate in a larger headspace.

The consequence for a screening workflow: never hand a scale-up team a condition
at the edge of the envelope. A 2 % yield sacrifice for materially milder
conditions is usually the correct engineering trade.

## How this maps into the scoring function

Risk should be a scored component, not an afterthought:

- Model disagreement (uncertainty proxy) increases the penalty.
- Every breached envelope limit adds a penalty.
- Extreme single-variable values (very hot, very high pressure, very long, very
  concentrated) add penalties even when the envelope is nominally respected.
- Low-yield regions carry an "information gain" penalty: an experiment that is
  both poor and uninformative is a waste of a batch.

The recommended candidate should be the best score, not the best yield - and the
risk penalty should be large enough that a safety-driven objective can actually
change the recommendation.
