import { useEffect, useRef, useState } from "react";
import Unicorn from "./Unicorn.jsx";
import { playHalloweenMusic } from "../../lib/halloweenMusic.js";
import "./halloween.css";


const Bat = ({ className }) => (
  <svg className={`hw-bat ${className}`} viewBox="0 0 64 32" aria-hidden="true">
    <path d="M32 12 C 29 6, 22 2, 12 4 C 16 7, 15 10, 10 12 C 15 13, 18 16, 18 21 C 22 17, 27 17, 29 20 L 32 24 L 35 20 C 37 17, 42 17, 46 21 C 46 16, 49 13, 54 12 C 49 10, 48 7, 52 4 C 42 2, 35 6, 32 12 Z" fill="#120A1F" />
    <circle cx="29.5" cy="13" r="1.1" fill="#FB923C" />
    <circle cx="34.5" cy="13" r="1.1" fill="#FB923C" />
  </svg>
);

const Pumpkin = ({ className }) => (
  <svg className={`hw-pumpkin ${className}`} viewBox="0 0 80 70" aria-hidden="true">
    <path d="M38 10 C 38 4, 42 1, 46 2 C 43 5, 42 8, 43 12 Z" fill="#4D7C0F" />
    <ellipse cx="22" cy="40" rx="16" ry="25" fill="#EA580C" />
    <ellipse cx="58" cy="40" rx="16" ry="25" fill="#EA580C" />
    <ellipse cx="40" cy="40" rx="18" ry="27" fill="#F97316" />
    <path d="M24 34 l8 -7 4 9z M56 34 l-8 -7 -4 9z" fill="#FEF08A" className="hw-glow" />
    <path d="M24 46 C 30 58, 50 58, 56 46 L 50 49 L 46 45 L 40 50 L 34 45 L 30 49 Z" fill="#FEF08A" className="hw-glow" />
  </svg>
);

// Pantalla de carga de Halloween: luna, murciélagos, calabazas y el unicornio con sombrero de bruja
export default function HalloweenLoader({ text, onSkip }) {
  // Música: intenta sonar sola; si el navegador la bloquea, el primer toque la activa (en vez de saltar)
  const musicRef = useRef(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    let cancelled = false;
    playHalloweenMusic().then((m) => {
      if (cancelled) return m?.stop();
      musicRef.current = m;
      if (!m) setBlocked(true);
    });
    return () => { cancelled = true; musicRef.current?.stop(); };
  }, []);

  const handleTap = async () => {
    if (blocked) {
      setBlocked(false);
      musicRef.current = await playHalloweenMusic();
      return;
    }
    onSkip?.();
  };

  return (
    <div className="halloween-loader" role="status" aria-live="polite" onClick={handleTap}>
      <div className="hw-stars" />
      <div className="hw-moon" />
      <Bat className="b1" />
      <Bat className="b2" />
      <Bat className="b3" />
      <div className="hw-fog" />

      <div className="hw-center">
        <div className="unicorn-loader hw-unicorn-wrap">
          <Unicorn size={190} variant="loader" witchHat />
        </div>
        <div className="hw-title">¡Feliz Halloween!</div>
        <div className="hw-sub">🎃 M&amp;J · {text}</div>
        <div className="hw-progress"><div /></div>
        {blocked ? <div className="hw-skip hw-sound">🔊 Toca para la música</div> : onSkip && <div className="hw-skip">Toca para entrar</div>}
      </div>

      <div className="hw-ground">
        <Pumpkin className="pk1" />
        <Pumpkin className="pk2" />
        <Pumpkin className="pk3" />
      </div>
    </div>
  );
}
