import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";

import { useBudgetSync } from "./hooks/useBudgetSync.js";
import { useBudgetStats } from "./hooks/useBudgetStats.js";
import { useBudgetActions } from "./hooks/useBudgetActions.js";
import { usePushNotifications } from "./hooks/usePushNotifications.js";
import { readUserName, writeUserName } from "./lib/device.js";

import Toast from "./components/ui/Toast.jsx";
import Header from "./components/Header.jsx";
import Summary from "./components/Summary.jsx";
import UnicornLoader from "./components/unicorn/UnicornLoader.jsx";
import UnicornCelebration from "./components/unicorn/UnicornCelebration.jsx";

import PayrollSection from "./features/payroll/PayrollSection.jsx";
import { SourceForm, DepositForm, BulkPayrollForm } from "./features/payroll/PayrollForms.jsx";
import CategoriesSection from "./features/categories/CategoriesSection.jsx";
import CategoryDetail from "./features/categories/CategoryDetail.jsx";
import { CategoryForm, TransferForm } from "./features/categories/CategoryForms.jsx";
import TransactionsSection from "./features/transactions/TransactionsSection.jsx";
import TransactionForm from "./features/transactions/TransactionForm.jsx";
import RecurrentsSection, { RecurrentForm } from "./features/recurrents/RecurrentsSection.jsx";
import NameForm from "./features/settings/NameForm.jsx";

// Tiempo mínimo de la pantalla de carga, para que se vea al unicornio desplegar las alas
const MIN_LOADER_MS = 1400;

export default function App() {
  // --- Avisos -------------------------------------------------------------
  const [toast, setToast] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const notify = useCallback((message, type = "success") => setToast({ message, type, id: Date.now() }), []);
  const celebrate = useCallback((message) => setCelebration({ message, id: Date.now() }), []);
  const closeToast = useCallback(() => setToast(null), []);
  const endCelebration = useCallback(() => setCelebration(null), []);

  // --- Usuario de este móvil ---------------------------------------------------
  const [userName, setUserName] = useState(readUserName);

  // --- Datos -------------------------------------------------------------------
  const { data, loading, loadError, save } = useBudgetSync({ userName, onMessage: notify });
  const stats = useBudgetStats(data);
  const actions = useBudgetActions({ data, stats, save, notify, celebrate });
  const push = usePushNotifications(notify);

  // --- Navegación: una hoja (formulario) y/o el detalle de un sobre ---------------
  const [sheet, setSheet] = useState(null); // { type, n, ...props }
  const [detailId, setDetailId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const openSheet = useCallback((type, props = {}) => setSheet({ type, n: Date.now(), ...props }), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const [minTimePassed, setMinTimePassed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinTimePassed(true), MIN_LOADER_MS);
    return () => clearTimeout(t);
  }, []);

  // Bloquea el scroll de la página mientras hay una hoja o ventana abierta
  const overlayOpen = !!sheet || !!detailId;
  useEffect(() => {
    document.body.style.overflow = overlayOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [overlayOpen]);

  function saveUserName(name) {
    const n = name.trim().slice(0, 24);
    if (!n) return notify("Escribe tu nombre.", "error");
    writeUserName(n);
    setUserName(n);
    closeSheet();
    notify(`¡Hola, ${n}! 👋`);
  }

  function enableNotifications() {
    if (!userName) openSheet("name");
    push.enable();
  }

  if (loading || !minTimePassed) return <UnicornLoader />;

  if (loadError && !data) {
    return (
      <div className="loading-screen">
        ⚠️ No se han podido cargar los datos del servidor.
        <p className="load-error-hint">Suele ser un problema temporal de conexión. Tus datos guardados no se han borrado.</p>
        <button className="btn-primary" style={{ margin: "0 auto" }} onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    );
  }

  const { sources, categories, transactions, recurrents, fund, catById, categoryBalances, lastPayrollBySource, cycle } = stats;
  const detailCat = detailId ? catById.get(detailId) : null;
  const formProps = { actions, onClose: closeSheet };

  return (
    <div className="app-container">
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={closeToast} />}
      {celebration && <UnicornCelebration key={celebration.id} message={celebration.message} onDone={endCelebration} />}

      <Header
        cycle={cycle}
        userName={userName}
        showBell={push.permission !== "granted"}
        onEnableNotifications={enableNotifications}
        onEditName={() => openSheet("name")}
        onExport={actions.exportCSV}
      />

      <main className="main-content">
        <Summary fund={fund} cycle={cycle} hasSources={sources.length > 0} onRegisterPayroll={() => openSheet("bulkPayroll")} />
        <PayrollSection sources={sources} lastPayrollBySource={lastPayrollBySource} openSheet={openSheet} actions={actions} />
        <CategoriesSection
          categories={categories}
          categoryBalances={categoryBalances}
          actions={actions}
          openSheet={openSheet}
          onOpenDetail={setDetailId}
        />
        <RecurrentsSection recurrents={recurrents} transactions={transactions} catById={catById} actions={actions} openSheet={openSheet} />
        <TransactionsSection
          transactions={transactions}
          catById={catById}
          actions={actions}
          openSheet={openSheet}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
        />
      </main>

      {/* Botón flotante: apuntar un gasto en 2 toques */}
      {!overlayOpen && (
        <button className="fab" onClick={() => openSheet("tx", { preset: { type: "expense" } })} aria-label="Nuevo gasto">
          <Plus size={26} />
        </button>
      )}

      {detailCat && (
        <CategoryDetail
          category={detailCat}
          stats={categoryBalances[detailCat.id] || { balance: 0, income: 0, expense: 0 }}
          transactions={transactions}
          actions={actions}
          openSheet={openSheet}
          onFilterHistory={setCategoryFilter}
          onClose={() => setDetailId(null)}
        />
      )}

      {sheet?.type === "source" && <SourceForm key={sheet.n} {...formProps} source={sheet.source} />}
      {sheet?.type === "deposit" && <DepositForm key={sheet.n} {...formProps} source={sheet.source} />}
      {sheet?.type === "bulkPayroll" && <BulkPayrollForm key={sheet.n} {...formProps} sources={sources} />}
      {sheet?.type === "category" && <CategoryForm key={sheet.n} {...formProps} category={sheet.category} />}
      {sheet?.type === "transfer" && <TransferForm key={sheet.n} {...formProps} categories={categories} from={sheet.from} />}
      {sheet?.type === "tx" && <TransactionForm key={sheet.n} {...formProps} tx={sheet.tx} preset={sheet.preset} categories={categories} />}
      {sheet?.type === "recurrent" && <RecurrentForm key={sheet.n} {...formProps} categories={categories} />}
      {sheet?.type === "name" && <NameForm key={sheet.n} initial={userName} onSave={saveUserName} onClose={closeSheet} notify={notify} />}
    </div>
  );
}
