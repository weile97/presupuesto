import { useState } from "react";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { money } from "../../lib/format.js";

// Gasto por sobre en este ciclo frente al anterior, y cuánto ha pagado cada uno
export default function CycleSummary({ categories, cycleSummary, isLocked }) {
  const [open, setOpen] = useState(true);
  const { current, previous, paidBy } = cycleSummary;

  const rows = categories
    .filter((c) => !isLocked(c) && ((current[c.id] || 0) > 0 || (previous[c.id] || 0) > 0))
    .map((c) => ({ cat: c, now: current[c.id] || 0, before: previous[c.id] || 0 }))
    .sort((a, b) => b.now - a.now);
  const max = Math.max(1, ...rows.flatMap((r) => [r.now, r.before]));
  const total = rows.reduce((a, r) => a + r.now, 0);
  const totalBefore = rows.reduce((a, r) => a + r.before, 0);
  const payers = Object.entries(paidBy).sort((a, b) => b[1] - a[1]);
  const paidTotal = payers.reduce((a, [, v]) => a + v, 0);

  if (rows.length === 0 && payers.length === 0) return null;

  return (
    <section>
      <div className="section-header">
        <button className="section-title section-toggle" onClick={() => setOpen((v) => !v)}>
          <BarChart3 size={18} color="var(--pink-primary)" /> Resumen del ciclo
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {open && (
        <div className="card summary-cycle">
          <div className="cycle-totals">
            <div>
              <div className="summary-label">Gastado este ciclo</div>
              <div className="summary-val" style={{ color: "var(--red)" }}>{money(total)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="summary-label">Ciclo anterior</div>
              <div className="summary-val" style={{ color: "var(--text-muted)", fontSize: 18 }}>{money(totalBefore)}</div>
            </div>
          </div>

          {rows.map(({ cat, now, before }) => {
            const diff = now - before;
            return (
              <div key={cat.id} className="bar-row">
                <div className="bar-head">
                  <span className="bar-name">{cat.name}</span>
                  <span className="bar-val">
                    {money(now)}
                    {before > 0 && <small className={diff > 0 ? "up" : "down"}> {diff > 0 ? "▲" : "▼"} {money(Math.abs(diff))}</small>}
                  </span>
                </div>
                <div className="bar-track">
                  <div className="bar-prev" style={{ width: `${(before / max) * 100}%` }} />
                  <div className="bar-now" style={{ width: `${(now / max) * 100}%`, background: cat.color || "var(--pink-primary)" }} />
                </div>
              </div>
            );
          })}
          <div className="bar-legend"><span className="lg-now" /> Este ciclo <span className="lg-prev" /> Ciclo anterior</div>

          {payers.length > 0 && (
            <div className="payers">
              <div className="summary-label" style={{ marginBottom: 8 }}>Quién ha pagado los gastos</div>
              <div className="payer-bar">
                {payers.map(([name, v], i) => (
                  <div key={name} className={`payer-seg p${i % 4}`} style={{ width: `${(v / paidTotal) * 100}%` }} />
                ))}
              </div>
              <div className="payer-list">
                {payers.map(([name, v], i) => (
                  <span key={name}><i className={`dot p${i % 4}`} /> {name}: <strong>{money(v)}</strong> ({Math.round((v / paidTotal) * 100)}%)</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
