import { useMemo, useState } from "react";
import { CalendarRange } from "lucide-react";
import { money, todayISO } from "../../lib/format.js";

const monthLabel = (key, style = "short") =>
  new Date(`${key}-15T12:00:00`).toLocaleDateString("es-ES", style === "short" ? { month: "short" } : { month: "long", year: "numeric" }).replace(".", "");

// Últimos 12 meses (clave YYYY-MM), del más antiguo al actual
function lastMonths(n) {
  const [y, m] = todayISO().split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 15));
    return d.toISOString().slice(0, 7);
  });
}

// Gasto mensual del último año (sin sobres con PIN). Tocar una barra muestra el desglose por sobre.
export default function AnnualChart({ transactions, categories, isLocked }) {
  const hidden = useMemo(() => new Set(categories.filter((c) => c.hasPin).map((c) => c.id)), [categories]);

  const months = useMemo(() => {
    const byMonth = Object.fromEntries(lastMonths(12).map((key) => [key, { total: 0, cats: {} }]));
    for (const t of transactions) {
      const entry = byMonth[(t.date || "").slice(0, 7)];
      if (!entry || t.type !== "expense" || hidden.has(t.categoryId)) continue;
      entry.total += t.amount || 0;
      entry.cats[t.categoryId] = (entry.cats[t.categoryId] || 0) + (t.amount || 0);
    }
    return Object.entries(byMonth).map(([key, v]) => ({ key, ...v }));
  }, [transactions, hidden]);

  const [selected, setSelected] = useState(months[months.length - 1].key);
  const max = Math.max(1, ...months.map((m) => m.total));
  const current = months.find((m) => m.key === selected) || months[months.length - 1];
  if (months.every((m) => m.total === 0)) return null;

  const breakdown = categories
    .filter((c) => !isLocked(c) && current.cats[c.id] > 0)
    .map((c) => ({ id: c.id, name: c.name, amount: current.cats[c.id] }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <section id="anual" className="anchor">
      <div className="section-header">
        <div>
          <div className="section-title"><CalendarRange size={18} color="var(--violet)" /> Gasto del último año</div>
          <div className="section-hint">Toca un mes para ver el desglose. No incluye sobres con PIN.</div>
        </div>
      </div>
      <div className="card">
        <div className="year-chart" role="group" aria-label="Gasto por mes">
          {months.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`year-col ${m.key === current.key ? "active" : ""}`}
              onClick={() => setSelected(m.key)}
              aria-pressed={m.key === current.key}
              aria-label={`${monthLabel(m.key, "long")}: ${money(m.total)}`}
            >
              <span className="year-track">
                <span className="year-bar" style={{ height: m.total > 0 ? `${Math.max(3, (m.total / max) * 100)}%` : 0 }} />
              </span>
              <span className="year-label">{monthLabel(m.key).slice(0, 1).toUpperCase()}</span>
            </button>
          ))}
        </div>
        <div className="year-detail">
          <div className="year-detail-head">
            <span>{monthLabel(current.key, "long")}</span>
            <strong>{money(current.total)}</strong>
          </div>
          {breakdown.map((row) => (
            <div key={row.id} className="year-row"><span>{row.name}</span><span>{money(row.amount)}</span></div>
          ))}
        </div>
      </div>
    </section>
  );
}
