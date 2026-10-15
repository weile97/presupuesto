import { memo } from "react";
import { Edit2, Trash2, Wallet, Banknote } from "lucide-react";
import { CAT_ICONS } from "../../lib/constants.js";
import { money, fmtDay } from "../../lib/format.js";
import { isExpenseType } from "../../shared.js";

const isAdjustment = (type) => type === "adjustment_income" || type === "adjustment_expense";

// Una fila del historial. `compact` = versión de la ventana de un sobre (sin icono ni nombre del sobre).
function TransactionItem({ tx: t, category: cat, compact, onEdit, onDelete }) {
  const negative = isExpenseType(t.type) || (t.type === "carryover" && t.amount < 0);
  const tags = (
    <>
      {t.recurrentId && <span className="recurrent-tag">Recurrente</span>}
      {isAdjustment(t.type) && <span className="adjust-tag">Ajuste</span>}
    </>
  );
  const amount = <div className={`tx-amount ${negative ? "expense" : "income"}`}>{negative ? "-" : "+"}{money(Math.abs(t.amount))}</div>;
  const buttons = (
    <>
      <button className="btn-icon" onClick={onEdit} aria-label="Editar movimiento"><Edit2 size={15} /></button>
      <button className="btn-icon" onClick={onDelete} aria-label="Eliminar movimiento"><Trash2 size={15} style={{ color: "var(--red)" }} /></button>
    </>
  );

  if (compact) {
    return (
      <div className="modal-tx-item">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{t.concept}{tags}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{fmtDay(t.date)}</div>
        </div>
        <div className="tx-right">{amount}{buttons}</div>
      </div>
    );
  }

  const Icon = cat ? CAT_ICONS[cat.icon] || Wallet : t.type === "payroll_income" ? Banknote : Wallet;
  const badgeColor = cat?.color || (t.type === "payroll_income" ? "#059669" : "#1E293B");
  return (
    <div className="tx-item">
      <div className="tx-left">
        <div className="tx-badge" style={{ backgroundColor: badgeColor }}><Icon size={20} /></div>
        <div style={{ minWidth: 0 }}>
          <div className="tx-title">{t.concept}{tags}</div>
          <div className="tx-sub">{cat ? cat.name : "Fondo General"} • {fmtDay(t.date)}</div>
        </div>
      </div>
      <div className="tx-right">{amount}{buttons}</div>
    </div>
  );
}

export default memo(TransactionItem);
