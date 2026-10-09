import { useEffect, useMemo, useState } from "react";
import { Search, Eye, User, CheckCircle2, XCircle, MoreVertical, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

const API_BASE_URL = "http://localhost:5000";
const PAGE_SIZE = 10;

const STATUS_BADGE_STYLES = {
  "Onay Bekliyor": "bg-orange-50 text-orange-600",
  "Onaylandi": "bg-emerald-50 text-emerald-600",
  "Reddedildi": "bg-red-50 text-red-600",
};

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

export default function PermissionManagement({ t }) {
  const pm = t.permissionManagementPage;

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionErrorMessage, setActionErrorMessage] = useState("");
  const [pendingActionId, setPendingActionId] = useState(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchRequests = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/permission-requests`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.message || pm.loadError);
        return;
      }
      setRequests(data.requests || []);
    } catch {
      setErrorMessage(pm.networkError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return requests;
    return requests.filter((r) => `${r.full_name} ${r.institution_name}`.toLowerCase().includes(query));
  }, [requests, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleStatusChange = async (id, status) => {
    setActionErrorMessage("");
    setPendingActionId(id);
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/permission-requests/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionErrorMessage(data.message || pm.actionError);
        return;
      }
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: data.request.status } : r)));
    } catch {
      setActionErrorMessage(pm.networkError);
    } finally {
      setPendingActionId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-extrabold text-[#001A3F]">{pm.title}</h1>
          <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-blue-100 px-2 text-sm font-bold text-blue-700">
            {requests.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-80 max-w-full">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={pm.searchPlaceholder}
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setPage(1);
            }}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            <Eye size={15} />
            {pm.viewAllLabel}
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        {actionErrorMessage && (
          <p className="mb-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">{actionErrorMessage}</p>
        )}

        {loading ? (
          <p className="py-10 text-center text-sm font-medium text-gray-400">{pm.loadingLabel}</p>
        ) : errorMessage ? (
          <p className="py-10 text-center text-sm font-medium text-red-500">{errorMessage}</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm font-medium text-gray-400">{pm.emptyLabel}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-bold uppercase tracking-wide text-gray-400">
                  <th className="py-2.5 pr-3">{pm.columnFullName}</th>
                  <th className="py-2.5 pr-3">{pm.columnInstitution}</th>
                  <th className="py-2.5 pr-3">{pm.columnRegisteredAt}</th>
                  <th className="py-2.5 pr-3">{pm.columnStatus}</th>
                  <th className="py-2.5 pr-3">{pm.columnAction}</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((req) => {
                  const isPending = pendingActionId === req.id;
                  return (
                    <tr key={req.id} className="border-b border-gray-50">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500">
                            <User size={16} />
                          </div>
                          <span className="font-semibold text-[#001A3F]">{req.full_name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-gray-600">{req.institution_name}</td>
                      <td className="py-3 pr-3 whitespace-nowrap text-gray-500">{formatDate(req.created_at)}</td>
                      <td className="py-3 pr-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            STATUS_BADGE_STYLES[req.status] || "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {pm.statusLabels[req.status] || req.status}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isPending || req.status === "Onaylandi"}
                            onClick={() => handleStatusChange(req.id, "Onaylandi")}
                            className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <CheckCircle2 size={14} />
                            {pm.approveLabel}
                          </button>
                          <button
                            type="button"
                            disabled={isPending || req.status === "Reddedildi"}
                            onClick={() => handleStatusChange(req.id, "Reddedildi")}
                            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <XCircle size={14} />
                            {pm.rejectLabel}
                          </button>
                          <button
                            type="button"
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
            <p className="text-xs text-gray-400">{pm.totalRecordsTemplate.replace("{count}", filtered.length)}</p>
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
            <div className="relative">
              <select
                disabled
                className="appearance-none rounded-lg border border-gray-200 py-2 pl-3 pr-9 text-sm text-gray-600"
                defaultValue={10}
              >
                <option value={10}>{pm.pageSizeTemplate.replace("{count}", 10)}</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
