import { useEffect } from "react";
import Unicorn from "./Unicorn.jsx";
import "./unicorn.css";

const DURATION_MS = 1900;

// Celebración breve al guardar un sobre: el unicornio aparece aleteando entre destellos.
// No bloquea la pantalla (pointer-events: none) y se cierra solo.
export default function UnicornCelebration({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, DURATION_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="unicorn-celebration" aria-live="polite">
      <div className="unicorn-celebration-burst">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} style={{ "--i": i }}>✦</span>
        ))}
      </div>
      <Unicorn size={150} variant="fly" />
      <div className="unicorn-celebration-text">{message}</div>
    </div>
  );
}
