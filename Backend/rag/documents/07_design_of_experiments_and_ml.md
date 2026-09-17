# Design of Experiments and Surrogate Models

> PROTOTYPE NOTE authored for the Virtual R&D Lab demo. Not a publication.

## From grid screening to model-guided search

Classical screening walks a coarse grid: for each catalyst, vary temperature in
steps, hold everything else, measure, repeat. It is easy to defend and easy to
reproduce - and it scales terribly. Five catalysts across a five-dimensional grid
at five levels each is 3,125 runs before anything is optimised.

Model-guided search inverts the order of operations:

1. Run a **small, spread-out initial design** (random or Latin-hypercube style)
   that covers the whole envelope rather than clustering in one corner.
2. Fit a **cheap surrogate** - a random forest, gradient-boosted tree or Gaussian
   process - to the data collected so far.
3. Use the surrogate to **score the entire candidate pool**, including conditions
   never tested.
4. Run the best candidate in the lab, add the result to the dataset, and re-fit.
5. Repeat. Each physical experiment makes the next suggestion better.

This is the loop the Virtual R&D Lab automates, with the candidate generation and
ranking made explicit and auditable at every step.

## Random forests as process surrogates

Random forests are a pragmatic choice for small experimental datasets:

- **They capture non-linearity and interactions** natively, which matters for a
  yield surface with coupled temperature-time and catalyst-concentration effects.
- **They need no feature scaling** and tolerate mixed numeric/categorical inputs
  after one-hot encoding.
- **They interpolate rather than extrapolate.** A prediction outside the convex
  hull of the training data is an average of leaf values, not an extrapolation -
  so it can look confidently wrong. Always constrain candidate generation to the
  validated envelope.
- **They provide a free disagreement signal.** The standard deviation across the
  ensemble's individual trees indicates how much the trees argue about a point.
  Points of high disagreement are precisely where an additional experiment is
  most informative.

## Uncertainty is not confidence theatre

Tree disagreement is an **uncertainty proxy**, not a calibrated confidence
interval. It answers "do the trees agree?" and not "what is the probability the
true yield exceeds 90 %?". A responsible interface:

- Reports predicted value and the disagreement spread separately.
- Labels the interval as approximate and model-derived.
- Refuses to present a confidence number as a statistical guarantee.
- Keeps a residual-based floor so that over-confident ensembles cannot claim
  near-zero uncertainty on thin data.

## Five-fold cross-validation versus a single split

A single held-out split is quick but noisy on a few thousand rows. Five-fold
cross-validation trained on the same data gives a mean R-squared and a spread
across folds; a small spread indicates the model is stable rather than lucky.
Report both, and never tune on the test set.

## Active learning and the next experiment

The cheapest way to improve a surrogate is not more random data - it is data where
the model is uncertain. Two useful acquisition strategies:

- **Exploit**: run the highest-scoring candidate (best predicted objective).
- **Explore**: run the point of maximum disagreement among promising candidates.

Alternating between the two is what "next suggested experiment" should mean in a
working research platform.

## Provenance discipline

Any model trained on synthetic, historical or transferred data must say so
explicitly in its outputs. A prediction's credibility rests on the provenance of
its training data, and a demo dataset cannot support a claim about real chemistry.
Architect for replacement: keep dataset loading, feature schema and training
configuration separate from the model code, so a validated in-house dataset can be
dropped in and the model retrained without touching the API.
