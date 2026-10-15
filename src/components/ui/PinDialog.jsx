import { useState } from "react";
import { Lock } from "lucide-react";

// Pide el PIN de un sobre. onDone(pin) con el PIN escrito, o onDone(null) si se cancela.
export default function PinDialog({ title, onDone }) {
  const [pin, setPin] = useState("");

  return (
    <div className="modal-overlay pin-overlay" onClick={() => onDone(null)}>
      <form
        className="pin-dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); onDone(pin); }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="pin-icon"><Lock size={22} /></div>
        <div className="pin-title">{title}</div>
        <input
          className="pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoFocus
          aria-label="PIN"
        />
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={!pin}>Aceptar</button>
          <button type="button" className="btn-secondary" onClick={() => onDone(null)}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
