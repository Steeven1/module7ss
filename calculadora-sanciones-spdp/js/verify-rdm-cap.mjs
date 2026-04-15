/**
 * Caso de uso: PERT min=85, prob=90, max=95 en todos los factores (TDP…RER).
 * Privado, leve, VDN 100000, RDM 0.1%–0.7%, PDI 55, coef. RER 0.20.
 * Debe activar el tope: multa sin tope > importe máximo RDM (700 USD).
 */
import {
  SDI_RER_COEF_DEFAULT,
  calculateCdiPrivate,
  calculateSdi,
  calculateTotalFine,
  capFineByRdmMaximum,
  getRdmMaximumFineUsd
} from "./calculations.js";

const triple = { min: 85, prob: 90, max: 95 };
const factors = {
  tdp: triple,
  tav: triple,
  ndv: triple,
  tev: triple,
  int: triple,
  rer: triple
};

const vdn = 100_000;
const rdmMin = 0.1;
const rdmMax = 0.7;
const pdi = 55;

const cdi = calculateCdiPrivate(vdn, rdmMin, rdmMax, pdi);
const sdi = calculateSdi(factors, SDI_RER_COEF_DEFAULT);
const rawTotal = calculateTotalFine(cdi, sdi);
const maxUsd = getRdmMaximumFineUsd("private", vdn, rdmMax);
const cap = capFineByRdmMaximum(rawTotal, maxUsd);

const ok = cap.capped === true && Math.abs(cap.total - maxUsd) < 1e-6;
console.log(
  JSON.stringify(
    {
      scenario: "PERT 85/90/95 all factors; private leve",
      cdi,
      sdi,
      rawTotal,
      rdmMaxFineUsd: maxUsd,
      capped: cap.capped,
      totalAfterCap: cap.total,
      verifyPassed: ok
    },
    null,
    2
  )
);
process.exit(ok ? 0 : 1);
