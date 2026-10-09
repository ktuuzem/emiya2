require("dotenv").config();
const { Pool } = require("pg");
const pool = new Pool({ user: process.env.DB_USER, password: process.env.DB_PASSWORD, host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME });

(async () => {
  const cinsiyet = await pool.query("SELECT DISTINCT cinsiyet FROM raw_survey_data ORDER BY cinsiyet");
  console.log("cinsiyet:", cinsiyet.rows.map(r => r.cinsiyet));
  const egitim = await pool.query("SELECT DISTINCT egitim_seviyesi FROM raw_survey_data ORDER BY egitim_seviyesi");
  console.log("egitim_seviyesi:", egitim.rows.map(r => r.egitim_seviyesi));
  const istihdam = await pool.query("SELECT DISTINCT istihdam_durumu FROM raw_survey_data ORDER BY istihdam_durumu");
  console.log("istihdam_durumu:", istihdam.rows.map(r => r.istihdam_durumu));
  const ikamet = await pool.query("SELECT DISTINCT mevcut_ikamet_yeri FROM raw_survey_data ORDER BY mevcut_ikamet_yeri");
  console.log("mevcut_ikamet_yeri:", ikamet.rows.map(r => r.mevcut_ikamet_yeri));

  // Moldova harmonize edilmis etiketler (MOLDOVA_EGITIM_LABELS/MOLDOVA_ISTIHDAM_LABELS) zaten
  // server.js'de TR metinleriyle hizalanmis - bu yuzden MD tarafindan ayrica kontrol gerekmiyor,
  // ayni TR degerlerini (Lisans, Lise, vs.) kullaniyor olmasi beklenir.
  pool.end();
})();
