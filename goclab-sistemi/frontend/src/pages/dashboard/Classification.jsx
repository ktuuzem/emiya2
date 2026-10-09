import { useEffect, useState } from "react";
import {
  Brain,
  CheckCircle2,
  Activity,
  ShieldCheck,
  Trophy,
  Sparkles,
  Zap,
  Info,
  Briefcase,
  Share2,
  GraduationCap,
  Landmark,
  Frown,
  RotateCcw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  LabelList,
  CartesianGrid,
} from "recharts";

const API_BASE_URL = "http://localhost:5000";

const SELECT_FIELDS = [
  { key: "yasGrubu", optionsKey: "yasGrubu" },
  { key: "cinsiyet", optionsKey: "cinsiyet" },
  { key: "egitimDurumu", optionsKey: "egitimSeviyesi" },
  { key: "istihdamDurumu", optionsKey: "istihdamDurumu" },
  { key: "medeniDurum", optionsKey: "medeniDurum" },
  { key: "ikametBolgesi", optionsKey: "ikametYeri" },
  { key: "gelirDuzeyi", optionsKey: "gelirDuzeyi" },
  { key: "yurtDisindaAile", optionsKey: "aileYurtdisi" },
  { key: "yurtDisiDeneyimi", optionsKey: "yurtdisiDeneyimi" },
  { key: "hedefUlke", optionsKey: "hedefUlke" },
  { key: "dilYetkinligi", optionsKey: "dilYetkinligi" },
];

// Moldova modeli (rf_model_moldova.joblib) ham MD degerleriyle egitildigi icin
// her alanin backend'e giden payloadKey'i modelin ozellik adidir. isCode:
// anlami dogrulanmamis sayisal kodlar (etiket yerine "Kod N" gosterilir).
const MD_SELECT_FIELDS = [
  { key: "yasGrubu", optionsKey: "yasGrubu", payloadKey: "yas_grubu" },
  { key: "cinsiyet", optionsKey: "cinsiyet", payloadKey: "cinsiyet" },
  { key: "egitimDurumu", optionsKey: "egitimSeviyesi", payloadKey: "egitim_level" },
  { key: "istihdamDurumu", optionsKey: "istihdamDurumu", payloadKey: "istiftam" },
  { key: "medeniDurum", optionsKey: "medeniDurum", payloadKey: "medeni_durum" },
  { key: "gelirDuzeyi", optionsKey: "gelirDuzeyi", payloadKey: "gelir", isCode: true },
  { key: "yurtDisindaAile", optionsKey: "yurtDisindaAile", payloadKey: "yurt_disi_yasayan_aile_durumu" },
  { key: "yurtDisiDeneyimi", optionsKey: "yurtDisiDeneyimi", payloadKey: "yurt_disi_bulunma_durumu" },
  { key: "hedefUlke", optionsKey: "hedefUlke", payloadKey: "gitmek_istedigi_ulke" },
  { key: "dilSayisi", optionsKey: "dilSayisi", payloadKey: "dil_sayisi" },
];

// Form tek tek yas gosterir; modeller yas gruplariyla egitildigi icin secilen yas,
// egitimdeki ilgili gruba cevrilir (TR: 18-21/22-25/26-30, MD: 18-21/22-25/26-33).
function ageGroupFor(age, isMoldova) {
  if (age === "" || age === null || age === undefined) return "";
  const a = Number(age);
  if (a <= 21) return "18-21";
  if (a <= 25) return "22-25";
  return isMoldova ? "26-33" : "26-30";
}

const SLIDER_FIELDS = [
  { key: "ekonomik_istihdam", color: "#4C1D95" },
  { key: "aile_sosyal", color: "#2563EB" },
  { key: "sosyo_politik", color: "#38BDF8" },
  { key: "egitim", color: "#16A34A" },
  { key: "cevresel", color: "#14B8A6" },
  { key: "psikolojik", color: "#DB2777" },
  { key: "kulturel", color: "#EA580C" },
];

const DEFAULT_SELECTS = [...SELECT_FIELDS, ...MD_SELECT_FIELDS].reduce((acc, f) => ({ ...acc, [f.key]: "" }), {});
const DEFAULT_SLIDERS = SLIDER_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: 50 }), {});

const CLUSTER_ICONS = {
  K1: Briefcase,
  K2: Share2,
  K3: GraduationCap,
  K4: Landmark,
  K5: Frown,
};

const MIGRATION_LEVEL_COLORS = {
  "Düşük": "#DC2626",
  "Orta": "#EA580C",
  "Yüksek": "#16A34A",
};

function getAdminToken() {
  try {
    const stored = localStorage.getItem("goclab_admin_session");
    return stored ? JSON.parse(stored)?.token : null;
  } catch {
    return null;
  }
}

function MetricCard({ icon, iconBg, title, value, subtitle }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>{icon}</div>
      </div>
      <p className="text-3xl font-extrabold text-[#001A3F]">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{subtitle}</p>
    </div>
  );
}

export default function Classification({ t, dataScope = "turkey" }) {
  const cp = t.classificationPage;
  const isMoldova = dataScope === "moldova";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [selects, setSelects] = useState(DEFAULT_SELECTS);
  const [sliders, setSliders] = useState(DEFAULT_SLIDERS);
  const [predicting, setPredicting] = useState(false);
  const [predictionResult, setPredictionResult] = useState(null);
  const [predictionError, setPredictionError] = useState("");
  const [migrationPrediction, setMigrationPrediction] = useState(null);
  const [migrationError, setMigrationError] = useState("");

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const token = getAdminToken();
        const query = isMoldova ? "?country=md" : "";
        const res = await fetch(`${API_BASE_URL}/api/classification-metrics${query}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setErrorMessage(json.message || cp.notFound);
          return;
        }
        if (!json.trained) {
          setErrorMessage(json.message);
          return;
        }
        setData(json);
      } catch {
        setErrorMessage(cp.networkError);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [cp, isMoldova]);

  const simulatorFields = isMoldova ? MD_SELECT_FIELDS : SELECT_FIELDS;

  const handleSelectChange = (key, value) => {
    setSelects((prev) => ({ ...prev, [key]: value }));
  };

  const handleSliderChange = (key, value) => {
    setSliders((prev) => ({ ...prev, [key]: Number(value) }));
  };

  const handleResetSimulator = () => {
    setSelects(DEFAULT_SELECTS);
    setSliders(DEFAULT_SLIDERS);
    setPredictionResult(null);
    setPredictionError("");
    setMigrationPrediction(null);
    setMigrationError("");
  };

  const handlePredict = async () => {
    setPredicting(true);
    setPredictionError("");
    setPredictionResult(null);
    setMigrationError("");
    setMigrationPrediction(null);
    try {
      const token = getAdminToken();
      const authHeaders = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const country = isMoldova ? "md" : "tr";

      // 1) Kume benzerligi (K-Means merkezlerine Oklid mesafesi - Random Forest'tan bagimsiz).
      const clusterPayload = {
        country,
        scores: {
          ekonomik_istihdam: sliders.ekonomik_istihdam,
          aile_sosyal: sliders.aile_sosyal,
          sosyo_politik: sliders.sosyo_politik,
          egitim: sliders.egitim,
          cevresel: sliders.cevresel,
          psikolojik: sliders.psikolojik,
          kulturel: sliders.kulturel,
        },
      };

      // 2) Goc niyeti duzeyi tahmini (Random Forest - 7 faktor skoru + demografik alanlar).
      const scoreFields = {
        score_ekonomik_istihdam: sliders.ekonomik_istihdam,
        score_aile_sosyal: sliders.aile_sosyal,
        score_sosyo_politik: sliders.sosyo_politik,
        score_egitim: sliders.egitim,
        score_cevresel: sliders.cevresel,
        score_psikolojik: sliders.psikolojik,
        score_kulturel: sliders.kulturel,
      };
      const dilYok = selects.dilYetkinligi === "Yok" || !selects.dilYetkinligi;
      const migrationPayload = isMoldova
        ? {
            country,
            ...scoreFields,
            ...MD_SELECT_FIELDS.reduce((acc, f) => ({ ...acc, [f.payloadKey]: selects[f.key] }), {}),
            yas_grubu: ageGroupFor(selects.yasGrubu, true),
          }
        : {
            ...scoreFields,
            yas_grubu: ageGroupFor(selects.yasGrubu, false),
            cinsiyet: selects.cinsiyet,
            egitim_seviyesi: selects.egitimDurumu,
            istihdam_durumu: selects.istihdamDurumu,
            medeni_durum: selects.medeniDurum,
            mevcut_ikamet_yeri: selects.ikametBolgesi,
            gelir_duzeyi: selects.gelirDuzeyi,
            aile_yurtdisi: selects.yurtDisindaAile,
            onceki_yurtdisi: selects.yurtDisiDeneyimi,
            hedef_ulke: selects.hedefUlke,
            ingilizce_duzeyi: dilYok ? "Yok" : selects.dilYetkinligi,
            yabanci_dil_ingilizce: dilYok ? "Hayır" : "Evet",
            yabanci_dil_almanca: "Hayır",
            yabanci_dil_arapca: "Hayır",
            yabanci_dil_rusca: "Hayır",
            yabanci_dil_fransizca: "Hayır",
            sektor: "Yok",
            dogum_yeri: "Bilinmiyor",
          };
      const [clusterRes, migrationRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/simulator/predict`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(clusterPayload),
        }),
        fetch(`${API_BASE_URL}/api/predict-simulation`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(migrationPayload),
        }),
      ]);

      const clusterJson = await clusterRes.json();
      if (!clusterRes.ok || !clusterJson.success) {
        setPredictionError(clusterJson.message || cp.predictionError);
      } else {
        setPredictionResult(clusterJson);
      }

      const migrationJson = await migrationRes.json();
      if (!migrationRes.ok || !migrationJson.success) {
        setMigrationError(migrationJson.message || cp.predictionError);
      } else {
        setMigrationPrediction(migrationJson);
      }
    } catch {
      setPredictionError(cp.networkError);
      setMigrationError(cp.networkError);
    } finally {
      setPredicting(false);
    }
  };

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
        <p className="max-w-md text-center text-sm font-medium text-red-500">
          {errorMessage || cp.notFound}
        </p>
      </div>
    );
  }

  const translatedFeatureImportances = data.featureImportances.map((item) => ({
    ...item,
    label: cp.featureLabels[item.key] || item.label,
  }));
  const featureChartData = [...translatedFeatureImportances].reverse();
  const topFeatures = [...translatedFeatureImportances]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 3);
  const classes = data.classes;
  const classLabel = (c) => t.overviewPage.classificationLabels?.[c] || c;
  const clusterTitles = isMoldova ? t.kMeansPage.clustersMoldova : t.kMeansPage.clusters;

  return (
    <div className="flex flex-col gap-6">
      {/* BAŞLIK */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
            <Brain size={22} className="text-indigo-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#001A3F]">{cp.title}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {cp.datasetLabel} {data.datasetName} • {cp.algorithmLabel}{" "}
              {cp.algorithmNames?.[data.algorithm] || data.algorithm} •{" "}
              {cp.targetLabel} {cp.targetValue} • {cp.testRatioLabel} %{Math.round(data.testSizeRatio * 100)} •{" "}
              {cp.dateLabel}{" "}
              {new Date(data.generatedAt).toLocaleDateString("tr-TR")}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-sm font-semibold text-green-700">
          <CheckCircle2 size={16} />
          {cp.modelActive}
        </span>
      </div>

      {/* METRİK KARTLARI */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard
          icon={<CheckCircle2 size={18} className="text-green-700" />}
          iconBg="bg-green-100"
          title={cp.accuracyTitle}
          value={`${(data.accuracy * 100).toFixed(1)}%`}
          subtitle={
            data.baselineAccuracy !== undefined
              ? `${cp.accuracySubtitle} • ${cp.baselineLabel} %${(data.baselineAccuracy * 100).toFixed(1)}`
              : cp.accuracySubtitle
          }
        />
        <MetricCard
          icon={<Activity size={18} className="text-indigo-700" />}
          iconBg="bg-indigo-100"
          title={cp.f1Title}
          value={data.f1Score.toFixed(4)}
          subtitle={cp.f1Subtitle}
        />
        <MetricCard
          icon={<ShieldCheck size={18} className="text-purple-700" />}
          iconBg="bg-purple-100"
          title={cp.precisionTitle}
          value={data.precision.toFixed(4)}
          subtitle={cp.precisionSubtitle}
        />
      </div>

      {/* ÖZNİTELİK + EN ETKİLİ 3 + KONFÜZYON MATRİSİ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ÖZNİTELİK ÖNEM DÜZEYLERİ */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-[#001A3F]">{cp.featureImportanceTitle}</h3>
          <p className="mb-4 text-xs text-gray-400">{cp.featureImportanceSubtitle}</p>
          <ResponsiveContainer width="100%" height={Math.max(320, featureChartData.length * 24)}>
            <BarChart
              data={featureChartData}
              layout="vertical"
              margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, "dataMax + 3"]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="label"
                width={150}
                tick={{ fontSize: 11, fill: "#334155" }}
              />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="importance" fill="#1D4ED8" radius={[0, 4, 4, 0]} barSize={12}>
                <LabelList dataKey="importance" position="right" formatter={(v) => `${v}%`} style={{ fontSize: 11, fill: "#334155" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col gap-6">
          {/* EN ETKİLİ 3 ÖZNİTELİK */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-[#001A3F]">
              <Trophy size={18} className="text-amber-500" />
              {cp.topFeaturesTitle}
            </h3>
            <div className="flex flex-col gap-3">
              {topFeatures.map((feature, i) => (
                <div key={feature.key} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                    {i + 1}
                  </span>
                  <span className="text-sm font-semibold text-[#001A3F]">{feature.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* KONFÜZYON MATRİSİ */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="text-base font-bold text-[#001A3F]">{cp.confusionMatrixTitle}</h3>
            <p className="mb-4 text-xs text-gray-400">
              {cp.confusionMatrixSubtitlePrefix}
              {Math.round(data.testSizeRatio * 100)}
              {cp.confusionMatrixSubtitleSuffix}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-center text-xs">
                <thead>
                  <tr>
                    <th className="p-1.5" />
                    {classes.map((c) => (
                      <th key={c} className="p-1.5 font-bold text-indigo-700">
                        {classLabel(c)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.confusionMatrix.map((row, i) => (
                    <tr key={classes[i]}>
                      <th className="p-1.5 text-right font-bold text-indigo-700">{classLabel(classes[i])}</th>
                      {row.map((value, j) => (
                        <td
                          key={j}
                          className={`rounded-md p-2 font-semibold ${
                            i === j ? "bg-indigo-100 text-indigo-800" : "text-gray-600"
                          }`}
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* GELİŞMİŞ TAHMİN SİMÜLATÖRÜ (ülkeye göre kendi modeli: TR rf_model / MD rf_model_moldova) */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles size={18} className="text-indigo-700" />
          <h3 className="text-base font-bold text-[#001A3F]">{cp.simulatorTitle}</h3>
        </div>
        <p className="mb-4 text-xs text-gray-400">{cp.simulatorSubtitle}</p>

        {/* SELECTLER */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {simulatorFields.map((field) => (
            <div key={field.key} className="flex flex-col gap-1">
              <label className="text-[11px] font-bold tracking-wide text-gray-400">
                {cp.fieldLabels[field.key]}
              </label>
              <select
                value={selects[field.key]}
                onChange={(e) => handleSelectChange(field.key, e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              >
                <option value="">
                  {cp.selectPlaceholder}
                </option>
                {(data.simulatorOptions[field.optionsKey] || []).map((opt) => {
                  // Moldova "hedefUlke": backend sadece COK DILLI olmayan kanonik
                  // ulke adini (orn. "Germany") dondurur - gercek etiket buradan,
                  // cp.countryNames (TR/EN/RO) sozlugunden cevrilir. Diger tum
                  // alanlarda (TR dahil) dogrudan cp.optionLabels kullanilir.
                  const canonical = field.optionsKey === "hedefUlke" ? data.simulatorOptionLabels?.hedefUlke?.[opt] : null;
                  const label =
                    (canonical && cp.countryNames?.[canonical]) ||
                    cp.optionLabels[field.optionsKey]?.[opt] ||
                    canonical ||
                    (field.isCode ? `${cp.codeOptionPrefix} ${opt}` : opt);
                  return (
                    <option key={opt} value={opt}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
          ))}
        </div>

        {/* SLIDERLAR */}
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SLIDER_FIELDS.map((field) => (
            <div key={field.key} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#001A3F]">{cp.sliderLabels[field.key]}</label>
                <span className="text-xs font-bold" style={{ color: field.color }}>
                  {sliders[field.key]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">0</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sliders[field.key]}
                  onChange={(e) => handleSliderChange(field.key, e.target.value)}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-indigo-600"
                  style={{ accentColor: field.color }}
                />
                <span className="text-[10px] text-gray-400">100</span>
              </div>
            </div>
          ))}
        </div>

        {/* BUTON + SONUÇ */}
        <div className="mt-6 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handlePredict}
              disabled={predicting}
              className="flex items-center gap-2 rounded-xl bg-indigo-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Zap size={16} />
              {predicting ? cp.calculatingButton : cp.calculateButton}
            </button>
            <button
              type="button"
              onClick={handleResetSimulator}
              disabled={predicting}
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw size={16} />
              {cp.clearButton}
            </button>
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <Info size={14} />
              {cp.incompleteHint}
            </span>
          </div>

          {predictionError && (
            <p className="text-sm font-medium text-red-500">{predictionError}</p>
          )}

          {predictionResult && (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${predictionResult.dominantCluster.color}1A` }}
                  >
                    {(() => {
                      const DominantIcon = CLUSTER_ICONS[predictionResult.dominantCluster.key] || Sparkles;
                      return <DominantIcon size={20} style={{ color: predictionResult.dominantCluster.color }} />;
                    })()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                      {cp.resultDominantLabel}
                    </p>
                    <p
                      className="truncate text-sm font-extrabold sm:text-base"
                      style={{ color: predictionResult.dominantCluster.color }}
                      title={clusterTitles?.[predictionResult.dominantCluster.key] || predictionResult.dominantCluster.title}
                    >
                      {clusterTitles?.[predictionResult.dominantCluster.key] || predictionResult.dominantCluster.title}
                    </p>
                  </div>
                </div>
                <p
                  className="shrink-0 text-3xl font-extrabold"
                  style={{ color: predictionResult.dominantCluster.color }}
                >
                  %{predictionResult.dominantCluster.percentage}
                </p>
              </div>

              <p className="mb-2 mt-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                {cp.resultDistributionLabel}
              </p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {predictionResult.distribution.map((cluster) => {
                  const ClusterIcon = CLUSTER_ICONS[cluster.key] || Sparkles;
                  const label = clusterTitles?.[cluster.key] || cluster.title;
                  return (
                    <div
                      key={cluster.key}
                      className="flex flex-col items-center gap-1 rounded-xl bg-white px-2 py-3 text-center shadow-sm"
                    >
                      <ClusterIcon size={16} style={{ color: cluster.color }} />
                      <p className="line-clamp-2 text-xs font-semibold leading-tight text-gray-500" title={label}>
                        {label}
                      </p>
                      <p className="text-sm font-extrabold" style={{ color: cluster.color }}>
                        %{cluster.percentage}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {migrationError && (
            <p className="text-sm font-medium text-red-500">{migrationError}</p>
          )}

          {migrationPrediction && (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{cp.migrationResultTitle}</p>
              <p className="mb-3 text-xs text-gray-400">{cp.migrationResultSubtitle}</p>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
                <p
                  className="text-lg font-extrabold sm:text-xl"
                  style={{ color: MIGRATION_LEVEL_COLORS[migrationPrediction.predictedLabel] || "#001A3F" }}
                >
                  {classLabel(migrationPrediction.predictedLabel)}
                </p>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{cp.migrationConfidenceLabel}</p>
                  <p
                    className="text-2xl font-extrabold"
                    style={{ color: MIGRATION_LEVEL_COLORS[migrationPrediction.predictedLabel] || "#001A3F" }}
                  >
                    %{(migrationPrediction.confidence * 100).toFixed(1)}
                  </p>
                </div>
              </div>

              <p className="mb-2 mt-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                {cp.migrationClassProbabilitiesLabel}
              </p>
              <div className="flex flex-col gap-2">
                {migrationPrediction.classProbabilities.map((item) => {
                  const color = MIGRATION_LEVEL_COLORS[item.label] || "#64748B";
                  return (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-xs font-semibold text-gray-600">{classLabel(item.label)}</span>
                      <div className="h-2 flex-1 rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full"
                          style={{ width: `${item.probability * 100}%`, backgroundColor: color }}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right text-xs font-bold text-gray-500">
                        %{(item.probability * 100).toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
