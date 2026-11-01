import { useState } from "react";
import { Wallet } from "lucide-react";
import Sheet, { Field, AmountInput } from "../../components/ui/Sheet.jsx";
import { IconPicker, ColorPicker } from "../../components/ui/Pickers.jsx";
import { SRC_ICONS, PRESET_COLORS } from "../../lib/constants.js";
import { money, parseAmount } from "../../lib/format.js";

const amountText = (n) => (n ? String(n).replace(".", ",") : "");

export function SourceForm({ source, actions, onClose }) {
  const [name, setName] = useState(source?.name || "");
  const [amount, setAmount] = useState(amountText(source?.amount));
  const [icon, setIcon] = useState(source?.icon || "banknote");
  const [color, setColor] = useState(source?.color || PRESET_COLORS[0]);

  const submit = async () => (await actions.saveSource({ id: source?.id, name, amount, icon, color })) && onClose();

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
  const submit = async () => (await actions.depositPayroll(source, amount)) && onClose();

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

// Tras registrar las nóminas, ofrece repartirlas si hay reglas de ingreso pendientes este mes
export function BulkPayrollForm({ sources, actions, onClose, onDistribute }) {
  const [amounts, setAmounts] = useState(() => Object.fromEntries(sources.map((s) => [s.id, amountText(s.amount)])));
  const submit = async () => {
    if (!(await actions.bulkPayroll(amounts))) return;
    if (actions.pendingAllocations().length > 0) onDistribute();
    else onClose();
  };

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

// Reparto del Fondo General entre sobres, a partir de las reglas de ingreso que faltan este mes
export function DistributeForm({ rules, categoriesById, available, actions, onClose }) {
  const [amounts, setAmounts] = useState(() => Object.fromEntries(rules.map((r) => [r.id, amountText(r.amount)])));
  const total = rules.reduce((sum, r) => sum + (parseAmount(amounts[r.id]) || 0), 0);
  const submit = () => actions.distribute(amounts) && onClose();

  return (
    <Sheet
      title="Repartir la nómina"
      subtitle="Revisa cuánto va a cada sobre. Deja en blanco lo que no quieras repartir ahora."
      onClose={onClose}
      onSubmit={submit}
      submitLabel={`Repartir ${money(total)}`}
    >
      <div className="bulk-list">
        {rules.map((r) => (
          <label key={r.id} className="bulk-row">
            <span className="bulk-name">
              {r.concept}
              <span className="adjust-hint distribute-cat">{categoriesById.get(r.categoryId)?.name || "Sobre eliminado"}</span>
            </span>
            <AmountInput
              value={amounts[r.id] ?? ""}
              onChange={(e) => setAmounts((prev) => ({ ...prev, [r.id]: e.target.value }))}
              style={{ maxWidth: 120 }}
            />
          </label>
        ))}
      </div>
      <p className={`distribute-left ${total > available ? "over" : ""}`}>
        Quedarán {money(available - total)} en el Fondo General
      </p>
    </Sheet>
  );
}
