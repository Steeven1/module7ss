import { calculateSdiFromFactorValues, calculateTotalFine, sampleTriangular } from "./calculations.js";

const DEFAULT_ITERATIONS = 8000;

function applyRdmCap(raw, rdmMaxFineUsd) {
  if (!Number.isFinite(rdmMaxFineUsd) || rdmMaxFineUsd < 0) {
    return raw;
  }
  return Math.min(raw, rdmMaxFineUsd);
}

/**
 * Monte Carlo: sample each PERT factor from triangular(min, prob, max), then SDI y multa.
 * Cada simulación aplica el mismo tope al importe máximo del RDM que el cálculo determinístico.
 * @param {number} rerCoef - coeficiente de reincidencia (mismo que en calculateSdi)
 * @param {number} [rdmMaxFineUsd] - tope USD derivado del RDM máximo (opcional)
 */
export function runMonteCarloSimulation(
  cdi,
  pertFactors,
  rerCoef,
  rdmMaxFineUsd,
  iterations = DEFAULT_ITERATIONS
) {
  const totals = new Array(iterations);
  for (let i = 0; i < iterations; i++) {
    const values = {
      tdp: sampleTriangular(pertFactors.tdp.min, pertFactors.tdp.prob, pertFactors.tdp.max),
      tav: sampleTriangular(pertFactors.tav.min, pertFactors.tav.prob, pertFactors.tav.max),
      ndv: sampleTriangular(pertFactors.ndv.min, pertFactors.ndv.prob, pertFactors.ndv.max),
      tev: sampleTriangular(pertFactors.tev.min, pertFactors.tev.prob, pertFactors.tev.max),
      int: sampleTriangular(pertFactors.int.min, pertFactors.int.prob, pertFactors.int.max),
      rer: sampleTriangular(pertFactors.rer.min, pertFactors.rer.prob, pertFactors.rer.max)
    };
    const sdi = calculateSdiFromFactorValues(values, rerCoef);
    const raw = calculateTotalFine(cdi, sdi);
    totals[i] = applyRdmCap(raw, rdmMaxFineUsd);
  }
  totals.sort((a, b) => a - b);
  const mean = totals.reduce((s, v) => s + v, 0) / iterations;
  const percentile = (sorted, q) => {
    if (sorted.length === 0) return NaN;
    const idx = (sorted.length - 1) * q;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  const p = (q) => percentile(totals, q);
  const variance =
    totals.reduce((s, v) => s + (v - mean) * (v - mean), 0) / iterations;
  const stdev = Math.sqrt(variance);
  return {
    iterations,
    mean,
    min: totals[0],
    max: totals[iterations - 1],
    p5: p(0.05),
    p50: p(0.5),
    p95: p(0.95),
    stdev,
    samples: totals
  };
}

/** Build histogram buckets for chart display. */
export function buildHistogram(samples, bucketCount = 20) {
  const min = samples[0];
  const max = samples[samples.length - 1];
  if (min === max) {
    return [{ from: min, to: max, count: samples.length, pct: 100 }];
  }
  const step = (max - min) / bucketCount;
  const buckets = [];
  for (let b = 0; b < bucketCount; b++) {
    const from = min + b * step;
    const to = b === bucketCount - 1 ? max : min + (b + 1) * step;
    buckets.push({ from, to, count: 0 });
  }
  for (const v of samples) {
    let idx = Math.floor((v - min) / step);
    if (idx >= bucketCount) idx = bucketCount - 1;
    if (idx < 0) idx = 0;
    buckets[idx].count += 1;
  }
  const maxCount = Math.max(...buckets.map((x) => x.count), 1);
  for (const bucket of buckets) {
    bucket.pct = (bucket.count / samples.length) * 100;
    bucket.barPct = (bucket.count / maxCount) * 100;
  }
  return buckets;
}
