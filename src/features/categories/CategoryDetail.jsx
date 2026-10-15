import { useMemo, useState } from "react";
import { X, Lock, Plus, Minus, Wallet, Edit2, Eye, EyeOff, Search, ArrowRightLeft, Eraser, Trash2 } from "lucide-react";
import { AmountInput } from "../../components/ui/Sheet.jsx";
import { CAT_ICONS } from "../../lib/constants.js";
import { money, isLightColor, sortByDateDesc } from "../../lib/format.js";
import TransactionItem from "../transactions/TransactionItem.jsx";

// Ventana con el detalle de un sobre: saldo, accesos rápidos y sus movimientos
export default function CategoryDetail({ category: cat, stats, transactions, actions, openSheet, onFilterHistory, onClose }) {
  const catTxs = useMemo(
    () => transactions.filter((t) => t.categoryId === cat.id).sort(sortByDateDesc),
    [transactions, cat.id]
  );
  const Icon = CAT_ICONS[cat.icon] || Wallet;
  const locked = actions.isLocked(cat);
  const color = cat.color || "#151C28";
  const fg = isLightColor(color) ? "#0F172A" : "white";
  const pct = cat.targetGoal > 0 ? Math.min(100, (stats.balance / cat.targetGoal) * 100) : 0;

  const [adjust, setAdjust] = useState("");
  const applyAdjust = async (sign) => {
    const text = adjust.trim().replace(/^[-+]/, "");
    if (await actions.adjustCategory(cat.id, sign < 0 ? `-${text}` : text)) setAdjust("");
  };

  const openTx = (preset) => { onClose(); openSheet("tx", { preset: { ...preset, categoryId: cat.id } }); };
  const edit = async () => {
    if (!(await actions.requirePin(cat, `PIN para editar "${cat.name}"`))) return;
    onClose();
    openSheet("category", { category: cat });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={cat.name}>
        <div className="modal-header" style={{ backgroundColor: color, color: fg }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="card-icon"><Icon size={20} /></div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                {cat.name} {cat.hasPin && <Lock size={13} />}
              </div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                {locked ? "Sobre bloqueado" : `${catTxs.length} movimiento${catTxs.length === 1 ? "" : "s"}`}
              </div>
            </div>
          </div>
          <button className="btn-icon" style={{ color: fg }} onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>

        <div className="modal-body">
          <div className="modal-balance">{locked ? "••••••" : money(stats.balance)}</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <span className="color-badge income-contrast">+ {locked ? "•••" : money(stats.income)}</span>
            <span className="color-badge expense-contrast">- {locked ? "•••" : money(stats.expense)}</span>
          </div>

          {cat.targetGoal > 0 && !locked && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6, color: "var(--text-muted)", fontWeight: 600 }}>
                <span>Presupuesto: {money(cat.targetGoal)}</span>
                <span>{Math.round(pct)}%</span>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${pct}%`, backgroundColor: "var(--pink-primary)" }} />
              </div>
            </div>
          )}

          {!locked && (
            <div className="quick-actions">
              <button className="btn-primary" onClick={() => openTx({ type: "expense" })}><Plus size={16} /> Apuntar gasto</button>
              <button className="btn-secondary" onClick={() => openTx({ type: "income" })}><Wallet size={16} /> Meter dinero</button>
            </div>
          )}

          {!locked && (
            <div className="adjust-box">
              <label>Sumar o quitar dinero al sobre (no toca el Fondo General)</label>
              <div className="adjust-row">
                <AmountInput value={adjust} onChange={(e) => setAdjust(e.target.value)} placeholder="Importe" />
                <button type="button" className="btn-secondary adjust-plus" onClick={() => applyAdjust(1)}><Plus size={15} /> Sumar</button>
                <button type="button" className="btn-secondary adjust-minus" onClick={() => applyAdjust(-1)}><Minus size={15} /> Quitar</button>
              </div>
            </div>
          )}

          <div className="detail-tools">
            <button className="btn-secondary" onClick={edit}><Edit2 size={14} /> Editar sobre</button>
            {!locked && (
              <button className="btn-secondary" onClick={() => { onClose(); openSheet("transfer", { from: cat.id }); }}>
                <ArrowRightLeft size={14} /> Traspasar
              </button>
            )}
            {cat.hasPin && (
              <button className="btn-secondary" onClick={() => actions.toggleUnlock(cat)}>
                {locked ? <Eye size={14} /> : <EyeOff size={14} />} {locked ? "Desbloquear" : "Bloquear"}
              </button>
            )}
            <button className="btn-secondary" onClick={() => { onFilterHistory(cat.id); onClose(); }}>
              <Search size={14} /> Ver en el historial
            </button>
            <button className="btn-secondary" onClick={() => actions.clearCategory(cat.id)}>
              <Eraser size={14} /> Vaciar historial
            </button>
            <button className="btn-secondary btn-danger" onClick={async () => { if (await actions.deleteCategory(cat.id)) onClose(); }}>
              <Trash2 size={14} /> Eliminar sobre
            </button>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "var(--text-muted)" }}>Movimientos de este sobre</div>
          <div className="modal-tx-list">
            {locked ? (
              <div className="empty-text">Desbloquea el sobre para ver sus movimientos.</div>
            ) : catTxs.length === 0 ? (
              <div className="empty-text">Todavía no hay movimientos en este sobre.</div>
            ) : (
              catTxs.map((t) => (
                <TransactionItem
                  key={t.id}
                  tx={t}
                  compact
                  onEdit={async () => { if (await actions.canEditTx(t)) { onClose(); openSheet("tx", { tx: t }); } }}
                  onDelete={() => actions.deleteTransaction(t.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
