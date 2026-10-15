import { todayLocal } from "../shared.js";

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Fechas en hora de España (toISOString usa UTC y entre las 00:00 y las 02:00 daba el día anterior)
export const todayISO = () => todayLocal();

export const fmtDay = (iso) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "";

// "YYYY-MM" del mes siguiente a "YYYY-MM-DD"
export function nextMonthKey(iso) {
  const [y, m] = iso.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

// Importes: acepta "12,50" o "12.50" (el teclado español usa coma)
export const parseAmount = (v) => parseFloat(String(v ?? "").trim().replace(/\s/g, "").replace(",", "."));

const euro = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
export const money = (n) => euro.format(Math.round(((n || 0) + Number.EPSILON) * 100) / 100);

export const sortByDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

export const hashPin = (pin) => (pin ? btoa(pin.trim()) : "");
export const pinMatches = (cat, entered) => !!entered && (hashPin(entered) === cat.pinHash || entered === cat.pin);

export function isLightColor(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#")) return false;
  const c = hex.substring(1);
  const rgb = parseInt(c.length === 3 ? c.split("").map((x) => x + x).join("") : c, 16);
  if (isNaN(rgb)) return false;
  const r = (rgb >> 16) & 0xff, g = (rgb >> 8) & 0xff, b = rgb & 0xff;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 128;
}
