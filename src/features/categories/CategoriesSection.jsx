import { useState, useRef } from "react";
import {
  Layers, PieChart, LayoutGrid, Settings2, ArrowRightLeft, Plus, GripVertical, Eye, EyeOff,
  Edit2, Trash2, X, Lock, Wallet, ChevronUp, ChevronDown
} from "lucide-react";
import { CAT_ICONS } from "../../lib/constants.js";
import { money, isLightColor } from "../../lib/format.js";

const VIEW_KEY = "mj_cat_view";
const readView = () => { try { return localStorage.getItem(VIEW_KEY) || "stack"; } catch { return "stack"; } };

export default function CategoriesSection({ categories, categoryBalances, actions, openSheet, onOpenDetail }) {
  const [viewMode, setViewMode] = useState(readView); // "grid" | "stack" (se recuerda en este móvil)
  const [editMode, setEditMode] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const changeView = (mode) => {
    setViewMode(mode);
    try { localStorage.setItem(VIEW_KEY, mode); } catch { /* sin almacenamiento */ }
  };

  // Arrastrar desde el asa ⋮⋮ para reordenar. Pointer events: funciona con dedo y con ratón
  // (el drag HTML5 no funciona en móviles). El asa tiene touch-action:none para no hacer scroll.
  const overRef = useRef(null);
  const startDrag = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    handle.setPointerCapture?.(e.pointerId);
    navigator.vibrate?.(15);
    overRef.current = null;
    setDragId(id);

    const move = (ev) => {
      const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-cat-id]");
      const overId = target?.dataset.catId || null;
      if (overId !== overRef.current) { overRef.current = overId; setDragOverId(overId); }
      // Auto-scroll al acercarse a los bordes de la pantalla
      if (ev.clientY < 90) window.scrollBy(0, -14);
      else if (ev.clientY > window.innerHeight - 90) window.scrollBy(0, 14);
    };
    const end = (drop) => () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onCancel);
      if (drop && overRef.current) actions.moveCategory(id, overRef.current);
      setDragId(null);
      setDragOverId(null);
    };
    const onUp = end(true), onCancel = end(false);
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onCancel);
  };
  const dragClass = (id) => `${dragId === id ? "dragging" : ""} ${dragOverId === id && dragId !== id ? "drag-over" : ""}`;
  const handle = (cat, size) => (
    <span className="drag-handle" title="Mantén y arrastra para reordenar" onPointerDown={(e) => startDrag(e, cat.id)} onClick={(e) => e.stopPropagation()}>
      <GripVertical size={size} />
    </span>
  );

  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  const editCategory = (cat) => { if (actions.requirePin(cat, `PIN requerido para editar "${cat.name}":`)) openSheet("category", { category: cat }); };

  return (
    <section>
      <div className="section-header">
        <div className="section-title">
          {viewMode === "stack" ? <Layers size={18} color="var(--purple-accent)" /> : <PieChart size={18} color="var(--purple-accent)" />}
          Sobres
        </div>
        <div className="section-actions">
          <div className="view-toggle">
            <button className={viewMode === "grid" ? "active" : ""} onClick={() => changeView("grid")}><LayoutGrid size={14} /> Cuadrícula</button>
            <button className={viewMode === "stack" ? "active" : ""} onClick={() => changeView("stack")}><Layers size={14} /> Tarjetero</button>
          </div>
          <button className={`stack-edit-btn ${editMode ? "on" : ""}`} onClick={() => setEditMode((v) => !v)}>
            <Settings2 size={14} /> {editMode ? "Listo" : "Ordenar / editar"}
          </button>
          <button className="btn-secondary" onClick={() => openSheet("transfer")}><ArrowRightLeft size={15} /> Traspaso</button>
          <button className="btn-primary" onClick={() => openSheet("category")}><Plus size={15} /> Crear sobre</button>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="card empty-card">Aún no tienes ningún sobre. Pulsa "Crear sobre" para crear el primero.</div>
      ) : (
        <div className={viewMode === "grid" ? "grid-3" : `stack-wrap ${editMode ? "editing" : ""}`}>
          {categories.map((cat, index) => {
            const Icon = CAT_ICONS[cat.icon] || Wallet;
            const stats = categoryBalances[cat.id] || { balance: 0, income: 0, expense: 0 };
            const locked = actions.isLocked(cat);
            const color = cat.color || "#151C28";
            const light = isLightColor(color);
            const style = { backgroundColor: color, color: light ? "#0F172A" : "var(--text-main)" };
            const openDetail = () => { if (!editMode && !dragId) onOpenDetail(cat.id); };

            const editTools = (
              <>
                {editMode && (
                  <>
                    <button className="btn-action" disabled={index === 0} onClick={stop(() => actions.shiftCategory(cat.id, -1))} aria-label="Subir"><ChevronUp size={16} /></button>
                    <button className="btn-action" disabled={index === categories.length - 1} onClick={stop(() => actions.shiftCategory(cat.id, 1))} aria-label="Bajar"><ChevronDown size={16} /></button>
                  </>
                )}
                {cat.hasPin && (
                  <button className="btn-action" onClick={stop(() => actions.toggleUnlock(cat))} aria-label={locked ? "Desbloquear" : "Bloquear"}>
                    {locked ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                )}
                <button className="btn-action" onClick={stop(() => editCategory(cat))} aria-label="Editar sobre"><Edit2 size={14} /></button>
                <button className="btn-action" onClick={stop(() => actions.deleteCategory(cat.id))} aria-label="Eliminar sobre"><Trash2 size={14} /></button>
              </>
            );

            if (viewMode === "stack") {
              return (
                <div key={cat.id} data-cat-id={cat.id} className={`stack-card ${dragClass(cat.id)}`} style={style} onClick={openDetail}>
                  <div className="stack-card-top">
                    <div className="stack-card-left">
                      {handle(cat, 18)}
                      <div className="card-icon"><Icon size={18} /></div>
                      <div>
                        <div className="stack-card-name">{cat.name} {cat.hasPin && <Lock size={12} />}</div>
                        {cat.targetGoal > 0 && !locked && <div className="stack-card-hint">Presupuesto: {money(cat.targetGoal)}</div>}
                      </div>
                    </div>
                    <div className="stack-card-actions">{editTools}</div>
                  </div>
                  <div className="stack-saldo-label">SALDO DISPONIBLE</div>
                  <div className="stack-saldo-val">{locked ? "••••••" : money(stats.balance)}</div>
                </div>
              );
            }

            const pct = cat.targetGoal > 0 ? Math.min(100, (stats.balance / cat.targetGoal) * 100) : 0;
            return (
              <div key={cat.id} data-cat-id={cat.id} className={`card card-interactive ${dragClass(cat.id)}`} style={style} onClick={openDetail}>
                <div className="card-top">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {handle(cat, 18)}
                    <div className="card-icon"><Icon size={18} /></div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {editTools}
                    {editMode && (
                      <button className="btn-action" onClick={stop(() => actions.clearCategory(cat.id))} aria-label="Vaciar historial"><X size={14} /></button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{cat.name} {cat.hasPin && <Lock size={12} />}</div>
                <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800 }}>{locked ? "••••••" : money(stats.balance)}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 12, fontWeight: 700 }}>
                  <span className={`color-badge ${light ? "light-bg-income" : "income-contrast"}`}>+ {locked ? "•••" : money(stats.income)}</span>
                  <span className={`color-badge ${light ? "light-bg-expense" : "expense-contrast"}`}>- {locked ? "•••" : money(stats.expense)}</span>
                </div>
                {cat.targetGoal > 0 && !locked && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 10, opacity: 0.85, fontWeight: 600 }}>
                      <span>Presupuesto: {money(cat.targetGoal)}</span>
                      <span>{Math.round(pct)}%</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? "var(--red)" : pct >= 75 ? "var(--yellow)" : "var(--green)" }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
