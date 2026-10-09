import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

const API_BASE_URL = "http://localhost:5000";

const Y_TICKS = [0, 65, 130, 155, 200];

const DISTRIBUTION_COLORS = {
  ekonomik_istihdam: "#4C1D95",
  aile_sosyal: "#2563EB",
  sosyo_politik: "#38BDF8",
  egitim: "#16A34A",
  cevresel: "#14B8A6",
  psikolojik: "#DB2777",
  kulturel: "#EA580C",
};

const DISTRIBUTION_ORDER = [
  "ekonomik_istihdam",
  "aile_sosyal",
  "sosyo_politik",
  "egitim",
  "cevresel",
  "psikolojik",
  "kulturel",
];

const OVERALL_COLOR = "#4338CA";

function getAdminToken() {
  try {
    const stored = localStorage.getItem("goclab_admin_session");
    return stored ? JSON.parse(stored)?.token : null;
  } catch {
    return null;
  }
}

function DistributionChart({ data, color, height }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
        <XAxis dataKey="range" tick={{ fontSize: 11, fill: "#334155" }} />
        <YAxis domain={[0, 200]} ticks={Y_TICKS} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function Distribution({ t, dataScope = "turkey" }) {
  const dp = t.distributionPage;
  const isMoldova = dataScope === "moldova";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchDistribution = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const token = getAdminToken();
        const query = isMoldova ? "?country=md" : "";
        const res = await fetch(`${API_BASE_URL}/api/dashboard-distribution${query}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setErrorMessage(json.message || dp.notFound);
          return;
        }
        setData(json);
      } catch {
        setErrorMessage(dp.networkError);
      } finally {
        setLoading(false);
      }
    };

    fetchDistribution();
  }, [dp, isMoldova]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <p className="text-sm font-medium text-gray-400">{dp.loading}</p>
      </div>
    );
  }

  if (errorMessage || !data) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <p className="text-sm font-medium text-red-500">{errorMessage || dp.notFound}</p>
      </div>
    );
  }

  const factorByKey = data.factors.reduce((acc, f) => {
    acc[f.key] = f;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      {/* GENEL ORTALAMA DAĞILIMI */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-[#001A3F]">{dp.overallTitle}</h3>
        <p className="mb-4 text-sm text-gray-400">
          {data.totalQuestions} {dp.overallSubtitlePrefix} {data.totalParticipants} {dp.overallSubtitleMiddle}{" "}
          {dp.overallSubtitleSuffix}
        </p>
        <DistributionChart data={data.overall.bins} color={OVERALL_COLOR} height={300} />
      </div>

      {/* FAKTÖR BAZLI DAĞILIMLAR */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {DISTRIBUTION_ORDER.map((key) => {
          const factor = factorByKey[key];
          if (!factor) return null;
          return (
            <div key={key} className="rounded-2xl bg-white p-5 shadow-sm">
              <h4 className="mb-2 text-sm font-bold text-[#001A3F]">{dp.factorLabels[key]}</h4>
              <DistributionChart data={factor.bins} color={DISTRIBUTION_COLORS[key]} height={180} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
