import { useMemo } from "react";
import { Plus, EyeOff, Wallet, Banknote, Send } from "lucide-react";
import { money, fmtDay } from "../lib/format.js";

// Tarjeta principal: Fondo General + total en sobres (sin los ocultos con PIN) + totales del ciclo
export default function Summary({ fund, cycle, categories, categoryBalances, hasSources, onRegisterPayroll }) {
  const envelopes = useMemo(() => {
    let total = 0, hidden = 0;
    for (const c of categories) {
      if (c.hasPin) { hidden++; continue; }
      total += categoryBalances[c.id]?.balance || 0;
    }
    return { total, hidden, visible: categories.length - hidden };
  }, [categories, categoryBalances]);

  return (
    <div id="inicio" className="anchor">
      {hasSources && fund.income === 0 && (
        <div className="cycle-banner">
          <div>
            <div className="cycle-banner-title">🗓️ Nuevo ciclo desde el {fmtDay(cycle.start)}</div>
            <div className="cycle-banner-sub">Aún no hay nóminas registradas en este ciclo.</div>
          </div>
          <button className="btn-primary" onClick={onRegisterPayroll}><Plus size={16} /> Registrar nóminas</button>
        </div>
      )}

      <div className="hero">
        <div className="hero-top">
          <div>
            <div className="hero-label">Fondo General disponible</div>
            <div className={`hero-value ${fund.available < 0 ? "negative" : ""}`}>{money(fund.available)}</div>
            <div className="hero-sub">
              Sin repartir{fund.carry !== 0 ? ` · ${money(fund.carry)} del ciclo anterior` : ""}
            </div>
          </div>
          <div className="hero-cycle">{fmtDay(cycle.start)}<br />–<br />{fmtDay(cycle.nextStart)}</div>
        </div>

        <div className="hero-envelopes">
          <div className="hero-env-icon"><Wallet size={18} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="hero-label">Total en sobres</div>
            <div className="hero-env-value">{money(envelopes.total)}</div>
          </div>
          <div className="hero-env-note">
            {envelopes.visible} sobre{envelopes.visible === 1 ? "" : "s"}
            {envelopes.hidden > 0 && <span><EyeOff size={12} /> {envelopes.hidden} oculto{envelopes.hidden === 1 ? "" : "s"} sin contar</span>}
          </div>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="stat-icon green"><Banknote size={16} /></div>
          <div>
            <div className="stat-label">Nóminas del ciclo</div>
            <div className="stat-value green">{money(fund.income)}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icon violet"><Send size={16} /></div>
          <div>
            <div className="stat-label">Asignado a sobres</div>
            <div className="stat-value violet">{money(fund.assigned)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
