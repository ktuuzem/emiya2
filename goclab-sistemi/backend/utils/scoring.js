// Anket faktor gruplari, Likert -> sayisal donusum ve normalizasyon/siniflandirma mantigi.

const LIKERT_TEXT_TO_VALUE = {
  "kesinlikle katılıyorum": 5,
  "katılıyorum": 4,
  "kararsızım": 3,
  "katılmıyorum": 2,
  "kesinlikle katılmıyorum": 1,
};

function normalizeTr(text) {
  return String(text ?? "").trim().toLocaleLowerCase("tr");
}

function likertToNumber(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return raw >= 1 && raw <= 5 ? raw : null;
  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber) && asNumber >= 1 && asNumber <= 5) return asNumber;
  return LIKERT_TEXT_TO_VALUE[normalizeTr(raw)] ?? null;
}

// Sirali: ana skor (goc_niyeti) haric diger 7 faktor, radar/bar grafiklerinde bu sirayla gosterilir.
// GUNCELLEME: Tez Ek A'daki (Bolum 5.2) olcek gelistirme/guvenilirlik tablosundaki
// 35 maddelik DOGRULANMIS yapiya gore yeniden tanimlandi (bkz. sonuclar3.xlsx -
// 51 maddelik tam havuz). Her faktorun karsisindaki madde sayisi (k) ve
// omega (ω) degerleri o tablodan alinmistir; burada SADECE o tabloda
// listelenen maddeler kullanilir. Tabloda hic gecmeyen maddeler (l4, l8, l11,
// l14, l15, l21, l23, l27, l33, l36, l37, l38, l43, l47, l49, l51) guvenilirlik
// analizinde elendigi icin hicbir faktore dahil edilmemistir.
const FACTOR_GROUPS = [
  { key: "ekonomik_istihdam", label: "Ekonomik-İstihdam", columns: ["l1", "l2", "l3", "l5", "l6", "l7", "l9", "l10"] }, // k=8, ω=.76
  { key: "egitim", label: "Eğitim", columns: ["l12", "l13", "l22"] }, // k=3, ω=.80
  { key: "aile_sosyal", label: "Sosyal Ağ", columns: ["l16", "l17", "l18", "l19", "l20"] }, // k=5, ω=.83
  { key: "kulturel", label: "Kültürel-Dinî Uyum", columns: ["l24", "l25", "l26"] }, // k=3, ω=.55
  { key: "sosyo_politik", label: "Sosyo-Politik", columns: ["l28", "l29", "l30", "l31", "l32"] }, // k=5, ω=.82
  { key: "cevresel", label: "Çevresel", columns: ["l34", "l35"] }, // k=2, ω=.77
  { key: "psikolojik", label: "Göç Kaygıları", columns: ["l46", "l48", "l50"] }, // k=3, ω=.70
];

const MIGRATION_INTENT_GROUP = {
  key: "goc_niyeti",
  label: "Göç Niyeti Ölçeği",
  columns: ["l39", "l40", "l41", "l42", "l44", "l45"], // k=6, ω=.92
};

const ALL_GROUPS = [...FACTOR_GROUPS, MIGRATION_INTENT_GROUP];

// ((Ortalama Puan - 1) / 4) * 100
function normalizeScore(average) {
  if (average === null || average === undefined) return null;
  return ((average - 1) / 4) * 100;
}

function classifyScore(score) {
  if (score === null || score === undefined) return null;
  if (score <= 33) return "Düşük";
  if (score <= 66) return "Orta";
  return "Yüksek";
}

function computeRowScores(row) {
  const result = {};
  for (const group of ALL_GROUPS) {
    const values = group.columns.map((col) => likertToNumber(row[col])).filter((v) => v !== null);
    const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    result[group.key] = normalizeScore(average);
  }
  return result;
}

// Dagilim (histogram) grafikleri icin 1-5 arasi ham puan araliklari.
const BIN_LABELS = ["1.0-1.5", "1.5-2.0", "2.0-2.5", "2.5-3.0", "3.0-3.5", "3.5-4.0", "4.0-4.5", "4.5-5.0"];

function binIndexForValue(value) {
  if (value === null || value === undefined) return null;
  const idx = Math.floor((value - 1) / 0.5);
  return Math.max(0, Math.min(BIN_LABELS.length - 1, idx));
}

// Her faktor icin 1-5 arasi ham ortalama (normalize edilmemis) + tum faktor
// sorularinin duz (flat) ortalamasi (goc niyeti haric).
function computeRowRawAverages(row) {
  const result = {};
  const allValues = [];
  for (const group of FACTOR_GROUPS) {
    const values = group.columns.map((col) => likertToNumber(row[col])).filter((v) => v !== null);
    allValues.push(...values);
    result[group.key] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }
  result.overall = allValues.length > 0 ? allValues.reduce((a, b) => a + b, 0) / allValues.length : null;
  return result;
}

// Canli ogrenci anketinin (likert_responses.q1-q36) her sorusu, 51 maddelik tam
// havuzdaki HANGI L kodunun karsiligi oldugu madde metni karsilastirmasiyla
// dogrulanmistir (tez Ek A - 9.png madde havuzu tablosu). Sira numarasi l-kodu
// ile BIREBIR AYNI DEGILDIR: guvenilirlik disi birakilan maddeler (L4, L8, L11,
// L14, L15, L21, L23, L27, L33, L36-L38, L43, L47, L51) canli ankette hic
// sorulmamis, bu yuzden sonraki sorular kaymistir. q35 (L49) hicbir faktore
// dahil degildir (elenen madde); anket arayuzunden de kaldirildigi icin
// (bkz. RatingQuestions.jsx) yeni gonderimlerde q35 hep NULL kalacaktir -
// bu mapping sadece ESKI (36 soruluk donem) kayitlari dogru okumak icindir.
const LIVE_QUESTION_TO_L_CODE = {
  q1: "l1", q2: "l2", q3: "l3", q4: "l5", q5: "l6", q6: "l7", q7: "l9", q8: "l10",
  q9: "l12", q10: "l13", q11: "l16", q12: "l17", q13: "l18", q14: "l19", q15: "l20",
  q16: "l22", q17: "l24", q18: "l25", q19: "l26", q20: "l28", q21: "l29", q22: "l30",
  q23: "l31", q24: "l32", q25: "l34", q26: "l35", q27: "l39", q28: "l40", q29: "l41",
  q30: "l42", q31: "l44", q32: "l45", q33: "l46", q34: "l48", q35: "l49", q36: "l50",
};

const L_CODE_TO_LIVE_QUESTION = Object.fromEntries(
  Object.entries(LIVE_QUESTION_TO_L_CODE).map(([q, l]) => [l, q])
);

function liveColumnsFor(columns) {
  return columns.map((col) => L_CODE_TO_LIVE_QUESTION[col]).filter(Boolean);
}

// Ogrencinin q1-q36 yanitlarindan (answers = { q1: 4, q2: 5, ... }) her faktor
// ve Genel Goc Niyeti icin 0-100 normalize skor hesaplar.
function computeLiveScores(answers) {
  const result = {};
  for (const group of ALL_GROUPS) {
    const cols = liveColumnsFor(group.columns);
    const values = cols.map((col) => likertToNumber(answers[col])).filter((v) => v !== null);
    const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    result[group.key] = normalizeScore(average);
  }
  return result;
}

module.exports = {
  LIKERT_TEXT_TO_VALUE,
  FACTOR_GROUPS,
  MIGRATION_INTENT_GROUP,
  ALL_GROUPS,
  BIN_LABELS,
  likertToNumber,
  normalizeScore,
  classifyScore,
  computeRowScores,
  binIndexForValue,
  computeRowRawAverages,
  computeLiveScores,
};
