// Excel (backend/data/anket-son-sayisal.xlsx) dosyasindaki, Turkiye (tr) ve
// Moldova (md) katilimcilarinin BIRLESIK ham anket verisini, raw_survey_data'dan
// BAGIMSIZ, ayri bir 'anket_son_sayisal' tablosuna satir ve sutun sirasi
// korunarak birebir aktarir. L1-L51 kaynakta zaten sayisal (1-5) oldugu icin
// metin donusumune gerek yoktur.
// Calistirma: node scripts/importAnketSonSayisal.js
//   (Mevcut anket_son_sayisal satirlari once TRUNCATE edilir.)

const path = require("path");
const XLSX = require("xlsx");
const { Pool } = require("pg");
require("dotenv").config();

const EXCEL_PATH = path.join(__dirname, "..", "data", "anket-son-sayisal.xlsx");
const LIKERT_QUESTION_COUNT = 51;

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

function toInt(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : Math.trunc(n);
}

function toStr(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  return String(raw);
}

// Excel'deki gercek baslik -> anket_son_sayisal sutun adi eslesmesi (sabit, birebir).
const COLUMN_MAP = [
  ["ulke", "ulke", toStr],
  ["dil", "dil", toInt],
  ["cinsiyet", "cinsiyet", toInt],
  ["yas", "yas", toInt],
  ["medeni_durum", "medeni_durum", toStr],
  ["egitim_level", "egitim_level", toStr],
  ["istiftam", "istiftam", toStr],
  ["sektor_type", "sektor_type", toStr],
  ["gelir", "gelir", toStr],
  ["bolge", "bolge", toInt],
  ["ikamet", "ikamet", toStr],
  ["Yabancı Dil Bilgisi [Yabancı dilim yok]", "yabanci_dil_bilgisi_yok", toInt],
  ["dil_sayisi", "dil_sayisi", toInt],
  ["yurt_disi_yasayan_aile_durumu", "yurt_disi_yasayan_aile_durumu", toInt],
  ["yurt_disi_bulunma_durumu", "yurt_disi_bulunma_durumu", toInt],
  ["gitmek_istedigi_ulke", "gitmek_istedigi_ulke", toStr],
  ["gitmek_istedigi_ulke_2", "gitmek_istedigi_ulke_2", toStr],
  ["gitmek_istedigi_ulke_3", "gitmek_istedigi_ulke_3", toStr],
  ["gitmek_istedigi_ulke_4", "gitmek_istedigi_ulke_4", toStr],
];
for (let i = 1; i <= LIKERT_QUESTION_COUNT; i++) {
  COLUMN_MAP.push([`L${i}`, `l${i}`, toInt]);
}

async function truncateExisting() {
  const existing = await pool.query("SELECT COUNT(*) AS n FROM anket_son_sayisal");
  if (Number(existing.rows[0].n) > 0) {
    await pool.query("TRUNCATE TABLE anket_son_sayisal RESTART IDENTITY");
    console.log(`Mevcut ${existing.rows[0].n} satir temizlendi (TRUNCATE), yeniden aktariliyor...`);
  }
}

async function main() {
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  if (rows.length === 0) {
    throw new Error("anket-son-sayisal.xlsx bos veya okunamadi.");
  }

  const headerKeys = Object.keys(rows[0]);
  const matched = COLUMN_MAP.filter(([excelHeader]) => headerKeys.includes(excelHeader));
  console.log(`Eslesen sutunlar: ${matched.length} / ${COLUMN_MAP.length}`);
  if (matched.length !== COLUMN_MAP.length) {
    const missing = COLUMN_MAP.filter(([h]) => !headerKeys.includes(h)).map(([h]) => h);
    throw new Error(`Eksik basliklar bulundu: ${missing.join(", ")}`);
  }

  await truncateExisting();

  const dbColumns = COLUMN_MAP.map(([, col]) => col);
  let inserted = 0;
  for (const row of rows) {
    const values = COLUMN_MAP.map(([excelHeader, , convert]) => convert(row[excelHeader]));
    const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
    await pool.query(
      `INSERT INTO anket_son_sayisal (${dbColumns.join(", ")}) VALUES (${placeholders})`,
      values
    );
    inserted++;
  }

  console.log(`Tamamlandi. Aktarilan satir sayisi: ${inserted} / ${rows.length}.`);
  const countByCountry = await pool.query(
    "SELECT ulke, count(*) FROM anket_son_sayisal GROUP BY ulke ORDER BY ulke"
  );
  console.log("Ulke dagilimi:", JSON.stringify(countByCountry.rows));
  await pool.end();
}

main().catch((err) => {
  console.error("anket-son-sayisal.xlsx aktarimi sirasinda hata olustu:", err);
  process.exit(1);
});
