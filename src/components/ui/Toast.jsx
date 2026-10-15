import { useEffect } from "react";
import { Check, AlertTriangle } from "lucide-react";

// onClose debe ser estable (useCallback): si no, el temporizador se reinicia en cada render
export default function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast toast-${type}`} role="status" onClick={onClose}>
      {type === "success" ? <Check size={16} /> : <AlertTriangle size={16} />}
      <span>{message}</span>
    </div>
  );
}
