import { useState, useEffect } from "react";
import { uid, todayISO, money, parseAmount, nextMonthKey } from "../lib/format.js";
import { verifyCategoryPin, setCategoryPin } from "../lib/api.js";
import { isAllocation, isRecurrentApplied, findDuplicateTx, findDuplicateRule, normalizeText } from "../shared.js";

// --- Deshacer: funciones que devuelven el estado con el cambio revertido -------------------
const withIndex = (arr, pred) => arr.map((item, index) => ({ item, index })).filter(({ item }) => pred(item));
const reinsert = (key, removed) => (cur) => {
  const list = [...(cur[key] || [])];
  const ids = new Set(list.map((x) => x.id));
  for (const { item, index } of removed) if (!ids.has(item.id)) list.splice(Math.min(index, list.length), 0, item);
  return { ...cur, [key]: list };
};
const removeIds = (key, ids) => (cur) => ({ ...cur, [key]: (cur[key] || []).filter((x) => !ids.includes(x.id)) });
const restoreItem = (key, old) => (cur) => ({ ...cur, [key]: (cur[key] || []).map((x) => (x.id === old.id ? old : x)) });
const compose = (...fns) => (cur) => fns.reduce((acc, fn) => fn(acc), cur);

/**
 * Todas las operaciones que modifican el presupuesto. Cada una valida, guarda y avisa.
 * Las que vienen de un formulario devuelven (una promesa de) true si se ha guardado, para cerrarlo.
 */
export function useBudgetActions({ data, stats, save, getData, notify, celebrate, askPin, askConfirm, userName }) {
  const { sources, categories, transactions, recurrents, fund, catById, categoryBalances } = stats;

  // Aviso con botón "Deshacer": aplica la reversión sobre los datos ACTUALES (por si la pareja cambió algo)
  const undoable = (message, revert) =>
    notify(message, "success", { label: "Deshacer", onClick: () => { save(revert(getData())); notify("Cambio deshecho."); } });

  // Un duplicado solo se guarda si el usuario lo confirma expresamente
  const confirmDuplicate = (message) =>
    askConfirm({ title: "Posible duplicado", message, confirmLabel: "Añadir igualmente" });

  // --- Sobres con PIN: se desbloquean 60 s ---------------------------------
  const [unlockedCats, setUnlockedCats] = useState({});
  useEffect(() => {
    if (!Object.values(unlockedCats).some(Boolean)) return;
    const timer = setTimeout(() => {
      setUnlockedCats({});
      notify("Protección activada: sobres bloqueados.", "error");
    }, 60000);
    return () => clearTimeout(timer);
  }, [unlockedCats, notify]);

  const isLocked = (cat) => !!cat?.hasPin && !unlockedCats[cat.id];

  // Pide el PIN si el sobre está protegido. always=true lo pide aunque esté desbloqueado (borrados).
  async function requirePin(cat, title, always = false) {
    if (!cat?.hasPin || (!always && unlockedCats[cat.id])) return true;
    const entered = await askPin(title);
    if (entered === null) return false;
    try {
      if (await verifyCategoryPin(cat.id, entered)) return true;
      notify("PIN incorrecto.", "error");
    } catch (err) {
      notify(err.message === "Failed to fetch" ? "Sin conexión: no se puede comprobar el PIN." : err.message, "error");
    }
    return false;
  }

  async function toggleUnlock(cat) {
    if (unlockedCats[cat.id]) return setUnlockedCats((p) => ({ ...p, [cat.id]: false }));
    if (await requirePin(cat, `PIN de "${cat.name}"`, true)) {
      setUnlockedCats((p) => ({ ...p, [cat.id]: true }));
      notify(`Sobre "${cat.name}" desbloqueado.`);
    }
  }

  const fail = (msg) => { notify(msg, "error"); return false; };
  const addTxs = (newTxs) => save({ ...data, transactions: [...newTxs, ...transactions] });

  // --- Nóminas ---------------------------------------------------------------
  const payrollTx = (src, amount) => ({
    id: uid(), concept: `Nómina: ${src.name}`, categoryId: null, sourceId: src.id,
    type: "payroll_income", amount, date: todayISO()
  });

  const payrollExists = (src, amt) =>
    getData().transactions.some((t) => t.type === "payroll_income" && t.sourceId === src.id && t.amount === amt);

  async function depositPayroll(src, amountText) {
    const amt = parseAmount(amountText);
    if (isNaN(amt) || amt <= 0) return fail("Introduce un importe de nómina válido.");
    if (payrollExists(src, amt) && !(await confirmDuplicate(`Ya hay una nómina de ${money(amt)} de "${src.name}" en este ciclo. ¿Añadirla otra vez?`))) return false;
    const tx = payrollTx(src, amt);
    addTxs([tx]);
    undoable(`Se han añadido ${money(amt)} al Fondo General.`, removeIds("transactions", [tx.id]));
    return true;
  }

  async function bulkPayroll(amounts) {
    const newTxs = sources
      .map((src) => ({ src, amt: parseAmount(amounts[src.id]) }))
      .filter(({ amt }) => !isNaN(amt) && amt > 0)
      .map(({ src, amt }) => payrollTx(src, amt));
    if (newTxs.length === 0) return fail("Introduce al menos un importe válido.");
    const repeated = sources.filter((s) => newTxs.some((t) => t.sourceId === s.id && payrollExists(s, t.amount)));
    if (repeated.length > 0 && !(await confirmDuplicate(`Ya están registradas en este ciclo estas nóminas con el mismo importe: ${repeated.map((s) => s.name).join(", ")}. ¿Añadirlas otra vez?`))) return false;
    save({ ...getData(), transactions: [...newTxs, ...getData().transactions] });
    celebrate("¡Nóminas registradas!");
    undoable(`Se han añadido ${money(newTxs.reduce((a, t) => a + t.amount, 0))} al Fondo General.`, removeIds("transactions", newTxs.map((t) => t.id)));
    return true;
  }

  async function saveSource({ id, name, amount, icon, color }) {
    const n = name.trim();
    const amt = parseAmount(amount);
    if (!n || isNaN(amt) || amt < 0) return fail("Introduce un nombre e importe de referencia válidos.");
    if (sources.some((s) => s.id !== id && normalizeText(s.name) === normalizeText(n)) &&
      !(await confirmDuplicate(`Ya existe una fuente de nómina llamada "${n}". ¿Guardarla igualmente?`))) return false;
    const fields = { name: n, amount: amt, icon, color };
    save({
      ...data,
      sources: id ? sources.map((s) => (s.id === id ? { ...s, ...fields } : s)) : [...sources, { id: uid(), ...fields }]
    });
    notify(id ? "Fuente de nómina actualizada." : "Fuente de nómina añadida.");
    return true;
  }

  function deleteSource(id) {
    const removed = withIndex(sources, (s) => s.id === id);
    save({ ...data, sources: sources.filter((s) => s.id !== id) });
    undoable("Fuente de nómina eliminada.", reinsert("sources", removed));
  }

  // --- Sobres ------------------------------------------------------------------
  async function saveCategory({ id, name, icon, color, hasPin, pin, goal, goalDate }) {
    const n = name.trim();
    if (!n) return fail("Pon un nombre al sobre.");
    if (categories.some((c) => c.id !== id && normalizeText(c.name) === normalizeText(n)) &&
      !(await confirmDuplicate(`Ya existe un sobre llamado "${n}". ¿Guardarlo igualmente?`))) return false;
    const existing = id ? catById.get(id) : null;
    const newId = id || uid();
    if (hasPin) {
      if (pin.trim()) {
        try {
          await setCategoryPin(newId, pin);
        } catch (err) {
          return fail(err.message === "Failed to fetch" ? "Sin conexión: no se puede guardar el PIN." : err.message);
        }
      } else if (!existing?.hasPin) { // vacío = mantener el PIN actual
        return fail("Asigna un PIN al sobre.");
      }
    }
    const goalParsed = parseAmount(goal);
    const targetGoal = isNaN(goalParsed) ? 0 : goalParsed;
    const fields = { name: n, icon, color, hasPin, targetGoal, goalDate: targetGoal > 0 ? goalDate || null : null };
    const cur = getData();
    save({
      ...cur,
      categories: id
        ? cur.categories.map((c) => (c.id === id ? { ...c, ...fields } : c))
        : [...cur.categories, { id: newId, initialBalance: 0, ...fields }]
    });
    celebrate(id ? "¡Sobre guardado!" : "¡Sobre creado!");
    return true;
  }

  async function adjustCategory(catId, amountText) {
    const cat = catById.get(catId);
    if (!cat || !(await requirePin(cat, `PIN de "${cat.name}"`))) return false;
    const amt = parseAmount(amountText);
    if (isNaN(amt) || amt === 0) return fail("Introduce una cantidad válida.");
    const tx = {
      id: uid(), concept: `Ajuste manual de saldo: ${cat.name}`, categoryId: catId, sourceId: null,
      type: amt > 0 ? "adjustment_income" : "adjustment_expense", amount: Math.abs(amt), date: todayISO()
    };
    if (findDuplicateTx(tx, getData().transactions) &&
      !(await confirmDuplicate(`Ya has hecho hoy este mismo ajuste de ${money(Math.abs(amt))} en "${cat.name}". ¿Hacerlo otra vez?`))) return false;
    save({ ...getData(), transactions: [tx, ...getData().transactions] });
    undoable(`"${cat.name}" ${amt > 0 ? "+" : ""}${money(amt)}. No afecta al Fondo General.`, removeIds("transactions", [tx.id]));
    return true;
  }

  function moveCategory(dragId, targetId) {
    if (!dragId || dragId === targetId) return;
    const from = categories.findIndex((c) => c.id === dragId);
    const to = categories.findIndex((c) => c.id === targetId);
    if (from === -1 || to === -1) return;
    const reordered = [...categories];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    save({ ...data, categories: reordered });
  }

  // Mover un sobre una posición arriba (-1) o abajo (+1)
  function shiftCategory(id, dir) {
    const i = categories.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= categories.length) return;
    moveCategory(id, categories[j].id);
  }

  // Movimiento que deja el Fondo General bien al quitar los movimientos de un sobre: borrarlos devuelve al
  // fondo lo asignado este ciclo; lo correcto es que vuelva solo el dinero que queda sin gastar.
  function fundCorrection(cat, cur, moneyBack, concept) {
    const assigned = cur.transactions
      .filter((t) => t.categoryId === cat.id && isAllocation(t) && !t.settled)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const amount = Math.round((Math.max(moneyBack, 0) - assigned) * 100) / 100;
    if (amount === 0) return null;
    return { id: uid(), concept, categoryId: null, sourceId: null, type: "carryover", amount, date: todayISO() };
  }

  async function deleteCategory(id) {
    const cat = catById.get(id);
    if (!cat || !(await requirePin(cat, `PIN para eliminar "${cat.name}"`, true))) return false;
    const balance = categoryBalances[id]?.balance || 0;
    if (balance > 0 && !(await askConfirm({
      title: `Eliminar "${cat.name}"`,
      message: `Le quedan ${money(balance)}, que volverán al Fondo General. ¿Eliminarlo?`,
      confirmLabel: "Eliminar"
    }))) return false;
    const cur = getData();
    const fix = fundCorrection(cat, cur, balance, `Saldo del sobre eliminado: ${cat.name}`);
    const removedCat = withIndex(cur.categories, (c) => c.id === id);
    const removedTxs = withIndex(cur.transactions, (t) => t.categoryId === id);
    const kept = cur.transactions.filter((t) => t.categoryId !== id);
    save({ ...cur, categories: cur.categories.filter((c) => c.id !== id), transactions: fix ? [fix, ...kept] : kept });
    undoable(`Sobre "${cat.name}" eliminado.`, compose(reinsert("categories", removedCat), reinsert("transactions", removedTxs), removeIds("transactions", fix ? [fix.id] : [])));
    return true;
  }

  async function clearCategory(id) {
    const cat = catById.get(id);
    if (!cat || !(await requirePin(cat, `PIN para vaciar "${cat.name}"`, true))) return;
    const cur = getData();
    const removed = withIndex(cur.transactions, (t) => t.categoryId === id);
    if (removed.length === 0) return notify("Este sobre no tiene movimientos.", "error");
    const moneyBack = (categoryBalances[id]?.balance || 0) - (cat.initialBalance || 0);
    if (moneyBack > 0 && !(await askConfirm({
      title: `Vaciar "${cat.name}"`,
      message: `El sobre se queda sin movimientos y ${money(moneyBack)} volverán al Fondo General. ¿Continuar?`,
      confirmLabel: "Vaciar"
    }))) return;
    const fix = fundCorrection(cat, cur, moneyBack, `Saldo del sobre vaciado: ${cat.name}`);
    const kept = cur.transactions.filter((t) => t.categoryId !== id);
    save({ ...cur, transactions: fix ? [fix, ...kept] : kept });
    undoable(`Historial de "${cat.name}" vaciado.`, compose(reinsert("transactions", removed), removeIds("transactions", fix ? [fix.id] : [])));
  }

  function clearAllTransactions() {
    if (!window.confirm("⚠️ ¿Vaciar TODO el historial de movimientos?")) return;
    const removed = withIndex(transactions, () => true);
    save({ ...data, transactions: [] });
    undoable("Historial vaciado.", reinsert("transactions", removed));
  }

  async function transfer({ from, to, amount }) {
    const amt = parseAmount(amount);
    if (!from || !to || isNaN(amt) || amt <= 0) return fail("Completa los datos del traspaso.");
    if (from === to) return fail("Elige dos sobres diferentes.");
    const fromCat = catById.get(from), toCat = catById.get(to);
    if (!(await requirePin(fromCat, `PIN de "${fromCat.name}"`))) return false;
    if (!(await requirePin(toCat, `PIN de "${toCat.name}"`))) return false;
    if ((categoryBalances[from]?.balance || 0) < amt) return fail(`Saldo insuficiente en "${fromCat.name}".`);
    const date = todayISO();
    const txs = [
      { id: uid(), concept: `Traspaso ➔ ${toCat.name}`, categoryId: from, sourceId: null, type: "transfer_expense", amount: amt, date },
      { id: uid(), concept: `Traspaso desde ${fromCat.name}`, categoryId: to, sourceId: null, type: "transfer_income", amount: amt, date }
    ];
    if (findDuplicateTx(txs[0], getData().transactions) &&
      !(await confirmDuplicate(`Hoy ya hay un traspaso de ${money(amt)} de "${fromCat.name}" a "${toCat.name}". ¿Hacerlo otra vez?`))) return false;
    save({ ...getData(), transactions: [...txs, ...getData().transactions] });
    undoable(`Traspaso de ${money(amt)} completado.`, removeIds("transactions", txs.map((t) => t.id)));
    return true;
  }

  // --- Movimientos ---------------------------------------------------------------
  const canEditTx = (t) => requirePin(catById.get(t.categoryId), "PIN para modificar este movimiento");

  async function saveTransaction({ id, concept, categoryId, type, amount, date, paidBy }) {
    const amt = parseAmount(amount);
    if (!concept.trim() || isNaN(amt) || amt <= 0 || !categoryId) return fail("Completa todos los campos correctamente.");
    const cat = catById.get(categoryId);
    if (!(await requirePin(cat, `PIN de "${cat?.name}"`))) return false;

    const cur = getData();
    if (type === "income") {
      // Lo asignado en ciclos anteriores (settled) ya no cuenta en el Fondo General de este ciclo
      const editing = id ? cur.transactions.find((t) => t.id === id) : null;
      const previous = editing && isAllocation(editing) && !editing.settled ? editing.amount || 0 : 0;
      if (fund.available + previous < amt) return fail("Saldo insuficiente en el Fondo General para asignar.");
    }

    const fields = { concept: concept.trim(), categoryId, type, amount: amt, date: date || todayISO(), paidBy: type === "expense" ? paidBy || null : null };
    const dup = findDuplicateTx(fields, cur.transactions, cur.recurrents, id);
    if (dup && !(await confirmDuplicate(`Ya existe "${dup.concept}" de ${money(dup.amount)} en "${cat?.name}" con fecha ${dup.date}${dup.recurrentId ? " (recurrente)" : ""}. ¿Añadirlo igualmente?`))) return false;
    const latest = getData(); // puede haber cambiado mientras se confirmaba
    if (id) {
      const old = latest.transactions.find((t) => t.id === id);
      save({ ...latest, transactions: latest.transactions.map((t) => (t.id === id ? { ...t, ...fields } : t)) });
      if (old) undoable("Movimiento actualizado.", restoreItem("transactions", old));
    } else {
      const tx = { id: uid(), sourceId: null, ...fields };
      save({ ...latest, transactions: [tx, ...latest.transactions] });
      if (type === "income") celebrate(`¡${money(amt)} al sobre ${cat?.name || ""}!`);
      undoable(type === "income" ? "Dinero asignado al sobre." : `Gasto de ${money(amt)} apuntado.`, removeIds("transactions", [tx.id]));
    }
    return true;
  }

  async function deleteTransaction(id) {
    const t = transactions.find((x) => x.id === id);
    if (!t || !(await canEditTx(t))) return;
    const cur = getData();
    const removed = withIndex(cur.transactions, (x) => x.id === id);
    save({ ...cur, transactions: cur.transactions.filter((x) => x.id !== id) });
    undoable(`"${t.concept}" eliminado.`, reinsert("transactions", removed));
  }

  // --- Recurrentes -----------------------------------------------------------------
  // Crea una regla o, con id, edita una existente
  async function saveRecurrent({ id, concept, categoryId, type, amount, day }) {
    const amt = parseAmount(amount);
    const d = parseInt(day, 10);
    if (!concept.trim() || isNaN(amt) || amt <= 0 || !categoryId || isNaN(d) || d < 1 || d > 31) {
      return fail("Introduce datos válidos para la regla recurrente.");
    }
    if (findDuplicateRule({ concept, categoryId, type, amount: amt, day: d }, recurrents.filter((r) => r.id !== id)) &&
      !(await confirmDuplicate(`Ya existe una regla "${concept.trim()}" de ${money(amt)} el día ${d} en ese sobre. Si guardas otra igual solo se cobrará una vez al mes. ¿Guardarla igualmente?`))) return false;
    const today = todayISO();
    // Si el día de este mes ya pasó, empieza a aplicarse el mes que viene
    const startMonth = d >= Number(today.slice(8, 10)) ? today.slice(0, 7) : nextMonthKey(today);
    const fields = { concept: concept.trim(), categoryId, type, amount: amt, day: d };
    const cur = getData();
    save({
      ...cur,
      recurrents: id
        ? cur.recurrents.map((r) => (r.id === id ? { ...r, ...fields } : r))
        : [...cur.recurrents, { id: uid(), ...fields, startMonth }]
    });
    notify(id ? "Regla actualizada." : `Regla programada: se aplicará sola el día ${d} de cada mes.`);
    return true;
  }

  function deleteRecurrent(id) {
    const removed = withIndex(recurrents, (r) => r.id === id);
    save({ ...data, recurrents: recurrents.filter((r) => r.id !== id) });
    undoable("Regla recurrente eliminada.", reinsert("recurrents", removed));
  }

  // Reglas de ingreso a sobres que faltan este mes: son las que se ofrecen al repartir la nómina
  const pendingAllocations = () => {
    const month = todayISO().slice(0, 7);
    return (getData().recurrents || []).filter((r) => r.type === "income" && !isRecurrentApplied(r, getData().transactions, month));
  };

  // Reparte el Fondo General entre sobres según las reglas (con el mismo id, la regla ya no se aplica sola este mes)
  function distribute(amounts) {
    const month = todayISO().slice(0, 7);
    const newTxs = pendingAllocations().flatMap((rule) => {
      const amt = parseAmount(amounts[rule.id]);
      if (isNaN(amt) || amt <= 0) return [];
      return [{
        id: `rec-${rule.id}-${month}`, recurrentId: rule.id, concept: rule.concept, categoryId: rule.categoryId,
        sourceId: null, type: "income", amount: amt, date: todayISO()
      }];
    });
    if (newTxs.length === 0) return fail("Introduce al menos un importe.");
    save({ ...getData(), transactions: [...newTxs, ...getData().transactions] });
    celebrate("¡Nómina repartida!");
    undoable(`Repartidos ${money(newTxs.reduce((a, t) => a + t.amount, 0))} entre ${newTxs.length} sobres.`, removeIds("transactions", newTxs.map((t) => t.id)));
    return true;
  }

  function applyRecurrentsNow() {
    if (recurrents.length === 0) return notify("No hay reglas recurrentes configuradas.", "error");
    const month = todayISO().slice(0, 7);
    const newTxs = [];
    for (const rec of recurrents) {
      // Se salta si ya se pasó este mes: por la automatización, a mano o por otra regla igual
      if (isRecurrentApplied(rec, [...transactions, ...newTxs], month)) continue;
      // Mismo id que usa la automatización: nunca se aplica dos veces el mismo mes
      newTxs.push({
        id: `rec-${rec.id}-${month}`, recurrentId: rec.id, concept: rec.concept, categoryId: rec.categoryId,
        sourceId: null, type: rec.type, amount: rec.amount, date: `${month}-${String(rec.day).padStart(2, "0")}`
      });
    }
    if (newTxs.length === 0) return notify("Los recurrentes de este mes ya están aplicados.", "error");
    addTxs(newTxs);
    undoable(`Se aplicaron ${newTxs.length} movimientos recurrentes.`, removeIds("transactions", newTxs.map((t) => t.id)));
  }

  // --- Exportar ---------------------------------------------------------------------
  function exportCSV() {
    const rows = transactions.filter((t) => !catById.get(t.categoryId)?.hasPin);
    if (rows.length === 0) return notify("No hay movimientos públicos para exportar.", "error");
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    // ";" y BOM para que Excel en español lo abra bien; Blob en vez de data: URI (fallaba con "#" y en móviles)
    const csv = "﻿Fecha;Concepto;Tipo;Importe;Sobre;Pagado por\n" + rows.map((t) =>
      [t.date, esc(t.concept), t.type, String(t.amount).replace(".", ","), esc(catById.get(t.categoryId)?.name || "Fondo General"), esc(t.paidBy || "")].join(";")
    ).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `presupuesto_${todayISO()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return {
    unlockedCats, isLocked, requirePin, toggleUnlock, userName,
    depositPayroll, bulkPayroll, saveSource, deleteSource,
    saveCategory, adjustCategory, moveCategory, shiftCategory, deleteCategory, clearCategory, transfer,
    canEditTx, saveTransaction, deleteTransaction, clearAllTransactions,
    saveRecurrent, deleteRecurrent, applyRecurrentsNow, pendingAllocations, distribute,
    exportCSV
  };
}
