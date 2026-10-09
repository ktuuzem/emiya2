import DashboardLayout from "./DashboardLayout.jsx";
import Distribution from "./pages/dashboard/Distribution.jsx";

export default function DistributionPage({ lang, setLang, t, onLogout, onNavigate, onGoToTenantDashboard, onGoToAdminDashboard, dataScope, setDataScope }) {
  return (
    <DashboardLayout
      lang={lang}
      setLang={setLang}
      t={t}
      activeSidebarItem="dagilim"
      onLogout={onLogout}
      onNavigate={onNavigate}
      onGoToTenantDashboard={onGoToTenantDashboard}
      onGoToAdminDashboard={onGoToAdminDashboard}
      dataScope={dataScope}
      setDataScope={setDataScope}
    >
      <Distribution t={t} dataScope={dataScope} />
    </DashboardLayout>
  );
}
