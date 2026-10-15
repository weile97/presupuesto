import { CreditCard, RefreshCw, Plus, Edit2, X, History, Wallet } from "lucide-react";
import { SRC_ICONS } from "../../lib/constants.js";
import { money, fmtDay } from "../../lib/format.js";

export default function PayrollSection({ sources, lastPayrollBySource, openSheet, actions }) {
  return (
    <section>
      <div className="section-header">
        <div>
          <div className="section-title"><CreditCard size={18} color="var(--pink-primary)" /> Ingresos de Nómina</div>
          <div className="section-hint">Se reinician solos cada día 29. Los sobres no se tocan.</div>
        </div>
        <div className="section-actions">
          <button className="btn-secondary" onClick={() => openSheet("bulkPayroll")}>
            <RefreshCw size={15} /> Registrar nóminas
          </button>
          <button className="btn-primary" onClick={() => openSheet("source")}>
            <Plus size={15} /> Nueva fuente
          </button>
        </div>
      </div>

      {sources.length === 0 ? (
        <div className="card empty-card">Aún no hay fuentes de nómina. Pulsa "Nueva fuente" para empezar.</div>
      ) : (
        <div className="grid-3">
          {sources.map((s) => {
            const Icon = SRC_ICONS[s.icon] || Wallet;
            const last = lastPayrollBySource[s.id];
            return (
              <div className="card" key={s.id}>
                <div className="card-top">
                  <div className="card-icon" style={{ background: s.color }}><Icon size={18} /></div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn-icon" onClick={() => openSheet("source", { source: s })} aria-label="Editar"><Edit2 size={14} /></button>
                    <button className="btn-icon" onClick={() => actions.deleteSource(s.id)} aria-label="Eliminar"><X size={14} /></button>
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{s.name}</div>
                <div style={{ marginBottom: 6, fontSize: 12, color: "var(--text-muted)" }}>
                  Referencia: <strong style={{ color: "white" }}>{money(s.amount)}</strong>
                </div>
                <div style={{ marginBottom: 14, fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
                  <History size={12} />
                  {last ? `Este ciclo: ${money(last.amount)} · ${fmtDay(last.date)}` : "Sin nómina en este ciclo"}
                </div>
                <button className="btn-secondary" style={{ width: "100%" }} onClick={() => openSheet("deposit", { source: s })}>
                  <Plus size={15} /> Registrar ingreso
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
