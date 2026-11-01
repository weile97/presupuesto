import { memo, useRef, useState } from "react";
import { Trash2, Wallet, Banknote, ChevronRight, Edit2 } from "lucide-react";
import { CAT_ICONS } from "../../lib/constants.js";
import { money, fmtDay } from "../../lib/format.js";
import { isExpenseType } from "../../shared.js";

const isAdjustment = (type) => type === "adjustment_income" || type === "adjustment_expense";
const SWIPE_ACTION = 80;
const SWIPE_MAX = 110;

// Una fila del historial: tocarla o deslizarla a la derecha edita; deslizarla a la izquierda o la papelera borra.
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

  // Deslizar con el dedo. touch-action: pan-y deja el scroll vertical al navegador.
  const [dx, setDx] = useState(0);
  const start = useRef(null);
  const swiped = useRef(false);
  const onPointerDown = (e) => {
    if (e.pointerType !== "touch") return;
    start.current = { x: e.clientX, y: e.clientY };
    swiped.current = false;
  };
  const onPointerMove = (e) => {
    if (!start.current) return;
    const moveX = e.clientX - start.current.x;
    const moveY = e.clientY - start.current.y;
    if (!swiped.current && (Math.abs(moveX) < 12 || Math.abs(moveX) < Math.abs(moveY))) return;
    swiped.current = true;
    setDx(Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, moveX)));
  };
  const onPointerUp = () => {
    if (!start.current) return;
    start.current = null;
    setDx((current) => {
      if (current <= -SWIPE_ACTION) onDelete();
      else if (current >= SWIPE_ACTION) onEdit();
      return 0;
    });
  };
  const onPointerCancel = () => { start.current = null; setDx(0); };
  const onClick = () => {
    if (swiped.current) { swiped.current = false; return; }
    onEdit();
  };

  return (
    <div className="tx-swipe">
      {dx !== 0 && (
        <div className={`tx-swipe-bg ${dx > 0 ? "edit" : "delete"}`} aria-hidden="true">
          {dx > 0 ? <Edit2 size={18} /> : <Trash2 size={18} />}
        </div>
      )}
      <div
        className={compact ? "tx-item compact" : "tx-item"}
        role="button"
        tabIndex={0}
        style={dx ? { transform: `translateX(${dx}px)`, transition: "none" } : undefined}
        onClick={onClick}
        onKeyDown={(e) => e.key === "Enter" && onEdit()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {!compact && <div className="tx-badge" style={{ backgroundColor: badgeColor }}><Icon size={19} /></div>}
        <div className="tx-main">
          <div className="tx-title">{t.concept}{tags}</div>
          <div className="tx-sub">{meta}</div>
        </div>
        <div className={`tx-amount ${negative ? "expense" : "income"}`}>{negative ? "−" : "+"}{money(Math.abs(t.amount))}</div>
        <button className="tx-delete" onClick={remove} onPointerDown={(e) => e.stopPropagation()} aria-label="Eliminar movimiento"><Trash2 size={16} /></button>
        <ChevronRight size={16} className="tx-chevron" />
      </div>
    </div>
  );
}

export default memo(TransactionItem);
