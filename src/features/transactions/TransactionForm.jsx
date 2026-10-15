import { useState } from "react";
import Sheet, { Field, AmountInput } from "../../components/ui/Sheet.jsx";
import { todayISO } from "../../lib/format.js";

// Alta o edición de un movimiento. preset = { type, categoryId } para abrirlo ya rellenado.
export default function TransactionForm({ tx, preset = {}, categories, actions, onClose }) {
  const [type, setType] = useState(tx?.type || preset.type || "expense");
  const [categoryId, setCategoryId] = useState(tx?.categoryId || preset.categoryId || "");
  const [concept, setConcept] = useState(tx?.concept || "");
  const [amount, setAmount] = useState(tx ? String(tx.amount).replace(".", ",") : "");
  const [date, setDate] = useState(tx?.date || todayISO());

  const submit = () => actions.saveTransaction({ id: tx?.id, concept, categoryId, type, amount, date }) && onClose();

  // Los tipos especiales (traspasos, ajustes, nóminas) se editan conservando su tipo
  const isSpecial = tx && !["income", "expense"].includes(tx.type);

  return (
    <Sheet title={tx ? "Editar movimiento" : type === "income" ? "Meter dinero en un sobre" : "Apuntar gasto"} onClose={onClose} onSubmit={submit}>
      {!isSpecial && (
        <div className="segmented">
          <button type="button" className={type === "expense" ? "active expense" : ""} onClick={() => setType("expense")}>💸 Gasto</button>
          <button type="button" className={type === "income" ? "active income" : ""} onClick={() => setType("income")}>📥 Asignar al sobre</button>
        </div>
      )}
      <div className="form-grid">
        <Field label="Importe (€)">
          <AmountInput value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus={!tx} className="amount-big" />
        </Field>
        <Field label="Sobre">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Selecciona…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name} {c.hasPin ? "🔒" : ""}</option>)}
          </select>
        </Field>
        <Field label="Concepto">
          <input type="text" value={concept} onChange={(e) => setConcept(e.target.value)} placeholder={type === "income" ? "Ej. Reparto del mes" : "Ej. Mercadona"} />
        </Field>
        <Field label="Fecha">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}
