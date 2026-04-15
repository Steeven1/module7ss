/**
 * Opens an independent window with deterministic results, Monte Carlo summary, print and save.
 */

function escapeHtml(text) {
  const s = String(text);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt2(n) {
  if (!Number.isFinite(n)) return "-";
  return Number(n).toFixed(2);
}

function fmtUsd2(n) {
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

/**
 * @param {object} data
 * @param {string} data.institutionLabel
 * @param {string} data.infractionLabel
 * @param {string} data.baseMetricLabel
 * @param {number} data.baseMetricValue
 * @param {number} data.rdmMin
 * @param {number} data.rdmMax
 * @param {string} data.rdmUnit
 * @param {number} data.pdi
 * @param {number} data.cdi
 * @param {number} data.sdi
 * @param {number} data.total - multa final (con tope RDM si aplica)
 * @param {number} [data.totalRaw] - multa antes del tope
 * @param {boolean} [data.cappedByRdm] - true si se aplicó tope al RDM máximo
 * @param {number} [data.rdmMaxFineUsd] - importe USD tope por RDM máximo
 * @param {object} data.mc - { iterations, mean, min, max, p5, p50, p95, stdev }
 * @param {Array} data.histogram - buckets from buildHistogram
 * @param {object} [data.sdiWeights] - pesos aplicados (IED, INT, subpesos IED, coef. RER)
 */
export function openResultsWindow(data) {
  const resultWin = window.open("", "ResultadosSancionesSPDP", "width=900,height=800,scrollbars=yes");
  if (!resultWin) {
    alert("Permite ventanas emergentes para ver el resultado en una ventana independiente.");
    return;
  }
  resultWin.opener = null;

  const pct = (x) => (Number(x) * 100).toFixed(2);
  const swt = data.sdiWeights;
  const weightsBlock =
    swt &&
    `
  <div class="card">
    <h2>Pesos del SDI aplicados en este cálculo</h2>
    <p class="muted">Los bloques de impacto en derechos e intencionalidad, y los subpesos del IED, son fijos en el modelo. Solo el coeficiente de RER es el que ajustaste en el formulario.</p>
    <table>
      <thead>
        <tr><th>Bloque / factor</th><th>Peso</th></tr>
      </thead>
      <tbody>
        <tr><td>Impacto en derechos (IED)</td><td>${pct(swt.iedBlock)}% (fijo)</td></tr>
        <tr><td> → TDP dentro del IED</td><td>${pct(swt.iedSub.tdp)}% del subscore IED</td></tr>
        <tr><td> → TAV dentro del IED</td><td>${pct(swt.iedSub.tav)}% del subscore IED</td></tr>
        <tr><td> → NDV dentro del IED</td><td>${pct(swt.iedSub.ndv)}% del subscore IED</td></tr>
        <tr><td> → TEV dentro del IED</td><td>${pct(swt.iedSub.tev)}% del subscore IED</td></tr>
        <tr><td>Intencionalidad (INT)</td><td>${pct(swt.intBlock)}% (fijo)</td></tr>
        <tr><td>Reincidencia (RER)</td><td>PERT × ${fmt2(swt.rerCoef)} (coeficiente ajustable)</td></tr>
      </tbody>
    </table>
    <p class="muted">Fórmula: SDI = 2 × [ (ponderación IED sobre TDP,TAV,NDV,TEV) + INT × bloque intencionalidad + RER_PERT × coeficiente ]. Los pesos del bloque IED y del bloque INT están fijados; solo el coeficiente de RER es editable.</p>
  </div>`;

  const histRows = data.histogram
    .map((b) => {
      const barW = Math.min(100, Math.max(0, Number(b.barPct) || 0));
      return `
    <tr>
      <td>${fmtUsd2(b.from)} – ${fmtUsd2(b.to)}</td>
      <td>${fmt2(b.count)}</td>
      <td>${fmt2(b.pct)}%</td>
      <td class="bar-cell"><span class="bar" style="width:${barW.toFixed(2)}%"></span></td>
    </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Resultado — Calculadora Sanciones SPDP</title>
  <style>
    :root { --text: #1f2a37; --muted: #5b6573; --border: #d9e2ef; --primary: #0b5fff; --bg: #f4f7fb; }
    body { font-family: Arial, sans-serif; margin: 0; padding: 1rem; color: var(--text); background: var(--bg); }
    h1 { font-size: 1.35rem; margin-top: 0; }
    h2 { font-size: 1.05rem; margin-top: 1.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0.35rem; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
    .toolbar button { padding: 0.45rem 0.85rem; border-radius: 8px; border: 1px solid #cfd6df; background: #fff; cursor: pointer; font-size: 0.95rem; }
    .toolbar button.primary { background: var(--primary); color: #fff; border-color: var(--primary); }
    .card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 1rem; margin-bottom: 1rem; }
    .muted { color: var(--muted); font-size: 0.9rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
    th, td { border: 1px solid var(--border); padding: 0.4rem 0.5rem; text-align: left; }
    th { background: #f2f4f7; }
    .bar-cell { width: 35%; }
    .bar { display: block; height: 10px; background: #0b5fff; border-radius: 4px; min-width: 2px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
    .alert-rdm-cap {
      color: #b91c1c;
      font-weight: 700;
      font-size: 1.05rem;
      margin: 0.75rem 0;
      line-height: 1.35;
    }
    .strike-muted { color: var(--muted); text-decoration: line-through; }
    @media print {
      body { background: #fff; padding: 0; }
      .toolbar { display: none !important; }
      .card { border: none; box-shadow: none; page-break-inside: avoid; }
      .alert-rdm-cap { color: #b91c1c !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button type="button" class="primary" id="btn-print">Imprimir</button>
    <button type="button" id="btn-save">Guardar reporte HTML</button>
    <button type="button" id="btn-close">Cerrar</button>
  </div>

  <h1>Resultado — Calculadora de Sanciones SPDP</h1>
  <p class="muted">Módulo determinístico (MPRIV-1 / MPUB-1) y simulación Monte Carlo sobre factores PERT (distribución triangular por factor).</p>

  ${
    data.cappedByRdm
      ? `<p class="alert-rdm-cap" role="alert">Aplica tope por RDM máximo: la multa determinística sin tope (${fmtUsd2(
          data.totalRaw
        )}) supera el importe máximo asociado al RDM (${fmtUsd2(
          data.rdmMaxFineUsd
        )}). <strong>Se multa con el valor máximo de RDM: ${fmtUsd2(data.total)}.</strong></p>`
      : ""
  }

  <div class="card">
    <h2>Resumen de entrada</h2>
    <div class="grid-2">
      <div><strong>Institución:</strong> ${escapeHtml(data.institutionLabel)}</div>
      <div><strong>Infracción:</strong> ${escapeHtml(data.infractionLabel)}</div>
      <div><strong>${escapeHtml(data.baseMetricLabel)}:</strong> ${fmtUsd2(data.baseMetricValue)}</div>
      <div><strong>PDI:</strong> ${fmt2(data.pdi)}</div>
      <div><strong>RDM mín.:</strong> ${fmt2(data.rdmMin)} ${escapeHtml(data.rdmUnit)}</div>
      <div><strong>RDM máx.:</strong> ${fmt2(data.rdmMax)} ${escapeHtml(data.rdmUnit)}</div>
      <div><strong>Tope multa (importe máx. RDM):</strong> ${fmtUsd2(data.rdmMaxFineUsd)}</div>
    </div>
  </div>
  ${weightsBlock || ""}

  <div class="card">
    <h2>Resultado determinístico</h2>
    <p><strong>CDI:</strong> ${fmtUsd2(data.cdi)}</p>
    <p><strong>SDI:</strong> ${fmt2(data.sdi)}%</p>
    <p><strong>Multa administrativa total:</strong> ${fmtUsd2(data.total)}</p>
    ${
      data.cappedByRdm
        ? `<p class="muted">Referencia (sin tope RDM): <span class="strike-muted">${fmtUsd2(data.totalRaw)}</span> — no aplica; prevalece el tope ${fmtUsd2(
            data.rdmMaxFineUsd
          )}.</p>`
        : ""
    }
  </div>

  <div class="card">
    <h2>Simulación Monte Carlo (multa total)</h2>
    <p class="muted">Iteraciones: ${escapeHtml(String(data.mc.iterations))}. Cada factor PERT se muestrea de una triangular (mín, más probable, máx). Cada iteración aplica el mismo tope al importe máximo del RDM que el resultado determinístico.</p>
    <div class="grid-2">
      <p><strong>Media:</strong> ${fmtUsd2(data.mc.mean)}</p>
      <p><strong>Desv. estándar:</strong> ${fmtUsd2(data.mc.stdev)}</p>
      <p><strong>Mínimo:</strong> ${fmtUsd2(data.mc.min)}</p>
      <p><strong>Máximo:</strong> ${fmtUsd2(data.mc.max)}</p>
      <p><strong>Percentil 5:</strong> ${fmtUsd2(data.mc.p5)}</p>
      <p><strong>Mediana (P50):</strong> ${fmtUsd2(data.mc.p50)}</p>
      <p><strong>Percentil 95:</strong> ${fmtUsd2(data.mc.p95)}</p>
    </div>
  </div>

  <div class="card">
    <h2>Distribución (histograma)</h2>
    <table>
      <thead>
        <tr><th>Rango multa (USD)</th><th>Frecuencia</th><th>% del total</th><th></th></tr>
      </thead>
      <tbody>${histRows}</tbody>
    </table>
  </div>

  <script>
    (function () {
      var saved = false;
      document.getElementById("btn-print").addEventListener("click", function () { window.print(); });
      document.getElementById("btn-close").addEventListener("click", function () {
        if (!saved && !confirm("¿Cerrar sin guardar el reporte HTML?")) {
          return;
        }
        window.close();
      });
      document.getElementById("btn-save").addEventListener("click", function () {
        var blob = new Blob([document.documentElement.outerHTML], { type: "text/html;charset=utf-8" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "reporte-sanciones-spdp.html";
        a.click();
        URL.revokeObjectURL(a.href);
        saved = true;
      });
      window.addEventListener("beforeunload", function (e) {
        if (!saved) {
          e.preventDefault();
          e.returnValue = "";
        }
      });
    })();
  </script>
</body>
</html>`;

  resultWin.document.open();
  resultWin.document.write(html);
  resultWin.document.close();
  resultWin.focus();
}
