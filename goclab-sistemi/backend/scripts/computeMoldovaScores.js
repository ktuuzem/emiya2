// anket_son_sayisal tablosundaki Moldova (ulke='md') satirlari icin, raw_survey_data
// ile AYNI Ek A faktor yapisini (scoring.js -> FACTOR_GROUPS/MIGRATION_INTENT_GROUP,
// L1-L51 madde kodlari) kullanarak 7 faktor skorunu + genel goc niyeti skorunu
// hesaplayip score_* sutunlarina yazar. L1-L51 burada zaten sayisal (1-5) oldugu
// icin scoring.js'teki likertToNumber fonksiyonu (sayilari dogrudan kabul eder)
// hicbir degisiklik gerektirmeden calisir.
// Calistirma: node scripts/computeMoldovaScores.js
require("dotenv").config();
const { Pool } = require("pg");
const { computeRowScores, classifyScore } = require("../utils/scoring");
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

(async () => {
  const likertCols = Array.from({ length: 51 }, (_, i) => `l${i + 1}`);
  const rows = (
    await pool.query(
      `SELECT id, ${likertCols.join(", ")} FROM anket_son_sayisal WHERE ulke = 'md' ORDER BY id`
    )
  ).rows;
  console.log("Islenecek Moldova satiri:", rows.length);

  for (const row of rows) {
    const scores = computeRowScores(row);
    const siniflandirma = classifyScore(scores.goc_niyeti);
    await pool.query(
      `UPDATE anket_son_sayisal SET
         score_ekonomik_istihdam = $1, score_egitim = $2, score_aile_sosyal = $3, score_kulturel = $4,
         score_sosyo_politik = $5, score_cevresel = $6, score_goc_niyeti = $7, score_psikolojik = $8,
         goc_niyeti_siniflandirma = $9, scores_computed_at = NOW()
       WHERE id = $10`,
      [
        scores.ekonomik_istihdam, scores.egitim, scores.aile_sosyal, scores.kulturel,
        scores.sosyo_politik, scores.cevresel, scores.goc_niyeti, scores.psikolojik,
        siniflandirma, row.id,
      ]
    );
  }
  console.log("Skorlar hesaplandi.");

  const check = await pool.query(`
    SELECT count(*) n,
      count(*) filter (where score_ekonomik_istihdam is null) e_null,
      count(*) filter (where score_goc_niyeti is null) g_null,
      round(avg(score_ekonomik_istihdam),2) eko_ort, round(avg(score_egitim),2) egi_ort,
      round(avg(score_aile_sosyal),2) ail_ort, round(avg(score_kulturel),2) kul_ort,
      round(avg(score_sosyo_politik),2) sos_ort, round(avg(score_cevresel),2) cev_ort,
      round(avg(score_goc_niyeti),2) goc_ort, round(avg(score_psikolojik),2) psi_ort
    FROM anket_son_sayisal WHERE ulke = 'md'
  `);
  console.log("KONTROL:", JSON.stringify(check.rows[0], null, 1));
  await pool.end();
})();
