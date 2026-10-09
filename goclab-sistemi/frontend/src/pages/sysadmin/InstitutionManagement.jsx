import { useEffect, useMemo, useState } from "react";
import {
  Search,
  ChevronDown,
  RotateCcw,
  Download,
  Eye,
  Pencil,
  CheckCircle2,
  XCircle,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const API_BASE_URL = "http://localhost:5000";
const PAGE_SIZE = 10;

const TYPE_BADGE_COLORS = {
  "Bakanlık": "bg-purple-100 text-purple-700",
  "Valilik / Kaymakamlık": "bg-indigo-100 text-indigo-700",
  "Belediye": "bg-emerald-100 text-emerald-700",
  "Üniversite": "bg-blue-100 text-blue-700",
  "Sivil Toplum Kuruluşu (STK)": "bg-amber-100 text-amber-700",
  "Diğer": "bg-gray-100 text-gray-700",
};

const LOGO_COLORS = ["#2563EB", "#16A34A", "#7C3AED", "#DC2626", "#0D9488", "#CA8A04", "#DB2777", "#0891B2"];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function getInitials(name) {
  const words = name.replace(/[()]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
}

function formatDate(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getAdminToken() {
  try {
    const stored = localStorage.getItem("goclab_admin_session");
    return stored ? JSON.parse(stored)?.token : null;
  } catch {
    return null;
  }
}

const STATUS_DOT_COLORS = {
  "Aktif": "bg-emerald-500",
  "Beklemede": "bg-amber-400",
  "Reddedildi": "bg-red-500",
};

export default function InstitutionManagement({ t }) {
  const im = t.institutionManagementPage;
  const ia = t.institutionApplyPage;

  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionErrorMessage, setActionErrorMessage] = useState("");
  const [pendingActionId, setPendingActionId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [page, setPage] = useState(1);

  const fetchInstitutions = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_BASE_URL}/api/institutions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.message || im.loadError);
        return;
      }
      setInstitutions(data.institutions || []);
    } catch {
      setErrorMessage(im.networkError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstitutions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cityOptions = useMemo(
    () => [...new Set(institutions.map((i) => i.city).filter(Boolean))].sort(),
    [institutions]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return institutions.filter((inst) => {
      if (statusFilter && inst.status !== statusFilter) return false;
      if (typeFilter && inst.institution_type !== typeFilter) return false;
      if (cityFilter && inst.city !== cityFilter) return false;
      if (query) {
        const haystack = `${inst.name} ${inst.city ?? ""} ${inst.contact_person ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [institutions, search, statusFilter, typeFilter, cityFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setTypeFilter("");
    setCityFilter("");
    setPage(1);
  };

  const handleStatusChange = async (id, status) => {
    setActionErrorMessage("");
    setPendingActionId(id);
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_BASE_URL}/api/institutions/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionErrorMessage(data.message || im.actionError);
        return;
      }
      setInstitutions((prev) => prev.map((inst) => (inst.id === id ? data.institution : inst)));
    } catch {
      setActionErrorMessage(im.networkError);
    } finally {
      setPendingActionId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#001A3F]">{im.title}</h1>
        <p className="mt-1 text-sm text-gray-400">
          {im.breadcrumbHome} <span className="mx-1">›</span> {im.title}
        </p>
      </div>

      {/* FİLTRE BARI */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={im.searchPlaceholder}
            className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="appearance-none rounded-lg border border-gray-200 py-2.5 pl-3 pr-9 text-sm text-gray-600 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          >
            <option value="">{im.statusFilterLabel}</option>
            <option value="Aktif">{im.statusActive}</option>
            <option value="Beklemede">{im.statusPending}</option>
            <option value="Reddedildi">{im.statusRejected}</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="appearance-none rounded-lg border border-gray-200 py-2.5 pl-3 pr-9 text-sm text-gray-600 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          >
            <option value="">{im.typeFilterLabel}</option>
            {ia.institutionTypeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        <div className="relative">
          <select
            value={cityFilter}
            onChange={(e) => {
              setCityFilter(e.target.value);
              setPage(1);
            }}
            className="appearance-none rounded-lg border border-gray-200 py-2.5 pl-3 pr-9 text-sm text-gray-600 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          >
            <option value="">{im.cityFilterLabel}</option>
            {cityOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        <button
          type="button"
          onClick={handleClearFilters}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
        >
          <RotateCcw size={15} />
          {im.clearFiltersLabel}
        </button>

        <button
          type="button"
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          <Download size={15} />
          {im.exportLabel}
        </button>
      </div>

      {/* TABLO */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-bold text-[#001A3F]">
          {im.institutionsCountLabel} ({filtered.length})
        </h2>

        {actionErrorMessage && (
          <p className="mb-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">{actionErrorMessage}</p>
        )}

        {loading ? (
          <p className="py-10 text-center text-sm font-medium text-gray-400">{im.loadingLabel}</p>
        ) : errorMessage ? (
          <p className="py-10 text-center text-sm font-medium text-red-500">{errorMessage}</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm font-medium text-gray-400">{im.emptyLabel}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-bold uppercase tracking-wide text-gray-400">
                  <th className="py-2.5 pr-3">{im.columnName}</th>
                  <th className="py-2.5 pr-3">{im.columnType}</th>
                  <th className="py-2.5 pr-3">{im.columnCity}</th>
                  <th className="py-2.5 pr-3">{im.columnContact}</th>
                  <th className="py-2.5 pr-3">{im.columnEmail}</th>
                  <th className="py-2.5 pr-3">{im.columnPhone}</th>
                  <th className="py-2.5 pr-3">{im.columnStatus}</th>
                  <th className="py-2.5 pr-3">{im.columnCreatedAt}</th>
                  <th className="py-2.5 pr-3">{im.columnActions}</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((inst) => {
                  const logoColor = LOGO_COLORS[hashString(inst.name) % LOGO_COLORS.length];
                  const isPending = pendingActionId === inst.id;
                  return (
                    <tr key={inst.id} className="border-b border-gray-50">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
                            style={{ backgroundColor: logoColor }}
                          >
                            {getInitials(inst.name)}
                          </div>
                          <span className="font-semibold text-[#001A3F]">{inst.name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        {inst.institution_type ? (
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              TYPE_BADGE_COLORS[inst.institution_type] || "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {inst.institution_type}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-3 pr-3 text-gray-600">{inst.city || "-"}</td>
                      <td className="py-3 pr-3 text-gray-600">{inst.contact_person || "-"}</td>
                      <td className="py-3 pr-3 text-gray-600">{inst.contact_email || "-"}</td>
                      <td className="py-3 pr-3 text-gray-600">{inst.contact_phone || "-"}</td>
                      <td className="py-3 pr-3">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_COLORS[inst.status] || "bg-gray-300"}`} />
                          {inst.status === "Aktif" ? im.statusActive : inst.status === "Reddedildi" ? im.statusRejected : im.statusPending}
                        </span>
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap text-gray-500">{formatDate(inst.created_at)}</td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title={im.viewTooltip}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            title={im.editTooltip}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            title={im.approveTooltip}
                            disabled={isPending || inst.status === "Aktif"}
                            onClick={() => handleStatusChange(inst.id, "Aktif")}
                            className="rounded-lg p-1.5 text-emerald-500 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                          <button
                            type="button"
                            title={im.rejectTooltip}
                            disabled={isPending || inst.status === "Reddedildi"}
                            onClick={() => handleStatusChange(inst.id, "Reddedildi")}
                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <XCircle size={16} />
                          </button>
                          <button
                            type="button"
                            title={im.moreTooltip}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                          >
                            <MoreVertical size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !errorMessage && filtered.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-400">
              {im.showingLabel} {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, filtered.length)} / {filtered.length}{" "}
              {im.institutionsCountLabel.toLowerCase()}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={15} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .slice(0, 6)
                .map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold ${
                      p === currentPage ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
