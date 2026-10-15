import { BellRing, Heart, Download } from "lucide-react";
import { fmtDay } from "../lib/format.js";

export default function Header({ cycle, userName, showBell, onEnableNotifications, onEditName, onExport }) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="brand">
          <div className="brand-logo">🦄</div>
          <div>
            <div className="brand-title">M&amp;J</div>
            <div className="brand-sub">Ciclo: {fmtDay(cycle.start)} – {fmtDay(cycle.nextStart)}</div>
          </div>
        </div>
        <div className="header-actions">
          {showBell && (
            <button className="btn-icon-square bell-pulse" onClick={onEnableNotifications} title="Activar notificaciones">
              <BellRing size={17} />
              <span className="btn-label"> Activar avisos</span>
            </button>
          )}
          <button className="btn-icon-square" onClick={onEditName} title="¿Quién usa este móvil?">
            {userName ? <span className="user-chip">{userName.slice(0, 1).toUpperCase()}</span> : <Heart size={17} />}
          </button>
          <button className="btn-icon-square" onClick={onExport} title="Exportar CSV">
            <Download size={17} /><span className="btn-label"> CSV</span>
          </button>
        </div>
      </div>
    </header>
  );
}
