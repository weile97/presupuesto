import { useEffect } from "react";
import { Check, AlertTriangle, Undo2 } from "lucide-react";

// onClose debe ser estable (useCallback): si no, el temporizador se reinicia en cada render.
// action = { label, onClick } muestra un botón (p. ej. "Deshacer") y alarga el aviso.
export default function Toast({ message, type, action, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, action ? 7000 : 3500);
    return () => clearTimeout(timer);
  }, [onClose, action]);

  return (
    <div className={`toast toast-${type}`} role="status">
      {type === "success" ? <Check size={16} /> : <AlertTriangle size={16} />}
      <span style={{ flex: 1 }} onClick={onClose}>{message}</span>
      {action && (
        <button className="toast-action" onClick={() => { action.onClick(); onClose(); }}>
          <Undo2 size={14} /> {action.label}
        </button>
      )}
    </div>
  );
}
