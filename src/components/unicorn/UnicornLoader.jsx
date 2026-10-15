import Unicorn from "./Unicorn.jsx";
import "./unicorn.css";

// Pantalla de carga: el unicornio despliega las alas y luego aletea mientras cargan los datos
export default function UnicornLoader({ text = "Cargando vuestro presupuesto…" }) {
  return (
    <div className="unicorn-loader" role="status" aria-live="polite">
      <Unicorn size={180} variant="loader" />
      <div className="unicorn-loader-title">M&amp;J</div>
      <div className="unicorn-loader-text">{text}</div>
    </div>
  );
}
