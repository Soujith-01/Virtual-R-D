# Reaction Time and Kinetics: Throughput versus Conversion

> PROTOTYPE NOTE authored for the Virtual R&D Lab demo. Not a publication.

## The shape of a batch conversion curve

A simple irreversible batch reaction follows approximately first-order kinetics in
the reagent: conversion rises as `1 - exp(-k t)`, where `k` depends exponentially
on temperature and on the catalyst. The practical consequences are worth stating
plainly:

- **80-90 % of the achievable conversion usually arrives in the first time
  constant.** With a fast catalyst (time constant of a few tens of minutes) this
  can be under 30 minutes.
- **Each further increment costs disproportionately more time.** Going from 90 %
  to 95 % conversion takes roughly the same duration again as reaching 90 % from
  zero, and from 95 % to 99 % roughly the same again.
- **Time interacts with temperature.** A hot run completes its kinetics quickly and
  then spends the remainder of the hold degrading the product. The optimum is
  therefore *not* the longest hold; it is the hold that maximises
  conversion-minus-degradation.

## Why time is the highest-leverage variable for throughput

Reaction time multiplies directly into plant capacity. Halving the hold roughly
doubles the number of batches a reactor can run per day, with no capital cost and
no additional raw material. For a campaign whose objective is
"maximise yield while minimising time", the interesting region of the design space
is therefore the **compromise band**: the shortest hold that still captures most
of the achievable yield.

Typical read of this design space:

| Reaction time | Expected situation |
| --- | --- |
| 5-20 min | Only viable with a high-activity catalyst near its temperature optimum; conversion is still rising steeply and results are sensitive to ramp time |
| 30-60 min | The sweet spot for a fast catalyst: most of the achievable yield at a fraction of the cycle time |
| 60-120 min | Needed by slower, higher-temperature catalysts to reach completion |
| >150 min | Diminishing returns; pairs with high temperature to create a genuine over-reaction penalty |

## Sampling and reproducibility caveats

- The clock should start when the vessel is **isothermal and the catalyst is
  charged**, not when heating begins. Mixing the two inflates apparent induction
  periods at low temperature.
- Short runs are disproportionately sensitive to ramp and mixing variability, so
  a 10-minute advantage on paper can be lost to reproducibility noise.
- Quench or cool promptly at the end of the hold. Any time at temperature after
  the nominal end is time spent degrading product.

## Practical guidance

- Prefer a fast catalyst at moderate temperature over a slow catalyst pushed hot:
  same yield, shorter hold, smaller thermal load.
- When yield curves flatten, stop adding time and spend the effort on catalyst or
  temperature instead.
- Always report the hold time together with the total cycle time, including ramp
  and cool-down.
