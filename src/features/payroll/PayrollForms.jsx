import { useState } from "react";
import { Wallet } from "lucide-react";
import Sheet, { Field, AmountInput } from "../../components/ui/Sheet.jsx";
import { IconPicker, ColorPicker } from "../../components/ui/Pickers.jsx";
import { SRC_ICONS, PRESET_COLORS } from "../../lib/constants.js";

const amountText = (n) => (n ? String(n).replace(".", ",") : "");

export function SourceForm({ source, actions, onClose }) {
  const [name, setName] = useState(source?.name || "");
  const [amount, setAmount] = useState(amountText(source?.amount));
  const [icon, setIcon] = useState(source?.icon || "banknote");
  const [color, setColor] = useState(source?.color || PRESET_COLORS[0]);

  const submit = () => actions.saveSource({ id: source?.id, name, amount, icon, color }) && onClose();

  return (
    <Sheet title={source ? "Editar fuente de nómina" : "Nueva fuente de nómina"} onClose={onClose} onSubmit={submit}>
      <div className="form-grid">
        <Field label="Nombre">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Nómina Meli" />
        </Field>
        <Field label="Importe de referencia (€)">
          <AmountInput value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Color" wide><ColorPicker value={color} onChange={setColor} /></Field>
        <Field label="Icono" wide><IconPicker icons={SRC_ICONS} value={icon} onChange={setIcon} /></Field>
      </div>
    </Sheet>
  );
}

export function DepositForm({ source, actions, onClose }) {
  const [amount, setAmount] = useState(amountText(source.amount));
  const submit = () => actions.depositPayroll(source, amount) && onClose();

  return (
    <Sheet
      title={`Ingresar nómina: ${source.name}`}
      subtitle="Introduce la cantidad exacta cobrada en este ciclo."
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Añadir al Fondo General"
    >
      <Field label="Importe cobrado (€)">
        <AmountInput value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
      </Field>
    </Sheet>
  );
}

export function BulkPayrollForm({ sources, actions, onClose }) {
  const [amounts, setAmounts] = useState(() => Object.fromEntries(sources.map((s) => [s.id, amountText(s.amount)])));
  const submit = () => actions.bulkPayroll(amounts) && onClose();

  return (
    <Sheet
      title="Registrar nóminas"
      subtitle="Revisa el importe de cada nómina. Deja en blanco la que no quieras añadir ahora."
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Confirmar ingresos"
    >
      <div className="bulk-list">
        {sources.map((s) => {
          const Icon = SRC_ICONS[s.icon] || Wallet;
          return (
            <label key={s.id} className="bulk-row">
              <div className="card-icon" style={{ background: s.color }}><Icon size={16} /></div>
              <span className="bulk-name">{s.name}</span>
              <AmountInput
                value={amounts[s.id] ?? ""}
                onChange={(e) => setAmounts((prev) => ({ ...prev, [s.id]: e.target.value }))}
                style={{ maxWidth: 130 }}
              />
            </label>
          );
        })}
      </div>
    </Sheet>
  );
}
