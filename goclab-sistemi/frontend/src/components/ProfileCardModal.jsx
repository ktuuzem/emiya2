import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { QRCodeSVG } from "qrcode.react";
import {
  X,
  Plane,
  Wallet,
  GraduationCap,
  MoonStar,
  Share2,
  Landmark,
  Leaf,
  Target,
  TrendingUp,
  Trophy,
  TrendingDown,
  Users,
  Briefcase,
  Frown,
  Download,
  Link2,
  Loader2,
  CalendarDays,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";
import GaugeChart from "./GaugeChart.jsx";

const FACTOR_ICONS = {
  ekonomik_istihdam: Wallet,
  egitim: GraduationCap,
  kulturel: MoonStar,
  aile_sosyal: Share2,
  psikolojik: Plane,
  sosyo_politik: Landmark,
  cevresel: Leaf,
};

const FACTOR_COLORS = {
  ekonomik_istihdam: "#2563EB",
  egitim: "#16A34A",
  kulturel: "#0EA5E9",
  aile_sosyal: "#0D9488",
  psikolojik: "#F97316",
  sosyo_politik: "#DC2626",
  cevresel: "#4ADE80",
};

const CLUSTER_ICONS = { K1: Briefcase, K2: Share2, K3: GraduationCap, K4: Landmark, K5: Frown };

const SOCIAL_BUTTONS = [
  { key: "linkedin", label: "LinkedIn", bg: "#0A66C2", letter: "in" },
  { key: "x", label: "X (Twitter)", bg: "#000000", letter: "X" },
  { key: "instagram", label: "Instagram", bg: "#D6249F", letter: "IG" },
  { key: "facebook", label: "Facebook", bg: "#1877F2", letter: "f" },
  { key: "whatsapp", label: "WhatsApp", bg: "#25D366", letter: "WA" },
];

function classifyScore(score) {
  if (score === null || score === undefined) return null;
  if (score <= 33) return "Düşük";
  if (score <= 66) return "Orta";
  return "Yüksek";
}

export default function ProfileCardModal({ isOpen, onClose, report, t }) {
  const cardRef = useRef(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  if (!isOpen || !report || !t) return null;

  const pc = t.profileCardPage;
  const sr = t.studentReportPage;
  const factorLabels = t.distributionPage.factorLabels;
  const classificationLabels = t.overviewPage.classificationLabels;

  const sortedFactors = [...report.factors]
    .filter((f) => f.score !== null)
    .sort((a, b) => b.score - a.score);
  const topFactor = sortedFactors[0] ?? null;
  const weakestFactor = sortedFactors[sortedFactors.length - 1] ?? null;
  const ClusterIcon = report.assignedCluster ? CLUSTER_ICONS[report.assignedCluster] ?? Users : Users;
  const clusterTitle = report.clusterInfo ? t.kMeansPage.clusters[report.clusterInfo.key] || report.clusterInfo.title : null;

  const comparisonData = [
    { name: sr.ownLabel, value: report.comparison.own ?? 0, color: "#16A34A" },
    { name: sr.institutionLabel, value: report.comparison.institution ?? 0, color: "#2563EB" },
    { name: sr.nationalLabel, value: report.comparison.national ?? 0, color: "#F97316" },
  ];

  const dateLabel = new Date(report.completedAt ?? Date.now())
    .toLocaleDateString(sr.dateLocale, { day: "2-digit", month: "long", year: "numeric" })
    .toUpperCase();

  const generalClassification = classifyScore(report.generalScore);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `goc-profili-kartim-${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Kart indirilirken hata olustu:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1800);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="relative w-full max-w-xl py-4" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-1 right-0 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-500 shadow-lg hover:text-gray-700"
        >
          <X size={18} />
        </button>

        {/* BEYAZ MODAL KUTUSU: kaydirma (scroll) KASITLI OLARAK YOK - kart,
            asagidaki kompakt padding/gap/font/grafik boyutlariyla tek ekrana
            sigacak sekilde tasarlanmistir. */}
        <div className="rounded-3xl border-4 border-[#001A3F] bg-white shadow-2xl">
          {/* PAYLASILACAK/INDIRILECEK KART: html-to-image bu ic div'i referans alir. */}
          <div ref={cardRef} className="p-3">
            {/* ÜST BAŞLIK */}
            <div className="mb-2 flex items-center justify-between">
              <h1 className="text-base font-black tracking-tight text-[#001A3F] sm:text-lg">{pc.cardTitle}</h1>
              <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#001A3F] px-2 py-0.5 text-[9px] font-bold text-white sm:text-[10px]">
                <CalendarDays size={11} />
                {dateLabel}
              </div>
            </div>

            {/* GAUGE + KARSILASTIRMA */}
            <div className="mb-2 rounded-2xl border border-gray-100 p-2.5">
              <div className="mb-1.5 inline-block rounded-lg bg-[#001A3F] px-2 py-0.5 text-[9px] font-bold text-white">
                {pc.generalScoreLabel}
              </div>
              <div className="flex flex-col items-center gap-2 md:flex-row md:items-start">
                <div className="flex w-full max-w-[130px] flex-col items-center">
                  <GaugeChart score={report.generalScore} />
                </div>
                <div className="flex-1">
                  <p className="mb-0.5 text-center text-[9px] font-bold text-gray-500 md:text-left">{pc.scoreComparisonLabel}</p>
                  <ResponsiveContainer width="100%" height={100}>
                    <BarChart data={comparisonData} margin={{ top: 14, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis
                        dataKey="name"
                        interval={0}
                        tick={{ fontSize: 8, fill: "#001A3F", fontWeight: 600 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: "#94A3B8" }} tickLine={false} axisLine={false} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={28} isAnimationActive={false}>
                        {comparisonData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                        <LabelList dataKey="value" position="top" style={{ fontSize: 10, fontWeight: 800, fill: "#001A3F" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* NEDENLER + KUME */}
            <div className="mb-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 p-2.5">
                <div className="mb-1.5 inline-block rounded-lg bg-[#001A3F] px-2 py-0.5 text-[9px] font-bold text-white">
                  {pc.reasonsTitle}
                </div>
                <div className="flex flex-col gap-1.5">
                  {sortedFactors.map((factor) => {
                    const Icon = FACTOR_ICONS[factor.key] ?? Wallet;
                    const color = FACTOR_COLORS[factor.key] ?? "#64748B";
                    return (
                      <div key={factor.key} className="flex items-center gap-1.5">
                        <div
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: color }}
                        >
                          <Icon size={10} className="text-white" />
                        </div>
                        <p className="w-24 shrink-0 text-[9px] font-bold text-[#001A3F] sm:text-[10px]">
                          {factorLabels[factor.key]}
                        </p>
                        <div className="h-1.5 flex-1 rounded-full bg-gray-100">
                          <div
                            className="h-1.5 rounded-full"
                            style={{ width: `${Math.max(2, factor.score)}%`, backgroundColor: color }}
                          />
                        </div>
                        <p className="w-8 shrink-0 text-right text-[9px] font-extrabold text-[#001A3F] sm:text-[10px]">
                          {factor.score.toFixed(1)}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1 text-right text-[8px] text-gray-400">{pc.avgScoreCaption}</p>
              </div>

              <div className="rounded-2xl border border-gray-100 p-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="inline-block rounded-lg bg-[#001A3F] px-2 py-0.5 text-[9px] font-bold text-white">
                    {pc.dominantClusterTitle}
                  </div>
                  <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[8px] font-bold text-teal-700">
                    {pc.dominantClusterBadge}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5 text-center sm:flex-row sm:items-start sm:text-left">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-4 border-teal-100 bg-teal-50">
                    <ClusterIcon size={18} className="text-teal-600" />
                  </div>
                  <div>
                    <h3 className="mb-0.5 text-[11px] font-black uppercase leading-snug text-[#001A3F] sm:text-xs">
                      {clusterTitle}
                    </h3>
                    <p className="text-[9px] leading-snug text-gray-500">
                      {report.clusterInfo ? sr.clusterDescriptions[report.clusterInfo.key] || report.clusterInfo.description : ""}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* KISA OZET SERIDI */}
            <div className="mb-2 grid grid-cols-2 gap-2 rounded-2xl border border-gray-100 p-2 sm:grid-cols-5">
              <div className="mb-0.5 hidden text-[9px] font-bold text-[#001A3F] sm:col-span-5 sm:block">{pc.summaryTitle}</div>

              <div className="flex items-center gap-1.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50">
                  <Target size={12} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-[8px] font-semibold uppercase text-gray-400">{pc.generalScoreShort}</p>
                  <p className="text-[11px] font-extrabold text-[#001A3F]">
                    {report.generalScore?.toFixed(1)}<span className="text-[9px] font-medium text-gray-400">/100</span>
                  </p>
                  <p className="text-[8px] text-gray-400">
                    {generalClassification ? classificationLabels[generalClassification] : ""} {pc.trendSuffix}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-50">
                  <TrendingUp size={12} className="text-teal-600" />
                </div>
                <div>
                  <p className="text-[8px] font-semibold uppercase text-gray-400">{pc.migrationIntentLabel}</p>
                  <p className="text-[11px] font-extrabold text-[#001A3F]">
                    {classificationLabels[classifyScore(report.migrationIntentScore)] ?? "-"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-50">
                  <Trophy size={12} className="text-amber-500" />
                </div>
                <div>
                  <p className="text-[8px] font-semibold uppercase text-gray-400">{pc.strongestFactorLabel}</p>
                  <p className="text-[11px] font-extrabold text-[#001A3F]">{topFactor ? factorLabels[topFactor.key] : "-"}</p>
                  <p className="text-[8px] text-gray-400">{topFactor ? `(${topFactor.score.toFixed(1)})` : ""}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100">
                  <TrendingDown size={12} className="text-gray-500" />
                </div>
                <div>
                  <p className="text-[8px] font-semibold uppercase text-gray-400">{pc.weakestFactorLabel}</p>
                  <p className="text-[11px] font-extrabold text-[#001A3F]">
                    {weakestFactor ? factorLabels[weakestFactor.key] : "-"}
                  </p>
                  <p className="text-[8px] text-gray-400">{weakestFactor ? `(${weakestFactor.score.toFixed(1)})` : ""}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-50">
                  <Users size={12} className="text-teal-600" />
                </div>
                <div>
                  <p className="text-[8px] font-semibold uppercase text-gray-400">{pc.clusterLabel}</p>
                  <p className="text-[9px] font-extrabold leading-tight text-[#001A3F]">{clusterTitle}</p>
                </div>
              </div>
            </div>

            {/* PAYLASIM ALANI */}
            <div className="rounded-2xl bg-[#001A3F] p-3 text-white">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="mb-0.5 flex items-center gap-1.5 text-xs font-extrabold">
                    <Share2 size={13} />
                    {pc.shareTitle}
                  </p>
                  <p className="mb-1.5 text-[9px] text-blue-200">{pc.shareSubtitle}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SOCIAL_BUTTONS.map((s) => (
                      <div key={s.key} className="flex flex-col items-center gap-0.5">
                        <div
                          className="flex h-6 w-6 items-center justify-center rounded-full text-[8px] font-extrabold"
                          style={{ backgroundColor: s.bg }}
                        >
                          {s.letter}
                        </div>
                        <span className="text-[7px] text-blue-200">{s.label}</span>
                      </div>
                    ))}
                    <button type="button" onClick={handleCopyLink} className="flex flex-col items-center gap-0.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15">
                        <Link2 size={12} />
                      </div>
                      <span className="text-[7px] text-blue-200">{copyFeedback ? pc.copiedFeedback : pc.copyLink}</span>
                    </button>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <div className="rounded-xl bg-white p-1.5">
                    <QRCodeSVG value={typeof window !== "undefined" ? window.location.href : "https://goclab.com"} size={44} />
                  </div>
                  <div className="max-w-[120px]">
                    <p className="mb-1 text-[8px] text-blue-200">{pc.qrHint}</p>
                    <button
                      type="button"
                      onClick={handleDownload}
                      disabled={isDownloading}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-[#001A3F] hover:bg-blue-50 disabled:opacity-60"
                    >
                      {isDownloading ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                      {pc.downloadCard}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/10 pt-1.5">
                {["#GöçLab", "#GençGöçEğilimi", "#Verideniçgörüye", "#GeleceğeBirAdım"].map((tag) => (
                  <span key={tag} className="rounded-full bg-white/10 px-1.5 py-0.5 text-[8px] font-medium text-blue-100">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
