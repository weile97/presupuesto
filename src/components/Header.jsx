import { BellRing, Download } from "lucide-react";

export default function Header({ userName, showBell, onEnableNotifications, onEditName, onExport }) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="brand">
          <img className="brand-logo" src="/favicon.svg" alt="" width="40" height="40" />
          <div>
            <div className="brand-title">M&amp;J</div>
            <div className="brand-sub">{userName ? `Hola, ${userName} 👋` : "Vuestro presupuesto"}</div>
          </div>
        </div>
        <div className="header-actions">
          {showBell && (
            <button className="icon-btn bell-pulse" onClick={onEnableNotifications} aria-label="Activar notificaciones">
              <BellRing size={19} />
            </button>
          )}
          <button className="icon-btn" onClick={onExport} aria-label="Exportar CSV"><Download size={19} /></button>
          <button className="avatar" onClick={onEditName} aria-label="Ajustes">
            {userName ? userName.slice(0, 1).toUpperCase() : "?"}
          </button>
        </div>
      </div>
    </header>
  );
}
