import Unicorn from "./Unicorn.jsx";
import { useLoaderMusic } from "../../hooks/useLoaderMusic.js";
import { playChristmasMusic } from "../../lib/christmasMusic.js";
import "./christmas.css";

// Copos con posición, tamaño y velocidad fijos (calcularlos al azar los recolocaría en cada render)
const FLAKES = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  size: 3 + (i * 7) % 6,
  duration: 5 + (i * 3) % 6,
  delay: -((i * 11) % 9)
}));
const LIGHT_COLORS = ["#F87171", "#FDE68A", "#34D399", "#60A5FA"];

const Tree = ({ className }) => (
  <svg className={`xm-tree ${className}`} viewBox="0 0 80 110" aria-hidden="true">
    <rect x="35" y="90" width="10" height="18" rx="2" fill="#5B3A1E" />
    <path d="M40 4 L66 42 H52 L72 68 H56 L78 94 H2 L24 68 H8 L28 42 H14 Z" fill="#14532D" />
    <path d="M40 4 L52 22 C 44 28, 36 28, 28 22 Z" fill="#F8FAFC" opacity="0.8" />
    <circle cx="30" cy="48" r="3" fill="#F87171" className="xm-glow" />
    <circle cx="50" cy="60" r="3" fill="#FDE68A" className="xm-glow" />
    <circle cx="26" cy="78" r="3" fill="#60A5FA" className="xm-glow" />
    <circle cx="54" cy="82" r="3" fill="#F87171" className="xm-glow" />
    <path d="M40 0 l2.5 6 6 .6 -4.6 4 1.4 6 -5.3 -3.2 -5.3 3.2 1.4 -6 -4.6 -4 6 -.6z" fill="#FDE68A" />
  </svg>
);

const Gift = ({ className, box, ribbon }) => (
  <svg className={`xm-gift ${className}`} viewBox="0 0 48 48" aria-hidden="true">
    <rect x="4" y="16" width="40" height="30" rx="3" fill={box} />
    <rect x="20" y="16" width="8" height="30" fill={ribbon} />
    <rect x="2" y="12" width="44" height="9" rx="2" fill={box} />
    <rect x="20" y="12" width="8" height="9" fill={ribbon} />
    <path d="M24 12 C 16 2, 8 6, 14 12 Z M24 12 C 32 2, 40 6, 34 12 Z" fill={ribbon} />
  </svg>
);

// Pantalla de carga de Navidad: nieve, luces, árboles, regalos y el unicornio con gorro de Papá Noel
export default function ChristmasLoader({ text, onSkip }) {
  const { blocked, handleTap } = useLoaderMusic(playChristmasMusic, onSkip);

  return (
    <div className="christmas-loader" role="status" aria-live="polite" onClick={handleTap}>
      <div className="xm-lights" aria-hidden="true">
        {Array.from({ length: 13 }, (_, i) => (
          <span key={i} style={{ background: LIGHT_COLORS[i % 4], color: LIGHT_COLORS[i % 4], animationDelay: `${(i % 4) * 0.35}s` }} />
        ))}
      </div>

      <div className="xm-center">
        <div className="unicorn-loader xm-unicorn-wrap">
          <Unicorn size={190} variant="loader" santaHat />
        </div>
        <div className="xm-title">¡Feliz Navidad!</div>
        <div className="xm-sub">🎄 M&amp;J · {text}</div>
        <div className="xm-progress"><div /></div>
        {blocked ? <div className="xm-skip xm-sound">🔊 Toca para la música</div> : onSkip && <div className="xm-skip">Toca para entrar</div>}
      </div>

      <div className="xm-ground" aria-hidden="true">
        <Tree className="t1" />
        <Tree className="t2" />
        <Gift className="g1" box="#DC2626" ribbon="#FDE68A" />
        <Gift className="g2" box="#15803D" ribbon="#F8FAFC" />
      </div>

      <div className="xm-snow" aria-hidden="true">
        {FLAKES.map((f, i) => (
          <span key={i} style={{ left: `${f.left}%`, width: f.size, height: f.size, animationDuration: `${f.duration}s`, animationDelay: `${f.delay}s` }} />
        ))}
      </div>
    </div>
  );
}
