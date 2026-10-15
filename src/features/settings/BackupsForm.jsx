import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import Sheet from "../../components/ui/Sheet.jsx";
import { DEVICE_ID } from "../../lib/device.js";

const fmt = (ts) => (ts ? new Date(ts).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

// Lista de copias de seguridad y restauración (la versión actual también queda guardada como copia)
export default function BackupsForm({ userName, notify, onRestored, onClose }) {
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    fetch("/api/backups", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setList)
      .catch(() => { setList([]); notify("No se pudieron cargar las copias.", "error"); });
  }, [notify]);

  async function restore(b) {
    if (!window.confirm(`¿Volver a la versión del ${fmt(b.at)}? La versión actual quedará guardada como copia.`)) return;
    setBusy(b.index);
    try {
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index: b.index, deviceId: DEVICE_ID, name: userName || null })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      notify("Copia restaurada.");
      onRestored();
      onClose();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet title="Copias de seguridad" subtitle="Se guarda una copia antes de cada cambio (las 50 últimas)." onClose={onClose}>
      {list === null ? (
        <div className="empty-text">Cargando…</div>
      ) : list.length === 0 ? (
        <div className="empty-text">Aún no hay copias.</div>
      ) : (
        <div className="bulk-list">
          {list.map((b) => (
            <div key={b.index} className="bulk-row">
              <div className="bulk-name">
                {fmt(b.at)}{b.by ? ` · ${b.by}` : ""}
                <div className="adjust-hint" style={{ marginTop: 2 }}>{b.categories} sobres · {b.transactions} movimientos</div>
              </div>
              <button type="button" className="btn-secondary" disabled={busy !== null} onClick={() => restore(b)}>
                <RotateCcw size={14} /> {busy === b.index ? "…" : "Restaurar"}
              </button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
