# Catalyst Selection: Activity versus Selectivity versus Operability

> PROTOTYPE NOTE authored for the Virtual R&D Lab demo. Not a publication.

## The three-way trade

A catalyst is chosen on three axes that rarely move together:

1. **Activity** - how fast it turns the substrate over. High activity shortens
   cycle time and lowers the required temperature.
2. **Selectivity** - how much of the consumed substrate becomes the desired
   product rather than side products.
3. **Operability** - thermal stability, tolerance to impurities, ease of
   separation and reuse, and cost per kilogram.

A screening campaign that only measures yield confuses activity with selectivity.
Two catalysts reaching 90 % yield are not equivalent if one gets there through a
fast clean pathway and the other through a hot, side-product-heavy one.

## Behaviour of the catalysts in this design space

**Catalyst A - baseline heterogeneous.** Moderate ceiling (high 70s %). Tolerant
and cheap, best around 105-115 degrees C, and comparatively slow. Use as the
control against which the others must justify themselves.

**Catalyst B - high-activity, fast kinetics.** Highest ceiling (~96 %). Reaches
near-complete conversion quickly, so it peaks at moderate temperature (about
90-95 degrees C) and relatively short times. The narrow optimum means
over-temperature operation is punished harder than with the other catalysts.
This is the natural first choice when the objective is to reduce reaction time.

**Catalyst C - high-temperature, slow.** Good ceiling (~88 %) but requires
115-135 degrees C and long residence times to express its performance. Attractive
where heat is cheap and reactor occupancy is not, and structurally more tolerant
of hot operation than B.

**Catalyst D - selective but low activity.** Lower ceiling (~64 %), yet very
selective and easy to handle. Worth considering when downstream purification cost
dominates and a moderate yield is acceptable.

**Uncatalysed control.** Thermal-only conversion (~42 % ceiling) requiring the
harshest conditions in every dimension. Include it in every campaign: without it
you cannot tell how much of the performance the catalyst is actually delivering.

## Deactivation and thermal history

Catalyst activity is not constant across a campaign. Sintering, poisoning by trace
impurities and fouling all reduce performance with cumulative exposure to high
temperature. A catalyst that performs well in a fresh 45-minute run may lose
measurable activity after several hot, prolonged runs. When a hot + long
condition is proposed, treat the yield prediction as an upper bound valid for
fresh catalyst only.

## Practical selection guidance

- Screen at each catalyst's own optimum temperature; a single shared temperature
  systematically mis-ranks the set.
- Compare at **matched conversion or matched time**, never at unmatched conditions.
- Prefer the least active catalyst that meets the yield and time target - it is
  usually cheaper and more robust.
