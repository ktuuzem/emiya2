// Excel (backend/data/sonuclar3.xlsx) dosyasindaki ham anket verisini,
// hicbir iliskisel tabloya bagli olmayan bagimsiz 'raw_survey_data' tablosuna
// satir ve sutun sirasi korunarak, birebir aktarir.
// NOT: Onceki sonuclar.xlsx yalnizca L1-L36 iceriyordu ve bu numaralandirma
// tez Ek A'sindaki (Bolum 5.2) olcek tablosuyla UYUSMUYORDU. sonuclar3.xlsx,
// L1-L51 arasi TUM madde havuzunu iceren guncel/dogru kaynak dosyadir.
// Calistirma: node scripts/importRawExcel.js
//   (Mevcut raw_survey_data satirlari once TRUNCATE edilir, ardindan
//   sonuclar3.xlsx'ten sifirdan aktarilir - bkz. truncateExisting().)

const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");
const { Pool } = require("pg");
require("dotenv").config();

const EXCEL_PATH = path.join(__dirname, "..", "data", "sonuclar3.xlsx");
const LIKERT_QUESTION_COUNT = 51;

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

function normalize(text) {
  return String(text ?? "")
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, " ");
}

function toInt(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : Math.trunc(n);
}

// Excel'deki gercek baslik -> raw_survey_data sutun adi eslesmesi (sabit, birebir).
const COLUMN_MAP = [
  ["Yanıt kodu", "yanit_kodu", toInt],
  ["Gönderildiği tarih", "gonderildigi_tarih", String],
  ["Son bakılan sayfa", "son_bakilan_sayfa", toInt],
  ["Başlangıç dili", "baslangic_dili", String],
  ["Tohum", "tohum", toInt],
  ["Başlangıç tarihi", "baslangic_tarihi", String],
  ["Son işlem tarihi", "son_islem_tarihi", String],
  ["Gelinen adres", "gelinen_adres", String],
  ["Cinsiyet", "cinsiyet", String],
  ["Yaş", "yas", toInt],
  ["Medeni Durum", "medeni_durum", String],
  ["Eğitim Seviyesi", "egitim_seviyesi", String],
  ["İstihdam Durumu", "istihdam_durumu", String],
  ["Sektör (çalışıyorsanız)", "sektor", String],
  ["Hangi sektörde çalışıyorsunuz?", "sektor_diger", String],
  ["Gelir Düzeyi (aylık, yaklaşık)", "gelir_duzeyi", String],
  ["İl seçiniz.", "il", String],
  ["Mevcut İkamet Yeri", "mevcut_ikamet_yeri", String],
  ["Yabancı Dil Bilgisi [Yabancı dilim yok]", "yabanci_dil_yok", String],
  ["Yabancı Dil Bilgisi [İngilizce]", "yabanci_dil_ingilizce", String],
  ["Yabancı Dil Bilgisi [Almanca]", "yabanci_dil_almanca", String],
  ["Yabancı Dil Bilgisi [Fransızca]", "yabanci_dil_fransizca", String],
  ["Yabancı Dil Bilgisi [Rusça]", "yabanci_dil_rusca", String],
  ["Yabancı Dil Bilgisi [Arapça]", "yabanci_dil_arapca", String],
  ["Yabancı Dil Bilgisi [Diğer]", "yabanci_dil_diger", String],
  ["İngilizce dil düzeyiniz", "ingilizce_duzeyi", String],
  ["Almanca dil düzeyiniz", "almanca_duzeyi", String],
  ["Fransızca dil düzeyiniz", "fransizca_duzeyi", String],
  ["Rusça dil düzeyiniz", "rusca_duzeyi", String],
  ["Arapça dil düzeyiniz", "arapca_duzeyi", String],
  ["Diğer:", "diger_dil_adi", String],
  ["Bildiğiniz yabancı dil düzeyi(Diğer)", "diger_dil_duzeyi", String],
  ["Yurt dışında yaşayan aile üyeleriniz var mı?", "aile_yurtdisi", String],
  ["Daha önce yurt dışında yaşadınız / eğitim gördünüz / çalıştınız mı?", "onceki_yurtdisi", String],
  ["Doğum yerinizi yazınız.", "dogum_yeri", String],
  ["Hangi ülkeye göç edip yaşamak isterdiniz?", "hedef_ulke", String],
];

function coerce(fn, value) {
  if (value === null || value === undefined || value === "") return null;
  return fn === String ? String(value) : fn(value);
}

function findLikertColumns(row) {
  const keys = Object.keys(row);
  const columns = [];
  for (let i = 1; i <= LIKERT_QUESTION_COUNT; i++) {
    const target = normalize(`L${i}`);
    const match = keys.find((k) => normalize(k) === target);
    columns.push(match || null);
  }
  return columns;
}

async function importRawExcel() {
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`Excel dosyasi bulunamadi: ${EXCEL_PATH}`);
    console.error("Lutfen 'sonuclar3.xlsx' dosyasini 'backend/data/' klasorune yerlestirip tekrar calistirin.");
    process.exit(1);
  }

  // Tekrar calistirildiginda satirlarin coklanmamasi (duplicate) icin tablo
  // once bosaltilir - bu tablo hicbir Foreign Key ile referans edilmediginden
  // (bkz. yukaridaki dosya basi NOT) TRUNCATE guvenlidir.
  const existing = await pool.query("SELECT COUNT(*) AS n FROM raw_survey_data");
  if (Number(existing.rows[0].n) > 0) {
    await pool.query("TRUNCATE TABLE raw_survey_data RESTART IDENTITY");
    console.log(`Mevcut ${existing.rows[0].n} satir temizlendi (TRUNCATE), yeniden aktariliyor...`);
  }

  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  if (rows.length === 0) {
    console.log("Excel dosyasinda satir bulunamadi.");
    await pool.end();
    return;
  }

  const firstRow = rows[0];
  const resolvedColumnMap = COLUMN_MAP.map(([header, dbColumn, fn]) => {
    const actualKey = Object.keys(firstRow).find((k) => normalize(k) === normalize(header));
    return { header, actualKey, dbColumn, fn };
  });
  const missing = resolvedColumnMap.filter((c) => !c.actualKey);
  if (missing.length > 0) {
    console.warn(
      "Excel'de eslesmeyen basliklar (bu alanlar bos kalacak):",
      missing.map((c) => c.header)
    );
  }

  const likertColumns = findLikertColumns(firstRow);
  console.log("Eslesen L1-L36 sutunlari:", likertColumns.filter(Boolean).length, "/", LIKERT_QUESTION_COUNT);

  const mappedKeys = new Set([
    ...resolvedColumnMap.map((c) => c.actualKey).filter(Boolean),
    ...likertColumns.filter(Boolean),
  ]);

  const dbFieldNames = resolvedColumnMap.map((c) => c.dbColumn);
  const likertFieldNames = Array.from({ length: LIKERT_QUESTION_COUNT }, (_, idx) => `l${idx + 1}`);
  const allColumns = ["row_number", ...dbFieldNames, ...likertFieldNames, "extra_data"];

  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;

    const extraData = {};
    for (const [key, value] of Object.entries(row)) {
      if (!mappedKeys.has(key)) extraData[key] = value;
    }

    const fieldValues = resolvedColumnMap.map(({ actualKey, fn }) =>
      actualKey ? coerce(fn, row[actualKey]) : null
    );
    const likertValues = likertColumns.map((col) => {
      if (!col) return null;
      const value = row[col];
      return value === null || value === undefined || value === "" ? null : String(value);
    });

    const values = [rowNumber, ...fieldValues, ...likertValues, JSON.stringify(extraData)];
    const placeholders = values.map((_, idx) => `$${idx + 1}`).join(", ");

    try {
      await pool.query(
        `INSERT INTO raw_survey_data (${allColumns.join(", ")}) VALUES (${placeholders})`,
        values
      );
      imported++;
    } catch (err) {
      console.error(`Satir ${rowNumber} aktarilirken hata olustu:`, err.message);
    }
  }

  console.log(`Tamamlandi. Aktarilan satir sayisi: ${imported} / ${rows.length}.`);
  await pool.end();
}

importRawExcel();
