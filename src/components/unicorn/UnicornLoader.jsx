import Unicorn from "./Unicorn.jsx";
import HalloweenLoader from "./HalloweenLoader.jsx";
import ChristmasLoader from "./ChristmasLoader.jsx";
import "./unicorn.css";

// Pantalla de carga: el unicornio despliega las alas y luego aletea mientras cargan los datos
export default function UnicornLoader({ text = "Cargando vuestro presupuesto…", season = null, onSkip }) {
  if (season === "halloween") return <HalloweenLoader text={text} onSkip={onSkip} />;
  if (season === "christmas") return <ChristmasLoader text={text} onSkip={onSkip} />;
  return (
    <div className="unicorn-loader" role="status" aria-live="polite">
      <Unicorn size={180} variant="loader" />
      <div className="unicorn-loader-title">M&amp;J</div>
      <div className="unicorn-loader-text">{text}</div>
    </div>
  );
}
