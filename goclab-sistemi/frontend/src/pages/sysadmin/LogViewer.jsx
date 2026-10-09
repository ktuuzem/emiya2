import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  ShieldCheck,
  XCircle,
  Search,
  Calendar,
  Download,
  Filter,
  RotateCcw,
  LogIn,
  LogOut,
  KeyRound,
  ShieldAlert,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

const API_BASE_URL = "http://localhost:5000";

const ACTION_TYPE_OPTIONS = ["Kullanıcı Girişi", "Kullanıcı Çıkışı", "Şifre Değiştirme", "Yetki Onayı", "Yetkisiz Erişim"];
const STATUS_OPTIONS = ["Başarılı", "Başarısız"];

const ACTION_TYPE_ICONS = {
  "Kullanıcı Girişi": { icon: LogIn, className: "text-blue-600" },
  "Kullanıcı Çıkışı": { icon: LogOut, className: "text-blue-600" },
  "Şifre Değiştirme": { icon: KeyRound, className: "text-indigo-600" },
  "Yetki Onayı": { icon: ShieldCheck, className: "text-emerald-600" },
  "Yetkisiz Erişim": { icon: ShieldAlert, className: "text-red-600" },
};

const EMPTY_FILTERS = { dateFrom: "", dateTo: "", user: "", actionType: "", status: "", ip: "" };

function formatDateTime(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatTime(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function getAdminToken() {
  try {
    const stored = localStorage.getItem("goclab_admin_session");
    return stored ? JSON.parse(stored)?.token : null;
  } catch {
    return null;
  }
}

function downloadCsv(rows, lv) {
  const header = [lv.columnDateTime, lv.columnFullName, lv.columnActionType, lv.columnLoginTime, lv.columnLogoutTime, lv.columnIpAddress, lv.columnStatus];
  const lines = rows.map((row) =>
    [
      formatDateTime(row.created_at),
      row.user_name ?? "",
      lv.actionTypeOptions[row.action_type] || row.action_type || "",
      formatTime(row.login_time),
      formatTime(row.logout_time),
      row.ip_address ?? "",
      lv.statusOptions[row.status] || row.status || "",
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csvContent = [header.join(","), ...lines].join("\n");
  const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `log-kayitlari-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function LogViewer({ t }) {
  const lv = t.logViewerPage;

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const token = getAdminToken();
      const params = new URLSearchParams();
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`${API_BASE_URL}/api/admin/logs?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.message || lv.loadError);
        return;
      }
      setLogs(data.logs || []);
      setSummary(data.summary || null);
      setTotalCount(data.totalCount || 0);
    } catch {
      setErrorMessage(lv.networkError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters, page, pageSize]);

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const handleApplyFilters = () => {
    setPage(1);
    setAppliedFilters(filters);
  };

  const handleClearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
    setAppliedFilters(EMPTY_FILTERS);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  const pageNumbers = useMemo(() => {
    const pages = [1];
    if (page > 3) pages.push("...");
    for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) pages.push(p);
    if (page < totalPages - 2) pages.push("...");
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  }, [page, totalPages]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#001A3F]">{lv.title}</h1>
        <p className="mt-1 text-sm text-gray-400">
          {lv.breadcrumbHome} <span className="mx-1">›</span> {lv.title}
        </p>
      </div>

      {/* KPI KARTLARI */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600">
            <FileText size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">{lv.totalLogsLabel}</p>
            <p className="text-2xl font-extrabold text-[#001A3F]">{summary ? summary.totalLogs.toLocaleString("tr-TR") : "-"}</p>
            <p className="text-xs text-gray-400">{lv.allTimeLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">{lv.successfulOperationsLabel}</p>
            <p className="text-2xl font-extrabold text-[#001A3F]">{summary ? summary.successCount.toLocaleString("tr-TR") : "-"}</p>
            <p className="text-xs text-gray-400">%{summary ? summary.successRate.toLocaleString("tr-TR") : "-"}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-600">
            <XCircle size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">{lv.errorsLabel}</p>
            <p className="text-2xl font-extrabold text-[#001A3F]">{summary ? summary.errorCount.toLocaleString("tr-TR") : "-"}</p>
            <p className="text-xs text-gray-400">%{summary ? summary.errorRate.toLocaleString("tr-TR") : "-"}</p>
          </div>
        </div>
      </div>

      {/* FİLTRELEME ÇUBUĞU */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">{lv.dateRangeLabel}</label>
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-2">
              <Calendar size={14} className="shrink-0 text-gray-400" />
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => updateFilter("dateFrom", e.target.value)}
                className="w-full min-w-0 text-xs text-gray-700 focus:outline-none"
              />
              <span className="text-gray-300">-</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilter("dateTo", e.target.value)}
                className="w-full min-w-0 text-xs text-gray-700 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">{lv.userLabel}</label>
            <input
              type="text"
              value={filters.user}
              onChange={(e) => updateFilter("user", e.target.value)}
              placeholder={lv.userSearchPlaceholder}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">{lv.actionTypeLabel}</label>
            <div className="relative">
              <select
                value={filters.actionType}
                onChange={(e) => updateFilter("actionType", e.target.value)}
                className="w-full appearance-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="">{lv.allOptionLabel}</option>
                {ACTION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {lv.actionTypeOptions[opt] || opt}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">{lv.statusLabel}</label>
            <div className="relative">
              <select
                value={filters.status}
                onChange={(e) => updateFilter("status", e.target.value)}
                className="w-full appearance-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="">{lv.allOptionLabel}</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {lv.statusOptions[opt] || opt}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">{lv.ipAddressLabel}</label>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filters.ip}
                onChange={(e) => updateFilter("ip", e.target.value)}
                placeholder={lv.ipSearchPlaceholder}
                className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm text-gray-700 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => downloadCsv(logs, lv)}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={15} />
            {lv.exportLabel}
          </button>
          <button
            type="button"
            onClick={handleClearFilters}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            <RotateCcw size={15} />
            {lv.clearLabel}
          </button>
          <button
            type="button"
            onClick={handleApplyFilters}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Filter size={15} />
            {lv.filterLabel}
          </button>
        </div>
      </div>

      {/* TABLO */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-bold text-[#001A3F]">{lv.logRecordsTemplate.replace("{count}", totalCount.toLocaleString("tr-TR"))}</h2>

        {loading ? (
          <p className="py-10 text-center text-sm font-medium text-gray-400">{lv.loadingLabel}</p>
        ) : errorMessage ? (
          <p className="py-10 text-center text-sm font-medium text-red-500">{errorMessage}</p>
        ) : logs.length === 0 ? (
          <p className="py-10 text-center text-sm font-medium text-gray-400">{lv.emptyLabel}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-bold uppercase tracking-wide text-gray-400">
                  <th className="py-2.5 pr-3">{lv.columnDateTime}</th>
                  <th className="py-2.5 pr-3">{lv.columnFullName}</th>
                  <th className="py-2.5 pr-3">{lv.columnActionType}</th>
                  <th className="py-2.5 pr-3">{lv.columnLoginTime}</th>
                  <th className="py-2.5 pr-3">{lv.columnLogoutTime}</th>
                  <th className="py-2.5 pr-3">{lv.columnIpAddress}</th>
                  <th className="py-2.5 pr-3">{lv.columnStatus}</th>
                  <th className="py-2.5 pr-3">{lv.columnActions}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const actionMeta = ACTION_TYPE_ICONS[log.action_type] || { icon: FileText, className: "text-gray-400" };
                  const ActionIcon = actionMeta.icon;
                  const isSuccess = log.status === "Başarılı";
                  return (
                    <tr key={log.id} className="border-b border-gray-50">
                      <td className="py-3 pr-3 whitespace-nowrap text-gray-500">{formatDateTime(log.created_at)}</td>
                      <td className="py-3 pr-3 font-semibold text-[#001A3F]">{log.user_name || "-"}</td>
                      <td className="py-3 pr-3">
                        <span className="flex items-center gap-2 text-gray-700">
                          <ActionIcon size={16} className={actionMeta.className} />
                          {lv.actionTypeOptions[log.action_type] || log.action_type}
                        </span>
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap text-gray-500">{formatTime(log.login_time)}</td>
                      <td className="py-3 pr-3 whitespace-nowrap text-gray-500">{formatTime(log.logout_time)}</td>
                      <td className="py-3 pr-3 text-gray-500">{log.ip_address || "-"}</td>
                      <td className="py-3 pr-3">
                        <span className={`flex items-center gap-1.5 text-xs font-semibold ${isSuccess ? "text-emerald-600" : "text-red-600"}`}>
                          <span className={`h-2 w-2 shrink-0 rounded-full ${isSuccess ? "bg-emerald-500" : "bg-red-500"}`} />
                          {lv.statusOptions[log.status] || log.status}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <button type="button" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
                          <MoreVertical size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !errorMessage && totalCount > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-400">
              {lv.showingRangeTemplate
                .replace("{start}", rangeStart)
                .replace("{end}", rangeEnd)
                .replace("{total}", totalCount.toLocaleString("tr-TR"))}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={15} />
              </button>
              {pageNumbers.map((p, idx) =>
                p === "..." ? (
                  <span key={`ellipsis-${idx}`} className="flex h-8 w-8 items-center justify-center text-sm text-gray-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold ${
                      p === page ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight size={15} />
              </button>
            </div>
            <div className="relative">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="appearance-none rounded-lg border border-gray-200 py-2 pl-3 pr-9 text-sm text-gray-600 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value={10}>{lv.pageSizeTemplate.replace("{count}", 10)}</option>
                <option value={25}>{lv.pageSizeTemplate.replace("{count}", 25)}</option>
                <option value={50}>{lv.pageSizeTemplate.replace("{count}", 50)}</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
