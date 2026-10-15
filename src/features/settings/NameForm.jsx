import { useState } from "react";
import Sheet, { Field } from "../../components/ui/Sheet.jsx";

// "¿Quién usa este móvil?": el nombre aparece en las notificaciones de la pareja
export default function NameForm({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial || "");

  return (
    <Sheet
      title="¿Quién usa este móvil?"
      subtitle={`Tu nombre aparecerá en las notificaciones: "M&J · ${name.trim() || "Tu nombre"}".`}
      onClose={onClose}
      onSubmit={() => onSave(name)}
    >
      <Field label="Tu nombre">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Meli" maxLength={24} autoFocus />
      </Field>
    </Sheet>
  );
}
