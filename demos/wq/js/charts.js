import { normaliseKey } from "./format.js";

export function drawCqChart(canvas, caption, payload, parameter = "all", scale = "log") {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const pairs = payload?.analysis?.cq_pairs || [];

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#061816";
  ctx.fillRect(0, 0, width, height);

  const filtered = pairs
    .filter(pair => parameter === "all" || normaliseKey(pair.parameter) === parameter)
    .filter(pair => Number(pair.flow_m3_s) > 0 && Number(pair.concentration_value) > 0);

  if (!filtered.length) {
    ctx.fillStyle = "#9ccbc4";
    ctx.font = "24px system-ui, sans-serif";
    ctx.fillText("No paired flow-concentration data yet.", 42, 92);
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText("The chart engine is ready. Historical chemistry and OPW flow joins come next.", 42, 128);
    caption.textContent = "C-Q analysis requires paired discharge Q and concentration C for the same station or defensible waterbody join.";
    return;
  }

  const xValues = filtered.map(pair => scale === "log" ? Math.log10(Number(pair.flow_m3_s)) : Number(pair.flow_m3_s));
  const yValues = filtered.map(pair => scale === "log" ? Math.log10(Number(pair.concentration_value)) : Number(pair.concentration_value));
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const pad = 54;

  function sx(value) {
    if (xMax === xMin) return width / 2;
    return pad + ((value - xMin) / (xMax - xMin)) * (width - pad * 1.6);
  }

  function sy(value) {
    if (yMax === yMin) return height / 2;
    return height - pad - ((value - yMin) / (yMax - yMin)) * (height - pad * 1.6);
  }

  ctx.strokeStyle = "rgba(156, 203, 196, 0.32)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, 20);
  ctx.lineTo(pad, height - pad);
  ctx.lineTo(width - 24, height - pad);
  ctx.stroke();

  ctx.fillStyle = "#5eead4";
  filtered.forEach((pair, index) => {
    ctx.beginPath();
    ctx.arc(sx(xValues[index]), sy(yValues[index]), 5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#ecfffb";
  ctx.font = "15px system-ui, sans-serif";
  ctx.fillText(scale === "log" ? "log₁₀(Q), m³ s⁻¹" : "Q, m³ s⁻¹", pad, height - 18);
  ctx.save();
  ctx.translate(18, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(scale === "log" ? "log₁₀(C)" : "Concentration", 0, 0);
  ctx.restore();

  caption.textContent = `${filtered.length} paired records shown. Regression and hysteresis diagnostics will be added when source joins are stable.`;
}
