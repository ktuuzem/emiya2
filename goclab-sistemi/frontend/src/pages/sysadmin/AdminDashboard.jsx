import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Building2,
  ShieldCheck,
  Calendar,
  ChevronDown,
  Search,
  Eye,
  ArrowUp,
  LogIn,
  LogOut,
  KeyRound,
  ShieldAlert,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const API_BASE_URL = "http://localhost:5000";

const ACTION_TYPE_ICONS = {
  "Kullanıcı Girişi": { icon: LogIn, className: "text-blue-600 bg-blue-50" },
  "Kullanıcı Çıkışı": { icon: LogOut, className: "text-blue-600 bg-blue-50" },
  "Şifre Değiştirme": { icon: KeyRound, className: "text-indigo-600 bg-indigo-50" },
  "Yetki Onayı": { icon: ShieldCheck, className: "text-emerald-600 bg-emerald-50" },
  "Yetkisiz Erişim": { icon: ShieldAlert, className: "text-red-600 bg-red-50" },
};

const INSTITUTION_STATUS_BADGE = {
  "Aktif": "bg-emerald-50 text-emerald-600",
  "Beklemede": "bg-orange-50 text-orange-600",
  "Reddedildi": "bg-red-50 text-red-600",
};

const INSTITUTION_STATUS_LABEL_KEYS = {
  "Aktif": "statusActive",
  "Beklemede": "statusPending",
  "Reddedildi": "statusRejected",
};

const REQUEST_STATUS_BADGE = {
  "Onay Bekliyor": "bg-orange-50 text-orange-600",
  "Onaylandi": "bg-emerald-50 text-emerald-600",
  "Reddedildi": "bg-red-50 text-red-600",
};

function formatDateTime(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function getAdminToken() {
  try {
    const stored = localStorage.getItem("goclab_admin_session");
    return stored ? JSON.parse(stored)?.token : null;
  } catch {
    return null;
  }
}

function KpiCard({ icon: Icon, iconBg, label, value, trendPct, trendSuffix }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="text-2xl font-extrabold text-[#001A3F]">{value.toLocaleString("tr-TR")}</p>
        <p className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
          <ArrowUp size={12} />%{trendPct.toLocaleString("tr-TR")} {trendSuffix}
        </p>
      </div>
    </div>
  );
}

export default function AdminDashboard({ t, onNavigate }) {
  const ad = t.adminDashboardPage;
  const im = t.institutionManagementPage;
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(t.langCode || "tr-TR", { day: "2-digit", month: "long", year: "numeric", weekday: "long" }).format(
        new Date()
      ),
    [t.langCode]
  );

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [institutionSearch, setInstitutionSearch] = useState("");
  const [requestSearch, setRequestSearch] = useState("");

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const token = getAdminToken();
        const res = await fetch(`${API_BASE_URL}/api/admin/dashboard/summary`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setErrorMessage(json.message || ad.loadError);
          return;
        }
        setData(json);
      } catch {
        setErrorMessage(ad.networkError);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredInstitutions = useMemo(() => {
    const rows = data?.recentInstitutions ?? [];
    const query = institutionSearch.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => `${row.name} ${row.contact_person ?? ""}`.toLowerCase().includes(query));
  }, [data, institutionSearch]);

  const filteredRequests = useMemo(() => {
    const rows = data?.recentPermissionRequests ?? [];
    const query = requestSearch.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => `${row.institution_name} ${row.full_name}`.toLowerCase().includes(query));
  }, [data, requestSearch]);

  if (loading) {
    return <p className="py-10 text-center text-sm font-medium text-gray-400">{ad.loadingLabel}</p>;
  }

  if (errorMessage) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-medium text-red-600">{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* BAŞLIK */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#001A3F]">{ad.welcomeTitle}</h1>
          <p className="mt-1 text-sm text-gray-400">{ad.welcomeSubtitle}</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600">
          <Calendar size={16} className="text-gray-400" />
          {todayLabel}
          <ChevronDown size={14} className="text-gray-400" />
        </div>
      </div>

      {/* KPI KARTLARI */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          icon={Users}
          iconBg="bg-blue-600"
          label={ad.totalUsersLabel}
          value={data.kpi.totalUsers}
          trendPct={data.kpi.totalUsersTrendPct}
          trendSuffix={ad.trendSuffix}
        />
        <KpiCard
          icon={Building2}
          iconBg="bg-teal-600"
          label={ad.totalInstitutionsLabel}
          value={data.kpi.totalInstitutions}
          trendPct={data.kpi.totalInstitutionsTrendPct}
          trendSuffix={ad.trendSuffix}
        />
        <KpiCard
          icon={ShieldCheck}
          iconBg="bg-emerald-600"
          label={ad.activePermissionGroupsLabel}
          value={data.kpi.activePermissionGroups}
          trendPct={data.kpi.activePermissionGroupsTrendPct}
          trendSuffix={ad.trendSuffix}
        />
      </div>

      {/* ORTA BÖLÜM: LOGLAR + AKTİVİTE GRAFİĞİ */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="rounded-2xl bg-white p-5 shadow-sm xl:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#001A3F]">
              {ad.systemLogsTitle}
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-100 px-1.5 text-xs font-bold text-blue-700">
                {data.recentLogs.length}
              </span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigate?.("logIzleme")}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              {ad.viewAllLabel}
            </button>
          </div>

          {data.recentLogs.length === 0 ? (
            <p className="py-8 text-center text-sm font-medium text-gray-400">{ad.noLogsLabel}</p>
          ) : (
            <div className="flex flex-col gap-1">
              {data.recentLogs.map((log) => {
                const meta = ACTION_TYPE_ICONS[log.action_type] || { icon: LogIn, className: "text-gray-500 bg-gray-100" };
                const Icon = meta.icon;
                const isSuccess = log.status === "Başarılı";
                return (
                  <div key={log.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-gray-50">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.className}`}>
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#001A3F]">{ad.actionTypeLabels[log.action_type] || log.action_type}</p>
                      <p className="truncate text-xs text-gray-400">
                        {log.user_name || "-"} · {formatDateTime(log.created_at)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
                        isSuccess ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                      }`}
                    >
                      {ad.statusLabels[log.status] || log.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm xl:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#001A3F]">{ad.activityChartTitle}</h2>
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500">
              {ad.last7DaysLabel}
              <ChevronDown size={12} />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.activityChart} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip />
              <Legend
                formatter={(value) => (value === "users" ? ad.usersSeriesLabel : ad.dataOpsSeriesLabel)}
                wrapperStyle={{ fontSize: 12 }}
              />
              <Line type="monotone" dataKey="users" name="users" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="dataOps" name="dataOps" stroke="#16A34A" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ALT BÖLÜM: KURUMLAR + YETKİ TALEPLERİ */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#001A3F]">
              {ad.institutionsFormsTitle}
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-100 px-1.5 text-xs font-bold text-blue-700">
                {data.recentInstitutions.length}
              </span>
            </h2>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={institutionSearch}
                onChange={(e) => setInstitutionSearch(e.target.value)}
                placeholder={ad.institutionsSearchPlaceholder}
                className="w-64 max-w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-xs text-gray-700 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          {filteredInstitutions.length === 0 ? (
            <p className="py-8 text-center text-sm font-medium text-gray-400">{ad.noInstitutionsLabel}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-bold uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3">{ad.columnInstitutionName}</th>
                    <th className="py-2 pr-3">{ad.columnAuthorizedName}</th>
                    <th className="py-2 pr-3">{ad.columnStatus}</th>
                    <th className="py-2 pr-3">{ad.columnAction}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInstitutions.map((inst) => (
                    <tr key={inst.id} className="border-b border-gray-50">
                      <td className="py-2.5 pr-3 flex items-center gap-2 font-semibold text-[#001A3F]">
                        <Building2 size={14} className="shrink-0 text-blue-500" />
                        {inst.name}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-600">{inst.contact_person || "-"}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${INSTITUTION_STATUS_BADGE[inst.status] || "bg-gray-100 text-gray-600"}`}>
                          {im[INSTITUTION_STATUS_LABEL_KEYS[inst.status]] || inst.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <button
                          type="button"
                          onClick={() => onNavigate?.("kurumYonetimi")}
                          className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          <Eye size={13} />
                          {ad.viewDetailLabel}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-gray-400">{ad.totalRecordsTemplate.replace("{count}", filteredInstitutions.length)}</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#001A3F]">
              {ad.permissionRequestsTitle}
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-100 px-1.5 text-xs font-bold text-blue-700">
                {data.recentPermissionRequests.length}
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={requestSearch}
                  onChange={(e) => setRequestSearch(e.target.value)}
                  placeholder={ad.requestsSearchPlaceholder}
                  className="w-56 max-w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-xs text-gray-700 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.("yetkiYonetimi")}
                className="whitespace-nowrap text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                {ad.viewAllLabel}
              </button>
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <p className="py-8 text-center text-sm font-medium text-gray-400">{ad.noRequestsLabel}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-bold uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3">{ad.columnFullName}</th>
                    <th className="py-2 pr-3">{ad.columnInstitution}</th>
                    <th className="py-2 pr-3">{ad.columnRegisteredAt}</th>
                    <th className="py-2 pr-3">{ad.columnStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((req) => (
                    <tr key={req.id} className="border-b border-gray-50">
                      <td className="py-2.5 pr-3 font-semibold text-[#001A3F]">{req.full_name}</td>
                      <td className="py-2.5 pr-3 text-gray-600">{req.institution_name}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap text-gray-500">{formatDateTime(req.created_at)}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${REQUEST_STATUS_BADGE[req.status] || "bg-gray-100 text-gray-600"}`}>
                          {ad.statusLabels[req.status] || req.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-gray-400">{ad.totalRecordsTemplate.replace("{count}", filteredRequests.length)}</p>
        </div>
      </div>
    </div>
  );
}
