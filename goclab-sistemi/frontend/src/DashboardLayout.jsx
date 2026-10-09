import { useEffect, useState } from "react";
import {
  ClipboardList,
  LayoutDashboard,
  Settings,
  Bell,
  Moon,
  Sun,
  ChevronDown,
  User,
  LogOut,
  Home,
  Share2,
  BarChart3,
  TrendingUp,
  GitBranch,
  Grid3x3,
  Workflow,
} from "lucide-react";
import { LanguageSelector } from "./i18n.jsx";
import SurveyContent from "./pages/tenant/SurveyContent.jsx";
import Comparison from "./pages/dashboard/Comparison.jsx";

const API_BASE_URL = "http://localhost:5000";

const SIDEBAR_ITEMS = [
  { key: "genelBakis", icon: Home },
  { key: "kMeans", icon: Share2 },
  { key: "dagilim", icon: BarChart3 },
  { key: "korelasyon", icon: TrendingUp },
  { key: "siniflandirma", icon: GitBranch },
  { key: "isiHaritasi", icon: Grid3x3 },
  { key: "kararAgaci", icon: Workflow },
];

export default function DashboardLayout({ lang, setLang, t, activeSidebarItem = "genelBakis", onLogout, onNavigate, onGoToTenantDashboard, onGoToAdminDashboard, dataScope = "turkey", setDataScope, children }) {
  const d = t.dashboardLayoutPage;
  const [admin, setAdmin] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  // 'Anket' sekmesi: ayri bir sayfaya/route'a gitmeden, ayni Layout govdesi
  // icinde admin icerigiyle Anket icerigi arasinda gecis yapar.
  const [showSurvey, setShowSurvey] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("goclab_admin_session");
      if (stored) setAdmin(JSON.parse(stored));
    } catch {
      setAdmin(null);
    }
  }, []);

  const displayName = admin?.first_name
    ? `${admin.first_name} ${admin?.last_name ? admin.last_name.charAt(0).toUpperCase() + "." : ""}`.trim()
    : d.roleLabel;
  const avatarInitials = (admin?.first_name?.charAt(0) ?? "") + (admin?.last_name?.charAt(0) ?? "");

  const handleLogout = () => {
    try {
      const stored = localStorage.getItem("goclab_admin_session");
      const token = stored ? JSON.parse(stored)?.token : null;
      if (token) {
        fetch(`${API_BASE_URL}/api/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
      }
    } catch {}
    try {
      localStorage.removeItem("goclab_admin_session");
    } catch {}
    setIsDropdownOpen(false);
    onLogout?.();
  };

  return (
    <div className="min-h-screen w-full bg-gray-50">
      {/* ÜST NAVBAR */}
      <nav className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSurvey(true)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors ${
              showSurvey
                ? "border-b-2 border-blue-600 font-semibold text-blue-700"
                : "font-medium text-gray-500 hover:bg-gray-50"
            }`}
          >
            <ClipboardList size={18} />
            {d.navSurvey}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowSurvey(false);
              onGoToTenantDashboard?.();
            }}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            <LayoutDashboard size={18} />
            {d.navDashboard}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowSurvey(false);
              onGoToAdminDashboard?.();
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors ${
              showSurvey
                ? "font-medium text-gray-500 hover:bg-gray-50"
                : "border-b-2 border-blue-600 font-semibold text-blue-700"
            }`}
          >
            <Settings size={18} />
            {d.navResults}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDropdownOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-900 text-sm font-semibold text-white">
                {avatarInitials ? avatarInitials.toUpperCase() : <User size={16} />}
              </div>
              <div className="text-left leading-tight">
                <p className="text-sm font-semibold text-[#001A3F]">{displayName}</p>
                <p className="text-xs text-gray-500">{d.roleLabel}</p>
              </div>
              <ChevronDown size={16} className="text-gray-400" />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg bg-white py-2 shadow-lg z-50">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <LogOut size={16} />
                  {d.logoutLabel}
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-50"
          >
            <Bell size={18} />
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              2
            </span>
          </button>

          <LanguageSelector lang={lang} setLang={setLang} t={t} />

          <button
            type="button"
            onClick={() => setIsDark((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-50"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </nav>

      {/* ULKE/KARSILASTIRMA SECIMI: Anket aktifken gizlenir. */}
      {!showSurvey && (
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-white px-6 py-3">
          {[
            { key: "turkey", label: d.scopeToggle.turkey },
            { key: "moldova", label: d.scopeToggle.moldova },
            { key: "comparison", label: d.scopeToggle.comparison },
          ].map((scope) => (
            <button
              key={scope.key}
              type="button"
              onClick={() => {
                setDataScope(scope.key);
                // Karsilastirma'ya her girilende temiz bir varsayimla (Genel
                // Bakis gorunumuyle) baslanir - oncesinde TR/MD'de baska bir
                // sayfadaysa (orn. Dagilim) karisikligi onler.
                if (scope.key === "comparison") onNavigate?.("genelBakis");
              }}
              style={dataScope === scope.key ? { backgroundColor: "#33465C" } : undefined}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                dataScope === scope.key
                  ? "text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {scope.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex w-full">
        {/* SOL SIDEBAR: Anket aktifken gizlenir. */}
        {!showSurvey && (
          <aside className="hidden w-64 shrink-0 border-r border-gray-100 bg-white p-4 md:block">
            <nav className="flex flex-col gap-1">
              {SIDEBAR_ITEMS.filter(
                (item) => !(dataScope === "comparison" && (item.key === "isiHaritasi" || item.key === "kararAgaci"))
              ).map((item) => {
                const Icon = item.icon;
                const isActive = item.key === activeSidebarItem;
                // Karsilastirma modunda sadece "Genel Bakis", "K-Means" (burada
                // "Harita" olarak etiketlenir), "Dagilim" (burada "Iliskisel
                // Analiz" olarak etiketlenir), "Korelasyon" (burada "Yurt Disi
                // Baglantisi" olarak etiketlenir) ve "Siniflandirma" (burada
                // "Profil" olarak etiketlenir) gecerlidir - Karsilastirma
                // sayfasinin kendi icinde bes ayri gorunum olarak degisirler
                // (sayfadan CIKILMAZ, kaydirma YAPILMAZ). Diger ogeler icin
                // henuz bir Karsilastirma karsiligi olmadigindan, bunlara
                // tiklamak hala Turkiye gorunumune doner.
                const isComparisonValidItem =
                  dataScope === "comparison" &&
                  (item.key === "genelBakis" ||
                    item.key === "kMeans" ||
                    item.key === "dagilim" ||
                    item.key === "korelasyon" ||
                    item.key === "siniflandirma");
                const isMapShortcut = dataScope === "comparison" && item.key === "kMeans";
                const isRelationShortcut = dataScope === "comparison" && item.key === "dagilim";
                const isAbroadShortcut = dataScope === "comparison" && item.key === "korelasyon";
                const isProfileShortcut = dataScope === "comparison" && item.key === "siniflandirma";
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      if (isComparisonValidItem) {
                        onNavigate?.(item.key);
                        return;
                      }
                      // Karsilastirma modunda diger sidebar ogelerine tiklamak,
                      // o sayfanin Karsilastirma karsiligi olmadigi icin
                      // kullaniciyi otomatik olarak Turkiye gorunumune dondurur.
                      if (dataScope === "comparison") setDataScope?.("turkey");
                      onNavigate?.(item.key);
                    }}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <Icon size={18} />
                    {isMapShortcut
                      ? d.sidebar.harita
                      : isRelationShortcut
                      ? d.sidebar.iliskiselAnaliz
                      : isAbroadShortcut
                      ? d.sidebar.yurtDisiBaglantisi
                      : isProfileShortcut
                      ? d.sidebar.profil
                      : d.sidebar[item.key]}
                  </button>
                );
              })}
            </nav>
          </aside>
        )}

        {/* İÇERİK ALANI: Anket aktifken saf anket formu tam genislikte gosterilir. */}
        <main className={`min-h-[calc(100vh-57px)] flex-1 bg-gray-50 ${showSurvey ? "" : "p-6"}`}>
          {showSurvey ? (
            <div className="w-full max-w-full px-6 py-8 lg:px-12">
              <SurveyContent t={t} onFinish={() => setShowSurvey(false)} />
            </div>
          ) : dataScope === "comparison" ? (
            <Comparison t={t} activeSidebarItem={activeSidebarItem} />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
