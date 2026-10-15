import { useId } from "react";

// Unicornio en SVG. Las alas se animan con CSS (ver unicorn.css): parten plegadas y se despliegan
// girando sobre el hombro. `variant` elige la animación: "loader" (despliega y aletea) o "fly" (celebración).
const WING = "M98 104 C 84 74, 62 52, 30 44 C 42 56, 38 63, 26 67 C 41 73, 39 81, 30 88 C 48 92, 64 98, 98 113 Z";
const FEATHERS = "M90 100 C 74 80, 58 66, 40 58 M88 106 C 70 92, 54 82, 38 76";

export default function Unicorn({ size = 160, variant = "loader" }) {
  const id = useId().replace(/:/g, "");
  const g = (name) => `${name}-${id}`;

  return (
    <svg className={`unicorn uni-${variant}`} width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="Unicornio">
      <defs>
        <linearGradient id={g("wing")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FDF2F8" />
          <stop offset="0.55" stopColor="#F9A8D4" />
          <stop offset="1" stopColor="#C084FC" />
        </linearGradient>
        <linearGradient id={g("wingBack")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E9D5FF" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
        <linearGradient id={g("horn")} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#F59E0B" />
          <stop offset="1" stopColor="#FDE68A" />
        </linearGradient>
        <linearGradient id={g("body")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F3E8FF" />
        </linearGradient>
      </defs>

      {/* Destellos alrededor */}
      <g className="uni-sparkles" fill="#FDE68A">
        <path d="M30 30 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" />
        <path d="M172 40 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" />
        <path d="M176 140 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" />
        <path d="M22 150 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" />
      </g>

      <g className="uni-body">
        {/* Ala trasera (detrás del cuerpo) */}
        <g className="uni-wing uni-wing-back">
          <path d={WING} fill={`url(#${g("wingBack")})`} transform="translate(-6 -4)" />
        </g>

        {/* Cola */}
        <g className="uni-tail">
          <circle cx="50" cy="112" r="8" fill="#F472B6" />
          <circle cx="42" cy="121" r="8" fill="#A855F7" />
          <circle cx="38" cy="133" r="7" fill="#60A5FA" />
          <circle cx="40" cy="145" r="6" fill="#F472B6" />
        </g>

        {/* Patas */}
        <g fill={`url(#${g("body")})`} stroke="#E9D5FF" strokeWidth="1.5">
          <rect x="64" y="132" width="11" height="40" rx="5" />
          <rect x="79" y="134" width="11" height="38" rx="5" />
          <rect x="110" y="134" width="11" height="38" rx="5" />
          <rect x="125" y="132" width="11" height="40" rx="5" />
        </g>
        <g fill="#C084FC">
          <rect x="64" y="166" width="11" height="7" rx="3" />
          <rect x="79" y="166" width="11" height="7" rx="3" />
          <rect x="110" y="166" width="11" height="7" rx="3" />
          <rect x="125" y="166" width="11" height="7" rx="3" />
        </g>

        {/* Cuerpo y cuello */}
        <ellipse cx="96" cy="120" rx="46" ry="27" fill={`url(#${g("body")})`} stroke="#E9D5FF" strokeWidth="1.5" />
        <path d="M118 112 C 122 92, 128 78, 136 66 L 156 76 C 148 90, 142 104, 138 122 Z" fill={`url(#${g("body")})`} />

        {/* Cabeza */}
        <ellipse cx="148" cy="66" rx="18" ry="15" fill="#FFFFFF" stroke="#E9D5FF" strokeWidth="1.5" />
        <ellipse cx="162" cy="77" rx="12" ry="9" fill="#FCE7F3" stroke="#F9A8D4" strokeWidth="1.2" />
        <circle cx="167" cy="78" r="1.3" fill="#DB2777" />
        <path d="M139 54 L142 40 L148 53 Z" fill="#FFFFFF" stroke="#E9D5FF" strokeWidth="1.2" />

        {/* Cuerno */}
        <path className="uni-horn" d="M149 52 L161 24 L157 55 Z" fill={`url(#${g("horn")})`} />
        <path d="M151 47 L158 45 M153 40 L159 38 M155 33 L160 31" stroke="#F59E0B" strokeWidth="1.2" strokeLinecap="round" />

        {/* Ojo y mejilla */}
        <g className="uni-eye">
          <circle cx="152" cy="64" r="2.8" fill="#1E1B4B" />
          <circle cx="153" cy="63" r="0.9" fill="#FFFFFF" />
        </g>
        <path d="M149 60 l-2 -2 M151 59.5 l-1 -2.5" stroke="#1E1B4B" strokeWidth="1" strokeLinecap="round" />
        <ellipse cx="157" cy="71" rx="3.5" ry="2" fill="#F472B6" opacity="0.55" />

        {/* Crin */}
        <g className="uni-mane">
          <circle cx="138" cy="52" r="8" fill="#F472B6" />
          <circle cx="132" cy="62" r="8" fill="#A855F7" />
          <circle cx="127" cy="74" r="8" fill="#60A5FA" />
          <circle cx="123" cy="87" r="7" fill="#F472B6" />
          <circle cx="120" cy="99" r="6" fill="#A855F7" />
        </g>

        {/* Ala delantera */}
        <g className="uni-wing uni-wing-front">
          <path d={WING} fill={`url(#${g("wing")})`} stroke="#F9A8D4" strokeWidth="1.2" />
          <path d={FEATHERS} stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.8" />
        </g>
      </g>
    </svg>
  );
}
