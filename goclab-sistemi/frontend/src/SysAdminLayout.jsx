import { useEffect, useState } from "react";
import {
  Menu,
  Home,
  Shield,
  Building2,
  FileText,
  ArrowLeft,
  Bell,
  Moon,
  Sun,
  ChevronDown,
  User,
  LogOut,
} from "lucide-react";
import { LanguageSelector } from "./i18n.jsx";

const API_BASE_URL = "http://localhost:5000";

const SIDEBAR_SECTIONS = [
  { headingKey: "mainMenuHeading", items: [{ key: "kontrolPaneli", icon: Home }] },
  {
    headingKey: "managementHeading",
    items: [
      { key: "yetkiYonetimi", icon: Shield },
      { key: "kurumYonetimi", icon: Building2 },
    ],
  },
  { headingKey: "systemHeading", items: [{ key: "logIzleme", icon: FileText }] },
];

export default function SysAdminLayout({ lang, setLang, t, activeSidebarItem = "kurumYonetimi", onLogout, onNavigate, onBackToLogin, children }) {
  const d = t.sysAdminLayoutPage;
  const [admin, setAdmin] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

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
    <div className="flex min-h-screen w-full bg-gray-50">
      {/* SOL SIDEBAR */}
      <aside className="flex w-64 shrink-0 flex-col bg-[#0B1638]">
        <div className="flex items-center px-5 py-5">
          <button type="button" className="text-white/70 hover:text-white">
            <Menu size={22} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
          {SIDEBAR_SECTIONS.map((section) => (
            <div key={section.headingKey}>
              <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
                {d[section.headingKey]}
              </p>
              <div className="flex flex-col gap-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.key === activeSidebarItem;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onNavigate?.(item.key)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                        isActive ? "bg-blue-600 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon size={18} />
                      {d.sidebar[item.key]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <button
            type="button"
            onClick={onBackToLogin}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft size={18} />
            {d.backToMenu}
          </button>
        </div>
      </aside>

      {/* SAĞ TARAF */}
      <div className="flex min-h-screen flex-1 flex-col">
        {/* ÜST BAR */}
        <nav className="flex items-center justify-end gap-3 border-b border-gray-100 bg-white px-6 py-3">
          <LanguageSelector lang={lang} setLang={setLang} t={t} />

          <button
            type="button"
            onClick={() => setIsDark((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            type="button"
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            <Bell size={18} />
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              3
            </span>
          </button>

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
        </nav>

        {/* İÇERİK ALANI */}
        <main className="min-h-[calc(100vh-57px)] flex-1 bg-gray-50 p-6">{children}</main>
      </div>
    </div>
  );
}
