import { AlertTriangle } from "lucide-react";

// Confirmación propia (p. ej. duplicados). onDone(true) si se acepta, onDone(false) si se cancela.
export default function ConfirmDialog({ title, message, confirmLabel = "Aceptar", onDone }) {
  return (
    <div className="modal-overlay pin-overlay" onClick={() => onDone(false)}>
      <div className="pin-dialog" role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="pin-icon confirm-icon"><AlertTriangle size={22} /></div>
        <div className="pin-title">{title}</div>
        <p className="confirm-message">{message}</p>
        <div className="form-actions confirm-actions">
          <button type="button" className="btn-secondary" onClick={() => onDone(false)} autoFocus>Cancelar</button>
          <button type="button" className="btn-primary" onClick={() => onDone(true)}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
