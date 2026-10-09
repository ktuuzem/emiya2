import DashboardLayout from "./DashboardLayout.jsx";
import RegionalHeatmap from "./pages/dashboard/RegionalHeatmap.jsx";

export default function RegionalHeatmapPage({ lang, setLang, t, onLogout, onNavigate, onGoToTenantDashboard, onGoToAdminDashboard, dataScope, setDataScope }) {
  return (
    <DashboardLayout
      lang={lang}
      setLang={setLang}
      t={t}
      activeSidebarItem="isiHaritasi"
      onLogout={onLogout}
      onNavigate={onNavigate}
      onGoToTenantDashboard={onGoToTenantDashboard}
      onGoToAdminDashboard={onGoToAdminDashboard}
      dataScope={dataScope}
      setDataScope={setDataScope}
    >
      <RegionalHeatmap t={t} dataScope={dataScope} />
    </DashboardLayout>
  );
}
