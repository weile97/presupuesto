import { Fragment, useMemo, useState } from "react";
import { TrendingUp, Trash2, Plus, Search, X } from "lucide-react";
import { TX_PAGE } from "../../lib/constants.js";
import { sortByDateDesc, todayISO } from "../../lib/format.js";

// Cabecera de cada día del historial: "Hoy", "Ayer" o "lunes, 27 oct"
function dayLabel(iso) {
  if (!iso) return "Sin fecha";
  const today = todayISO();
  const y = new Date(`${today}T12:00:00`);
  y.setDate(y.getDate() - 1);
  if (iso === today) return "Hoy";
  if (iso === y.toISOString().slice(0, 10)) return "Ayer";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" });
}
import { currentCycle, isExpenseType } from "../../shared.js";
import TransactionItem from "./TransactionItem.jsx";

export default function TransactionsSection({ transactions, catById, actions, openSheet, categoryFilter, setCategoryFilter }) {
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("all"); // all | current | expenses
  const [paging, setPaging] = useState({ key: "", n: TX_PAGE });

  const { unlockedCats } = actions;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = currentCycle().start;
    return transactions
      .filter((t) => {
        const cat = catById.get(t.categoryId);
        if (cat?.hasPin && !unlockedCats[cat.id]) return false;
        if (categoryFilter && t.categoryId !== categoryFilter) return false;
        if (q && !(t.concept || "").toLowerCase().includes(q)) return false;
        if (range === "current" && (t.date || "") < from) return false;
        if (range === "expenses" && !isExpenseType(t.type)) return false;
        return true;
      })
      .sort(sortByDateDesc);
  }, [transactions, catById, unlockedCats, categoryFilter, search, range]);

  // Paginación: al cambiar los filtros se vuelve a la primera página
  const filterKey = `${categoryFilter}|${search}|${range}`;
  const limit = paging.key === filterKey ? paging.n : TX_PAGE;

  const edit = async (t) => { if (await actions.canEditTx(t)) openSheet("tx", { tx: t }); };

  return (
    <section id="movimientos" className="anchor">
      <div className="section-header">
        <div className="section-title"><TrendingUp size={18} color="var(--green)" /> Historial de movimientos</div>
        <div className="section-actions">
          {transactions.length > 0 && (
            <button className="btn-action" onClick={actions.clearAllTransactions} style={{ color: "var(--red)" }}>
              <Trash2 size={14} /> Vaciar
            </button>
          )}
          <button className="btn-primary" onClick={() => openSheet("tx")}><Plus size={15} /> Nuevo movimiento</button>
        </div>
      </div>

      {categoryFilter && (
        <div className="filter-chip">
          Sobre: {catById.get(categoryFilter)?.name || "eliminado"}
          <button onClick={() => setCategoryFilter(null)} aria-label="Quitar filtro"><X size={14} /></button>
        </div>
      )}

      <div className="search-bar">
        <div className="search-input-wrapper">
          <Search className="search-icon" size={16} />
          <input type="search" placeholder="Buscar por concepto…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select style={{ maxWidth: 170 }} value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="all">Todo</option>
          <option value="current">Este ciclo</option>
          <option value="expenses">Solo gastos</option>
        </select>
      </div>

      <div className="tx-list">
        {filtered.length === 0 ? (
          <div className="empty-text">No se encontraron movimientos.</div>
        ) : (
          filtered.slice(0, limit).map((t, i, arr) => (
            <Fragment key={t.id}>
              {(i === 0 || arr[i - 1].date !== t.date) && <div className="day-head">{dayLabel(t.date)}</div>}
              <TransactionItem
                tx={t}
                category={catById.get(t.categoryId)}
                onEdit={() => edit(t)}
                onDelete={() => actions.deleteTransaction(t.id)}
              />
            </Fragment>
          ))
        )}
        {filtered.length > limit && (
          <button className="btn-secondary" style={{ width: "100%" }} onClick={() => setPaging({ key: filterKey, n: limit + TX_PAGE })}>
            Ver más ({filtered.length - limit} restantes)
          </button>
        )}
      </div>
    </section>
  );
}
