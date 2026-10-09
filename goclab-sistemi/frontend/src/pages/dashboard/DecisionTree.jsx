import { useEffect, useMemo, useState } from "react";
import { GitBranch, Gauge, BarChart3 } from "lucide-react";

const API_BASE_URL = "http://localhost:5000";

const CLUSTER_COLORS = {
  K1: "#DC2626",
  K2: "#2563EB",
  K3: "#16A34A",
  K4: "#14B8A6",
  K5: "#7C3AED",
};
const CLUSTER_ORDER = ["K1", "K2", "K3", "K4", "K5"];

const COL_WIDTH = 168;
const ROW_HEIGHT = 128;
const NODE_WIDTH = 148;
const INTERNAL_HEIGHT = 56;
const LEAF_HEIGHT = 84;

function getAdminToken() {
  try {
    const stored = localStorage.getItem("goclab_admin_session");
    return stored ? JSON.parse(stored)?.token : null;
  } catch {
    return null;
  }
}

function formatPct(value) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// Yaprak dugumlere soldan saga sirali bir x indeksi atar; ic dugumlerin x'i
// cocuklarinin ortalamasidir. Depth, kok'ten itibaren satir indeksidir.
function layoutTree(node, depth, leafCounter) {
  if (node.isLeaf) {
    const x = leafCounter.count;
    leafCounter.count += 1;
    return { ...node, depth, x };
  }
  const left = layoutTree(node.left, depth + 1, leafCounter);
  const right = layoutTree(node.right, depth + 1, leafCounter);
  const x = (left.x + right.x) / 2;
  return { ...node, depth, x, left, right };
}

function collectRenderData(node, factorLabels, nodes, edges) {
  const width = node.isLeaf ? LEAF_HEIGHT : INTERNAL_HEIGHT;
  const centerX = node.x * COL_WIDTH + COL_WIDTH / 2;
  const top = node.depth * ROW_HEIGHT;
  nodes.push({ ...node, centerX, top, height: width });

  if (!node.isLeaf) {
    [
      { child: node.left, branch: "no" },
      { child: node.right, branch: "yes" },
    ].forEach(({ child, branch }) => {
      const childCenterX = child.x * COL_WIDTH + COL_WIDTH / 2;
      const childTop = child.depth * ROW_HEIGHT;
      edges.push({
        x1: centerX,
        y1: top + INTERNAL_HEIGHT,
        x2: childCenterX,
        y2: childTop,
        branch,
      });
      collectRenderData(child, factorLabels, nodes, edges);
    });
  }
}

export default function DecisionTree({ t, dataScope = "turkey" }) {
  const dp = t.decisionTreePage;
  const isMoldova = dataScope === "moldova";
  const factorLabels = t.overviewPage.factorLabels;
  const clusterLabels = isMoldova ? t.kMeansPage.clustersMoldova : t.kMeansPage.clusters;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchTree = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const token = getAdminToken();
        const query = isMoldova ? "?country=md" : "";
        const res = await fetch(`${API_BASE_URL}/api/decision-tree${query}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setErrorMessage(json.message || dp.notFound);
          return;
        }
        if (!json.trained) {
          setErrorMessage(json.message);
          return;
        }
        setData(json);
      } catch {
        setErrorMessage(dp.networkError);
      } finally {
        setLoading(false);
      }
    };

    fetchTree();
  }, [dp, isMoldova]);

  const layout = useMemo(() => {
    if (!data) return null;
    const rootLaidOut = layoutTree(data.tree, 0, { count: 0 });
    const nodes = [];
    const edges = [];
    collectRenderData(rootLaidOut, factorLabels, nodes, edges);
    const leafCount = nodes.filter((n) => n.isLeaf).length;
    const maxDepth = Math.max(...nodes.map((n) => n.depth));
    return {
      nodes,
      edges,
      width: leafCount * COL_WIDTH,
      height: maxDepth * ROW_HEIGHT + LEAF_HEIGHT + 20,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <p className="text-sm font-medium text-gray-400">{dp.loading}</p>
      </div>
    );
  }

  if (errorMessage || !data || !layout) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <p className="max-w-md text-center text-sm font-medium text-red-500">
          {errorMessage || dp.notFound}
        </p>
      </div>
    );
  }

  const subtitle = dp.subtitleTemplate
    .replace("{algorithm}", data.algorithm)
    .replace("{maxDepth}", data.maxDepth)
    .replace("{accuracy}", formatPct(data.accuracy * 100));

  const datasetLine = dp.datasetTemplate
    .replace("{total}", data.totalParticipants)
    .replace("{test}", data.testCount);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
      {/* SOL PANEL */}
      <div className="flex flex-col gap-6">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold tracking-wide text-[#001A3F]">
            <Gauge size={16} className="text-indigo-700" />
            {dp.modelPerformanceTitle}
          </h3>
          <p className="mb-4 text-xs text-gray-400">{datasetLine}</p>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{dp.accuracyLabel}</span>
              <span className="text-base font-extrabold text-[#001A3F]">{formatPct(data.accuracy * 100)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{dp.f1Label}</span>
              <span className="text-base font-extrabold text-[#001A3F]">{data.f1Score.toFixed(4)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{dp.precisionLabel}</span>
              <span className="text-base font-extrabold text-[#001A3F]">{data.precision.toFixed(4)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold tracking-wide text-[#001A3F]">
            <BarChart3 size={16} className="text-indigo-700" />
            {dp.featureImportanceTitle}
          </h3>
          <div className="flex flex-col gap-4">
            {data.featureImportances.map((f) => (
              <div key={f.key}>
                <div className="mb-1 flex items-center justify-between text-xs font-semibold text-[#001A3F]">
                  <span>{factorLabels[f.key] || f.label}</span>
                  <span>{formatPct(f.importance)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100">
                  <div
                    className="h-1.5 rounded-full bg-indigo-600"
                    style={{ width: `${Math.max(0, Math.min(100, f.importance))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SAĞ PANEL */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
            <GitBranch size={20} className="text-indigo-700" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-wide text-[#001A3F]">{dp.title}</h2>
            <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>
          </div>
        </div>

        {/* LEJANT */}
        <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-gray-100 pb-4">
          {CLUSTER_ORDER.map((label) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[label] }} />
              <span>
                <span className="font-bold text-[#001A3F]">{label}</span> — {clusterLabels[label]}
              </span>
            </div>
          ))}
        </div>

        {/* AĞAÇ */}
        <div className="overflow-x-auto">
          <div className="relative mx-auto" style={{ width: layout.width, height: layout.height }}>
            <svg
              className="pointer-events-none absolute inset-0"
              width={layout.width}
              height={layout.height}
              style={{ overflow: "visible" }}
            >
              {layout.edges.map((e, i) => {
                const midY = (e.y1 + e.y2) / 2;
                const path = `M ${e.x1} ${e.y1} C ${e.x1} ${midY}, ${e.x2} ${midY}, ${e.x2} ${e.y2}`;
                const labelX = (e.x1 + e.x2) / 2;
                const labelY = midY;
                return (
                  <g key={i}>
                    <path d={path} fill="none" stroke="#1e3a8a" strokeWidth={1.5} />
                    <rect
                      x={labelX - 24}
                      y={labelY - 9}
                      width={48}
                      height={16}
                      rx={4}
                      fill="#ffffff"
                    />
                    <text
                      x={labelX}
                      y={labelY + 3}
                      textAnchor="middle"
                      style={{ fontSize: 10, fontWeight: 700, fill: branchColor(e.branch) }}
                    >
                      {e.branch === "yes" ? dp.yesLabel : dp.noLabel}
                    </text>
                  </g>
                );
              })}
            </svg>

            {layout.nodes.map((node, i) => {
              const left = node.centerX - NODE_WIDTH / 2;
              if (node.isLeaf) {
                const color = CLUSTER_COLORS[node.clusterLabel] || "#334155";
                return (
                  <div
                    key={i}
                    className="absolute flex flex-col items-center justify-center rounded-lg bg-white p-2 text-center shadow-sm"
                    style={{
                      left,
                      top: node.top,
                      width: NODE_WIDTH,
                      height: node.height,
                      border: `2px solid ${color}`,
                    }}
                  >
                    <p className="text-sm font-extrabold" style={{ color }}>
                      {node.clusterLabel}
                    </p>
                    <p className="mt-0.5 line-clamp-3 text-[9.5px] leading-tight text-gray-500">
                      {clusterLabels[node.clusterLabel]}
                    </p>
                  </div>
                );
              }
              return (
                <div
                  key={i}
                  className="absolute flex items-center justify-center rounded-lg border-2 border-blue-700 bg-white px-2 text-center shadow-sm"
                  style={{ left, top: node.top, width: NODE_WIDTH, height: node.height }}
                >
                  <p className="text-[11px] font-bold leading-tight text-[#001A3F]">
                    {factorLabels[node.factorKey] || node.factorKey} ≥ {node.threshold}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function branchColor(branch) {
  return branch === "yes" ? "#15803d" : "#b91c1c";
}
