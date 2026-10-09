import { useEffect, useRef, useState } from "react";
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
  LayoutGrid,
  Users,
  BarChart3,
  Map,
  Globe,
  Shield,
  Database,
} from "lucide-react";
import { LanguageSelector } from "./i18n.jsx";
import PermissionRequestModal from "./PermissionRequestModal.jsx";

const API_BASE_URL = "http://localhost:5000";

const SIDEBAR_ITEMS = [
  { key: "genelBakis", icon: LayoutGrid },
  { key: "katilimciAnalizi", icon: Users },
  { key: "kumeProfilleri", icon: Settings },
  { key: "demografikAnaliz", icon: BarChart3 },
  { key: "bolgeselHarita", icon: Map },
  { key: "kureselHarita", icon: Globe },
  { key: "bireyselIzleme", icon: User },
];

export default function TenantLayout({ lang, setLang, t, activeSidebarItem = "genelBakis", activeNavTab = "dashboard", isGlobalDataApproved = false, onLogout, onNavigate, onGoToSurvey, onGoToTenantDashboard, onGoToAdminDashboard, children }) {
  const d = t.tenantLayoutPage;
  const [admin, setAdmin] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("goclab_admin_session");
      if (stored) setAdmin(JSON.parse(stored));
    } catch {
      setAdmin(null);
    }
  }, []);

  // Menu acikken sayfanin bos bir yerine tiklaninca (disari tiklama) menuyu kapatir.
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

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
            onClick={onGoToSurvey}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors ${
              activeNavTab === "survey"
                ? "border-b-2 border-blue-600 font-semibold text-blue-700"
                : "font-medium text-gray-500 hover:bg-gray-50"
            }`}
          >
            <ClipboardList size={18} />
            {d.navSurvey}
          </button>
          <button
            type="button"
            onClick={onGoToTenantDashboard}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors ${
              activeNavTab === "dashboard"
                ? "border-b-2 border-blue-600 font-semibold text-blue-700"
                : "font-medium text-gray-500 hover:bg-gray-50"
            }`}
          >
            <LayoutDashboard size={18} />
            {d.navDashboard}
          </button>
          <button
            type="button"
            onClick={onGoToAdminDashboard}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            <Settings size={18} />
            {d.navResults}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative" ref={dropdownRef}>
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
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-gray-100 bg-white p-1.5 shadow-lg">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <User size={16} className="text-gray-500" />
                  {d.accountLabel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setIsPermissionModalOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Shield size={16} className="text-gray-500" />
                  {d.permissionRequestLabel}
                </button>
                <div className="my-1.5 border-t border-gray-100" />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-md border border-red-100 bg-red-50/60 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
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

      <div className="flex w-full">
        {/* SOL SIDEBAR: sadece 'Dashboard' (Genel Bakış) sekmesi aktifken gosterilir. */}
        {activeNavTab === "dashboard" && (
          <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-64 shrink-0 self-start overflow-y-auto border-r border-gray-100 bg-white p-4 md:block">
            <p className="mb-2 px-4 text-xs font-bold uppercase tracking-wide text-gray-400">{d.sidebarHeading}</p>
            <nav className="flex flex-col gap-1">
              {[
                ...SIDEBAR_ITEMS,
                ...(isGlobalDataApproved ? [{ key: "genelVeriler", icon: Database }] : []),
              ].map((item) => {
                const Icon = item.icon;
                const isActive = item.key === activeSidebarItem;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onNavigate?.(item.key)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <Icon size={18} />
                    {d.sidebar[item.key]}
                  </button>
                );
              })}
            </nav>
          </aside>
        )}

        {/* İÇERİK ALANI: sidebar gizliyken (Anket) icerik ferah ve genis bir alanda ortalanir. */}
        <main className={`min-h-[calc(100vh-57px)] flex-1 bg-gray-50 ${activeNavTab === "dashboard" ? "p-6" : ""}`}>
          {activeNavTab === "dashboard" ? (
            children
          ) : (
            <div className="w-full max-w-full px-6 py-8 lg:px-12">{children}</div>
          )}
        </main>
      </div>

      {isPermissionModalOpen && <PermissionRequestModal onClose={() => setIsPermissionModalOpen(false)} />}
    </div>
  );
}
