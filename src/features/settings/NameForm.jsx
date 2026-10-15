import { useState } from "react";
import Sheet, { Field } from "../../components/ui/Sheet.jsx";
import { sendTestPush } from "../../lib/push.js";

// "¿Quién usa este móvil?": el nombre aparece en las notificaciones de la pareja
export default function NameForm({ initial, onSave, onClose, notify, onOpenBackups }) {
  const [name, setName] = useState(initial || "");
  const [testing, setTesting] = useState(false);

  async function test() {
    setTesting(true);
    try {
      await sendTestPush();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setTesting(false);
    }
  }

  return (
    <Sheet
      title="Ajustes de este móvil"
      subtitle={`Tu nombre aparecerá en las notificaciones: "M&J · ${name.trim() || "Tu nombre"}".`}
      onClose={onClose}
      onSubmit={() => onSave(name)}
    >
      <Field label="Tu nombre">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Meli" maxLength={24} autoFocus />
      </Field>
      <div className="adjust-box" style={{ marginTop: 14 }}>
        <label>Probar notificaciones</label>
        <div className="adjust-hint" style={{ marginBottom: 8 }}>
          Pulsa, bloquea el móvil y espera 10 segundos. Si no llega, revisa los ajustes de batería del navegador.
        </div>
        <button type="button" className="btn-secondary" disabled={testing} onClick={test}>
          🔔 {testing ? "Enviando en 10 s… bloquea el móvil" : "Enviar aviso de prueba"}
        </button>
      </div>
      <button type="button" className="btn-secondary" style={{ width: "100%", marginTop: 12 }} onClick={onOpenBackups}>
        🛟 Copias de seguridad
      </button>
    </Sheet>
  );
}
