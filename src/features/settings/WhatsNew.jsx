import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import Sheet from "../../components/ui/Sheet.jsx";
import { CHANGELOG, LATEST } from "../../lib/changelog.js";

// Ventana de novedades tras una actualización
export default function WhatsNew({ onClose }) {
  const [expanded, setExpanded] = useState(false);
  const older = CHANGELOG.slice(1);

  return (
    <Sheet title="✨ Novedades" subtitle={LATEST.title} onClose={onClose}>
      <ul className="news-list">
        {LATEST.highlights.map((text) => <li key={text}>{text}</li>)}
      </ul>

      {expanded && (
        <>
          <div className="news-heading">Más detalles</div>
          <ul className="news-list news-details">
            {LATEST.details.map((text) => <li key={text}>{text}</li>)}
          </ul>
          {older.map((entry) => (
            <div key={entry.version}>
              <div className="news-heading">{entry.title}</div>
              <ul className="news-list news-details">
                {[...entry.highlights, ...entry.details].map((text) => <li key={text}>{text}</li>)}
              </ul>
            </div>
          ))}
        </>
      )}

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {expanded ? "Mostrar menos" : "Mostrar más"}
        </button>
        <button type="button" className="btn-primary" onClick={onClose}>Entendido</button>
      </div>
    </Sheet>
  );
}
