# Pressure and Headspace: The Saturating Benefit

> PROTOTYPE NOTE authored for the Virtual R&D Lab demo. Not a publication.

## What pressure actually buys you

In a batch reactor containing a volatile reagent, a gaseous co-reactant or an
equilibrium that releases a small molecule, raising the pressure does two things:
it increases the concentration of the volatile component dissolved in the liquid
phase, and it shifts the equilibrium towards the product.

Both effects are real, and both **saturate**. The dissolved concentration of a
volatile species follows a Henry-type relationship, so the first few bar of
overpressure produce most of the benefit and the curve flattens rapidly. Doubling
from 8 to 16 bar rarely doubles anything except the equipment cost.

In this design space (1-10 bar) the response typically looks like:

| Pressure | Relative benefit |
| --- | --- |
| 1-2 bar | Baseline / atmospheric operation; the volatile component may be stripped from the liquid phase |
| 2-5 bar | Most of the achievable gain is captured here |
| 5-8 bar | Marginal further improvement |
| >8 bar | Effectively flat; pressure rating, sealing and safety costs rise sharply |

## Engineering and cost consequences

Pressure is the variable with the worst ratio of scientific benefit to
engineering cost:

- Vessel and flange ratings scale with pressure, as does wall thickness.
- Higher pressure means stricter sealing, more elaborate relief systems and a
  larger exclusion zone.
- Hydrogenation-type duties at elevated pressure add gas handling, leak detection
  and purge management.

For a screening campaign the pragmatic reading is: **operate at the lowest
pressure that reaches the plateau** (typically 3-5 bar here), and spend the
optimisation effort on temperature, catalyst and time instead.

## Interaction with temperature

Pressure and temperature are coupled operationally through the vapour pressure of
the mixture. At high temperature the vessel's own vapour pressure contributes
substantially, so a nominal "5 bar" run at 140 degrees C carries a much higher
absolute load than the same 5 bar at 85 degrees C. Risk assessment must therefore
consider the **pair**, not the reported gauge pressure alone.

## Why the model may rank pressure low

A surrogate trained across this design space will usually assign pressure a small
importance score, precisely because its effect saturates across most of the range.
That is not a bug. It is the correct signal that pressure is a *constraint* to be
pushed down to the plateau, rather than a lever to be maximised. A scoring
function should reward shorter, cooler, lower-pressure operation for exactly this
reason.
