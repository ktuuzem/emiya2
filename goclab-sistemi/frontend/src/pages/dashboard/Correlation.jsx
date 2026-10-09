import { Fragment, useEffect, useState } from "react";
import { Info } from "lucide-react";

const API_BASE_URL = "http://localhost:5000";

const FACTOR_ORDER = [
  "ekonomik_istihdam",
  "aile_sosyal",
  "sosyo_politik",
  "egitim",
  "cevresel",
  "psikolojik",
  "kulturel",
];

function getAdminToken() {
  try {
    const stored = localStorage.getItem("goclab_admin_session");
    return stored ? JSON.parse(stored)?.token : null;
  } catch {
    return null;
  }
}

const POSITIVE_SHADES = [
  { abs: 0.6, cls: "bg-teal-600 text-white" },
  { abs: 0.4, cls: "bg-teal-300 text-slate-900" },
  { abs: 0.2, cls: "bg-teal-50 text-slate-600" },
];
const NEGATIVE_SHADES = [
  { abs: 0.6, cls: "bg-blue-600 text-white" },
  { abs: 0.4, cls: "bg-blue-300 text-slate-900" },
  { abs: 0.2, cls: "bg-blue-50 text-slate-600" },
];
const NO_RELATION_CLASS = "bg-gray-50 text-slate-400";

function cellColor(r) {
  if (r >= 0.999) return "bg-slate-900 text-white";
  const abs = Math.abs(r);
  const shades = r >= 0 ? POSITIVE_SHADES : NEGATIVE_SHADES;
  const match = shades.find((s) => abs >= s.abs);
  return match ? match.cls : NO_RELATION_CLASS;
}

function interpretR(r, cp) {
  if (r >= 0.999) {
    return { label: cp.perfectCorrelation, range: cp.rangePerfect };
  }
  const abs = Math.abs(r);
  const direction = r >= 0 ? cp.positive : cp.negative;
  if (abs >= 0.6) {
    return { label: `${cp.strong} ${direction} ${cp.correlationWord}`, range: cp.rangeStrong };
  }
  if (abs >= 0.4) {
    return { label: `${cp.medium} ${direction} ${cp.correlationWord}`, range: cp.rangeMedium };
  }
  if (abs >= 0.2) {
    return { label: `${cp.weak} ${direction} ${cp.correlationWord}`, range: cp.rangeWeak };
  }
  return { label: cp.noRelation, range: cp.rangeNone };
}

export default function Correlation({ t, dataScope = "turkey" }) {
  const cp = t.correlationPage;
  const isMoldova = dataScope === "moldova";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    const fetchMatrix = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const token = getAdminToken();
        const query = isMoldova ? "?country=md" : "";
        const res = await fetch(`${API_BASE_URL}/api/correlation-matrix${query}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setErrorMessage(json.message || cp.notFound);
          return;
        }
        setData(json);
      } catch {
        setErrorMessage(cp.networkError);
      } finally {
        setLoading(false);
      }
    };

    fetchMatrix();
  }, [cp, isMoldova]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <p className="text-sm font-medium text-gray-400">{cp.loading}</p>
      </div>
    );
  }

  if (errorMessage || !data) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <p className="text-sm font-medium text-red-500">{errorMessage || cp.notFound}</p>
      </div>
    );
  }

  const matrixByKey = data.matrix.reduce((acc, row) => {
    acc[row.key] = row.values.reduce((valAcc, v) => {
      valAcc[v.key] = v.r;
      return valAcc;
    }, {});
    return acc;
  }, {});

  const infoBox = hovered
    ? (() => {
        const { label, range } = interpretR(hovered.r, cp);
        return `R: ${hovered.r.toFixed(3)} | ${label} (${range}) - ${cp.detailSuffix}`;
      })()
    : cp.hoverPrompt;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-[#001A3F]">
              {cp.title}
              <Info size={16} className="text-gray-400" />
            </h3>
            <p className="mt-1 max-w-xl text-sm text-gray-500">{cp.subtitle}</p>
          </div>
          <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-700">
            {infoBox}
          </div>
        </div>

        {/* ISI HARİTASI */}
        <div className="overflow-x-auto">
          <div className="grid min-w-[880px] grid-cols-8 gap-1">
            {/* Sol üst boş hücre */}
            <div />
            {FACTOR_ORDER.map((key) => (
              <div key={key} className="px-2 py-3 text-center text-sm font-semibold text-[#001A3F]">
                {cp.factorLabels[key]}
              </div>
            ))}

            {FACTOR_ORDER.map((rowKey) => (
              <Fragment key={rowKey}>
                <div className="flex items-center px-2 py-3 text-sm font-semibold text-[#001A3F]">
                  {cp.factorLabels[rowKey]}
                </div>
                {FACTOR_ORDER.map((colKey) => {
                  const r = matrixByKey[rowKey]?.[colKey] ?? 0;
                  return (
                    <button
                      key={`${rowKey}-${colKey}`}
                      type="button"
                      onMouseEnter={() => setHovered({ rowKey, colKey, r })}
                      onMouseLeave={() => setHovered(null)}
                      className={`flex items-center justify-center rounded-lg py-4 text-sm font-bold transition-transform hover:scale-105 ${cellColor(
                        r
                      )}`}
                    >
                      {r.toFixed(2)}
                    </button>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>

        {/* ALT LEGEND */}
        <div className="mt-8 flex flex-col gap-3 text-xs font-medium text-gray-600">
          {[
            { title: cp.legendPositive, shades: POSITIVE_SHADES },
            { title: cp.legendNegative, shades: NEGATIVE_SHADES },
          ].map((group) => (
            <div key={group.title} className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="w-36 shrink-0 font-bold text-[#001A3F]">{group.title}</span>
              {[
                { cls: NO_RELATION_CLASS, label: cp.legendNoRelation, range: cp.rangeNone },
                { cls: group.shades[2].cls, label: cp.weak, range: cp.rangeWeak },
                { cls: group.shades[1].cls, label: cp.medium, range: cp.rangeMedium },
                { cls: group.shades[0].cls, label: cp.strong, range: cp.rangeStrong },
              ].map((item) => (
                <span key={item.label} className="flex items-center gap-1.5">
                  <span className={`h-4 w-6 rounded border border-gray-200 ${item.cls}`} />
                  {item.label} ({item.range})
                </span>
              ))}
            </div>
          ))}
          <p className="text-[11px] font-normal text-gray-400">{cp.legendAbsNote}</p>
        </div>
      </div>
    </div>
  );
}
