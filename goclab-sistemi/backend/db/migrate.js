const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

// GUVENLIK: Bu iki test/ilk-kurulum hesabinin sifreleri ONCEDEN schema.sql
// icinde duz metin olarak yaziliydi (kaynak kodu goren herkes bilebiliyordu).
// Artik .env'deki SEED_YONETICI_PASSWORD / SEED_SYSADMIN_PASSWORD degerleri
// kullanilir; hicbiri ayarlanmamissa rastgele bir sifre uretilip SADECE
// konsola bir kereligine yazdirilir (veritabanina her zaman bcrypt hash'i
// olarak yazilir, duz metin hicbir yerde saklanmaz).
function resolvePassword(envValue, label) {
  if (envValue && envValue.trim()) return { password: envValue.trim(), generated: false };
  const generated = crypto.randomBytes(9).toString("base64url");
  console.log(`\n[migrate] UYARI: ${label} icin ortam degiskeni ayarlanmamis, rastgele bir sifre uretildi.`);
  console.log(`[migrate] ${label} sifresi (SADECE BU SEFERLIK gosteriliyor, kaydedin): ${generated}\n`);
  return { password: generated, generated: true };
}

async function seedYoneticiAccount() {
  const existing = await pool.query("SELECT id FROM students WHERE email = $1", ["yonetici@goclab.com"]);
  if (existing.rows.length > 0) return; // idempotent: zaten olusturulmus, sifreyi degistirme

  const institution = await pool.query("SELECT id FROM institutions WHERE name = $1", ["GÖÇLAB"]);
  if (institution.rows.length === 0) return; // schema.sql henuz bu kurumu olusturmadiysa atla

  const { password } = resolvePassword(process.env.SEED_YONETICI_PASSWORD, "Yonetici Hesabi (yonetici@goclab.com)");
  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO students (first_name, last_name, email, institution, institution_id, password_hash, activation_code, is_active, role)
     VALUES ('Yönetici', 'Hesabı', 'yonetici@goclab.com', 'GÖÇLAB', $1, $2, '000000', true, 'admin')
     ON CONFLICT (email) DO NOTHING`,
    [institution.rows[0].id, passwordHash]
  );
}

async function seedSysAdminAccount() {
  const existing = await pool.query("SELECT id FROM system_admins WHERE email = $1", ["admin@goclab.com"]);
  if (existing.rows.length > 0) return; // idempotent: zaten olusturulmus, sifreyi degistirme

  const { password } = resolvePassword(process.env.SEED_SYSADMIN_PASSWORD, "Sistem Yoneticisi (admin@goclab.com)");
  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO system_admins (first_name, last_name, email, password_hash, role, is_active)
     VALUES ('Sistem', 'Yöneticisi', 'admin@goclab.com', $1, 'super_admin', true)
     ON CONFLICT (email) DO NOTHING`,
    [passwordHash]
  );
}

async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  try {
    await pool.query(schema);
    console.log("Veritabani semasi basariyla olusturuldu (students tablosu).");

    await seedYoneticiAccount();
    await seedSysAdminAccount();
  } catch (err) {
    console.error("Sema olusturma hatasi:", err.message);
  } finally {
    await pool.end();
  }
}

migrate();
