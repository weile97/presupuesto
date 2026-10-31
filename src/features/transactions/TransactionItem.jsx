import { memo } from "react";
import { Trash2, Wallet, Banknote, ChevronRight } from "lucide-react";
import { CAT_ICONS } from "../../lib/constants.js";
import { money, fmtDay } from "../../lib/format.js";
import { isExpenseType } from "../../shared.js";

const isAdjustment = (type) => type === "adjustment_income" || type === "adjustment_expense";

// Una fila del historial: tocarla abre la edición; la papelera la borra (con "Deshacer").
// `compact` = versión de la ventana de un sobre (sin icono ni nombre del sobre).
function TransactionItem({ tx: t, category: cat, compact, onEdit, onDelete }) {
  const negative = isExpenseType(t.type) || (t.type === "carryover" && t.amount < 0);
  const tags = (
    <>
      {t.recurrentId && <span className="recurrent-tag">Recurrente</span>}
      {isAdjustment(t.type) && <span className="adjust-tag">Ajuste</span>}
    </>
  );
  const remove = (e) => { e.stopPropagation(); onDelete(); };
  const meta = [compact ? fmtDay(t.date) : cat ? cat.name : "Fondo General", t.paidBy && `pagó ${t.paidBy}`].filter(Boolean).join(" · ");

  const Icon = cat ? CAT_ICONS[cat.icon] || Wallet : t.type === "payroll_income" ? Banknote : Wallet;
  const badgeColor = cat?.color || (t.type === "payroll_income" ? "#059669" : "#334155");

  return (
    <div className={compact ? "tx-item compact" : "tx-item"} role="button" tabIndex={0} onClick={onEdit} onKeyDown={(e) => e.key === "Enter" && onEdit()}>
      {!compact && <div className="tx-badge" style={{ backgroundColor: badgeColor }}><Icon size={19} /></div>}
      <div className="tx-main">
        <div className="tx-title">{t.concept}{tags}</div>
        <div className="tx-sub">{meta}</div>
      </div>
      <div className={`tx-amount ${negative ? "expense" : "income"}`}>{negative ? "−" : "+"}{money(Math.abs(t.amount))}</div>
      <button className="tx-delete" onClick={remove} aria-label="Eliminar movimiento"><Trash2 size={16} /></button>
      <ChevronRight size={16} className="tx-chevron" />
    </div>
  );
}

export default memo(TransactionItem);
