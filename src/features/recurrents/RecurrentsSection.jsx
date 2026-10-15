import { useState } from "react";
import { Calendar, RefreshCw, Plus, X } from "lucide-react";
import Sheet, { Field, AmountInput } from "../../components/ui/Sheet.jsx";
import { money, todayISO } from "../../lib/format.js";

export default function RecurrentsSection({ recurrents, transactions, catById, actions, openSheet }) {
  const month = todayISO().slice(0, 7);

  return (
    <section>
      <div className="section-header">
        <div>
          <div className="section-title"><Calendar size={18} color="var(--yellow)" /> Recurrentes mensuales</div>
          <div className="section-hint">Se aplican solos el día indicado de cada mes.</div>
        </div>
        <div className="section-actions">
          <button className="btn-secondary" onClick={actions.applyRecurrentsNow}><RefreshCw size={15} /> Aplicar ahora</button>
          <button className="btn-primary" onClick={() => openSheet("recurrent")}><Plus size={15} /> Nueva regla</button>
        </div>
      </div>

      {recurrents.length > 0 && (
        <div className="grid-3" style={{ marginBottom: 32 }}>
          {recurrents.map((r) => {
            const cat = catById.get(r.categoryId);
            const applied = transactions.some((t) => t.recurrentId === r.id && (t.date || "").startsWith(month));
            return (
              <div className="card" key={r.id} style={{ padding: 16 }}>
                <div className="card-top" style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{r.concept}</span>
                  <button className="btn-icon" onClick={() => actions.deleteRecurrent(r.id)} aria-label="Eliminar regla"><X size={14} /></button>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                  Día {r.day} de cada mes • <strong style={{ color: "white" }}>{cat ? cat.name : "Sobre eliminado"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: r.type === "expense" ? "var(--red)" : "var(--green)" }}>
                    {r.type === "expense" ? "-" : "+"}{money(r.amount)}
                  </div>
                  <span className={`status-pill ${applied ? "done" : ""}`}>
                    {applied ? "✓ Aplicado este mes" : r.startMonth && month < r.startMonth ? "Empieza el mes que viene" : `Automático el día ${r.day}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function RecurrentForm({ categories, actions, onClose }) {
  const [concept, setConcept] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("1");

  const submit = () => actions.addRecurrent({ concept, categoryId, type, amount, day }) && onClose();

  return (
    <Sheet title="Nueva regla recurrente" onClose={onClose} onSubmit={submit}>
      <div className="form-grid">
        <Field label="Concepto">
          <input type="text" value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej. Hipoteca, Netflix…" autoFocus />
        </Field>
        <Field label="Sobre">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Selecciona…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name} {c.hasPin ? "🔒" : ""}</option>)}
          </select>
        </Field>
        <Field label="Tipo">
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="expense">Gasto automático (-)</option>
            <option value="income">Asignación automática (+)</option>
          </select>
        </Field>
        <Field label="Importe (€)">
          <AmountInput value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Día del mes (1-31)">
          <input type="text" inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}
