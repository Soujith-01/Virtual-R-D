# Temperature: Optimal Window and Degradation Pathways

> PROTOTYPE NOTE authored for the Virtual R&D Lab demo. Not a publication.

## Why temperature is never "the hotter the better"

Arrhenius behaviour means the rate constant of *every* pathway in the pot rises
with temperature - the desired conversion and the undesired side reactions alike.
Below the optimum, the desired reaction has the higher apparent activation energy
and wins; above it, decomposition, oligomerisation, isomerisation or catalyst
deactivation start to dominate. The observable signature is a yield that peaks and
then declines with increasing temperature.

The optimum temperature is **catalyst-dependent**. An active catalyst that reaches
high conversion at moderate temperature has a comparatively low optimum; a sluggish
catalyst has to be pushed hotter to compensate, which narrows the usable window
because the degradation pathway is already close.

## Typical behaviour in this design space

- **Uncatalysed / thermal-only runs** need the hottest conditions (roughly
  120-150 degrees C) and still cap out well below the catalysed routes.
- **High-activity catalysts** peak in a comparatively narrow band around
  85-100 degrees C. Operating above that band loses yield quickly.
- **High-temperature catalysts** are engineered for the 115-135 degrees C region
  and tolerate more thermal abuse, but pay for it with slower kinetics.

A practical rule: locate the optimum temperature **per catalyst**, not once for
the whole campaign. Averaging the optimum across catalysts produces a set-point
that is wrong for all of them.

## Over-reaction and thermal history

Two failure modes deserve explicit attention:

1. **Sustained high temperature.** Holding above roughly 150 degrees C for a
   meaningful period drives thermal degradation that cannot be recovered by
   cooling afterwards. Thermal history matters - the damage is cumulative.
2. **Hot *and* long.** Temperature and time interact destructively. A run at
   130 degrees C for 30 minutes may be fine, while the same temperature held for
   150 minutes is not. Optimisation searches that vary the two independently tend
   to propose exactly these bad corners, which is why an interaction-aware
   surrogate model (or an explicit over-reaction penalty term) is important.

## Jacket dynamics and control reality

The recorded set-point is not the temperature the mixture actually sees at all
times. Reaching the set-point takes a finite ramp, and the reaction only proceeds
meaningfully once the vessel is close to isothermal. For a short nominally-timed
run, the ramp can consume a significant fraction of the cycle - another argument
for treating temperature and time as coupled rather than independent.

## Practical guidance

- Scan temperature in coarse steps (10-15 degrees C) first to bracket the optimum,
  then refine around the peak.
- Never extrapolate the optimum from a different catalyst.
- Treat temperatures above ~150 degrees C as a distinct risk class requiring
  thermal-stability evidence, not just a yield number.
