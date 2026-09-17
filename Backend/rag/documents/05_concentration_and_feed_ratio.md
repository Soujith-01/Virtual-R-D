# Concentration and Feed Ratio: A Shallow Optimum

> PROTOTYPE NOTE authored for the Virtual R&D Lab demo. Not a publication.

## Why concentration has an interior optimum

Initial reagent concentration is a productivity lever: a more concentrated feed
puts more material through the same reactor volume. Up to a point, higher
concentration also accelerates bimolecular steps simply because the partners
collide more often.

Past that point the balance tips:

- **Bimolecular side reactions scale faster than the desired pathway** when the
  rate order of the side reaction exceeds that of the main reaction. By-products
  and oligomers appear.
- **Heat release per unit volume rises.** A concentrated charge releases its
  enthalpy into less solvent, producing hot spots that locally exceed the
  jacket set-point and trigger thermal degradation.
- **Solubility limits.** Above the saturation point the additional reagent is not
  in solution and cannot react - it only creates slurry handling problems and
  non-reproducible kinetics.

The result is the familiar shallow optimum seen in this design space around
**0.18-0.25 M**, with the exact position shifting between catalysts. The curve is
broad, which is convenient: being 10 % off the optimum costs little yield, so
concentration is usually the last variable worth fine-tuning.

## Catalyst-specific shifts

Optimal concentration tracks catalyst loading behaviour rather than being a fixed
property of the chemistry:

- A highly active catalyst reaches completion at lower concentration; pushing the
  feed up mainly amplifies side reactions.
- A low-activity catalyst tolerates and benefits from higher concentration because
  the desired pathway is rate-limited by collision frequency.
- The uncatalysed control needs the most concentrated feed to produce anything
  meaningful, and is the least selective of the set.

Any surrogate model trained across the design space should therefore learn a
**catalyst-concentration interaction**, not two independent effects.

## Feed ratio and stoichiometry

Where two reagents are involved, the ratio matters at least as much as the
absolute concentration. A modest excess (5-20 %) of the cheaper component is
standard practice: it drives the equilibrium forward and consumes the more
expensive partner more completely. Large excesses, however, dilute the product,
complicate separation, and can push the mixture into a different rate regime.

## Practical guidance

- Bracket concentration coarsely (0.05-0.50 M in a handful of points), then refine
  only around the peak.
- If yield is flat across the range, you are rate-limited elsewhere (catalyst or
  temperature) - fix that first.
- Above ~0.40 M, expect thermal hot spots and check whether the measured yield is
  actually limited by mixing rather than chemistry.
