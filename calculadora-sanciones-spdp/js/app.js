import {
  calculateCdiPrivate,
  calculateCdiPublic,
  calculateSdi,
  calculateTotalFine,
  capFineByRdmMaximum,
  getRdmMaximumFineUsd,
  SDI_IED_SUB_NDV,
  SDI_IED_SUB_TAV,
  SDI_IED_SUB_TDP,
  SDI_IED_SUB_TEV,
  SDI_WEIGHT_IED_BLOCK,
  SDI_WEIGHT_INT_BLOCK
} from "./calculations.js";
import { buildHistogram, runMonteCarloSimulation } from "./monteCarlo.js";
import { openResultsWindow } from "./resultWindow.js";
const form = document.getElementById("sanctions-form");
const errorBox = document.getElementById("error-box");
const baseMetricLabel = document.getElementById("base-metric-label");
const rdmMinLabel = document.getElementById("rdm-min-label");
const rdmMaxLabel = document.getElementById("rdm-max-label");
const baseMetricInput = document.getElementById("baseMetricInput");
const sbuInfo = document.getElementById("sbu-info");
const rdmMinInput = document.getElementById("rdmMin");
const rdmMaxInput = document.getElementById("rdmMax");
const activeRangeInfo = document.getElementById("active-range-info");
const calculateBtn = document.getElementById("calculate-btn");
const infractionFieldset = document.getElementById("infraction-fieldset");
const institutionSelect = document.getElementById("institutionType");
const infractionSelect = document.getElementById("infractionType");

const numberInputs = form.querySelectorAll('input[data-number="decimal"]');
const invalidInputNames = new Set();
const FIXED_ECUADOR_SBU = 482.0;
const RDM_RANGES = {
  private: {
    leve: { min: 0.1, max: 0.7 },
    grave: { min: 0.7, max: 1.0 }
  },
  public: {
    leve: { min: 1, max: 10 },
    grave: { min: 10, max: 20 }
  }
};

numberInputs.forEach((input) => {
  input.addEventListener("input", () => {
    const hadInvalidChars = /[^0-9.]/.test(input.value);
    let clean = input.value.replace(/[^0-9.]/g, "");
    const dotCount = (clean.match(/\./g) || []).length;
    if (dotCount > 1) {
      const firstDot = clean.indexOf(".");
      clean = clean.slice(0, firstDot + 1) + clean.slice(firstDot + 1).replace(/\./g, "");
      invalidInputNames.add(input.name);
    }
    if (hadInvalidChars) {
      invalidInputNames.add(input.name);
      errorBox.textContent = "Solo se permiten números y punto decimal. No uses letras ni caracteres especiales.";
    }
    if (!hadInvalidChars && dotCount <= 1) {
      invalidInputNames.delete(input.name);
    }
    input.value = clean;
  });
});

institutionSelect.addEventListener("change", handleSelectionFlow);
institutionSelect.addEventListener("input", handleSelectionFlow);
infractionSelect.addEventListener("change", handleSelectionFlow);
infractionSelect.addEventListener("input", handleSelectionFlow);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  errorBox.textContent = "";

  const values = getFormValues();
  const errors = validate(values);
  if (errors.length > 0) {
    renderErrors(errors);
    return;
  }

  const cdi =
    values.institutionType === "private"
      ? calculateCdiPrivate(values.baseMetric, values.rdmMin, values.rdmMax, values.pdi)
      : calculateCdiPublic(values.baseMetric, values.rdmMin, values.rdmMax, values.pdi);

  const sdi = calculateSdi(values.pertFactors, values.rerCoef);
  const rdmMaxFineUsd = getRdmMaximumFineUsd(values.institutionType, values.baseMetric, values.rdmMax);
  const rawTotal = calculateTotalFine(cdi, sdi);
  const capResult = capFineByRdmMaximum(rawTotal, rdmMaxFineUsd);
  const total = capResult.total;

  const mc = runMonteCarloSimulation(cdi, values.pertFactors, values.rerCoef, rdmMaxFineUsd);
  const histogram = buildHistogram(mc.samples, 20);

  const institutionLabel =
    values.institutionType === "private" ? "Privada con fines de lucro (MPRIV-1)" : "Pública (MPUB-1)";
  const infractionLabel = values.infractionType === "grave" ? "Grave" : "Leve";
  const baseMetricLabel =
    values.institutionType === "public" ? "SBU (Salario Básico Unificado) en USD" : "VDN (Volumen de Negocio) en USD";
  const rdmUnit = values.institutionType === "public" ? "SBU" : "%";

  openResultsWindow({
    institutionLabel,
    infractionLabel,
    baseMetricLabel,
    baseMetricValue: values.baseMetric,
    rdmMin: values.rdmMin,
    rdmMax: values.rdmMax,
    rdmUnit,
    pdi: values.pdi,
    cdi,
    sdi,
    total,
    totalRaw: rawTotal,
    cappedByRdm: capResult.capped,
    rdmMaxFineUsd,
    sdiWeights: {
      iedBlock: SDI_WEIGHT_IED_BLOCK,
      intBlock: SDI_WEIGHT_INT_BLOCK,
      iedSub: {
        tdp: SDI_IED_SUB_TDP,
        tav: SDI_IED_SUB_TAV,
        ndv: SDI_IED_SUB_NDV,
        tev: SDI_IED_SUB_TEV
      },
      rerCoef: values.rerCoef
    },
    mc: {
      iterations: mc.iterations,
      mean: mc.mean,
      min: mc.min,
      max: mc.max,
      p5: mc.p5,
      p50: mc.p50,
      p95: mc.p95,
      stdev: mc.stdev
    },
    histogram
  });
});

function handleSelectionFlow() {
  applyInstitutionUi(getSelectedValue("institutionType"));
  updateInfractionAvailability();
  applyRdmBySelection();
  updateCalculationAvailability();
}

function applyInstitutionUi(type) {
  if (type === "public") {
    baseMetricLabel.textContent = "SBU (Salario Básico Unificado) en USD";
    rdmMinLabel.textContent = "RDM mínimo (cantidad de SBU)";
    rdmMaxLabel.textContent = "RDM máximo (cantidad de SBU)";
    baseMetricInput.value = FIXED_ECUADOR_SBU.toFixed(2);
    baseMetricInput.readOnly = true;
    baseMetricInput.placeholder = "Auto";
    sbuInfo.classList.remove("hidden");
  } else {
    baseMetricLabel.textContent = "VDN (Volumen de Negocio) en USD";
    rdmMinLabel.textContent = "RDM mínimo (%)";
    rdmMaxLabel.textContent = "RDM máximo (%)";
    baseMetricInput.value = "";
    baseMetricInput.readOnly = false;
    baseMetricInput.placeholder = "Ej: 100000";
    sbuInfo.classList.add("hidden");
  }
}

function updateInfractionAvailability() {
  const isEnabled = Boolean(getSelectedValue("institutionType"));
  infractionFieldset.classList.toggle("section-disabled", !isEnabled);
  infractionFieldset.setAttribute("aria-disabled", String(!isEnabled));
  infractionSelect.disabled = !isEnabled;
  if (!isEnabled) {
    infractionSelect.value = "";
  }
}

function applyRdmBySelection() {
  const institutionType = getSelectedValue("institutionType");
  const infractionType = getSelectedValue("infractionType");
  const rdmRange = resolveRdmRange(institutionType, infractionType);

  if (!rdmRange) {
    rdmMinInput.value = "";
    rdmMaxInput.value = "";
    activeRangeInfo.textContent = "";
    activeRangeInfo.classList.add("hidden");
    return;
  }

  rdmMinInput.value = rdmRange.min.toFixed(2);
  rdmMaxInput.value = rdmRange.max.toFixed(2);
  activeRangeInfo.textContent = buildRangeInfoText(institutionType, infractionType, rdmRange);
  activeRangeInfo.classList.remove("hidden");
}

function getFormValues() {
  const formData = new FormData(form);
  const institutionType = formData.get("institutionType");
  const infractionType = formData.get("infractionType");
  const rdmRange = resolveRdmRange(institutionType, infractionType);
  return {
    institutionType,
    infractionType,
    baseMetric: parseNumber(formData.get("baseMetricInput")),
    rdmMin: rdmRange ? rdmRange.min : NaN,
    rdmMax: rdmRange ? rdmRange.max : NaN,
    pdi: parseNumber(formData.get("pdi")),
    rerCoef: parseNumber(formData.get("rerCoef")),
    pertFactors: {
      tdp: getTriple(formData, "tdp"),
      tav: getTriple(formData, "tav"),
      ndv: getTriple(formData, "ndv"),
      tev: getTriple(formData, "tev"),
      int: getTriple(formData, "int"),
      rer: getTriple(formData, "rer")
    }
  };
}

function getTriple(formData, prefix) {
  return {
    min: parseNumber(formData.get(`${prefix}Min`)),
    prob: parseNumber(formData.get(`${prefix}Prob`)),
    max: parseNumber(formData.get(`${prefix}Max`))
  };
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") {
    return NaN;
  }
  return Number(value);
}

function validate(values) {
  const errors = [];
  if (invalidInputNames.size > 0) {
    errors.push("Se detectaron letras o caracteres especiales en campos numéricos. Corrige esos valores.");
  }
  if (!values.institutionType) {
    errors.push("Debes seleccionar el tipo de institución.");
  }
  if (!values.infractionType) {
    errors.push("Debes seleccionar el tipo de infracción (leve o grave).");
  }
  if (!isFiniteNumber(values.baseMetric) || values.baseMetric <= 0) {
    errors.push("El valor base (VDN o SBU) debe ser un número mayor a 0.");
  }
  if (values.institutionType === "public" && values.baseMetric !== FIXED_ECUADOR_SBU) {
    errors.push("Para sector público, el SBU es informativo y fijo en USD 482.00.");
  }
  if (!isFiniteNumber(values.rdmMin) || !isFiniteNumber(values.rdmMax)) {
    errors.push("No se pudo fijar el RDM. Selecciona institución e infracción.");
  }
  if (!isFiniteNumber(values.pdi) || values.pdi < 0 || values.pdi > 100) {
    errors.push("PDI debe estar entre 0 y 100.");
  }
  if (!isFiniteNumber(values.rerCoef) || values.rerCoef < 0 || values.rerCoef > 1) {
    errors.push("El coeficiente de reincidencia (RER) debe ser un número entre 0 y 1.");
  }
  Object.entries(values.pertFactors).forEach(([factorKey, triple]) => {
    validatePertTriple(triple, factorKey.toUpperCase(), errors);
  });
  return errors;
}

/**
 * Renderiza mensajes de error sin usar innerHTML para evitar riesgos de inyección.
 * @param {string[]} errors
 */
function renderErrors(errors) {
  errorBox.textContent = "";
  errors.forEach((error) => {
    const row = document.createElement("div");
    row.textContent = `- ${error}`;
    errorBox.appendChild(row);
  });
}

function validatePertTriple(triple, name, errors) {
  if (!isFiniteNumber(triple.min) || !isFiniteNumber(triple.prob) || !isFiniteNumber(triple.max)) {
    errors.push(`${name}: todos los campos PERT deben ser numéricos.`);
    return;
  }
  if (triple.min < 0 || triple.prob < 0 || triple.max < 0 || triple.min > 100 || triple.prob > 100 || triple.max > 100) {
    errors.push(`${name}: valores PERT deben estar entre 0 y 100.`);
  }
  if (!(triple.min <= triple.prob && triple.prob <= triple.max)) {
    errors.push(`${name}: se recomienda el orden Mínimo <= Probable <= Máximo.`);
  }
}

function resolveRdmRange(institutionType, infractionType) {
  if (!institutionType || !infractionType) {
    return null;
  }
  const institutionRanges = RDM_RANGES[institutionType];
  if (!institutionRanges) {
    return null;
  }
  return institutionRanges[infractionType] || null;
}

function updateCalculationAvailability() {
  calculateBtn.disabled = !(getSelectedValue("institutionType") && getSelectedValue("infractionType"));
}

function getSelectedValue(name) {
  if (name === "institutionType") {
    return institutionSelect ? institutionSelect.value : "";
  }
  if (name === "infractionType") {
    return infractionSelect ? infractionSelect.value : "";
  }
  return "";
}

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function buildRangeInfoText(institutionType, infractionType, rdmRange) {
  const model = institutionType === "public" ? "MPUB-1" : "MPRIV-1";
  const infractionLabel = infractionType === "grave" ? "Grave" : "Leve";
  const unit = institutionType === "public" ? "SBU" : "%";
  const minStr = Number(rdmRange.min).toFixed(2);
  const maxStr = Number(rdmRange.max).toFixed(2);
  return `Rango aplicado (${model} - ${infractionLabel}): ${minStr} a ${maxStr} ${unit}.`;
}
a