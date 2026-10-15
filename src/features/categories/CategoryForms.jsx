import { useState } from "react";
import Sheet, { Field, AmountInput } from "../../components/ui/Sheet.jsx";
import { IconPicker, ColorPicker } from "../../components/ui/Pickers.jsx";
import { CAT_ICONS, CAT_ICON_ORDER, PRESET_COLORS } from "../../lib/constants.js";

export function CategoryForm({ category, actions, onClose }) {
  const [name, setName] = useState(category?.name || "");
  const [icon, setIcon] = useState(category?.icon || "wallet");
  const [color, setColor] = useState(category?.color || PRESET_COLORS[0]);
  const [goal, setGoal] = useState(category?.targetGoal ? String(category.targetGoal).replace(".", ",") : "");
  const [hasPin, setHasPin] = useState(!!category?.hasPin);
  const [pin, setPin] = useState("");
  const [adjust, setAdjust] = useState("");

  const submit = async () => (await actions.saveCategory({ id: category?.id, name, icon, color, hasPin, pin, goal })) && onClose();

  return (
    <Sheet title={category ? `Editar sobre: ${category.name}` : "Crear sobre"} onClose={onClose} onSubmit={submit}>
      <div className="form-grid">
        <Field label="Nombre">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Alimentación" autoFocus={!category} />
        </Field>
        <Field label="Meta / presupuesto (€)">
          <AmountInput value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ej. 300" />
        </Field>
        <Field label="Color" wide><ColorPicker value={color} onChange={setColor} /></Field>
        <Field label="Icono" wide><IconPicker icons={CAT_ICONS} order={CAT_ICON_ORDER} value={icon} onChange={setIcon} /></Field>
      </div>

      <label className="check-row">
        <input type="checkbox" checked={hasPin} onChange={(e) => setHasPin(e.target.checked)} />
        <span>🔒 Proteger con PIN (oculta importes y movimientos)</span>
      </label>
      {hasPin && (
        <Field label="PIN" style={{ maxWidth: 220 }}>
          <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="new-password" placeholder={category?.hasPin ? "Vacío = mantener el PIN actual" : "Nuevo PIN"} />
        </Field>
      )}

      {category && (
        <div className="adjust-box">
          <label>Ajustar saldo del sobre (no afecta al Fondo General)</label>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <AmountInput value={adjust} onChange={(e) => setAdjust(e.target.value)} placeholder="Ej. 50 o -20" inputMode="text" />
            <button type="button" className="btn-secondary" onClick={async () => (await actions.adjustCategory(category.id, adjust)) && setAdjust("")}>
              Aplicar
            </button>
          </div>
          <div className="adjust-hint">Positivo para sumar, negativo (Ej. -20) para restar.</div>
        </div>
      )}
    </Sheet>
  );
}

export function TransferForm({ categories, from: initialFrom = "", actions, onClose }) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const options = categories.map((c) => <option key={c.id} value={c.id}>{c.name} {c.hasPin ? "🔒" : ""}</option>);

  const submit = async () => (await actions.transfer({ from, to, amount })) && onClose();

  return (
    <Sheet title="Traspaso entre sobres" onClose={onClose} onSubmit={submit} submitLabel="Confirmar traspaso">
      <div className="form-grid">
        <Field label="Desde (origen)">
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">Selecciona origen…</option>{options}
          </select>
        </Field>
        <Field label="Hacia (destino)">
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Selecciona destino…</option>{options}
          </select>
        </Field>
        <Field label="Importe (€)">
          <AmountInput value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}
