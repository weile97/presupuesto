import { useEffect, useState } from "react";
import { Home, Layers, Plus, ListOrdered, Settings } from "lucide-react";

const TABS = [
  { id: "inicio", label: "Inicio", Icon: Home },
  { id: "sobres", label: "Sobres", Icon: Layers },
  null, // hueco del botón central "+"
  { id: "movimientos", label: "Movimientos", Icon: ListOrdered },
  { id: "ajustes", label: "Ajustes", Icon: Settings }
];

// Barra inferior para el móvil: salta a cada sección y botón central para apuntar un gasto
export default function BottomNav({ onAdd, onSettings, hidden }) {
  const [active, setActive] = useState("inicio");

  // Marca la sección que está a la vista
  useEffect(() => {
    const ids = ["inicio", "sobres", "movimientos"];
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); }),
      { rootMargin: "-35% 0px -60% 0px" }
    );
    ids.forEach((id) => { const el = document.getElementById(id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const go = (id) => {
    if (id === "ajustes") return onSettings();
    navigator.vibrate?.(8);
    if (id === "inicio") window.scrollTo({ top: 0, behavior: "smooth" });
    else document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav className={`bottom-nav ${hidden ? "is-hidden" : ""}`} aria-label="Navegación">
      {TABS.map((tab, i) =>
        tab ? (
          <button key={tab.id} className={`nav-item ${active === tab.id ? "active" : ""}`} onClick={() => go(tab.id)}>
            <tab.Icon size={21} />
            <span>{tab.label}</span>
          </button>
        ) : (
          <button key={i} className="nav-add" onClick={onAdd} aria-label="Apuntar gasto">
            <Plus size={28} />
          </button>
        )
      )}
    </nav>
  );
}
