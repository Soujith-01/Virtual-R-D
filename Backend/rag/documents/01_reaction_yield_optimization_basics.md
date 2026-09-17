# Reaction Yield Optimization - Practical Basics

> PROTOTYPE NOTE authored for the Virtual R&D Lab demo. Not a publication.

## The core problem

In a batch reaction optimisation campaign the objective is rarely "maximum yield".
It is almost always a constrained compromise: reach an acceptable yield while
keeping cycle time, energy input, pressure rating and material cost within what
the plant can afford. A 96 % yield that takes three hours and 150 degrees C is
frequently worse in economic terms than a 88 % yield in 45 minutes at 90 degrees C.

This is why an optimisation service should expose **an explicit weighted score**
rather than ranking candidates by yield alone. Ranking by yield picks the slowest,
hottest run in the design space, which is exactly the experiment the plant does not
want to run.

## Shape of the yield surface

For catalysed liquid-phase conversions of this type the response surface has a
characteristic form:

- **One or more interior optima in temperature.** Yield rises with temperature
  while the desired reaction dominates kinetics, then falls as decomposition and
  competing pathways take over.
- **A plateau in pressure.** The benefit of pressure saturates once the reactor
  headspace no longer limits the dissolved gas / volatile component.
- **A saturating curve in time.** Conversion approaches completion asymptotically;
  doubling the last 10 % of conversion often costs as much time as the first 80 %.
- **A broad, shallow optimum in concentration.** Too dilute wastes reactor volume;
  too concentrated promotes bimolecular side products and heat release.

Because these effects interact multiplicatively, a one-factor-at-a-time campaign
routinely misses the true optimum. Two factors that are mediocre individually can
be strongly coupled - for example a high-activity catalyst at moderate temperature
can outperform a thermally forced run with a weaker catalyst.

## Turning the surface into a decision

A practical workflow:

1. **Fix the decision criteria first.** Write the objective as an explicit
   sentence and translate it into weights (yield, time, temperature, pressure,
   risk). If the weights change, the ranking must change - that is a feature.
2. **Predict before you spend.** A surrogate model trained on earlier runs screens
   the whole design space at near-zero cost.
3. **Rank with a transparent score.** Every component and weight should be visible
   to the researcher so the recommendation can be argued with.
4. **Report uncertainty honestly.** A prediction without an error bar invites
   over-confidence and expensive mistakes.
5. **Verify the top candidate, then re-fit.** One confirmatory run in the lab is
   worth more than a hundred model evaluations.

## What "good" looks like in this design space

Across the variable ranges used here (40-160 degrees C, 1-10 bar, 0.05-0.50 M,
5-180 minutes, catalysts A-D plus an uncatalysed control):

- Yields below ~45 % usually indicate a mis-specified catalyst or an off-optimum
  temperature.
- Yields of ~75-90 % are typically achievable without extreme conditions and are
  the realistic target for a first campaign.
- Yields above ~90 % generally require a high-activity catalyst, a near-optimal
  temperature, and enough residence time to complete conversion. Those last few
  points of yield are paid for in time and energy - always check whether they are
  worth it.
