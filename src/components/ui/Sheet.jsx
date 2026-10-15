import { X, Check } from "lucide-react";

// Formulario en hoja inferior (móvil) o ventana centrada (escritorio).
// Enviar con el botón principal o con "Intro" en el teclado del móvil.
export default function Sheet({ title, subtitle, onClose, onSubmit, submitLabel = "Guardar", children }) {
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <form
        className="form-box"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }}
      >
        <div className="sheet-head">
          <h3>{title}</h3>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>
        {subtitle && <p className="sheet-sub">{subtitle}</p>}
        {children}
        {onSubmit && (
          <div className="form-actions">
            <button type="submit" className="btn-primary"><Check size={15} /> {submitLabel}</button>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          </div>
        )}
      </form>
    </>
  );
}

// Campo con etiqueta
export function Field({ label, wide, children, style }) {
  return (
    <div className="field" style={{ ...(wide ? { gridColumn: "1 / -1" } : null), ...style }}>
      <label>{label}</label>
      {children}
    </div>
  );
}

// Input de importe con teclado numérico (acepta coma)
export function AmountInput(props) {
  return <input type="text" inputMode="decimal" autoComplete="off" placeholder="0,00" {...props} />;
}
