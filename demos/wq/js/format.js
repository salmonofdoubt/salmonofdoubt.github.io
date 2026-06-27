export function safeText(value, fallback = "not reported") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export function numberValue(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function prettyNumber(value, digits = 3) {
  const num = numberValue(value);
  if (num === null) return safeText(value);
  if (Math.abs(num) >= 1000) return num.toLocaleString("en-IE", { maximumFractionDigits: 0 });
  if (Math.abs(num) >= 10) return num.toLocaleString("en-IE", { maximumFractionDigits: 2 });
  return num.toLocaleString("en-IE", { maximumFractionDigits: digits });
}

export function formatDate(value) {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IE", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function normaliseKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
