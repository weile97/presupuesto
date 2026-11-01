import { useState } from "react";
import { login } from "../lib/api.js";

// Pantalla de acceso: el PIN se pide una vez en cada dispositivo. Los cambios sin enviar se conservan.
export default function PinGate() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(pin);
      window.location.reload();
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "Sin conexión. Inténtalo de nuevo." : err.message);
      setPin("");
      setBusy(false);
    }
  }

  return (
    <div className="pin-gate">
      <form className="pin-dialog" onSubmit={submit}>
        <img className="pin-gate-logo" src="/favicon.svg" alt="" width="64" height="64" />
        <div className="pin-title">Introduce el PIN de M&amp;J</div>
        <input
          className="pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          aria-label="PIN de acceso"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoFocus
        />
        {error && <div className="pin-error" role="alert">{error}</div>}
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={!pin || busy}>{busy ? "Comprobando…" : "Entrar"}</button>
        </div>
      </form>
    </div>
  );
}
