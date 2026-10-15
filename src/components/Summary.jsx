import { Plus } from "lucide-react";
import { money, fmtDay } from "../lib/format.js";

// Aviso de ciclo nuevo + Fondo General + totales del ciclo
export default function Summary({ fund, cycle, hasSources, onRegisterPayroll }) {
  return (
    <>
      {hasSources && fund.income === 0 && (
        <div className="cycle-banner">
          <div>
            <div style={{ fontWeight: 800 }}>🗓️ Nuevo ciclo desde el {fmtDay(cycle.start)}</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>Aún no hay nóminas registradas en este ciclo.</div>
          </div>
          <button className="btn-primary" onClick={onRegisterPayroll}><Plus size={15} /> Registrar nóminas</button>
        </div>
      )}

      <div className="summary-grid">
        <div className="summary-card highlight">
          <div className="summary-label">Fondo General Disponible</div>
          <div className="summary-val" style={{ color: fund.available >= 0 ? "var(--text-main)" : "var(--red)" }}>
            {money(fund.available)}
          </div>
          <div className="summary-sub">
            Sin asignar a sobres{fund.carry !== 0 ? ` · incluye ${money(fund.carry)} del ciclo anterior` : ""}
          </div>
        </div>
        <div className="summary-row">
          <div className="summary-card">
            <div className="summary-label">Nóminas del ciclo</div>
            <div className="summary-val" style={{ color: "var(--green)" }}>{money(fund.income)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Asignado a sobres</div>
            <div className="summary-val" style={{ color: "var(--purple-accent)" }}>{money(fund.assigned)}</div>
          </div>
        </div>
      </div>
    </>
  );
}
