import DashboardLayout from "./DashboardLayout.jsx";
import Correlation from "./pages/dashboard/Correlation.jsx";

export default function CorrelationPage({ lang, setLang, t, onLogout, onNavigate, onGoToTenantDashboard, onGoToAdminDashboard, dataScope, setDataScope }) {
  return (
    <DashboardLayout
      lang={lang}
      setLang={setLang}
      t={t}
      activeSidebarItem="korelasyon"
      onLogout={onLogout}
      onNavigate={onNavigate}
      onGoToTenantDashboard={onGoToTenantDashboard}
      onGoToAdminDashboard={onGoToAdminDashboard}
      dataScope={dataScope}
      setDataScope={setDataScope}
    >
      <Correlation t={t} dataScope={dataScope} />
    </DashboardLayout>
  );
}
