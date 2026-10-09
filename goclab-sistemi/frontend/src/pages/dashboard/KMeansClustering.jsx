import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

const API_BASE_URL = "http://localhost:5000";

const CLUSTER_COLORS = {
  K1: "#DC2626",
  K2: "#2563EB",
  K3: "#16A34A",
  K4: "#7C3AED",
  K5: "#EA580C",
};
const CLUSTER_ORDER = ["K1", "K2", "K3", "K4", "K5"];

const CLASSIFICATION_BADGE = {
  "Yüksek": "bg-green-100 text-green-700",
  "Orta": "bg-orange-100 text-orange-600",
  "Düşük": "bg-red-100 text-red-600",
};

function classifyScore(score) {
  if (score === null || score === undefined) return null;
  if (score <= 33) return "Düşük";
  if (score <= 66) return "Orta";
  return "Yüksek";
}

function formatScore(value) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function StarShape({ cx, cy, fill }) {
  if (cx === undefined || cy === undefined) return null;
  const outerR = 11;
  const innerR = 4.5;
  const points = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return <polygon points={points.join(" ")} fill={fill} stroke="#1f2937" strokeWidth={1} />;
}

function getAdminToken() {
  try {
    const stored = localStorage.getItem("goclab_admin_session");
    return stored ? JSON.parse(stored)?.token : null;
  } catch {
    return null;
  }
}

export default function KMeansClustering({ t, dataScope = "turkey" }) {
  const km = t.kMeansPage;
  const isMoldova = dataScope === "moldova";
  const clusters = isMoldova ? km.clustersMoldova : km.clusters;
  const factorLabels = t.overviewPage.factorLabels;
  const classificationLabels = t.overviewPage.classificationLabels;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeCluster, setActiveCluster] = useState("K1");
  const [generatedAt] = useState(() => new Date());

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const token = getAdminToken();
        const query = isMoldova ? "?country=md" : "";
        const res = await fetch(`${API_BASE_URL}/api/kmeans-results${query}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setErrorMessage(json.message || km.notFound);
          return;
        }
        if (!json.computed) {
          setErrorMessage(json.message);
          return;
        }
        setData(json);
      } catch {
        setErrorMessage(km.networkError);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMoldova]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <p className="text-sm font-medium text-gray-400">{km.loading}</p>
      </div>
    );
  }

  if (errorMessage || !data) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <p className="max-w-md text-center text-sm font-medium text-red-500">
          {errorMessage || km.notFound}
        </p>
      </div>
    );
  }

  const clusterTitle = (label) => clusters[label] || label;
  const factorLabel = (key) => factorLabels[key] || key;
  const classificationLabel = (classification) =>
    classification ? classificationLabels[classification] || classification : "-";

  const pointsByCluster = CLUSTER_ORDER.reduce((acc, label) => {
    acc[label] = data.points.filter((p) => p.clusterLabel === label).map((p) => ({ x: p.pcaX, y: p.pcaY }));
    return acc;
  }, {});

  const centroids = CLUSTER_ORDER.map((label) => {
    const pts = pointsByCluster[label];
    if (pts.length === 0) return null;
    const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    return { label, x, y };
  }).filter(Boolean);

  const profileByLabel = data.clusterProfiles.reduce((acc, p) => {
    acc[p.clusterLabel] = p;
    return acc;
  }, {});

  const activeProfile = profileByLabel[activeCluster];
  const activeColor = CLUSTER_COLORS[activeCluster];

  const radarData = activeProfile
    ? activeProfile.factors.map((f) => ({ label: factorLabel(f.key), score: f.score ?? 0 }))
    : [];

  return (
    <div className="flex flex-col gap-6">
      {/* KÜME DAĞILIM GRAFİĞİ (PCA) */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-[#001A3F]">{km.title}</h3>
            <p className="text-xs text-gray-400">{km.subtitle}</p>
          </div>
          <p className="text-xs text-gray-400">
            {generatedAt.toLocaleString("tr-TR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </p>
        </div>

        <ResponsiveContainer width="100%" height={380}>
          <ScatterChart margin={{ top: 10, right: 30, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="x" name={km.xAxisLabel} tick={{ fontSize: 11 }} />
            <YAxis type="number" dataKey="y" name={km.yAxisLabel} tick={{ fontSize: 11 }} />
            <ZAxis range={[18, 18]} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(value) => formatScore(value)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {CLUSTER_ORDER.map((label) => (
              <Scatter
                key={label}
                name={clusterTitle(label)}
                data={pointsByCluster[label]}
                fill={CLUSTER_COLORS[label]}
                fillOpacity={0.55}
                r={3}
              />
            ))}
            <Scatter
              name={km.centroidName}
              data={centroids}
              shape={(props) => <StarShape {...props} fill={CLUSTER_COLORS[props.payload.label]} />}
              legendType="none"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* ALT: PROFİLLER + DETAY */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* SOL: KÜME PROFİLLERİ */}
        <div className="rounded-2xl bg-white p-6 shadow-sm lg:col-span-1">
          <h3 className="mb-4 text-base font-bold text-[#001A3F]">{km.profilesTitle}</h3>
          <div className="flex flex-col gap-2">
            {CLUSTER_ORDER.map((label) => {
              const color = CLUSTER_COLORS[label];
              const profile = profileByLabel[label];
              const isActive = label === activeCluster;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setActiveCluster(label)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                    isActive ? "bg-blue-50" : "hover:bg-gray-50"
                  }`}
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="flex-1 text-sm font-semibold text-[#001A3F]">{clusterTitle(label)}</span>
                  <span className="shrink-0 text-xs font-medium text-gray-400">
                    N={profile?.count ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SAĞ: KÜME DETAY KARTI */}
        <div className="rounded-2xl bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-[#001A3F]">{clusterTitle(activeCluster)}</h3>
            <span className="text-sm font-semibold text-gray-400">N={activeProfile?.count ?? 0}</span>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* RADAR */}
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid />
                <PolarAngleAxis dataKey="label" tick={{ fontSize: 10, fill: "#334155" }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar
                  name={clusterTitle(activeCluster)}
                  dataKey="score"
                  stroke={activeColor}
                  fill={activeColor}
                  fillOpacity={0.2}
                />
                <Tooltip formatter={(value) => formatScore(value)} />
              </RadarChart>
            </ResponsiveContainer>

            {/* BARLAR */}
            <div className="flex flex-col justify-center gap-3">
              <p className="text-xs font-semibold text-gray-400">{km.averageScoreLabel}</p>
              {(activeProfile?.factors ?? []).map((f) => {
                const classification = classifyScore(f.score);
                return (
                  <div key={f.key} className="flex items-center gap-3">
                    <div className="w-28 shrink-0 text-xs font-semibold text-[#001A3F]">
                      {factorLabel(f.key)}
                    </div>
                    <div className="h-2 flex-1 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.max(0, Math.min(100, f.score ?? 0))}%`,
                          backgroundColor: activeColor,
                        }}
                      />
                    </div>
                    <div className="w-10 shrink-0 text-right text-xs font-bold text-[#001A3F]">
                      {formatScore(f.score)}
                    </div>
                    <span
                      className={`w-14 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-bold ${
                        CLASSIFICATION_BADGE[classification] || "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {classificationLabel(classification)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          <Info size={16} />
        </div>
      </div>
    </div>
  );
}
