// Pure math utilities. No DOM usage here.

/**
 * Pesos del SDI según el modelo implementado (bloques fijos por normativa en este cálculo).
 * - Impacto en derechos (IED): 60% del subscore combinado TDP/TAV/NDV/TEV.
 * - Intencionalidad (INT): 40% del valor PERT de intencionalidad.
 * - Reincidencia (RER): se multiplica el valor PERT por un coeficiente (único ajustable en la UI).
 */
export const SDI_WEIGHT_IED_BLOCK = 0.6;
export const SDI_WEIGHT_INT_BLOCK = 0.4;
export const SDI_IED_SUB_TDP = 0.4;
export const SDI_IED_SUB_TAV = 0.2;
export const SDI_IED_SUB_NDV = 0.2;
export const SDI_IED_SUB_TEV = 0.2;
export const SDI_RER_COEF_DEFAULT = 0.2;

export function calculatePert(min, probable, max) {
  return (min + 4 * probable + max) / 6;
}

export function calculateCdiPrivate(vdn, rdmMinPercent, rdmMaxPercent, pdiPercent) {
  const minFine = vdn * (rdmMinPercent / 100);
  const maxFine = vdn * (rdmMaxPercent / 100);
  return minFine + (pdiPercent / 100) * (maxFine - minFine);
}

export function calculateCdiPublic(sbu, rdmMinSbu, rdmMaxSbu, pdiPercent) {
  const minFine = sbu * rdmMinSbu;
  const maxFine = sbu * rdmMaxSbu;
  return minFine + (pdiPercent / 100) * (maxFine - minFine);
}

/**
 * @param {object} factors - triples PERT por factor
 * @param {number} [rerCoef=SDI_RER_COEF_DEFAULT] - coeficiente sobre el PERT de reincidencia (único peso ajustable en la app)
 */
export function calculateSdi(factors, rerCoef = SDI_RER_COEF_DEFAULT) {
  const tdpPert = calculatePert(factors.tdp.min, factors.tdp.prob, factors.tdp.max);
  const tavPert = calculatePert(factors.tav.min, factors.tav.prob, factors.tav.max);
  const ndvPert = calculatePert(factors.ndv.min, factors.ndv.prob, factors.ndv.max);
  const tevPert = calculatePert(factors.tev.min, factors.tev.prob, factors.tev.max);
  const intPert = calculatePert(factors.int.min, factors.int.prob, factors.int.max);
  const rerPert = calculatePert(factors.rer.min, factors.rer.prob, factors.rer.max);

  const iedTotal =
    (tdpPert * SDI_IED_SUB_TDP +
      tavPert * SDI_IED_SUB_TAV +
      ndvPert * SDI_IED_SUB_NDV +
      tevPert * SDI_IED_SUB_TEV) *
    SDI_WEIGHT_IED_BLOCK;
  const intTotal = intPert * SDI_WEIGHT_INT_BLOCK;
  const rerTotal = rerPert * rerCoef;

  return 2 * (iedTotal + intTotal + rerTotal);
}

export function calculateTotalFine(cdi, sdi) {
  return cdi * (sdi / 100);
}

/**
 * Importe en USD correspondiente al límite superior del rango RDM (misma base que el máximo del CDI).
 * - Privado: VDN × (RDM máx. % / 100)
 * - Público: SBU (USD) × RDM máx. (cantidad de SBU)
 */
export function getRdmMaximumFineUsd(institutionType, baseMetric, rdmMax) {
  if (!Number.isFinite(baseMetric) || !Number.isFinite(rdmMax)) {
    return NaN;
  }
  if (institutionType === "private") {
    return baseMetric * (rdmMax / 100);
  }
  return baseMetric * rdmMax;
}

/**
 * Si la multa determinística supera el tope derivado del RDM máximo, se aplica ese tope.
 * @returns {{ total: number, capped: boolean, rawTotal: number }}
 */
export function capFineByRdmMaximum(rawTotal, rdmMaxFineUsd) {
  if (!Number.isFinite(rawTotal)) {
    return { total: rawTotal, capped: false, rawTotal };
  }
  if (!Number.isFinite(rdmMaxFineUsd) || rdmMaxFineUsd < 0) {
    return { total: rawTotal, capped: false, rawTotal };
  }
  if (rawTotal <= rdmMaxFineUsd) {
    return { total: rawTotal, capped: false, rawTotal };
  }
  return { total: rdmMaxFineUsd, capped: true, rawTotal };
}

/**
 * SDI from precomputed factor percentages (0–100), same weights as calculateSdi.
 * Used by Monte Carlo when each factor is sampled from triangular(a, b, c).
 */
export function calculateSdiFromFactorValues(values, rerCoef = SDI_RER_COEF_DEFAULT) {
  const { tdp, tav, ndv, tev, int, rer } = values;
  const iedTotal =
    (tdp * SDI_IED_SUB_TDP + tav * SDI_IED_SUB_TAV + ndv * SDI_IED_SUB_NDV + tev * SDI_IED_SUB_TEV) *
    SDI_WEIGHT_IED_BLOCK;
  const intTotal = int * SDI_WEIGHT_INT_BLOCK;
  const rerTotal = rer * rerCoef;
  return 2 * (iedTotal + intTotal + rerTotal);
}

/** Triangular(a, mode, max) sample; if degenerate returns mode. */
export function sampleTriangular(a, mode, max) {
  if (!Number.isFinite(a) || !Number.isFinite(mode) || !Number.isFinite(max)) {
    return NaN;
  }
  if (max < a) {
    return mode;
  }
  if (a === max) {
    return mode;
  }
  const u = Math.random();
  const F = (mode - a) / (max - a);
  if (u <= F) {
    return a + Math.sqrt(u * (max - a) * (mode - a));
  }
  return max - Math.sqrt((1 - u) * (max - a) * (max - mode));
}
