import { useEffect, useState } from "react";
import { Users, Activity, UserCheck, Database } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  LabelList,
} from "recharts";

const API_BASE_URL = "http://localhost:5000";

const FACTOR_ORDER = ["ekonomik_istihdam", "aile_sosyal", "sosyo_politik", "egitim", "cevresel", "psikolojik", "kulturel"];

const FACTOR_ICONS = {
  ekonomik_istihdam: "💰",
  aile_sosyal: "👥",
  sosyo_politik: "🏛️",
  egitim: "🎓",
  cevresel: "🍃",
  psikolojik: "😟",
  kulturel: "⚖️",
};

function TopDot({ x, y, width }) {
  if (x === undefined || y === undefined || width === undefined) return null;
  const cx = x + width / 2;
  return <circle cx={cx} cy={y} r={5} fill="#ffffff" stroke="#2563EB" strokeWidth={2.5} />;
}

function CustomTick({ x, y, payload, factorLabels }) {
  const factorKey = payload.value;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="middle" fontSize={16}>
        {FACTOR_ICONS[factorKey]}
      </text>
      <text x={0} y={0} dy={38} textAnchor="middle" fontSize={11} fontWeight={600} fill="#334155">
        {factorLabels[factorKey]}
      </text>
    </g>
  );
}

function getAdminToken() {
  try {
    const stored = localStorage.getItem("goclab_admin_session");
    return stored ? JSON.parse(stored)?.token : null;
  } catch {
    return null;
  }
}

export default function GlobalDataView({ t }) {
  const gd = t.globalDataViewPage;
  const tp = t.tenantOverviewPage;
  const factorLabels = t.overviewPage.factorLabels;
  const clusterLabels = t.kMeansPage.clusters;

  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchGlobalStats = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const token = getAdminToken();
        const res = await fetch(`${API_BASE_URL}/api/dashboard/global-stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setErrorMessage(data.message || gd.loadError);
          return;
        }
        setStats(data);
      } catch {
        setErrorMessage(gd.networkError);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGlobalStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartData = FACTOR_ORDER.map((key) => ({
    key,
    score: stats?.factorAverages?.[key] ?? 0,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600">
          <Database size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#001A3F]">{gd.title}</h2>
          <p className="text-xs text-gray-400">{gd.subtitle}</p>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <p className="text-sm font-medium text-red-600">{errorMessage}</p>
        </div>
      ) : (
        <>
          {/* ÜST İSTATİSTİK KARTLARI */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border-l-4 border-l-emerald-500 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-start justify-between">
                <p className="text-xs font-bold tracking-wide text-gray-500">{tp.totalParticipantsLabel}</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
                  <Users size={18} className="text-emerald-600" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-[#001A3F]">{isLoading ? "-" : stats?.totalParticipants ?? 0}</p>
            </div>

            <div className="rounded-2xl border-l-4 border-l-blue-500 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-start justify-between">
                <p className="text-xs font-bold tracking-wide text-gray-500">{tp.generalIntentLabel}</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                  <Activity size={18} className="text-blue-600" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-[#001A3F]">{isLoading ? "-" : stats?.generalScore ?? "-"}</p>
            </div>

            <div className="rounded-2xl border-l-4 border-l-purple-500 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-start justify-between">
                <p className="text-xs font-bold tracking-wide text-gray-500">{tp.dominantClusterLabel}</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50">
                  <UserCheck size={18} className="text-purple-600" />
                </div>
              </div>
              <p className="text-xl font-extrabold leading-snug text-[#001A3F]">
                {isLoading ? "-" : stats?.dominantClusterKey ? clusterLabels[stats.dominantClusterKey] : gd.noClusterDataLabel}
              </p>
              <p className="mt-1 text-xs text-gray-400">{tp.dominantClusterSubtitle}</p>
            </div>
          </div>

          {/* KARŞILAŞTIRMA GRAFİĞİ */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold tracking-wide text-[#001A3F]">{tp.comparisonChartTitle}</h3>
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
                {tp.generalMigrationAverageLegend}
              </div>
            </div>

            {isLoading ? (
              <div className="flex h-[340px] items-center justify-center text-sm font-medium text-gray-400">{gd.loadingLabel}</div>
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 40, left: 0 }}>
                  <defs>
                    <linearGradient id="globalBarGradientBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" />
                      <stop offset="100%" stopColor="#FFFFFF" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="key"
                    tick={(props) => <CustomTick {...props} factorLabels={factorLabels} />}
                    tickLine={false}
                    axisLine={{ stroke: "#e5e7eb" }}
                    interval={0}
                    height={50}
                  />
                  <YAxis domain={[0, 100]} ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => [value, tp.scoreTooltipLabel]} labelFormatter={(key) => factorLabels[key]} />
                  <ReferenceLine
                    y={stats?.generalScore ?? 0}
                    stroke="#2563EB"
                    strokeDasharray="3 3"
                    label={{ value: String(stats?.generalScore ?? 0), position: "right", fill: "#2563EB", fontSize: 11, fontWeight: 700 }}
                  />
                  <Bar dataKey="score" fill="url(#globalBarGradientBlue)" radius={[8, 8, 0, 0]} barSize={44} isAnimationActive={false}>
                    <LabelList dataKey="score" content={<TopDot />} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            <p className="mt-4 rounded-lg bg-gray-50 px-4 py-2.5 text-center text-xs font-medium text-gray-400">
              {tp.filterHint}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
