import { useState, useEffect } from "react";
import { uid, todayISO, money, parseAmount, hashPin, pinMatches, nextMonthKey } from "../lib/format.js";
import { isAllocation } from "../shared.js";

/**
 * Todas las operaciones que modifican el presupuesto. Cada una valida, guarda y avisa.
 * Las que vienen de un formulario devuelven true si se ha guardado (para cerrar el formulario).
 */
export function useBudgetActions({ data, stats, save, notify, celebrate }) {
  const { sources, categories, transactions, recurrents, fund, catById, categoryBalances } = stats;

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
  function requirePin(cat, message, always = false) {
    if (!cat?.hasPin || (!always && unlockedCats[cat.id])) return true;
    const entered = prompt(message);
    if (entered === null) return false;
    if (pinMatches(cat, entered)) return true;
    notify("Contraseña incorrecta.", "error");
    return false;
  }

  function toggleUnlock(cat) {
    if (unlockedCats[cat.id]) return setUnlockedCats((p) => ({ ...p, [cat.id]: false }));
    if (requirePin(cat, `Contraseña para "${cat.name}":`, true)) {
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

  function depositPayroll(src, amountText) {
    const amt = parseAmount(amountText);
    if (isNaN(amt) || amt <= 0) return fail("Introduce un importe de nómina válido.");
    addTxs([payrollTx(src, amt)]);
    notify(`Se han añadido ${money(amt)} al Fondo General.`);
    return true;
  }

  function bulkPayroll(amounts) {
    const newTxs = sources
      .map((src) => ({ src, amt: parseAmount(amounts[src.id]) }))
      .filter(({ amt }) => !isNaN(amt) && amt > 0)
      .map(({ src, amt }) => payrollTx(src, amt));
    if (newTxs.length === 0) return fail("Introduce al menos un importe válido.");
    addTxs(newTxs);
    notify(`Se han añadido ${money(newTxs.reduce((a, t) => a + t.amount, 0))} al Fondo General.`);
    celebrate("¡Nóminas registradas!");
    return true;
  }

  function saveSource({ id, name, amount, icon, color }) {
    const n = name.trim();
    const amt = parseAmount(amount);
    if (!n || isNaN(amt) || amt < 0) return fail("Introduce un nombre e importe de referencia válidos.");
    const fields = { name: n, amount: amt, icon, color };
    save({
      ...data,
      sources: id ? sources.map((s) => (s.id === id ? { ...s, ...fields } : s)) : [...sources, { id: uid(), ...fields }]
    });
    notify(id ? "Fuente de nómina actualizada." : "Fuente de nómina añadida.");
    return true;
  }

  function deleteSource(id) {
    if (!window.confirm("¿Eliminar esta fuente de nómina?")) return;
    save({ ...data, sources: sources.filter((s) => s.id !== id) });
    notify("Fuente de nómina eliminada.");
  }

  // --- Sobres ------------------------------------------------------------------
  function saveCategory({ id, name, icon, color, hasPin, pin, goal }) {
    const n = name.trim();
    if (!n) return fail("Pon un nombre al sobre.");
    if (hasPin && !pin.trim()) return fail("Asigna un PIN al sobre.");
    const goalParsed = parseAmount(goal);
    const fields = {
      name: n, icon, color, hasPin,
      pinHash: hasPin ? hashPin(pin) : "",
      pin: hasPin ? pin.trim() : "",
      targetGoal: isNaN(goalParsed) ? 0 : goalParsed
    };
    save({
      ...data,
      categories: id
        ? categories.map((c) => (c.id === id ? { ...c, ...fields } : c))
        : [...categories, { id: uid(), initialBalance: 0, ...fields }]
    });
    celebrate(id ? "¡Sobre guardado!" : "¡Sobre creado!");
    return true;
  }

  function adjustCategory(catId, amountText) {
    const cat = catById.get(catId);
    const amt = parseAmount(amountText);
    if (!cat || !requirePin(cat, `PIN requerido para ajustar "${cat.name}":`)) return false;
    if (isNaN(amt) || amt === 0) return fail("Introduce una cantidad válida (positiva o negativa).");
    addTxs([{
      id: uid(), concept: `Ajuste manual de saldo: ${cat.name}`, categoryId: catId, sourceId: null,
      type: amt > 0 ? "adjustment_income" : "adjustment_expense", amount: Math.abs(amt), date: todayISO()
    }]);
    notify(`Saldo de "${cat.name}" ajustado en ${amt > 0 ? "+" : ""}${money(amt)}. No afecta al Fondo General.`);
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

  // Mover un sobre una posición arriba (-1) o abajo (+1): reordenar en el móvil sin arrastrar
  function shiftCategory(id, dir) {
    const i = categories.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= categories.length) return;
    moveCategory(id, categories[j].id);
  }

  function deleteCategory(id) {
    const cat = catById.get(id);
    if (!cat || !requirePin(cat, `Contraseña para eliminar "${cat.name}":`, true)) return false;
    if (!window.confirm(`¿Eliminar el sobre "${cat.name}"? Se borrará también su historial de movimientos. No se puede deshacer.`)) return false;
    save({
      ...data,
      categories: categories.filter((c) => c.id !== id),
      transactions: transactions.filter((t) => t.categoryId !== id)
    });
    notify("Sobre eliminado.");
    return true;
  }

  function clearCategory(id) {
    const cat = catById.get(id);
    if (!cat || !requirePin(cat, `PIN para vaciar "${cat.name}":`, true)) return;
    if (!window.confirm(`¿Vaciar el historial de "${cat.name}"?`)) return;
    save({ ...data, transactions: transactions.filter((t) => t.categoryId !== id) });
    notify("Historial del sobre vaciado.");
  }

  function clearAllTransactions() {
    if (!window.confirm("⚠️ ¿Vaciar todo el historial de movimientos?")) return;
    save({ ...data, transactions: [] });
    notify("Historial vaciado.");
  }

  function transfer({ from, to, amount }) {
    const amt = parseAmount(amount);
    if (!from || !to || isNaN(amt) || amt <= 0) return fail("Completa los datos del traspaso.");
    if (from === to) return fail("Elige dos sobres diferentes.");
    const fromCat = catById.get(from), toCat = catById.get(to);
    if (!requirePin(fromCat, `PIN para sacar dinero de "${fromCat.name}":`)) return false;
    if (!requirePin(toCat, `PIN para meter dinero en "${toCat.name}":`)) return false;
    if ((categoryBalances[from]?.balance || 0) < amt) return fail(`Saldo insuficiente en "${fromCat.name}".`);
    const date = todayISO();
    addTxs([
      { id: uid(), concept: `Traspaso ➔ ${toCat.name}`, categoryId: from, sourceId: null, type: "transfer_expense", amount: amt, date },
      { id: uid(), concept: `Traspaso desde ${fromCat.name}`, categoryId: to, sourceId: null, type: "transfer_income", amount: amt, date }
    ]);
    notify(`Traspaso de ${money(amt)} completado.`);
    return true;
  }

  // --- Movimientos ---------------------------------------------------------------
  const canEditTx = (t) => requirePin(catById.get(t.categoryId), `PIN requerido para modificar este movimiento:`);

  function saveTransaction({ id, concept, categoryId, type, amount, date }) {
    const amt = parseAmount(amount);
    if (!concept.trim() || isNaN(amt) || amt <= 0 || !categoryId) return fail("Completa todos los campos correctamente.");
    const cat = catById.get(categoryId);
    if (!requirePin(cat, `PIN requerido para "${cat?.name}":`)) return false;

    if (type === "income") {
      // Lo asignado en ciclos anteriores (settled) ya no cuenta en el Fondo General de este ciclo
      const editing = id ? transactions.find((t) => t.id === id) : null;
      const previous = editing && isAllocation(editing) && !editing.settled ? editing.amount || 0 : 0;
      if (fund.available + previous < amt) return fail("Saldo insuficiente en el Fondo General para asignar.");
    }

    const fields = { concept: concept.trim(), categoryId, type, amount: amt, date: date || todayISO() };
    if (id) {
      save({ ...data, transactions: transactions.map((t) => (t.id === id ? { ...t, ...fields } : t)) });
      notify("Movimiento actualizado.");
    } else {
      addTxs([{ id: uid(), sourceId: null, ...fields }]);
      if (type === "income") celebrate(`¡${money(amt)} al sobre ${cat?.name || ""}!`);
      else notify("Movimiento registrado.");
    }
    return true;
  }

  function deleteTransaction(id) {
    const t = transactions.find((x) => x.id === id);
    if (!t || !canEditTx(t)) return;
    if (!window.confirm(`¿Eliminar "${t.concept}"?`)) return;
    save({ ...data, transactions: transactions.filter((x) => x.id !== id) });
    notify("Movimiento eliminado.");
  }

  // --- Recurrentes -----------------------------------------------------------------
  function addRecurrent({ concept, categoryId, type, amount, day }) {
    const amt = parseAmount(amount);
    const d = parseInt(day, 10);
    if (!concept.trim() || isNaN(amt) || amt <= 0 || !categoryId || isNaN(d) || d < 1 || d > 31) {
      return fail("Introduce datos válidos para la regla recurrente.");
    }
    const today = todayISO();
    // Si el día de este mes ya pasó, empieza a aplicarse el mes que viene
    const startMonth = d >= Number(today.slice(8, 10)) ? today.slice(0, 7) : nextMonthKey(today);
    save({ ...data, recurrents: [...recurrents, { id: uid(), concept: concept.trim(), categoryId, type, amount: amt, day: d, startMonth }] });
    notify(`Regla programada: se aplicará sola el día ${d} de cada mes.`);
    return true;
  }

  function deleteRecurrent(id) {
    if (!window.confirm("¿Eliminar esta regla recurrente?")) return;
    save({ ...data, recurrents: recurrents.filter((r) => r.id !== id) });
    notify("Regla recurrente eliminada.");
  }

  function applyRecurrentsNow() {
    if (recurrents.length === 0) return notify("No hay reglas recurrentes configuradas.", "error");
    const month = todayISO().slice(0, 7);
    const newTxs = recurrents
      .filter((rec) => !transactions.some((t) => t.recurrentId === rec.id && (t.date || "").startsWith(month)))
      .map((rec) => ({
        // Mismo id que usa la automatización: nunca se aplica dos veces el mismo mes
        id: `rec-${rec.id}-${month}`, recurrentId: rec.id, concept: rec.concept, categoryId: rec.categoryId,
        sourceId: null, type: rec.type, amount: rec.amount, date: `${month}-${String(rec.day).padStart(2, "0")}`
      }));
    if (newTxs.length === 0) return notify("Los recurrentes de este mes ya están aplicados.", "error");
    addTxs(newTxs);
    notify(`Se aplicaron ${newTxs.length} movimientos recurrentes.`);
  }

  // --- Exportar ---------------------------------------------------------------------
  function exportCSV() {
    const rows = transactions.filter((t) => !catById.get(t.categoryId)?.hasPin);
    if (rows.length === 0) return notify("No hay movimientos públicos para exportar.", "error");
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    // ";" y BOM para que Excel en español lo abra bien; Blob en vez de data: URI (fallaba con "#" y en móviles)
    const csv = "﻿Fecha;Concepto;Tipo;Importe;Sobre\n" + rows.map((t) =>
      [t.date, esc(t.concept), t.type, String(t.amount).replace(".", ","), esc(catById.get(t.categoryId)?.name || "Fondo General")].join(";")
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
    unlockedCats, isLocked, requirePin, toggleUnlock,
    depositPayroll, bulkPayroll, saveSource, deleteSource,
    saveCategory, adjustCategory, moveCategory, shiftCategory, deleteCategory, clearCategory, transfer,
    canEditTx, saveTransaction, deleteTransaction, clearAllTransactions,
    addRecurrent, deleteRecurrent, applyRecurrentsNow,
    exportCSV
  };
}
