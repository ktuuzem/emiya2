require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { generateActivationCode } = require("./utils/activationCode");
const {
  sendActivationEmail,
  sendPasswordResetEmail,
  sendInstitutionApprovalEmail,
  sendInstitutionPasswordResetEmail,
} = require("./utils/mailer");
const { authenticate } = require("./middleware/auth");
const { revokeToken } = require("./utils/tokenBlacklist");
const {
  FACTOR_GROUPS,
  MIGRATION_INTENT_GROUP,
  BIN_LABELS,
  computeRowScores,
  classifyScore,
  binIndexForValue,
  computeRowRawAverages,
  computeLiveScores,
} = require("./utils/scoring");
const {
  assignCluster,
  CLUSTER_TITLES,
  CLUSTER_DESCRIPTIONS,
  CLUSTER_SUMMARY_BULLETS,
  CLUSTER_COLORS,
  CLUSTER_KEYS,
  getClusterCentroids,
  getClusterDistribution,
  POOLED_PROFILE_KEYS,
  getPooledProfileTitles,
  assignPooledProfile,
} = require("./utils/clustering");
const { provincesForRegion } = require("./utils/turkeyRegions");
const { logAction } = require("./utils/logger");
const { resolveTargetCountries } = require("./utils/targetCountryMap");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 saat
const PASSWORD_SETUP_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 saat

const app = express();
const PORT = process.env.PORT || 5000;

// permission_requests.status -> sol menudeki "Genel Veriler" gorunurlugunu ve
// /api/dashboard/global-stats erisimini belirleyen sadelestirilmis durum.
// Reddedilmis talepler yeniden basvuruyu engellemedigi icin (bkz. /my-status)
// 'none' ile ayni sekilde ele alinir - kurum tekrar talep gonderebilir.
const PERMISSION_STATUS_TO_GLOBAL_DATA_STATUS = {
  "Onay Bekliyor": "pending",
  "Onaylandi": "approved",
  "Reddedildi": "rejected",
};

async function getGlobalDataStatus(pool, institutionId) {
  if (!institutionId) return "none";
  const result = await pool.query(
    "SELECT status FROM permission_requests WHERE institution_id = $1 ORDER BY created_at DESC LIMIT 1",
    [institutionId]
  );
  if (result.rows.length === 0) return "none";
  return PERMISSION_STATUS_TO_GLOBAL_DATA_STATUS[result.rows[0].status] || "none";
}

// authenticate middleware sadece JWT'deki studentId/institutionId/role
// degerlerini verir; Log Izleme kayitlarina (system_logs) okunabilir bir
// Ad Soyad yazabilmek icin, hesabin gercekte hangi tabloda (system_admins,
// institutions, students) yasadigini role/institutionId kombinasyonuna gore
// cozer. /api/logout ve durum-degistiren admin islemlerinde kullanilir.
async function resolveActorIdentity(pool, req) {
  if (req.role === "super_admin") {
    const result = await pool.query("SELECT id, first_name, last_name FROM system_admins WHERE id = $1", [req.studentId]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return { userId: row.id, userName: `${row.first_name} ${row.last_name}`, userRole: req.role };
    }
  } else if (req.role === "admin" && req.institutionId && !req.studentId) {
    const result = await pool.query("SELECT id, name, contact_person FROM institutions WHERE id = $1", [req.institutionId]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return { userId: row.id, userName: row.contact_person || row.name, userRole: req.role };
    }
  } else if (req.studentId) {
    const result = await pool.query("SELECT id, first_name, last_name FROM students WHERE id = $1", [req.studentId]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return { userId: row.id, userName: `${row.first_name} ${row.last_name}`, userRole: req.role };
    }
  }
  return { userId: null, userName: null, userRole: req.role || null };
}

// GUVENLIK: Onceden herhangi bir siteden (cors() ayarsiz = tum kaynaklara
// acik) istek kabul ediliyordu. Sadece bilinen frontend adresine kisitlandi.
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// GUVENLIK: Giris/aktivasyon/sifre islemlerinde deneme sinirlamasi yoktu -
// sifre veya aktivasyon kodu kaba kuvvetle (brute force) denenebiliyordu.
// IP basina 15 dakikada 20 deneme ile sinirlandirildi.
// GUVENLIK: Asagidaki arastirma/analiz ve simulator uc noktalari
// (dashboard-*, kmeans-results, regional-heatmap, correlation-matrix,
// classification-metrics, decision-tree, predict-simulation, simulator/predict)
// onceden kimlik dogrulamasi HIC ISTEMIYORDU - sadece "Yonetici" (admin) veya
// sistem yoneticisi girisi yapmis kullanicilar icin tasarlandigi halde, giris
// yapmamis herkes bu 890 kisilik arastirma verisini ve model sonuclarini
// dogrudan API'den okuyabiliyor, predict-simulation ise her istekte bir Python
// alt sureci baslatarak kaynak tuketimine (DoS) acik kalabiliyordu.
// GUVENLIK: Kayit/sifre belirleme/sifre sifirlama uc noktalarinda sifre
// uzunlugu/karmasikligi hic kontrol edilmiyordu ("1" gibi bir sifre bile
// kabul ediliyordu). En az 8 karakter, en az bir harf ve bir rakam sarti getirildi.
function getPasswordStrengthError(password) {
  if (typeof password !== "string" || password.length < 8) {
    return "Sifre en az 8 karakter olmalidir.";
  }
  if (!/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(password) || !/[0-9]/.test(password)) {
    return "Sifre en az bir harf ve bir rakam icermelidir.";
  }
  return null;
}

function requireAdminOrSuperAdmin(req, res, next) {
  if (req.role !== "admin" && req.role !== "super_admin") {
    return res.status(403).json({ success: false, message: "Bu islem icin yetkiniz bulunmuyor." });
  }
  next();
}

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Cok fazla deneme yapildi. Lutfen daha sonra tekrar deneyin." },
});

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

pool.connect()
  .then(() => console.log("PostgreSQL veritabanina baglanti basarili."))
  .catch((err) => console.error("Veritabani baglanti hatasi:", err.message));

app.get("/", (req, res) => {
  res.send("GOCLAB backend calisiyor.");
});

app.get("/api/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ success: true, time: result.rows[0].now });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Bir hata olustu." });
  }
});

app.post("/register", authRateLimiter, async (req, res) => {
  const { firstName, lastName, email, institution, password } = req.body;

  if (!firstName || !lastName || !email || !institution || !password) {
    return res.status(400).json({ success: false, message: "Tum alanlar zorunludur." });
  }

  const passwordError = getPasswordStrengthError(password);
  if (passwordError) {
    return res.status(400).json({ success: false, message: passwordError });
  }

  try {
    const institutionResult = await pool.query(
      "SELECT id FROM institutions WHERE name = $1",
      [institution]
    );

    if (institutionResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Gecersiz kurum secimi." });
    }

    const institutionId = institutionResult.rows[0].id;

    const existing = await pool.query(
      "SELECT id, is_active FROM students WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0 && existing.rows[0].is_active) {
      return res.status(409).json({ success: false, message: "Bu e-posta adresi zaten kayitli ve aktif." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const activationCode = generateActivationCode();

    // Daha once aktivasyonu tamamlanmamis bir kayit varsa (ornegin e-posta
    // gonderimi basarisiz oldugu icin) onu guncelle; yoksa yeni kayit olustur.
    const result =
      existing.rows.length > 0
        ? await pool.query(
            `UPDATE students
             SET first_name = $1, last_name = $2, institution = $3, institution_id = $4, password_hash = $5, activation_code = $6
             WHERE email = $7
             RETURNING id, first_name, last_name, email, is_active, created_at`,
            [firstName, lastName, institution, institutionId, passwordHash, activationCode, email]
          )
        : await pool.query(
            `INSERT INTO students (first_name, last_name, email, institution, institution_id, password_hash, activation_code, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, false)
             RETURNING id, first_name, last_name, email, is_active, created_at`,
            [firstName, lastName, email, institution, institutionId, passwordHash, activationCode]
          );

    await sendActivationEmail(email, activationCode);

    res.status(201).json({
      success: true,
      message: "Kayit basarili. Aktivasyon kodu e-posta adresinize gonderildi.",
      user: { ...result.rows[0], institution },
    });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Kayit sirasinda bir hata olustu." });
  }
});

app.post("/login", authRateLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "E-posta ve sifre zorunludur." });
  }

  try {
    const result = await pool.query(
      "SELECT id, first_name, last_name, email, institution, institution_id, password_hash, is_active, role FROM students WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      await logAction(pool, { userName: email, actionType: "Yetkisiz Erişim", ipAddress: req.ip, status: "Başarısız" });
      return res.status(401).json({ success: false, message: "E-posta veya sifre hatali." });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      await logAction(pool, {
        userId: user.id,
        userName: `${user.first_name} ${user.last_name}`,
        userRole: user.role,
        actionType: "Yetkisiz Erişim",
        ipAddress: req.ip,
        status: "Başarısız",
      });
      return res.status(401).json({ success: false, message: "E-posta veya sifre hatali." });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Hesabiniz henuz aktiflestirilmemis. Lutfen e-postaniza gonderilen kodu girin.",
      });
    }

    const token = jwt.sign(
      { studentId: user.id, role: user.role, institutionId: user.institution_id, jti: crypto.randomUUID() },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    await logAction(pool, {
      userId: user.id,
      userName: `${user.first_name} ${user.last_name}`,
      userRole: user.role,
      actionType: "Kullanıcı Girişi",
      ipAddress: req.ip,
      status: "Başarılı",
      loginTime: new Date(),
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        institution: user.institution,
        is_active: user.is_active,
      },
    });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Giris sirasinda bir hata olustu." });
  }
});

app.post("/admin-login", authRateLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "E-posta ve sifre zorunludur." });
  }

  try {
    // Once ayri system_admins tablosuna bakilir (gizli rotadan giren gercek
    // sistem yoneticileri buradadir). Bulunamazsa, students tablosundaki
    // (role='admin') kurum yoneticisi hesaplarina (eski davranis) dusulur.
    const sysAdminResult = await pool.query(
      "SELECT id, first_name, last_name, email, password_hash, is_active, role FROM system_admins WHERE email = $1",
      [email]
    );

    if (sysAdminResult.rows.length > 0) {
      const sysAdmin = sysAdminResult.rows[0];
      const passwordMatches = await bcrypt.compare(password, sysAdmin.password_hash);

      if (!passwordMatches) {
        await logAction(pool, {
          userId: sysAdmin.id,
          userName: `${sysAdmin.first_name} ${sysAdmin.last_name}`,
          userRole: sysAdmin.role,
          actionType: "Yetkisiz Erişim",
          ipAddress: req.ip,
          status: "Başarısız",
        });
        return res.status(401).json({ success: false, message: "E-posta veya sifre hatali." });
      }

      if (!sysAdmin.is_active) {
        return res.status(403).json({ success: false, message: "Hesabiniz aktif degil." });
      }

      const sysToken = jwt.sign(
        { studentId: sysAdmin.id, role: sysAdmin.role, jti: crypto.randomUUID() },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
      );

      await logAction(pool, {
        userId: sysAdmin.id,
        userName: `${sysAdmin.first_name} ${sysAdmin.last_name}`,
        userRole: sysAdmin.role,
        actionType: "Kullanıcı Girişi",
        ipAddress: req.ip,
        status: "Başarılı",
        loginTime: new Date(),
      });

      return res.status(200).json({
        success: true,
        token: sysToken,
        user: {
          id: sysAdmin.id,
          first_name: sysAdmin.first_name,
          last_name: sysAdmin.last_name,
          email: sysAdmin.email,
          institution: "GÖÇLAB",
          role: sysAdmin.role,
        },
      });
    }

    // Kurum yetkilisi (Yonetici) girisi: asil kaynak artik institutions
    // tablosudur (kurum basvurusu onaylandiktan sonra "Sifre Olustur" akisiyla
    // contact_email + password_hash buraya yazilir). students tablosundaki
    // (role='admin') eski/seed hesaplar asagida geriye donuk uyumluluk icin
    // ikinci bir deneme olarak kalir.
    const institutionResult = await pool.query(
      "SELECT id, name, contact_person, contact_email, password_hash, status FROM institutions WHERE contact_email = $1",
      [email]
    );

    if (institutionResult.rows.length > 0) {
      const institution = institutionResult.rows[0];

      if (!institution.password_hash) {
        return res.status(403).json({
          success: false,
          message: "Bu kurum icin henuz bir sifre olusturulmamis. Lutfen e-postaniza gonderilen baglantiyi kullanin.",
        });
      }

      const passwordMatches = await bcrypt.compare(password, institution.password_hash);

      if (!passwordMatches) {
        await logAction(pool, {
          userId: institution.id,
          userName: institution.contact_person || institution.name,
          userRole: "admin",
          actionType: "Yetkisiz Erişim",
          ipAddress: req.ip,
          status: "Başarısız",
        });
        return res.status(401).json({ success: false, message: "E-posta veya sifre hatali." });
      }

      if (institution.status !== "Aktif") {
        return res.status(403).json({ success: false, message: "Kurum hesabiniz henuz aktif degil." });
      }

      const nameParts = (institution.contact_person || institution.name || "").trim().split(/\s+/);
      const firstName = nameParts[0] || institution.name;
      const lastName = nameParts.slice(1).join(" ");

      const institutionToken = jwt.sign(
        { role: "admin", institutionId: institution.id, jti: crypto.randomUUID() },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
      );

      const globalDataStatus = await getGlobalDataStatus(pool, institution.id);

      await logAction(pool, {
        userId: institution.id,
        userName: institution.contact_person || institution.name,
        userRole: "admin",
        actionType: "Kullanıcı Girişi",
        ipAddress: req.ip,
        status: "Başarılı",
        loginTime: new Date(),
      });

      return res.status(200).json({
        success: true,
        token: institutionToken,
        user: {
          id: institution.id,
          first_name: firstName,
          last_name: lastName,
          email: institution.contact_email,
          institution: institution.name,
          institution_id: institution.id,
          role: "admin",
          // Kurum panelini (tenant/genel-bakis) Yonetici (raw_survey_data
          // temelli ulusal arastirma) panelinden ayirmak icin frontend
          // yonlendirmesinde kullanilir.
          accountType: "institution",
          // Sol menudeki "Genel Veriler" ogesinin gorunurlugunu belirler:
          // 'none' | 'pending' | 'approved' | 'rejected'. Onay sonrasi
          // deger degisebileceginden frontend bunu ayrica canli olarak da
          // (bkz. GET /api/permission-requests/my-status) kontrol eder.
          global_data_status: globalDataStatus,
        },
      });
    }

    const result = await pool.query(
      "SELECT id, first_name, last_name, email, institution, institution_id, password_hash, is_active, role FROM students WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      await logAction(pool, { userName: email, actionType: "Yetkisiz Erişim", ipAddress: req.ip, status: "Başarısız" });
      return res.status(401).json({ success: false, message: "E-posta veya sifre hatali." });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      await logAction(pool, {
        userId: user.id,
        userName: `${user.first_name} ${user.last_name}`,
        userRole: user.role,
        actionType: "Yetkisiz Erişim",
        ipAddress: req.ip,
        status: "Başarısız",
      });
      return res.status(401).json({ success: false, message: "E-posta veya sifre hatali." });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Bu hesabin yonetici yetkisi bulunmuyor." });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: "Hesabiniz aktif degil." });
    }

    // Kurum yetkilisinin (rol='admin') JWT'sine kendi institution_id'si
    // gomulur; tum kurum-bazli veri filtreleme (Data Isolation) bu degere
    // dayanir. Sistem yoneticisi (super_admin) icin bu alan hic ayarlanmaz,
    // asagidaki middleware/endpoint'ler bunu "tum kurumlari gor" olarak yorumlar.
    const token = jwt.sign(
      { studentId: user.id, role: user.role, institutionId: user.institution_id, jti: crypto.randomUUID() },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    await logAction(pool, {
      userId: user.id,
      userName: `${user.first_name} ${user.last_name}`,
      userRole: user.role,
      actionType: "Kullanıcı Girişi",
      ipAddress: req.ip,
      status: "Başarılı",
      loginTime: new Date(),
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        institution: user.institution,
        institution_id: user.institution_id,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Giris sirasinda bir hata olustu." });
  }
});

// Kurum/Sistem Yoneticisi/Ogrenci panellerindeki "Guvenli Cikis" ve "Cikis
// Yap" butonlarindan cagrilir - Log Izleme sayfasinda "Kullanıcı Çıkışı"
// olarak gorunur. localStorage temizligi zaten frontend'de (handleLogout)
// yapildigindan, bu endpoint sadece denetim kaydi olusturur.
app.post("/api/logout", authenticate, async (req, res) => {
  try {
    // GUVENLIK: Token artik sadece istemcide silinmiyor, sunucu tarafinda da
    // (suresi dolana kadar) gecersiz kilinir - bkz. utils/tokenBlacklist.js.
    if (req.tokenId && req.tokenExpiresAtMs) {
      revokeToken(req.tokenId, req.tokenExpiresAtMs);
    }
    const actor = await resolveActorIdentity(pool, req);
    await logAction(pool, {
      userId: actor.userId,
      userName: actor.userName,
      userRole: actor.userRole,
      actionType: "Kullanıcı Çıkışı",
      ipAddress: req.ip,
      status: "Başarılı",
      logoutTime: new Date(),
    });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Cikis kaydedilirken bir hata olustu." });
  }
});

// Kurum Basvuru Formu'ndan (InstitutionApply.jsx) gelen basvuruyu 'Beklemede'
// statusuyle institutions tablosuna kaydeder. Herkese acik (kimlik dogrulama
// gerektirmez), tipki ogrenci kaydi gibi.
app.post("/api/institution-applications", async (req, res) => {
  const { institutionName, institutionType, province, fullName, title, email, phone, reason, kvkkAccepted } = req.body;

  if (!institutionName || !institutionType || !province || !fullName || !title || !email || !phone || !reason) {
    return res.status(400).json({ success: false, message: "Tum zorunlu alanlar doldurulmalidir." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO institutions (name, institution_type, city, contact_person, contact_title, contact_email, contact_phone, application_reason, kvkk_accepted, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Beklemede')
       RETURNING id, name, status, created_at`,
      [institutionName, institutionType, province, fullName, title, email, phone, reason, Boolean(kvkkAccepted)]
    );
    res.status(201).json({ success: true, institution: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ success: false, message: "Bu kurum adi veya kurumsal e-posta ile daha once basvuru yapilmis." });
    }
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Basvuru sirasinda bir hata olustu." });
  }
});

// Sistem Yoneticisi panelindeki Kurum Yonetimi sayfasi icin: tum kurum
// basvurularini/kayitlarini listeler. Sadece admin/super_admin erisebilir.
app.get("/api/institutions", authenticate, async (req, res) => {
  if (req.role !== "admin" && req.role !== "super_admin") {
    return res.status(403).json({ success: false, message: "Bu islem icin yetkiniz bulunmuyor." });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, institution_type, city, contact_person, contact_title, contact_email, contact_phone, application_reason, kvkk_accepted, status, created_at, updated_at
       FROM institutions
       ORDER BY created_at DESC`
    );
    res.json({ success: true, institutions: result.rows });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Kurumlar getirilirken bir hata olustu." });
  }
});

// Bir kurumun durumunu gunceller (Onayla -> Aktif, Reddet -> Reddedildi).
// Sadece admin/super_admin erisebilir.
app.patch("/api/institutions/:id/status", authenticate, async (req, res) => {
  // GUVENLIK: Kurum basvurularinin onaylanmasi/reddedilmesi SADECE sistem
  // yoneticisine (super_admin) aciktir. role='admin' (kurum yetkilisi) buraya
  // ASLA dahil edilmemeli - aksi halde herhangi bir kurum, baska bir kurumun
  // (veya kendi basvurusunun) durumunu dogrudan API istegiyle degistirebilir.
  if (req.role !== "super_admin") {
    return res.status(403).json({ success: false, message: "Bu islem icin yetkiniz bulunmuyor." });
  }

  const { id } = req.params;
  const { status } = req.body;
  const VALID_STATUSES = ["Beklemede", "Aktif", "Reddedildi"];

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: "Gecersiz durum degeri." });
  }

  try {
    const result = await pool.query(
      `UPDATE institutions SET status = $1 WHERE id = $2
       RETURNING id, name, institution_type, city, contact_person, contact_title, contact_email, contact_phone, application_reason, kvkk_accepted, status, created_at, updated_at`,
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Kurum bulunamadi." });
    }

    const institution = result.rows[0];

    // Kurum onaylandiginda (Aktif), kurumun kendi sifresini belirleyebilmesi
    // icin tek kullanimlik bir token uretilir, veri tabanina kaydedilir ve
    // kuruma e-posta ile gonderilir.
    if (status === "Aktif" && institution.contact_email) {
      const setupToken = crypto.randomBytes(32).toString("hex");
      const setupTokenExpires = new Date(Date.now() + PASSWORD_SETUP_TOKEN_TTL_MS);

      await pool.query(
        "UPDATE institutions SET password_setup_token = $1, password_setup_token_expires = $2 WHERE id = $3",
        [setupToken, setupTokenExpires, institution.id]
      );

      const setupLink = `${FRONTEND_URL}/kurum-sifre-belirle?token=${setupToken}`;
      try {
        await sendInstitutionApprovalEmail(institution.contact_email, institution.name, setupLink);
      } catch (mailErr) {
        console.error("Kurum onay e-postasi gonderilemedi:", mailErr.message);
      }
    }

    res.json({ success: true, institution });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Durum guncellenirken bir hata olustu." });
  }
});

// Kurum panelindeki "Yetki Talebi" modali acildiginda, giris yapan kurumun
// daha once olusturdugu bekleyen ('Onay Bekliyor') veya onaylanmis ('Onaylandi')
// bir talebi olup olmadigini kontrol eder - varsa formun tekrar gonderilmesini
// engellemek icin kullanilir. Reddedilmis ('Reddedildi') talepler yeniden
// basvuruyu engellemez. Sadece kurum yetkilisi (role='admin') erisebilir.
app.get("/api/permission-requests/my-status", authenticate, async (req, res) => {
  if (req.role !== "admin") {
    return res.status(403).json({ success: false, message: "Bu islem icin yetkiniz bulunmuyor." });
  }

  try {
    const result = await pool.query(
      `SELECT status FROM permission_requests
       WHERE institution_id = $1 AND status IN ('Onay Bekliyor', 'Onaylandi')
       ORDER BY created_at DESC LIMIT 1`,
      [req.institutionId]
    );
    const hasActiveRequest = result.rows.length > 0;
    const globalDataStatus = await getGlobalDataStatus(pool, req.institutionId);
    res.json({
      success: true,
      hasActiveRequest,
      status: hasActiveRequest ? result.rows[0].status : null,
      globalDataStatus,
    });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Yetki talebi durumu kontrol edilirken bir hata olustu." });
  }
});

// Kurum panelindeki "Yetki Talebi" modalindan (PermissionRequestModal.jsx)
// gonderilen, Turkiye geneli sistem verilerine erisim talebini kaydeder.
// Sadece kurum yetkilisi (role='admin') erisebilir - kendi kurumu adina talep acar.
app.post("/api/permission-requests", authenticate, async (req, res) => {
  if (req.role !== "admin") {
    return res.status(403).json({ success: false, message: "Bu islem icin yetkiniz bulunmuyor." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO permission_requests (institution_id, status)
       VALUES ($1, 'Onay Bekliyor')
       RETURNING id, institution_id, status, created_at, updated_at`,
      [req.institutionId]
    );
    res.status(201).json({ success: true, request: result.rows[0] });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Talep gonderilirken bir hata olustu." });
  }
});

// Sistem Yoneticisi panelindeki Yetki Yonetimi sayfasi icin: tum yetki
// taleplerini, ilgili kurumun adi ve yetkili Ad Soyad bilgisiyle birlikte
// listeler. Sadece admin/super_admin erisebilir.
app.get("/api/admin/permission-requests", authenticate, async (req, res) => {
  if (req.role !== "admin" && req.role !== "super_admin") {
    return res.status(403).json({ success: false, message: "Bu islem icin yetkiniz bulunmuyor." });
  }

  try {
    const result = await pool.query(
      `SELECT pr.id, pr.status, pr.created_at, pr.updated_at,
              i.id AS institution_id, i.name AS institution_name,
              COALESCE(i.contact_person, i.name) AS full_name
       FROM permission_requests pr
       JOIN institutions i ON i.id = pr.institution_id
       ORDER BY pr.created_at DESC`
    );
    res.json({ success: true, requests: result.rows });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Yetki talepleri getirilirken bir hata olustu." });
  }
});

// Bir yetki talebinin durumunu gunceller (Onayla -> Onaylandi, Reddet -> Reddedildi).
// Sadece admin/super_admin erisebilir.
app.patch("/api/admin/permission-requests/:id/status", authenticate, async (req, res) => {
  // GUVENLIK: Turkiye geneli veri erisim taleplerinin onaylanmasi/reddedilmesi
  // SADECE sistem yoneticisine (super_admin) aciktir. role='admin' (kurum
  // yetkilisi) buraya ASLA dahil edilmemeli - aksi halde bir kurum, sistem
  // yoneticisinin onayi olmadan kendi (veya baska bir kurumun) talebini
  // dogrudan API istegiyle onaylayip tum sistemdeki ogrenci verilerine
  // erisim kazanabilir.
  if (req.role !== "super_admin") {
    return res.status(403).json({ success: false, message: "Bu islem icin yetkiniz bulunmuyor." });
  }

  const { id } = req.params;
  const { status } = req.body;
  const VALID_STATUSES = ["Onay Bekliyor", "Onaylandi", "Reddedildi"];

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: "Gecersiz durum degeri." });
  }

  try {
    const result = await pool.query(
      `UPDATE permission_requests SET status = $1 WHERE id = $2
       RETURNING id, institution_id, status, created_at, updated_at`,
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Yetki talebi bulunamadi." });
    }

    const actor = await resolveActorIdentity(pool, req);
    await logAction(pool, {
      userId: actor.userId,
      userName: actor.userName,
      userRole: actor.userRole,
      actionType: "Yetki Onayı",
      ipAddress: req.ip,
      status: "Başarılı",
    });

    res.json({ success: true, request: result.rows[0] });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Durum guncellenirken bir hata olustu." });
  }
});

// Sistem Yoneticisi panelindeki Log Izleme sayfasi icin: system_logs
// tablosunu Tarih Araligi/Kullanici/Islem Turu/Durum/IP Adresi'ne gore
// filtreler ve sayfalar. Ust taraftaki KPI kartlari (Toplam Log, Basarili
// Islemler, Hatalar) "Tum zamanlar" etiketini tasidigi icin summary,
// filtrelerden BAGIMSIZ olarak veri tabanindaki TUM kayitlar uzerinden
// hesaplanir. Sadece super_admin erisebilir (sistem geneli denetim kaydi).
app.get("/api/admin/logs", authenticate, async (req, res) => {
  if (req.role !== "super_admin") {
    return res.status(403).json({ success: false, message: "Bu islem icin yetkiniz bulunmuyor." });
  }

  try {
    const { dateFrom, dateTo, user, actionType, status, ip, page, pageSize } = req.query;

    const params = [];
    let whereClause = "WHERE 1=1";
    if (dateFrom) {
      params.push(dateFrom);
      whereClause += ` AND created_at >= $${params.length}`;
    }
    if (dateTo) {
      params.push(dateTo);
      whereClause += ` AND created_at < ($${params.length}::date + INTERVAL '1 day')`;
    }
    if (user) {
      params.push(`%${user}%`);
      whereClause += ` AND user_name ILIKE $${params.length}`;
    }
    if (actionType) {
      params.push(actionType);
      whereClause += ` AND action_type = $${params.length}`;
    }
    if (status) {
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    }
    if (ip) {
      params.push(`%${ip}%`);
      whereClause += ` AND ip_address ILIKE $${params.length}`;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 10));
    const offset = (pageNum - 1) * pageSizeNum;

    const [logsResult, countResult, summaryResult] = await Promise.all([
      pool.query(
        `SELECT id, user_id, user_name, user_role, action_type, ip_address, status, login_time, logout_time, created_at
         FROM system_logs
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT ${pageSizeNum} OFFSET ${offset}`,
        params
      ),
      pool.query(`SELECT COUNT(*) AS total FROM system_logs ${whereClause}`, params),
      pool.query(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'Başarılı') AS success_count,
                COUNT(*) FILTER (WHERE status = 'Başarısız') AS error_count
         FROM system_logs`
      ),
    ]);

    const summaryRow = summaryResult.rows[0];
    const totalLogs = Number(summaryRow.total);
    const successCount = Number(summaryRow.success_count);
    const errorCount = Number(summaryRow.error_count);
    const toRate = (count) => (totalLogs > 0 ? Math.round((count / totalLogs) * 1000) / 10 : 0);

    res.json({
      success: true,
      logs: logsResult.rows,
      totalCount: Number(countResult.rows[0].total),
      page: pageNum,
      pageSize: pageSizeNum,
      summary: {
        totalLogs,
        successCount,
        successRate: toRate(successCount),
        errorCount,
        errorRate: toRate(errorCount),
      },
    });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Loglar getirilirken bir hata olustu." });
  }
});

const TR_SHORT_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

// Sistem Yoneticisi panelindeki Kontrol Paneli (AdminDashboard.jsx) icin: KPI
// istatistikleri, son loglar, son 7 gunun aktivite grafigi, son kurum
// basvurulari ve son yetki taleplerini TEK bir istekte toplar. Sadece
// super_admin erisebilir.
app.get("/api/admin/dashboard/summary", authenticate, async (req, res) => {
  if (req.role !== "super_admin") {
    return res.status(403).json({ success: false, message: "Bu islem icin yetkiniz bulunmuyor." });
  }

  try {
    const [
      usersResult,
      institutionsResult,
      permissionGroupsResult,
      recentLogsResult,
      loginActivityResult,
      dataOpsActivityResult,
      recentInstitutionsResult,
      recentRequestsResult,
    ] = await Promise.all([
      pool.query(
        `SELECT
           (SELECT COUNT(*) FROM students) +
           (SELECT COUNT(*) FROM institutions WHERE contact_email IS NOT NULL) +
           (SELECT COUNT(*) FROM system_admins) AS total,
           (SELECT COUNT(*) FROM students WHERE created_at >= date_trunc('month', NOW())) +
           (SELECT COUNT(*) FROM institutions WHERE contact_email IS NOT NULL AND created_at >= date_trunc('month', NOW())) +
           (SELECT COUNT(*) FROM system_admins WHERE created_at >= date_trunc('month', NOW())) AS this_month`
      ),
      pool.query(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW())) AS this_month
         FROM institutions`
      ),
      pool.query(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE updated_at >= date_trunc('month', NOW())) AS this_month
         FROM permission_requests WHERE status = 'Onaylandi'`
      ),
      pool.query(
        `SELECT id, user_name, user_role, action_type, ip_address, status, created_at
         FROM system_logs ORDER BY created_at DESC LIMIT 7`
      ),
      pool.query(
        `SELECT DATE(created_at) AS day, COUNT(*) AS count
         FROM system_logs
         WHERE action_type = 'Kullanıcı Girişi' AND created_at >= NOW() - INTERVAL '7 days'
         GROUP BY day`
      ),
      pool.query(
        `SELECT DATE(created_at) AS day, COUNT(*) AS count
         FROM likert_responses
         WHERE created_at >= NOW() - INTERVAL '7 days'
         GROUP BY day`
      ),
      pool.query(
        `SELECT id, name, contact_person, status, created_at
         FROM institutions ORDER BY created_at DESC LIMIT 5`
      ),
      pool.query(
        `SELECT pr.id, pr.status, pr.created_at,
                i.name AS institution_name, COALESCE(i.contact_person, i.name) AS full_name
         FROM permission_requests pr
         JOIN institutions i ON i.id = pr.institution_id
         WHERE pr.status = 'Onay Bekliyor'
         ORDER BY pr.created_at DESC LIMIT 5`
      ),
    ]);

    const trendPct = (total, thisMonth) => {
      const priorBase = total - thisMonth;
      if (priorBase <= 0) return thisMonth > 0 ? 100 : 0;
      return Math.round((thisMonth / priorBase) * 1000) / 10;
    };

    const usersRow = usersResult.rows[0];
    const institutionsRow = institutionsResult.rows[0];
    const permissionGroupsRow = permissionGroupsResult.rows[0];

    // Son 7 gun (bugun dahil) icin, gercek veri olmayan gunler 0 ile doldurulur -
    // veri uydurulmaz, sadece grafigin bos gun atlamamasi saglanir.
    const loginsByDay = new Map(loginActivityResult.rows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)]));
    const dataOpsByDay = new Map(dataOpsActivityResult.rows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)]));

    const activityChart = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      activityChart.push({
        date: key,
        label: `${d.getDate()} ${TR_SHORT_MONTHS[d.getMonth()]}`,
        users: loginsByDay.get(key) || 0,
        dataOps: dataOpsByDay.get(key) || 0,
      });
    }

    res.json({
      success: true,
      kpi: {
        totalUsers: Number(usersRow.total),
        totalUsersTrendPct: trendPct(Number(usersRow.total), Number(usersRow.this_month)),
        totalInstitutions: Number(institutionsRow.total),
        totalInstitutionsTrendPct: trendPct(Number(institutionsRow.total), Number(institutionsRow.this_month)),
        activePermissionGroups: Number(permissionGroupsRow.total),
        activePermissionGroupsTrendPct: trendPct(Number(permissionGroupsRow.total), Number(permissionGroupsRow.this_month)),
      },
      recentLogs: recentLogsResult.rows,
      activityChart,
      recentInstitutions: recentInstitutionsResult.rows,
      recentPermissionRequests: recentRequestsResult.rows,
    });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Kontrol paneli verileri hesaplanirken bir hata olustu." });
  }
});

// Onay e-postasindaki baglantidan gelen tek kullanimlik token'i dogrular,
// kurumun belirledigi yeni sifreyi bcrypt ile hash'leyerek kaydeder ve
// token'i (bir daha kullanilamayacak sekilde) veri tabanindan siler.
app.post("/api/institutions/set-password", async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ success: false, message: "Token ve yeni sifre zorunludur." });
  }

  const passwordError = getPasswordStrengthError(newPassword);
  if (passwordError) {
    return res.status(400).json({ success: false, message: passwordError });
  }

  try {
    const result = await pool.query(
      "SELECT id, name, contact_person FROM institutions WHERE password_setup_token = $1 AND password_setup_token_expires > NOW()",
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Gecersiz veya suresi dolmus baglanti." });
    }

    const institution = result.rows[0];
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE institutions SET password_hash = $1, password_setup_token = NULL, password_setup_token_expires = NULL WHERE id = $2",
      [passwordHash, institution.id]
    );

    await logAction(pool, {
      userId: institution.id,
      userName: institution.contact_person || institution.name,
      userRole: "admin",
      actionType: "Şifre Değiştirme",
      ipAddress: req.ip,
      status: "Başarılı",
    });

    res.status(200).json({ success: true, message: "Sifreniz basariyla belirlendi." });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Sifre belirlenirken bir hata olustu." });
  }
});

app.post("/verify-activation", authRateLimiter, async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ success: false, message: "E-posta ve kod zorunludur." });
  }

  try {
    const result = await pool.query(
      "SELECT id, activation_code, is_active FROM students WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Kullanici bulunamadi." });
    }

    const user = result.rows[0];

    if (user.is_active) {
      return res.status(200).json({ success: true, message: "Hesap zaten aktif." });
    }

    if (user.activation_code !== code) {
      return res.status(400).json({ success: false, message: "Aktivasyon kodu hatali." });
    }

    await pool.query("UPDATE students SET is_active = true WHERE id = $1", [user.id]);

    res.status(200).json({ success: true, message: "Hesap basariyla aktiflestirildi." });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Aktivasyon sirasinda bir hata olustu." });
  }
});

app.post("/forgot-password", authRateLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: "E-posta zorunludur." });
  }

  try {
    const result = await pool.query("SELECT id FROM students WHERE email = $1", [email]);

    // Hesap var mi yok mu bilgisini disariya sizdirmamak icin her durumda
    // ayni genel mesaji donuyoruz; mail sadece kullanici gercekten varsa gider.
    if (result.rows.length > 0) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);

      await pool.query(
        "UPDATE students SET reset_token = $1, reset_token_expires = $2 WHERE id = $3",
        [resetToken, resetTokenExpires, result.rows[0].id]
      );

      const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
      await sendPasswordResetEmail(email, resetLink);
    }

    res.status(200).json({
      success: true,
      message: "Eger bu e-posta adresi kayitliysa, sifre sifirlama baglantisi gonderildi.",
    });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Islem sirasinda bir hata olustu." });
  }
});

app.post("/reset-password", authRateLimiter, async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ success: false, message: "Token ve yeni sifre zorunludur." });
  }

  const passwordError = getPasswordStrengthError(newPassword);
  if (passwordError) {
    return res.status(400).json({ success: false, message: passwordError });
  }

  try {
    const result = await pool.query(
      "SELECT id, first_name, last_name, role FROM students WHERE reset_token = $1 AND reset_token_expires > NOW()",
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Gecersiz veya suresi dolmus baglanti." });
    }

    const student = result.rows[0];
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE students SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2",
      [passwordHash, student.id]
    );

    await logAction(pool, {
      userId: student.id,
      userName: `${student.first_name} ${student.last_name}`,
      userRole: student.role,
      actionType: "Şifre Değiştirme",
      ipAddress: req.ip,
      status: "Başarılı",
    });

    res.status(200).json({ success: true, message: "Sifreniz basariyla guncellendi." });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Sifre sifirlama sirasinda bir hata olustu." });
  }
});

// Yonetici Girisi ("Sifremi Unuttum") - hem gercek kurum (institutions,
// contact_email + password_setup_token ile SetPassword.jsx sayfasi tekrar
// kullanilir) hem de eski/seed students(role='admin') hesaplari icin calisir.
// Hesap var/yok bilgisini disariya sizdirmamak icin her durumda ayni genel
// mesaj donulur; mail sadece hesap gercekten bulunursa gonderilir.
app.post("/admin-forgot-password", authRateLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: "E-posta zorunludur." });
  }

  try {
    const institutionResult = await pool.query(
      "SELECT id, name, contact_email FROM institutions WHERE contact_email = $1",
      [email]
    );

    if (institutionResult.rows.length > 0) {
      const institution = institutionResult.rows[0];
      const setupToken = crypto.randomBytes(32).toString("hex");
      const tokenExpires = new Date(Date.now() + PASSWORD_SETUP_TOKEN_TTL_MS);

      await pool.query(
        "UPDATE institutions SET password_setup_token = $1, password_setup_token_expires = $2 WHERE id = $3",
        [setupToken, tokenExpires, institution.id]
      );

      const resetLink = `${FRONTEND_URL}/kurum-sifre-belirle?token=${setupToken}`;
      await sendInstitutionPasswordResetEmail(institution.contact_email, institution.name, resetLink);
    } else {
      const studentResult = await pool.query(
        "SELECT id FROM students WHERE email = $1 AND role = 'admin'",
        [email]
      );

      if (studentResult.rows.length > 0) {
        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetTokenExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);

        await pool.query(
          "UPDATE students SET reset_token = $1, reset_token_expires = $2 WHERE id = $3",
          [resetToken, resetTokenExpires, studentResult.rows[0].id]
        );

        const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
        await sendPasswordResetEmail(email, resetLink);
      }
    }

    res.status(200).json({
      success: true,
      message: "Eger bu e-posta adresi kayitliysa, sifre sifirlama baglantisi gonderildi.",
    });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Islem sirasinda bir hata olustu." });
  }
});

app.patch("/api/consent", authenticate, async (req, res) => {
  try {
    await pool.query(
      "UPDATE students SET consent_given = true, consent_date = CURRENT_TIMESTAMP WHERE id = $1",
      [req.studentId]
    );

    res.status(200).json({ success: true, message: "Onam durumu kaydedildi." });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Onam durumu kaydedilirken bir hata olustu." });
  }
});

app.post("/api/demographics", authenticate, async (req, res) => {
  const {
    gender,
    age,
    maritalStatus,
    education,
    income,
    province,
    targetCountry,
    employment,
    employmentSector,
    foreignLanguage,
    languageLevel,
  } = req.body;

  try {
    const existing = await pool.query("SELECT id FROM demographics WHERE student_id = $1", [req.studentId]);

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE demographics
         SET gender = $1, age = $2, marital_status = $3, education_level = $4, income_level = $5, province = $6,
             target_country = $7, employment_status = $8, employment_sector = $9, foreign_language = $10,
             language_level = $11
         WHERE student_id = $12`,
        [gender, age || null, maritalStatus, education, income, province, targetCountry, employment, employmentSector, foreignLanguage, languageLevel, req.studentId]
      );
    } else {
      await pool.query(
        `INSERT INTO demographics
           (student_id, gender, age, marital_status, education_level, income_level, province, target_country, employment_status, employment_sector, foreign_language, language_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [req.studentId, gender, age || null, maritalStatus, education, income, province, targetCountry, employment, employmentSector, foreignLanguage, languageLevel]
      );
    }

    res.status(201).json({ success: true, message: "Demografik bilgiler kaydedildi." });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Demografik bilgiler kaydedilirken bir hata olustu." });
  }
});

app.post("/api/likert-responses", authenticate, async (req, res) => {
  const { answers } = req.body;

  if (!answers || typeof answers !== "object") {
    return res.status(400).json({ success: false, message: "Yanit verisi eksik." });
  }

  const questionColumns = Array.from({ length: 36 }, (_, i) => `q${i + 1}`);
  const values = questionColumns.map((col) => answers[col] ?? null);

  // Kategori bazli (0-100 normalize) skorlar + genel goc niyeti skoru ve en
  // yakin kume atamasi, yanitlar kaydedilirken hesaplanir.
  const liveScores = computeLiveScores(answers);
  const factorScoresForCluster = {
    ekonomik_istihdam: liveScores.ekonomik_istihdam,
    aile_sosyal: liveScores.aile_sosyal,
    sosyo_politik: liveScores.sosyo_politik,
    egitim: liveScores.egitim,
    cevresel: liveScores.cevresel,
    psikolojik: liveScores.psikolojik,
    kulturel: liveScores.kulturel,
  };
  const assignedCluster = assignCluster(factorScoresForCluster);

  const scoreColumns = [
    "goc_niyeti_skoru",
    "normalize_skor",
    "ekonomik_skor",
    "egitim_skor",
    "sosyal_skor",
    "kulturel_skor",
    "sosyo_politik_skor",
    "cevresel_skor",
    "psikolojik_skor",
    "assigned_cluster",
  ];
  const scoreValues = [
    liveScores.goc_niyeti,
    liveScores.goc_niyeti, // normalize_skor: genel goc egilimi gostergesi, goc_niyeti_skoru ile ayni deger
    liveScores.ekonomik_istihdam,
    liveScores.egitim,
    liveScores.aile_sosyal,
    liveScores.kulturel,
    liveScores.sosyo_politik,
    liveScores.cevresel,
    liveScores.psikolojik,
    assignedCluster,
  ];

  const allColumns = [...questionColumns, ...scoreColumns];
  const allValues = [...values, ...scoreValues];

  // 1:N iliski (Anket Gecmisim): her basarili gonderim, ogrencinin onceki
  // yanitlarinin UZERINE YAZILMADAN yeni, bagimsiz bir satir olarak eklenir.
  try {
    // Once yeni anket satiri INSERT edilir (snapshot alanlari henuz NULL).
    // Boylece bir sonraki adimda hesaplanacak Kurum/Turkiye ortalamalari,
    // az once eklenen bu satiri da (kendi guncel skorunu da) kapsar.
    const columnList = ["student_id", ...allColumns].join(", ");
    const placeholders = ["$1", ...allColumns.map((_, i) => `$${i + 2}`)].join(", ");
    const inserted = await pool.query(
      `INSERT INTO likert_responses (${columnList}) VALUES (${placeholders}) RETURNING id`,
      [req.studentId, ...allValues]
    );
    const newResponseId = inserted.rows[0].id;

    // Insert veri tabanina islendikten HEMEN SONRA, Kurum ve Turkiye
    // ortalamalari yeniden hesaplanir - artik az once eklenen bu satir da
    // hesaba dahildir. Turkiye (ve tutarlilik icin kurum) ortalamasi her
    // ogrencinin SADECE en son anketini baz alir (DISTINCT ON (student_id) -
    // /api/dashboard/global-stats ile ayni kural).
    const [institutionAvgResult, turkeyAvgResult] = await Promise.all([
      req.institutionId
        ? pool.query(
            `SELECT AVG(l.normalize_skor) AS avg
             FROM students s
             JOIN (
               SELECT DISTINCT ON (student_id) * FROM likert_responses ORDER BY student_id, created_at DESC
             ) l ON l.student_id = s.id
             WHERE s.institution_id = $1 AND l.normalize_skor IS NOT NULL`,
            [req.institutionId]
          )
        : Promise.resolve({ rows: [{ avg: null }] }),
      pool.query(
        `SELECT AVG(l.normalize_skor) AS avg
         FROM (
           SELECT DISTINCT ON (student_id) * FROM likert_responses ORDER BY student_id, created_at DESC
         ) l
         WHERE l.normalize_skor IS NOT NULL`
      ),
    ]);

    const snapshotInstitutionAvg =
      institutionAvgResult.rows[0].avg !== null ? Number(institutionAvgResult.rows[0].avg) : null;
    const snapshotTurkeyAvg = turkeyAvgResult.rows[0].avg !== null ? Number(turkeyAvgResult.rows[0].avg) : null;

    // Bu guncel ortalamalar, SADECE az once olusturulan bu yeni satira
    // (eski/gecmis satirlara ASLA dokunulmadan) UPDATE ile yazilir.
    await pool.query(
      `UPDATE likert_responses SET snapshot_institution_avg = $1, snapshot_turkey_avg = $2 WHERE id = $3`,
      [snapshotInstitutionAvg, snapshotTurkeyAvg, newResponseId]
    );

    res.status(201).json({ success: true, message: "Anket yanitlari kaydedildi.", responseId: newResponseId });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Anket yanitlari kaydedilirken bir hata olustu." });
  }
});

// Ogrencinin "Kisisel Rapor" sayfasini besleyen endpoint: kendi normalize
// skoru, kurum ortalamasi, Turkiye ortalamasi, 7 faktor kirilimi ve en yakin
// kume atamasi (baslik + aciklama ile birlikte).
app.get("/api/student-report", authenticate, async (req, res) => {
  if (req.role !== "student") {
    return res.status(403).json({ success: false, message: "Bu islem icin yetkiniz bulunmuyor." });
  }

  try {
    const { responseId } = req.query;

    const ownResult = responseId
      ? await pool.query(
          `SELECT l.*, s.institution_id
           FROM likert_responses l
           JOIN students s ON s.id = l.student_id
           WHERE l.student_id = $1 AND l.id = $2`,
          [req.studentId, responseId]
        )
      : await pool.query(
          `SELECT l.*, s.institution_id
           FROM likert_responses l
           JOIN students s ON s.id = l.student_id
           WHERE l.student_id = $1
           ORDER BY l.created_at DESC
           LIMIT 1`,
          [req.studentId]
        );

    if (ownResult.rows.length === 0 || ownResult.rows[0].normalize_skor === null) {
      return res.status(404).json({ success: false, message: "Henuz tamamlanmis bir anket bulunamadi." });
    }

    const own = ownResult.rows[0];

    // Kurum/Turkiye ortalamalari ARTIK CANLI hesaplanmiyor - bu raporun
    // ait oldugu anket satirina, gonderildigi anda SABIT olarak yazilmis
    // (bkz. POST /api/likert-responses) snapshot_institution_avg ve
    // snapshot_turkey_avg degerleri dogrudan okunur. Boylece baska
    // ogrenciler daha sonra anket doldurdukca bu GECMIS raporun
    // ortalamalari geriye donuk degismez.
    const toNumber = (v) => (v === null || v === undefined ? null : Math.round(Number(v) * 100) / 100);

    const factorScoreColumnByKey = {
      ekonomik_istihdam: own.ekonomik_skor,
      egitim: own.egitim_skor,
      aile_sosyal: own.sosyal_skor,
      kulturel: own.kulturel_skor,
      sosyo_politik: own.sosyo_politik_skor,
      cevresel: own.cevresel_skor,
      psikolojik: own.psikolojik_skor,
    };

    const factors = FACTOR_GROUPS.map((g) => {
      const score = toNumber(factorScoreColumnByKey[g.key]);
      return { key: g.key, label: g.label, score, classification: classifyScore(score) };
    });

    const topFactor = factors.reduce(
      (best, f) => (f.score !== null && (best === null || f.score > best.score) ? f : best),
      null
    );

    res.json({
      success: true,
      generalScore: toNumber(own.normalize_skor),
      migrationIntentScore: toNumber(own.goc_niyeti_skoru),
      responseId: own.id,
      completedAt: own.created_at,
      comparison: {
        own: toNumber(own.normalize_skor),
        institution: toNumber(own.snapshot_institution_avg),
        national: toNumber(own.snapshot_turkey_avg),
      },
      factors,
      topFactorKey: topFactor?.key ?? null,
      assignedCluster: own.assigned_cluster,
      clusterInfo: own.assigned_cluster
        ? {
            key: own.assigned_cluster,
            title: CLUSTER_TITLES[own.assigned_cluster],
            description: CLUSTER_DESCRIPTIONS[own.assigned_cluster],
          }
        : null,
    });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Rapor verileri hesaplanirken bir hata olustu." });
  }
});

// Ogrencinin "Anket Gecmisim" sayfasini besleyen endpoint: gecmis tum anket
// gonderimlerini (1:N) en yeniden en eskiye siralayarak, ozet istatistiklerle
// (toplam anket, genel ortalama, en yuksek/dusuk skor + tarihleri) birlikte dondurur.
app.get("/api/student/survey-history", authenticate, async (req, res) => {
  if (req.role !== "student") {
    return res.status(403).json({ success: false, message: "Bu islem icin yetkiniz bulunmuyor." });
  }

  try {
    const result = await pool.query(
      `SELECT id, normalize_skor, assigned_cluster, created_at
       FROM likert_responses
       WHERE student_id = $1 AND normalize_skor IS NOT NULL
       ORDER BY created_at DESC`,
      [req.studentId]
    );

    const rows = result.rows;

    const items = rows.map((row) => ({
      id: row.id,
      generalScore: Math.round(Number(row.normalize_skor) * 100) / 100,
      assignedCluster: row.assigned_cluster,
      clusterInfo: row.assigned_cluster
        ? {
            key: row.assigned_cluster,
            title: CLUSTER_TITLES[row.assigned_cluster],
            color: CLUSTER_COLORS[row.assigned_cluster],
            summaryBullets: CLUSTER_SUMMARY_BULLETS[row.assigned_cluster] ?? [],
          }
        : null,
      completedAt: row.created_at,
    }));

    let summary = {
      totalSurveys: items.length,
      averageScore: null,
      highest: null,
      lowest: null,
    };

    if (items.length > 0) {
      const scores = items.map((it) => it.generalScore);
      const average = scores.reduce((sum, v) => sum + v, 0) / scores.length;

      const highestItem = items.reduce((best, it) => (it.generalScore > best.generalScore ? it : best));
      const lowestItem = items.reduce((worst, it) => (it.generalScore < worst.generalScore ? it : worst));

      summary = {
        totalSurveys: items.length,
        averageScore: Math.round(average * 100) / 100,
        highest: { score: highestItem.generalScore, date: highestItem.completedAt },
        lowest: { score: lowestItem.generalScore, date: lowestItem.completedAt },
      };
    }

    res.json({ success: true, summary, items });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Anket gecmisi hesaplanirken bir hata olustu." });
  }
});

// Kurum (tenant) paneli icin: students + demographics + likert_responses
// tablolarini student_id (ER diyagramindaki user_id) uzerinden JOIN'leyerek
// katilimci listesini ve ozet istatistikleri dondurur.
//
// VERI IZOLASYONU (Multi-Tenancy): role='admin' olan bir kurum yetkilisi
// SADECE kendi institution_id'sine ait katilimcilari gorur (WHERE filtresi
// zorunlu olarak uygulanir). role='super_admin' olan Sistem Yoneticisi icin
// bu filtre tamamen atlanir (bypass) ve TUM kurumlarin katilimcilari donulur.
app.get("/api/tenant/participants", authenticate, async (req, res) => {
  if (req.role !== "admin" && req.role !== "super_admin") {
    return res.status(403).json({ success: false, message: "Bu islem icin yetkiniz bulunmuyor." });
  }

  try {
    const questionColumns = Array.from({ length: 36 }, (_, i) => `l.q${i + 1}`).join(", ");
    const isScoped = req.role === "admin";

    const params = [];
    let whereClause = "WHERE s.role = 'student'";
    if (isScoped) {
      params.push(req.institutionId);
      whereClause += ` AND s.institution_id = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT
         s.id, s.first_name, s.last_name, s.email, s.institution, s.institution_id,
         s.consent_given, s.created_at,
         d.age, d.marital_status, d.education_level, d.province, d.employment_status, d.target_country,
         ${questionColumns}
       FROM students s
       LEFT JOIN demographics d ON d.student_id = s.id
       LEFT JOIN LATERAL (
         SELECT * FROM likert_responses lr WHERE lr.student_id = s.id ORDER BY lr.created_at DESC LIMIT 1
       ) l ON true
       ${whereClause}
       ORDER BY s.created_at DESC`,
      params
    );

    const participants = result.rows.map((row) => {
      const qValues = Array.from({ length: 36 }, (_, i) => row[`q${i + 1}`]).filter(
        (v) => v !== null && v !== undefined
      );
      const likertAverage = qValues.length > 0 ? qValues.reduce((sum, v) => sum + v, 0) / qValues.length : null;
      return {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        institution: row.institution,
        institutionId: row.institution_id,
        consentGiven: row.consent_given,
        age: row.age,
        maritalStatus: row.marital_status,
        educationLevel: row.education_level,
        province: row.province,
        employmentStatus: row.employment_status,
        targetCountry: row.target_country,
        likertAverage: likertAverage !== null ? Math.round(likertAverage * 100) / 100 : null,
        createdAt: row.created_at,
      };
    });

    const likertAverages = participants.map((p) => p.likertAverage).filter((v) => v !== null);
    const summary = {
      totalParticipants: participants.length,
      averageLikertScore:
        likertAverages.length > 0
          ? Math.round((likertAverages.reduce((sum, v) => sum + v, 0) / likertAverages.length) * 100) / 100
          : null,
      // 'institution': sadece kendi kurumu ile sinirli | 'all': Sistem Yoneticisi icin tum kurumlar
      scope: isScoped ? "institution" : "all",
    };

    res.json({ success: true, summary, participants });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Katilimcilar getirilirken bir hata olustu." });
  }
});

// Kurum Dashboard'unun (Overview.jsx) ust ozet kartlari, karsilastirma grafigi,
// kume profilleri ve demografik kirilim bolumlerini besleyen canli veri
// endpoint'i. VERI IZOLASYONU: role='admin' sadece kendi kurumunu gorur,
// role='super_admin' icin filtre atlanir (tum kurumlar).
app.get("/api/tenant/dashboard-summary", authenticate, async (req, res) => {
  if (req.role !== "admin" && req.role !== "super_admin") {
    return res.status(403).json({ success: false, message: "Bu islem icin yetkiniz bulunmuyor." });
  }

  try {
    const isScoped = req.role === "admin";
    const params = [];
    let whereClause = "WHERE s.role = 'student' AND l.normalize_skor IS NOT NULL";
    if (isScoped) {
      params.push(req.institutionId);
      whereClause += ` AND s.institution_id = $${params.length}`;
    }

    const [participantsResult, nationalAvgResult] = await Promise.all([
      pool.query(
        `SELECT
           d.gender, d.age, d.education_level, d.province, d.target_country,
           l.assigned_cluster, l.normalize_skor,
           l.ekonomik_skor, l.sosyal_skor, l.sosyo_politik_skor, l.egitim_skor,
           l.cevresel_skor, l.psikolojik_skor, l.kulturel_skor
         FROM students s
         LEFT JOIN demographics d ON d.student_id = s.id
         JOIN LATERAL (
           SELECT * FROM likert_responses lr WHERE lr.student_id = s.id ORDER BY lr.created_at DESC LIMIT 1
         ) l ON true
         ${whereClause}`,
        params
      ),
      pool.query(
        `SELECT AVG(l.normalize_skor) AS avg
         FROM students s
         JOIN LATERAL (
           SELECT * FROM likert_responses lr WHERE lr.student_id = s.id ORDER BY lr.created_at DESC LIMIT 1
         ) l ON true
         WHERE s.role = 'student' AND l.normalize_skor IS NOT NULL`
      ),
    ]);

    const rows = participantsResult.rows;
    const toNumber = (v) => (v === null || v === undefined ? null : Math.round(Number(v) * 100) / 100);
    const average = (values) => (values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null);

    const totalParticipants = rows.length;
    const generalScore = toNumber(average(rows.map((r) => Number(r.normalize_skor)).filter((v) => !Number.isNaN(v))));
    const nationalAverage = toNumber(nationalAvgResult.rows[0].avg);

    const FACTOR_SCORE_COLUMNS = {
      ekonomik_istihdam: "ekonomik_skor",
      aile_sosyal: "sosyal_skor",
      sosyo_politik: "sosyo_politik_skor",
      egitim: "egitim_skor",
      cevresel: "cevresel_skor",
      psikolojik: "psikolojik_skor",
      kulturel: "kulturel_skor",
    };

    const factorAverages = {};
    for (const [factorKey, column] of Object.entries(FACTOR_SCORE_COLUMNS)) {
      const values = rows.map((r) => Number(r[column])).filter((v) => !Number.isNaN(v));
      factorAverages[factorKey] = toNumber(average(values));
    }

    // Kume dagilimi: sayi/yuzde VE radar profili artik o kumeye gercekten
    // atanmis katilimcilarin GERCEK faktor ortalamalarindan hesaplanir; yeni
    // ogrenciler bir kumeye eklendikce (siradaki istek ile) kendiliginden
    // guncellenir. Henuz hic katilimcisi olmayan (count=0) bir kume icin
    // gercek ortalama hesaplanamayacagindan, sadece o durumda K-Means kume
    // merkezi (ml/cluster_centroids.json) ile gosterilir.
    const clusterCounts = { K1: 0, K2: 0, K3: 0, K4: 0, K5: 0 };
    for (const row of rows) {
      if (row.assigned_cluster && clusterCounts[row.assigned_cluster] !== undefined) {
        clusterCounts[row.assigned_cluster] += 1;
      }
    }

    const kmeansCentroids = getClusterCentroids();
    const clusters = CLUSTER_KEYS.map((key) => {
      const clusterRows = rows.filter((r) => r.assigned_cluster === key);
      const n = clusterRows.length;

      let radar;
      if (n > 0) {
        radar = {};
        for (const [factorKey, column] of Object.entries(FACTOR_SCORE_COLUMNS)) {
          const values = clusterRows.map((r) => Number(r[column])).filter((v) => !Number.isNaN(v));
          radar[factorKey] = values.length > 0 ? Math.round(average(values) * 10) / 10 : 0;
        }
      } else {
        radar =
          kmeansCentroids?.[key] ??
          Object.fromEntries(Object.keys(FACTOR_SCORE_COLUMNS).map((factorKey) => [factorKey, 0]));
      }

      const dominantFactorKey = Object.entries(radar).reduce((best, [k, v]) =>
        best === null || v > radar[best] ? k : best
      , null);

      return {
        key,
        count: n,
        percentage: totalParticipants > 0 ? Math.round((n / totalParticipants) * 1000) / 10 : 0,
        dominantFactorKey,
        radar,
      };
    });

    let dominantClusterKey = null;
    let dominantClusterCount = -1;
    for (const [key, count] of Object.entries(clusterCounts)) {
      if (count > dominantClusterCount) {
        dominantClusterCount = count;
        dominantClusterKey = count > 0 ? key : dominantClusterKey;
      }
    }

    // Demografik kirilim (cinsiyet/yas/egitim/il) icin ham katilimci listesi;
    // bolgesel (il -> bolge) gruplama zaten frontend'de (turkeyRegions.js)
    // tanimli oldugundan burada tekrar edilmez, ham "province" degeri donulur.
    const participantsRaw = rows.map((r) => ({
      gender: r.gender,
      age: r.age,
      educationLevel: r.education_level,
      province: r.province,
      targetCountry: r.target_country,
      assignedCluster: r.assigned_cluster,
      generalScore: toNumber(r.normalize_skor),
    }));

    res.json({
      success: true,
      totalParticipants,
      generalScore,
      nationalAverage,
      dominantClusterKey,
      factorAverages,
      clusters,
      participants: participantsRaw,
      scope: isScoped ? "institution" : "all",
    });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Dashboard verileri hesaplanirken bir hata olustu." });
  }
});

// Sol menudeki "Genel Veriler" sayfasi (GlobalDataView.jsx) icin: institution_id
// filtresi UYGULANMADAN, veri tabanindaki TUM ogrencilerin toplam sayisini,
// genel goc niyeti ortalamasini, en baskin kumesini ve 7 faktorun ortalamasini
// hesaplayip doner. Sadece Yetki Talebi ONAYLANMIS ('Onaylandi') kurumlar
// (role='admin') veya super_admin erisebilir - onay durumu her istekte
// veri tabanindan canli kontrol edilir (JWT'ye gomulmez, cunku onay token
// alindiktan SONRA da gerceklesebilir).
app.get("/api/dashboard/global-stats", authenticate, async (req, res) => {
  if (req.role === "admin") {
    const globalDataStatus = await getGlobalDataStatus(pool, req.institutionId);
    if (globalDataStatus !== "approved") {
      return res.status(403).json({ success: false, message: "Bu veriye erismek icin onaylanmis bir Yetki Talebi gereklidir." });
    }
  } else if (req.role !== "super_admin") {
    return res.status(403).json({ success: false, message: "Bu islem icin yetkiniz bulunmuyor." });
  }

  try {
    // DISTINCT ON (student_id) + ORDER BY student_id, created_at DESC: her
    // ogrencinin (student_id) SADECE en son (created_at maksimum) anketini
    // getirir - boylece birden fazla kez anket dolduran bir ogrenci Turkiye
    // ortalamasina birden fazla kez katilmaz.
    const result = await pool.query(
      `SELECT
         l.assigned_cluster, l.normalize_skor,
         l.ekonomik_skor, l.sosyal_skor, l.sosyo_politik_skor, l.egitim_skor,
         l.cevresel_skor, l.psikolojik_skor, l.kulturel_skor
       FROM students s
       JOIN (
         SELECT DISTINCT ON (student_id) *
         FROM likert_responses
         ORDER BY student_id, created_at DESC
       ) l ON l.student_id = s.id
       WHERE s.role = 'student' AND l.normalize_skor IS NOT NULL`
    );

    const rows = result.rows;
    const toNumber = (v) => (v === null || v === undefined ? null : Math.round(Number(v) * 100) / 100);
    const average = (values) => (values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null);

    const totalParticipants = rows.length;
    const generalScore = toNumber(average(rows.map((r) => Number(r.normalize_skor)).filter((v) => !Number.isNaN(v))));

    const FACTOR_SCORE_COLUMNS = {
      ekonomik_istihdam: "ekonomik_skor",
      aile_sosyal: "sosyal_skor",
      sosyo_politik: "sosyo_politik_skor",
      egitim: "egitim_skor",
      cevresel: "cevresel_skor",
      psikolojik: "psikolojik_skor",
      kulturel: "kulturel_skor",
    };

    const factorAverages = {};
    for (const [factorKey, column] of Object.entries(FACTOR_SCORE_COLUMNS)) {
      const values = rows.map((r) => Number(r[column])).filter((v) => !Number.isNaN(v));
      factorAverages[factorKey] = toNumber(average(values));
    }

    const clusterCounts = { K1: 0, K2: 0, K3: 0, K4: 0, K5: 0 };
    for (const row of rows) {
      if (row.assigned_cluster && clusterCounts[row.assigned_cluster] !== undefined) {
        clusterCounts[row.assigned_cluster] += 1;
      }
    }
    let dominantClusterKey = null;
    let dominantClusterCount = -1;
    for (const [key, count] of Object.entries(clusterCounts)) {
      if (count > dominantClusterCount) {
        dominantClusterCount = count;
        dominantClusterKey = count > 0 ? key : dominantClusterKey;
      }
    }

    res.json({ success: true, totalParticipants, generalScore, dominantClusterKey, factorAverages });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Genel veriler hesaplanirken bir hata olustu." });
  }
});

// "Bireysel Katilimci Izleme" panelinin dinamik alt grup kiyaslama motoru:
// secilen demografik filtrelere (cinsiyet/yas/bolge/egitim/istihdam) gore
// veri tabaninda (demographics JOIN) filtrelenmis grubun 7 skorunun
// aritmetik ortalamasini SQL AVG() ile hesaplar. Kurum ID'sine gore veri
// izolasyonu korunur (role='admin' sadece kendi kurumunu gorur).
app.get("/api/tenant/participant-analysis", authenticate, async (req, res) => {
  if (req.role !== "admin" && req.role !== "super_admin") {
    return res.status(403).json({ success: false, message: "Bu islem icin yetkiniz bulunmuyor." });
  }

  try {
    const { gender, age, region, educationLevel, employmentStatus } = req.query;
    const isScoped = req.role === "admin";

    const params = [];
    let whereClause = "WHERE s.role = 'student' AND l.normalize_skor IS NOT NULL";

    if (isScoped) {
      params.push(req.institutionId);
      whereClause += ` AND s.institution_id = $${params.length}`;
    }
    if (gender) {
      params.push(gender);
      whereClause += ` AND d.gender = $${params.length}`;
    }
    if (age) {
      params.push(Number(age));
      whereClause += ` AND d.age = $${params.length}`;
    }
    if (educationLevel) {
      params.push(educationLevel);
      whereClause += ` AND d.education_level = $${params.length}`;
    }
    if (employmentStatus) {
      params.push(employmentStatus);
      whereClause += ` AND d.employment_status = $${params.length}`;
    }
    if (region) {
      const provinces = provincesForRegion(region);
      if (provinces.length === 0) {
        return res.json({
          success: true,
          totalParticipants: 0,
          averageGeneralScore: null,
          factorAverages: {
            goc_niyeti: null,
            sosyo_politik: null,
            ekonomik_istihdam: null,
            aile_sosyal: null,
            psikolojik: null,
            kulturel: null,
            cevresel: null,
          },
        });
      }
      params.push(provinces);
      whereClause += ` AND d.province = ANY($${params.length})`;
    }

    const result = await pool.query(
      `SELECT
         COUNT(*) AS total,
         AVG(l.normalize_skor) AS avg_general,
         AVG(l.goc_niyeti_skoru) AS avg_goc_niyeti,
         AVG(l.sosyo_politik_skor) AS avg_sosyo_politik,
         AVG(l.ekonomik_skor) AS avg_ekonomik,
         AVG(l.sosyal_skor) AS avg_sosyal,
         AVG(l.psikolojik_skor) AS avg_psikolojik,
         AVG(l.kulturel_skor) AS avg_kulturel,
         AVG(l.cevresel_skor) AS avg_cevresel
       FROM students s
       JOIN demographics d ON d.student_id = s.id
       JOIN LATERAL (
         SELECT * FROM likert_responses lr WHERE lr.student_id = s.id ORDER BY lr.created_at DESC LIMIT 1
       ) l ON true
       ${whereClause}`,
      params
    );

    const row = result.rows[0];
    const toNumber = (v) => (v === null || v === undefined ? null : Math.round(Number(v) * 100) / 100);

    res.json({
      success: true,
      totalParticipants: Number(row.total),
      averageGeneralScore: toNumber(row.avg_general),
      factorAverages: {
        goc_niyeti: toNumber(row.avg_goc_niyeti),
        sosyo_politik: toNumber(row.avg_sosyo_politik),
        ekonomik_istihdam: toNumber(row.avg_ekonomik),
        aile_sosyal: toNumber(row.avg_sosyal),
        psikolojik: toNumber(row.avg_psikolojik),
        kulturel: toNumber(row.avg_kulturel),
        cevresel: toNumber(row.avg_cevresel),
      },
    });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, message: "Katilimci analizi hesaplanirken bir hata olustu." });
  }
});

const YAS_GRUBU_RANGES = Array.from({ length: 30 - 18 + 1 }, (_, i) => 18 + i).reduce(
  (acc, age) => ({ ...acc, [String(age)]: [age, age] }),
  {}
);

// Moldova (anket_son_sayisal) icin "Dinamik Alt Grup Kiyaslama Motoru" -
// anket-son-sayisal.xlsx kod kitapcigindaki (9.png) MD'ye ozgu sayisal
// kodlarin TR ile tutarli, okunabilir Turkce etiketlere eslemesi. "İkamet
// Yeri" filtresi Moldova'da YOK (kod kitapcigi: "ikamet: yalniz Turkiye").
const MOLDOVA_YAS_GRUBU_RANGES = Array.from({ length: 33 - 18 + 1 }, (_, i) => 18 + i).reduce(
  (acc, age) => ({ ...acc, [String(age)]: [age, age] }),
  {}
);
const MOLDOVA_CINSIYET_LABELS = { 1: "Kadın", 2: "Erkek" };
const MOLDOVA_EGITIM_LABELS = {
  1: "İlköğretim", 2: "Lise", 3: "Meslek Yüksekokulu", 4: "Lisans",
  5: "Yüksek Lisans", 6: "Doktora", 7: "Diğer", 8: "Diğer",
};
const MOLDOVA_ISTIHDAM_LABELS = {
  1: "Şu anda çalışıyorum (tam zamanlı veya yarı zamanlı)",
  2: "Daha önce çalıştım ama şu anda çalışmıyorum",
  3: "Hiç çalışmadım",
  4: "Öğrenciyim",
};

function reverseCodesForLabel(labelMap, label) {
  return Object.entries(labelMap)
    .filter(([, value]) => value === label)
    .map(([code]) => Number(code));
}

async function getMoldovaFilterOptions() {
  const [cinsiyetRes, egitimRes, istihdamRes] = await Promise.all([
    pool.query("SELECT DISTINCT cinsiyet FROM anket_son_sayisal WHERE ulke = 'md' AND cinsiyet IS NOT NULL ORDER BY cinsiyet"),
    pool.query("SELECT DISTINCT egitim_level FROM anket_son_sayisal WHERE ulke = 'md' AND egitim_level IS NOT NULL ORDER BY egitim_level"),
    pool.query("SELECT DISTINCT istiftam FROM anket_son_sayisal WHERE ulke = 'md' AND istiftam IS NOT NULL ORDER BY istiftam"),
  ]);
  const uniqueLabels = (rows, col, map) => [...new Set(rows.map((r) => map[r[col]]).filter(Boolean))];
  return {
    cinsiyet: uniqueLabels(cinsiyetRes.rows, "cinsiyet", MOLDOVA_CINSIYET_LABELS),
    yasGrubu: Object.keys(MOLDOVA_YAS_GRUBU_RANGES),
    egitimSeviyesi: uniqueLabels(egitimRes.rows, "egitim_level", MOLDOVA_EGITIM_LABELS),
    calismaDurumu: uniqueLabels(istihdamRes.rows, "istiftam", MOLDOVA_ISTIHDAM_LABELS),
  };
}

function buildMoldovaDemographicFilter(query) {
  const { cinsiyet, yas_grubu, egitim_seviyesi, calisma_durumu } = query;
  const conditions = ["ulke = 'md'"];
  const params = [];

  if (cinsiyet && cinsiyet !== "Hepsi") {
    const codes = reverseCodesForLabel(MOLDOVA_CINSIYET_LABELS, cinsiyet);
    if (codes.length > 0) {
      params.push(codes);
      conditions.push(`cinsiyet = ANY($${params.length})`);
    }
  }
  if (egitim_seviyesi && egitim_seviyesi !== "Hepsi") {
    const codes = reverseCodesForLabel(MOLDOVA_EGITIM_LABELS, egitim_seviyesi);
    if (codes.length > 0) {
      params.push(codes);
      conditions.push(`egitim_level = ANY($${params.length})`);
    }
  }
  if (calisma_durumu && calisma_durumu !== "Hepsi") {
    const codes = reverseCodesForLabel(MOLDOVA_ISTIHDAM_LABELS, calisma_durumu);
    if (codes.length > 0) {
      params.push(codes);
      conditions.push(`istiftam = ANY($${params.length})`);
    }
  }
  if (yas_grubu && yas_grubu !== "Hepsi" && MOLDOVA_YAS_GRUBU_RANGES[yas_grubu]) {
    const [min, max] = MOLDOVA_YAS_GRUBU_RANGES[yas_grubu];
    params.push(min, max);
    conditions.push(`yas BETWEEN $${params.length - 1} AND $${params.length}`);
  }

  return {
    whereClause: `WHERE ${conditions.join(" AND ")}`,
    params,
  };
}

async function getFilterOptions() {
  const [cinsiyet, egitim, calisma, ikamet, gocGecmisi] = await Promise.all([
    pool.query("SELECT DISTINCT cinsiyet FROM raw_survey_data WHERE cinsiyet IS NOT NULL ORDER BY cinsiyet"),
    pool.query(
      "SELECT DISTINCT egitim_seviyesi FROM raw_survey_data WHERE egitim_seviyesi IS NOT NULL ORDER BY egitim_seviyesi"
    ),
    pool.query(
      "SELECT DISTINCT istihdam_durumu FROM raw_survey_data WHERE istihdam_durumu IS NOT NULL ORDER BY istihdam_durumu"
    ),
    pool.query(
      "SELECT DISTINCT mevcut_ikamet_yeri FROM raw_survey_data WHERE mevcut_ikamet_yeri IS NOT NULL ORDER BY mevcut_ikamet_yeri"
    ),
    pool.query(
      "SELECT DISTINCT onceki_yurtdisi FROM raw_survey_data WHERE onceki_yurtdisi IS NOT NULL ORDER BY onceki_yurtdisi"
    ),
  ]);

  return {
    cinsiyet: cinsiyet.rows.map((r) => r.cinsiyet),
    yasGrubu: Object.keys(YAS_GRUBU_RANGES),
    egitimSeviyesi: egitim.rows.map((r) => r.egitim_seviyesi),
    calismaDurumu: calisma.rows.map((r) => r.istihdam_durumu),
    ikametYeri: ikamet.rows.map((r) => r.mevcut_ikamet_yeri),
    gocGecmisi: gocGecmisi.rows.map((r) => r.onceki_yurtdisi),
  };
}

function buildDemographicFilter(query) {
  const { cinsiyet, yas_grubu, egitim_seviyesi, calisma_durumu, ikamet_yeri, goc_gecmisi } = query;
  const conditions = [];
  const params = [];

  if (cinsiyet && cinsiyet !== "Hepsi") {
    params.push(cinsiyet);
    conditions.push(`cinsiyet = $${params.length}`);
  }
  if (egitim_seviyesi && egitim_seviyesi !== "Hepsi") {
    params.push(egitim_seviyesi);
    conditions.push(`egitim_seviyesi = $${params.length}`);
  }
  if (calisma_durumu && calisma_durumu !== "Hepsi") {
    params.push(calisma_durumu);
    conditions.push(`istihdam_durumu = $${params.length}`);
  }
  if (ikamet_yeri && ikamet_yeri !== "Hepsi") {
    params.push(ikamet_yeri);
    conditions.push(`mevcut_ikamet_yeri = $${params.length}`);
  }
  if (goc_gecmisi && goc_gecmisi !== "Hepsi") {
    params.push(goc_gecmisi);
    conditions.push(`onceki_yurtdisi = $${params.length}`);
  }
  if (yas_grubu && yas_grubu !== "Hepsi" && YAS_GRUBU_RANGES[yas_grubu]) {
    const [min, max] = YAS_GRUBU_RANGES[yas_grubu];
    params.push(min, max);
    conditions.push(`yas BETWEEN $${params.length - 1} AND $${params.length}`);
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

app.get("/api/dashboard-filter", authenticate, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const isMoldova = req.query.country === "md";
    const { whereClause, params } = isMoldova
      ? buildMoldovaDemographicFilter(req.query)
      : buildDemographicFilter(req.query);
    const sourceTable = isMoldova ? "anket_son_sayisal" : "raw_survey_data";
    const likertColumns = Array.from({ length: 51 }, (_, i) => `l${i + 1}`);
    const result = await pool.query(
      `SELECT ${likertColumns.join(", ")} FROM ${sourceTable} ${whereClause}`,
      params
    );

    const rows = result.rows;
    const totalParticipants = rows.length;

    if (totalParticipants === 0) {
      return res.status(200).json({
        success: true,
        totalParticipants: 0,
        migrationIntent: { average: null, classification: null },
        factors: FACTOR_GROUPS.map((g) => ({ key: g.key, label: g.label, score: null, classification: null })),
      });
    }

    const computedRows = rows.map((row) => computeRowScores(row));

    const average = (key) => {
      const values = computedRows.map((r) => r[key]).filter((v) => v !== null && v !== undefined);
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    };

    const factors = FACTOR_GROUPS.map((g) => {
      const score = average(g.key);
      return { key: g.key, label: g.label, score, classification: classifyScore(score) };
    });

    const migrationIntentAverage = average(MIGRATION_INTENT_GROUP.key);

    res.status(200).json({
      success: true,
      totalParticipants,
      migrationIntent: {
        average: migrationIntentAverage,
        classification: classifyScore(migrationIntentAverage),
      },
      factors,
    });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({
      success: false,
      message: "Filtrelenmis veriler hesaplanirken bir hata olustu.",
    });
  }
});

// Turkiye-Moldova Karsilastirma sayfasi: ayni demografik filtrelerle (cinsiyet,
// yas_grubu, egitim_seviyesi, calisma_durumu - "ikamet_yeri" iki ulkede ortak
// olmadigi icin kullanilmaz) her iki ulkenin 7 faktorunu, goc niyeti
// siniflandirma dagilimini (Dusuk/Orta/Yuksek yuzdesi) ve yasa gore goc niyeti
// egilimini (yas_grubu filtresi HARIC, diger filtrelerle) tek istekte dondurur.
async function computeComparisonSide(sourceTable, filterBuilder, query) {
  const likertColumns = Array.from({ length: 51 }, (_, i) => `l${i + 1}`);

  const { whereClause, params } = filterBuilder(query);
  const result = await pool.query(`SELECT ${likertColumns.join(", ")} FROM ${sourceTable} ${whereClause}`, params);
  const computedRows = result.rows.map((row) => computeRowScores(row));
  const totalParticipants = computedRows.length;

  const average = (key) => {
    const values = computedRows.map((r) => r[key]).filter((v) => v !== null && v !== undefined);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };
  const factors = FACTOR_GROUPS.map((g) => ({ key: g.key, label: g.label, score: average(g.key) }));
  const migrationIntentAverage = average(MIGRATION_INTENT_GROUP.key);

  const classCounts = { "Düşük": 0, "Orta": 0, "Yüksek": 0 };
  for (const scores of computedRows) {
    const c = classifyScore(scores.goc_niyeti);
    if (c && classCounts[c] !== undefined) classCounts[c] += 1;
  }
  const classificationDistribution = Object.fromEntries(
    Object.entries(classCounts).map(([key, count]) => [
      key,
      totalParticipants > 0 ? (count / totalParticipants) * 100 : 0,
    ])
  );

  // Yas trendi: yas_grubu filtresi HARIC, diger secili filtrelerle.
  const { yas_grubu, ...queryWithoutAge } = query;
  const { whereClause: ageWhereClause, params: ageParams } = filterBuilder(queryWithoutAge);
  const ageResult = await pool.query(
    `SELECT yas, ${likertColumns.join(", ")} FROM ${sourceTable} ${ageWhereClause}`,
    ageParams
  );
  const ageGroups = {};
  for (const row of ageResult.rows) {
    if (row.yas === null || row.yas === undefined) continue;
    const scores = computeRowScores(row);
    if (scores.goc_niyeti === null) continue;
    (ageGroups[row.yas] ??= []).push(scores.goc_niyeti);
  }
  const ageTrend = Object.entries(ageGroups)
    .map(([age, values]) => ({
      age: Number(age),
      average: values.reduce((a, b) => a + b, 0) / values.length,
    }))
    .sort((a, b) => a.age - b.age);

  return {
    totalParticipants,
    migrationIntent: { average: migrationIntentAverage, classification: classifyScore(migrationIntentAverage) },
    factors,
    classificationDistribution,
    ageTrend,
  };
}

app.get("/api/comparison", authenticate, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const [turkey, moldova, trOptions, mdOptions] = await Promise.all([
      computeComparisonSide("raw_survey_data", buildDemographicFilter, req.query),
      computeComparisonSide("anket_son_sayisal", buildMoldovaDemographicFilter, req.query),
      getFilterOptions(),
      getMoldovaFilterOptions(),
    ]);

    // Iki ulkenin ortak filtre secenekleri (etiketler kasitli olarak ayni
    // Turkce metinlerle hizalandi - bkz. MOLDOVA_EGITIM_LABELS/ISTIHDAM_LABELS);
    // birlesim alinir ki her iki ulkede de gercekte var olan tum degerler
    // (orn. MD'deki 31-33 yas) secenek listesinde kaybolmasin.
    const unionSorted = (a, b) => [...new Set([...(a || []), ...(b || [])])].sort();
    const filterOptions = {
      cinsiyet: unionSorted(trOptions.cinsiyet, mdOptions.cinsiyet),
      yasGrubu: unionSorted(trOptions.yasGrubu, mdOptions.yasGrubu).sort((a, b) => Number(a) - Number(b)),
      egitimSeviyesi: unionSorted(trOptions.egitimSeviyesi, mdOptions.egitimSeviyesi),
      calismaDurumu: unionSorted(trOptions.calismaDurumu, mdOptions.calismaDurumu),
    };

    res.status(200).json({ success: true, turkey, moldova, filterOptions });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({
      success: false,
      message: "Karsilastirma verileri hesaplanirken bir hata olustu.",
    });
  }
});

// "Iliskisel Analiz" (Goc Niyeti x Goc Kaygilari scatter) icin kisi bazinda
// (satir satir, ORTALAMA DEGIL) 7 faktor + goc niyeti skorlarini dondurur.
// Frontend bu noktalari kendi cizer ve kullanici bir aralik sectiginde
// (surukleyerek) o aralikta kalan noktalarin faktor profilini ISTEMCI
// TARAFINDA hesaplar - boylece surukleme sirasinda sunucuya tekrar istek
// atilmaz, etkilesim aninda tepki verir.
async function computeComparisonScatter(sourceTable, filterBuilder, query) {
  const likertColumns = Array.from({ length: 51 }, (_, i) => `l${i + 1}`);
  const { whereClause, params } = filterBuilder(query);
  const result = await pool.query(`SELECT ${likertColumns.join(", ")} FROM ${sourceTable} ${whereClause}`, params);
  const points = result.rows
    .map((row) => computeRowScores(row))
    .filter((s) => s.goc_niyeti !== null && s.psikolojik !== null);
  return { points };
}

app.get("/api/comparison-scatter", authenticate, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const [turkey, moldova] = await Promise.all([
      computeComparisonScatter("raw_survey_data", buildDemographicFilter, req.query),
      computeComparisonScatter("anket_son_sayisal", buildMoldovaDemographicFilter, req.query),
    ]);
    res.status(200).json({ success: true, turkey, moldova });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({
      success: false,
      message: "Iliskisel analiz verileri hesaplanirken bir hata olustu.",
    });
  }
});

// "Yurt Disi Baglantisi" karsilastirmasi: katilimcilari yurt disinda aile
// uyesi bulunup bulunmamasi VE kendi yurt disi deneyimi (yasama/egitim/
// calisma) bulunup bulunmamasina gore 4 gruba ayirir (bkz. GROUP_ORDER),
// her grup icin 7 faktor + goc niyeti ortalamasini ve katilimci sayisini
// dondurur. Moldova kodlamasi kullanici tarafindan DOGRULANDI: 1=Evet, 2=Hayir.
const ABROAD_GROUP_ORDER = ["noneNone", "familyOnly", "experienceOnly", "both"];

function classifyAbroadGroup(hasFamily, hasExperience) {
  if (!hasFamily && !hasExperience) return "noneNone";
  if (hasFamily && !hasExperience) return "familyOnly";
  if (!hasFamily && hasExperience) return "experienceOnly";
  return "both";
}

async function computeAbroadGroups(sourceTable, filterBuilder, query, familyColumn, experienceColumn, isPositiveFamily, isPositiveExperience) {
  const likertColumns = Array.from({ length: 51 }, (_, i) => `l${i + 1}`);
  const { whereClause, params } = filterBuilder(query);
  const result = await pool.query(
    `SELECT ${familyColumn} AS family_raw, ${experienceColumn} AS experience_raw, ${likertColumns.join(", ")} FROM ${sourceTable} ${whereClause}`,
    params
  );

  const buckets = { noneNone: [], familyOnly: [], experienceOnly: [], both: [] };
  for (const row of result.rows) {
    if (row.family_raw === null || row.family_raw === undefined) continue;
    if (row.experience_raw === null || row.experience_raw === undefined) continue;
    const key = classifyAbroadGroup(isPositiveFamily(row.family_raw), isPositiveExperience(row.experience_raw));
    buckets[key].push(computeRowScores(row));
  }

  const scoreKeys = [...FACTOR_GROUPS.map((g) => g.key), MIGRATION_INTENT_GROUP.key];
  const groups = ABROAD_GROUP_ORDER.map((key) => {
    const rows = buckets[key];
    const scores = {};
    for (const scoreKey of scoreKeys) {
      const values = rows.map((r) => r[scoreKey]).filter((v) => v !== null && v !== undefined);
      scores[scoreKey] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    }
    return { key, count: rows.length, scores };
  });

  return { groups };
}

app.get("/api/comparison-abroad-groups", authenticate, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const [turkey, moldova] = await Promise.all([
      computeAbroadGroups(
        "raw_survey_data",
        buildDemographicFilter,
        req.query,
        "aile_yurtdisi",
        "onceki_yurtdisi",
        (v) => v === "Evet",
        (v) => v === "Evet"
      ),
      computeAbroadGroups(
        "anket_son_sayisal",
        buildMoldovaDemographicFilter,
        req.query,
        "yurt_disi_yasayan_aile_durumu",
        "yurt_disi_bulunma_durumu",
        (v) => Number(v) === 1,
        (v) => Number(v) === 1
      ),
    ]);
    res.status(200).json({ success: true, turkey, moldova });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({
      success: false,
      message: "Yurt disi baglantisi verileri hesaplanirken bir hata olustu.",
    });
  }
});

// "Ortak Goc Profilleri": her katilimciyi, TR+MD BIRLESIK (pooled, ulke
// GIRDI OLMADAN kurulmus) sabit merkezlere (bkz. utils/clustering.js ->
// getPooledProfileCentroids, backend/ml/cluster_centroids_pooled.json) gore
// en yakin profile (P1-P5) atar. Merkezler SABITTIR - filtre degisince
// YENIDEN KURULMAZ, sadece hangi katilimcilarin sayildigi degisir.
const TR_LANGUAGE_COLUMNS = [
  "yabanci_dil_ingilizce",
  "yabanci_dil_almanca",
  "yabanci_dil_fransizca",
  "yabanci_dil_rusca",
  "yabanci_dil_arapca",
  "yabanci_dil_diger",
];

function deriveTrProfileDetail(row) {
  const languageCount = TR_LANGUAGE_COLUMNS.reduce((sum, col) => sum + (row[col] === "Evet" ? 1 : 0), 0);
  return { age: row.yas ?? null, languageCount, hasExperience: row.onceki_yurtdisi === "Evet" };
}

function deriveMdProfileDetail(row) {
  return {
    age: row.yas ?? null,
    languageCount: row.dil_sayisi ?? null,
    hasExperience: Number(row.yurt_disi_bulunma_durumu) === 1,
  };
}

async function computeProfileSide(sourceTable, filterBuilder, query, extraColumns, deriveDetail) {
  const likertColumns = Array.from({ length: 51 }, (_, i) => `l${i + 1}`);
  const { whereClause, params } = filterBuilder(query);
  const result = await pool.query(
    `SELECT ${extraColumns.join(", ")}, ${likertColumns.join(", ")} FROM ${sourceTable} ${whereClause}`,
    params
  );

  const titles = getPooledProfileTitles() || {};
  const buckets = Object.fromEntries(POOLED_PROFILE_KEYS.map((key) => [key, []]));
  for (const row of result.rows) {
    const scores = computeRowScores(row);
    const profileKey = assignPooledProfile(scores);
    if (!profileKey || !buckets[profileKey]) continue;
    buckets[profileKey].push({ scores, detail: deriveDetail(row) });
  }

  const totalParticipants = result.rows.length;
  const average = (items, fn) => {
    const values = items.map(fn).filter((v) => v !== null && v !== undefined);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };

  const profiles = POOLED_PROFILE_KEYS.map((key) => {
    const items = buckets[key];
    const count = items.length;
    return {
      key,
      title: titles[key] || key,
      count,
      percentage: totalParticipants > 0 ? (count / totalParticipants) * 100 : 0,
      detail: {
        migrationIntent: average(items, (it) => it.scores.goc_niyeti),
        age: average(items, (it) => it.detail.age),
        languageCount: average(items, (it) => it.detail.languageCount),
        abroadExperiencePercentage: count > 0 ? (items.filter((it) => it.detail.hasExperience).length / count) * 100 : null,
        factors: Object.fromEntries(
          FACTOR_GROUPS.map((g) => [g.key, average(items, (it) => it.scores[g.key])])
        ),
      },
    };
  });

  return { totalParticipants, profiles };
}

app.get("/api/comparison-profiles", authenticate, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const [turkey, moldova] = await Promise.all([
      computeProfileSide(
        "raw_survey_data",
        buildDemographicFilter,
        req.query,
        ["yas", "onceki_yurtdisi", ...TR_LANGUAGE_COLUMNS],
        deriveTrProfileDetail
      ),
      computeProfileSide(
        "anket_son_sayisal",
        buildMoldovaDemographicFilter,
        req.query,
        ["yas", "dil_sayisi", "yurt_disi_bulunma_durumu"],
        deriveMdProfileDetail
      ),
    ]);
    res.status(200).json({ success: true, turkey, moldova });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({
      success: false,
      message: "Ortak goc profilleri hesaplanirken bir hata olustu.",
    });
  }
});

app.get("/api/dashboard-overview", authenticate, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    // ulke=md -> Moldova (anket_son_sayisal, ulke='md', 483 katilimci). Varsayilan
    // (parametre yoksa/baska bir deger ise) her zaman Turkiye (raw_survey_data, 890).
    const isMoldova = req.query.country === "md";
    const sourceTable = isMoldova ? "anket_son_sayisal" : "raw_survey_data";
    const likertColumns = Array.from({ length: 51 }, (_, i) => `l${i + 1}`);
    const result = await pool.query(
      isMoldova
        ? `SELECT id, ${likertColumns.join(", ")} FROM anket_son_sayisal WHERE ulke = 'md' ORDER BY id`
        : `SELECT id, ${likertColumns.join(", ")} FROM raw_survey_data ORDER BY row_number`
    );

    const rows = result.rows;
    const filterOptions = isMoldova ? await getMoldovaFilterOptions() : await getFilterOptions();

    if (rows.length === 0) {
      return res.status(200).json({
        success: true,
        totalParticipants: 0,
        migrationIntent: { average: null, classification: null },
        topFactor: null,
        highScoreStudentPercentage: 0,
        factors: FACTOR_GROUPS.map((g) => ({ key: g.key, label: g.label, score: null, classification: null })),
        filterOptions,
      });
    }

    // Her satirin faktor skorlarini hesapla ve veritabanina yaz (ortalama skor DB'de de gorunsun).
    const computedRows = rows.map((row) => ({ id: row.id, scores: computeRowScores(row) }));

    await Promise.all(
      computedRows.map(({ id, scores }) => {
        const gocNiyetiSiniflandirma = classifyScore(scores.goc_niyeti);
        return pool.query(
          `UPDATE ${sourceTable} SET
             score_ekonomik_istihdam = $1,
             score_egitim = $2,
             score_aile_sosyal = $3,
             score_kulturel = $4,
             score_sosyo_politik = $5,
             score_cevresel = $6,
             score_goc_niyeti = $7,
             score_psikolojik = $8,
             goc_niyeti_siniflandirma = $9,
             scores_computed_at = NOW()
           WHERE id = $10`,
          [
            scores.ekonomik_istihdam,
            scores.egitim,
            scores.aile_sosyal,
            scores.kulturel,
            scores.sosyo_politik,
            scores.cevresel,
            scores.goc_niyeti,
            scores.psikolojik,
            gocNiyetiSiniflandirma,
            id,
          ]
        );
      })
    );

    const totalParticipants = computedRows.length;

    const average = (key) => {
      const values = computedRows.map((r) => r.scores[key]).filter((v) => v !== null && v !== undefined);
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    };

    const factors = FACTOR_GROUPS.map((g) => {
      const score = average(g.key);
      return { key: g.key, label: g.label, score, classification: classifyScore(score) };
    });

    const migrationIntentAverage = average(MIGRATION_INTENT_GROUP.key);
    const migrationIntentClassification = classifyScore(migrationIntentAverage);

    const topFactor = factors.reduce(
      (best, f) => (f.score !== null && (best === null || f.score > best.score) ? f : best),
      null
    );

    const highScoreCount = computedRows.filter(
      (r) => classifyScore(r.scores.goc_niyeti) === "Yüksek"
    ).length;
    const highScoreStudentPercentage = totalParticipants > 0 ? (highScoreCount / totalParticipants) * 100 : 0;

    res.status(200).json({
      success: true,
      totalParticipants,
      migrationIntent: {
        average: migrationIntentAverage,
        classification: migrationIntentClassification,
      },
      topFactor,
      highScoreStudentPercentage,
      factors,
      filterOptions,
    });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({
      success: false,
      message: "Dashboard verileri hesaplanirken bir hata olustu.",
    });
  }
});

app.get("/api/kmeans-results", authenticate, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const isMoldova = req.query.country === "md";
    const sourceTable = isMoldova ? "anket_son_sayisal" : "raw_survey_data";
    const countryFilter = isMoldova ? "ulke = 'md' AND " : "";
    const factorColumns = FACTOR_GROUPS.map((g) => `score_${g.key}`);

    const pointsResult = await pool.query(
      `SELECT id, cluster_label, pca_x, pca_y, ${factorColumns.join(", ")}
       FROM ${sourceTable}
       WHERE ${countryFilter}cluster_label IS NOT NULL AND pca_x IS NOT NULL AND pca_y IS NOT NULL
       ORDER BY id`
    );

    if (pointsResult.rows.length === 0) {
      return res.status(200).json({
        success: true,
        computed: false,
        message: isMoldova
          ? "Moldova kumeleme sonuclari henuz hesaplanmamis. Terminalde 'python backend/scripts/run_kmeans_pca_moldova.py' komutunu calistirin."
          : "Kumeleme sonuclari henuz hesaplanmamis. Terminalde 'python backend/scripts/run_kmeans_pca.py' komutunu calistirin.",
        points: [],
        clusterProfiles: [],
      });
    }

    const points = pointsResult.rows.map((row) => ({
      id: row.id,
      clusterLabel: row.cluster_label,
      pcaX: Number(row.pca_x),
      pcaY: Number(row.pca_y),
    }));

    const profilesResult = await pool.query(
      `SELECT cluster_label, COUNT(*) AS count, ${factorColumns
        .map((col) => `AVG(${col}) AS ${col}`)
        .join(", ")}
       FROM ${sourceTable}
       WHERE ${countryFilter}cluster_label IS NOT NULL
       GROUP BY cluster_label
       ORDER BY cluster_label`
    );

    const clusterProfiles = profilesResult.rows.map((row) => ({
      clusterLabel: row.cluster_label,
      count: Number(row.count),
      factors: FACTOR_GROUPS.map((g) => ({
        key: g.key,
        label: g.label,
        score: row[`score_${g.key}`] !== null ? Number(row[`score_${g.key}`]) : null,
      })),
    }));

    res.status(200).json({
      success: true,
      computed: true,
      totalParticipants: points.length,
      points,
      clusterProfiles,
    });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({
      success: false,
      message: "K-Means sonuclari alinirken bir hata olustu.",
    });
  }
});

// Turkiye'nin 81 ilini 7 cografi bolgeye eslestiren sozluk.
const PROVINCE_TO_REGION = {
  // Marmara
  Balıkesir: "marmara",
  Bilecik: "marmara",
  Bursa: "marmara",
  Çanakkale: "marmara",
  Edirne: "marmara",
  İstanbul: "marmara",
  Kırklareli: "marmara",
  Kocaeli: "marmara",
  Sakarya: "marmara",
  Tekirdağ: "marmara",
  Yalova: "marmara",
  // Ege
  Afyonkarahisar: "ege",
  Aydın: "ege",
  Denizli: "ege",
  İzmir: "ege",
  Kütahya: "ege",
  Manisa: "ege",
  Muğla: "ege",
  Uşak: "ege",
  // Akdeniz
  Adana: "akdeniz",
  Antalya: "akdeniz",
  Burdur: "akdeniz",
  Hatay: "akdeniz",
  Isparta: "akdeniz",
  Kahramanmaraş: "akdeniz",
  Mersin: "akdeniz",
  Osmaniye: "akdeniz",
  // Ic Anadolu
  Aksaray: "icAnadolu",
  Ankara: "icAnadolu",
  Çankırı: "icAnadolu",
  Eskişehir: "icAnadolu",
  Karaman: "icAnadolu",
  Kayseri: "icAnadolu",
  Kırıkkale: "icAnadolu",
  Kırşehir: "icAnadolu",
  Konya: "icAnadolu",
  Nevşehir: "icAnadolu",
  Niğde: "icAnadolu",
  Sivas: "icAnadolu",
  Yozgat: "icAnadolu",
  // Karadeniz
  Amasya: "karadeniz",
  Artvin: "karadeniz",
  Bartın: "karadeniz",
  Bayburt: "karadeniz",
  Bolu: "karadeniz",
  Çorum: "karadeniz",
  Düzce: "karadeniz",
  Giresun: "karadeniz",
  Gümüşhane: "karadeniz",
  Kastamonu: "karadeniz",
  Karabük: "karadeniz",
  Ordu: "karadeniz",
  Rize: "karadeniz",
  Samsun: "karadeniz",
  Sinop: "karadeniz",
  Tokat: "karadeniz",
  Trabzon: "karadeniz",
  Zonguldak: "karadeniz",
  // Dogu Anadolu
  Ağrı: "doguAnadolu",
  Ardahan: "doguAnadolu",
  Bingöl: "doguAnadolu",
  Bitlis: "doguAnadolu",
  Elazığ: "doguAnadolu",
  Erzincan: "doguAnadolu",
  Erzurum: "doguAnadolu",
  Hakkari: "doguAnadolu",
  Iğdır: "doguAnadolu",
  Kars: "doguAnadolu",
  Malatya: "doguAnadolu",
  Muş: "doguAnadolu",
  Tunceli: "doguAnadolu",
  Van: "doguAnadolu",
  // Guneydogu Anadolu
  Adıyaman: "guneydoguAnadolu",
  Batman: "guneydoguAnadolu",
  Diyarbakır: "guneydoguAnadolu",
  Gaziantep: "guneydoguAnadolu",
  Kilis: "guneydoguAnadolu",
  Mardin: "guneydoguAnadolu",
  Siirt: "guneydoguAnadolu",
  Şanlıurfa: "guneydoguAnadolu",
  Şırnak: "guneydoguAnadolu",
};

const REGION_ORDER = [
  "marmara",
  "ege",
  "akdeniz",
  "icAnadolu",
  "karadeniz",
  "doguAnadolu",
  "guneydoguAnadolu",
];

const CLUSTER_LABELS = ["K1", "K2", "K3", "K4", "K5"];

// "bolge" sutunundaki 1-4 kodlari, burada ham haliyle (bolge1-bolge4) gruplanip
// dondurulur; kodun hangi resmi Moldova bolgesine (Chisinau/Nord/Centru/
// Sud+Gagauzia) karsilik geldigi esleme SADECE frontend'de (RegionalHeatmap.jsx
// -> MOLDOVA_BOLGE_TO_REGION, kullanicinin sagladigi kod kitapcigiyla
// dogrulanmistir) yapilir - harita, gercek raion sinirlariyla (moldova-raions.geojson) cizilir.
const MOLDOVA_REGION_KEYS = ["bolge1", "bolge2", "bolge3", "bolge4"];

app.get("/api/regional-heatmap", authenticate, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const isMoldova = req.query.country === "md";
    const likertColumns = Array.from({ length: 51 }, (_, i) => `l${i + 1}`);

    if (isMoldova) {
      const result = await pool.query(
        `SELECT bolge, cluster_label, ${likertColumns.join(", ")} FROM anket_son_sayisal WHERE ulke = 'md'`
      );

      const buckets = MOLDOVA_REGION_KEYS.reduce((acc, key) => {
        acc[key] = { scores: [], clusterCounts: { K1: 0, K2: 0, K3: 0, K4: 0, K5: 0 } };
        return acc;
      }, {});

      for (const row of result.rows) {
        const regionKey = row.bolge ? `bolge${row.bolge}` : null;
        if (!regionKey || !buckets[regionKey]) continue;
        buckets[regionKey].scores.push(computeRowScores(row));
        if (row.cluster_label && buckets[regionKey].clusterCounts[row.cluster_label] !== undefined) {
          buckets[regionKey].clusterCounts[row.cluster_label] += 1;
        }
      }

      const average = (scores, key) => {
        const values = scores.map((s) => s[key]).filter((v) => v !== null && v !== undefined);
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
      };

      const regions = MOLDOVA_REGION_KEYS.map((key) => {
        const bucket = buckets[key];
        const clusterTotal = CLUSTER_LABELS.reduce((sum, label) => sum + bucket.clusterCounts[label], 0);
        const clusterDistribution = CLUSTER_LABELS.map((label) => ({
          clusterLabel: label,
          count: bucket.clusterCounts[label],
          percentage: clusterTotal > 0 ? (bucket.clusterCounts[label] / clusterTotal) * 100 : 0,
        }));
        const dominantProfile = clusterDistribution.reduce(
          (best, c) => (best === null || c.percentage > best.percentage ? c : best),
          null
        );
        return {
          key,
          participantCount: bucket.scores.length,
          migrationIntentScore: average(bucket.scores, "goc_niyeti"),
          anxietyScore: average(bucket.scores, "psikolojik"),
          clusterDistribution,
          dominantProfile: dominantProfile && dominantProfile.count > 0 ? dominantProfile : null,
        };
      });

      return res.status(200).json({ success: true, isMoldova: true, regions });
    }

    const result = await pool.query(
      `SELECT il, cluster_label, ${likertColumns.join(", ")} FROM raw_survey_data`
    );

    const buckets = REGION_ORDER.reduce((acc, key) => {
      acc[key] = { scores: [], clusterCounts: { K1: 0, K2: 0, K3: 0, K4: 0, K5: 0 } };
      return acc;
    }, {});

    for (const row of result.rows) {
      const regionKey = PROVINCE_TO_REGION[String(row.il ?? "").trim()];
      if (!regionKey) continue;
      buckets[regionKey].scores.push(computeRowScores(row));
      if (row.cluster_label && buckets[regionKey].clusterCounts[row.cluster_label] !== undefined) {
        buckets[regionKey].clusterCounts[row.cluster_label] += 1;
      }
    }

    const average = (scores, key) => {
      const values = scores.map((s) => s[key]).filter((v) => v !== null && v !== undefined);
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    };

    const regions = REGION_ORDER.map((key) => {
      const bucket = buckets[key];
      const clusterTotal = CLUSTER_LABELS.reduce((sum, label) => sum + bucket.clusterCounts[label], 0);

      const clusterDistribution = CLUSTER_LABELS.map((label) => ({
        clusterLabel: label,
        count: bucket.clusterCounts[label],
        percentage: clusterTotal > 0 ? (bucket.clusterCounts[label] / clusterTotal) * 100 : 0,
      }));

      const dominantProfile = clusterDistribution.reduce(
        (best, c) => (best === null || c.percentage > best.percentage ? c : best),
        null
      );

      return {
        key,
        participantCount: bucket.scores.length,
        migrationIntentScore: average(bucket.scores, "goc_niyeti"),
        anxietyScore: average(bucket.scores, "psikolojik"),
        clusterDistribution,
        dominantProfile: dominantProfile && dominantProfile.count > 0 ? dominantProfile : null,
      };
    });

    res.status(200).json({ success: true, regions });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({
      success: false,
      message: "Bolgesel veriler hesaplanirken bir hata olustu.",
    });
  }
});

// "Hedef Ulke Haritasi" (dunya haritasinda tercih yogunlugu) ve "Goc Yonelim
// Haritasi" (Turkiye/Moldova'dan hedef ulkelere cizgiler) sayfalari icin:
// serbest metin "hedef ulke" yanitlarini (bkz. utils/targetCountryMap.js)
// kanonik ulke adlarina cozup, her ulke icin kac kez secildigini sayar.
const COUNTRY_CENTROIDS_PATH = path.join(__dirname, "ml", "country_centroids.json");
let countryCentroidsCache = null;
function getCountryCentroids() {
  if (!countryCentroidsCache) {
    countryCentroidsCache = JSON.parse(fs.readFileSync(COUNTRY_CENTROIDS_PATH, "utf8"));
  }
  return countryCentroidsCache;
}

// filterBuilder'in urettigi WHERE kosuluna (bkz. buildDemographicFilter /
// buildMoldovaDemographicFilter - "Ortak Filtreler" panelindeki cinsiyet/yas
// grubu/egitim/calisma durumu secimleri) hedef-ulke sutununun BOS OLMAMASI
// sarti eklenir. MD tarafinda whereClause zaten hep doludur ("ulke='md'"
// kosulu kalici oldugu icin), TR tarafinda filtre yoksa bos olabilir.
async function aggregateTargetCountries(sourceTable, columnName, filterBuilder, query) {
  const { whereClause, params } = filterBuilder(query);
  const nonEmptyCondition = `${columnName} IS NOT NULL AND ${columnName} <> ''`;
  const fullWhere = whereClause ? `${whereClause} AND ${nonEmptyCondition}` : `WHERE ${nonEmptyCondition}`;

  const result = await pool.query(
    `SELECT ${columnName} AS raw_value FROM ${sourceTable} ${fullWhere}`,
    params
  );
  const counts = {};
  let resolvedTotal = 0;
  let nonCountryCount = 0;
  let unresolvedCount = 0;
  for (const row of result.rows) {
    const { countries, isNonCountry } = resolveTargetCountries(row.raw_value);
    if (countries.length > 0) {
      resolvedTotal += 1;
      for (const country of countries) {
        counts[country] = (counts[country] || 0) + 1;
      }
    } else if (isNonCountry) {
      nonCountryCount += 1;
    } else {
      unresolvedCount += 1;
    }
  }

  const centroids = getCountryCentroids();
  const countries = Object.entries(counts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: resolvedTotal > 0 ? (count / resolvedTotal) * 100 : 0,
      coordinates: centroids[name] || null,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalResponses: result.rows.length,
    resolvedTotal,
    nonCountryCount,
    unresolvedCount,
    countries,
  };
}

app.get("/api/target-countries", authenticate, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const centroids = getCountryCentroids();
    const [turkey, moldova] = await Promise.all([
      aggregateTargetCountries("raw_survey_data", "hedef_ulke", buildDemographicFilter, req.query),
      aggregateTargetCountries("anket_son_sayisal", "gitmek_istedigi_ulke", buildMoldovaDemographicFilter, req.query),
    ]);

    // Renk olceginin Turkiye ve Moldova haritalarinda AYNI yuzdeyi AYNI renkle
    // gostermesi icin (karsilastirilabilirlik), iki tarafin en yuksek
    // yuzdesinin BUYUGU tek, PAYLASILAN bir tavan (maxPercentage) olarak
    // dondurulur - frontend ayri ayri degil, bu ortak degeri kullanir.
    const sideMax = (side) => (side.countries.length > 0 ? side.countries[0].percentage : 0);
    const maxPercentage = Math.max(sideMax(turkey), sideMax(moldova), 1);

    res.status(200).json({
      success: true,
      maxPercentage,
      turkey: { ...turkey, origin: centroids["Turkey"] || null },
      moldova: { ...moldova, origin: centroids["Moldova"] || null },
    });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({
      success: false,
      message: "Hedef ulke verileri hesaplanirken bir hata olustu.",
    });
  }
});

app.get("/api/dashboard-distribution", authenticate, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const isMoldova = req.query.country === "md";
    const likertColumns = Array.from({ length: 51 }, (_, i) => `l${i + 1}`);
    const result = await pool.query(
      isMoldova
        ? `SELECT ${likertColumns.join(", ")} FROM anket_son_sayisal WHERE ulke = 'md'`
        : `SELECT ${likertColumns.join(", ")} FROM raw_survey_data`
    );
    const rows = result.rows;
    const totalParticipants = rows.length;
    const totalQuestions = FACTOR_GROUPS.reduce((sum, g) => sum + g.columns.length, 0);

    const overallBins = Array(BIN_LABELS.length).fill(0);
    const factorBins = {};
    FACTOR_GROUPS.forEach((g) => {
      factorBins[g.key] = Array(BIN_LABELS.length).fill(0);
    });

    for (const row of rows) {
      const averages = computeRowRawAverages(row);

      const overallIdx = binIndexForValue(averages.overall);
      if (overallIdx !== null) overallBins[overallIdx]++;

      FACTOR_GROUPS.forEach((g) => {
        const idx = binIndexForValue(averages[g.key]);
        if (idx !== null) factorBins[g.key][idx]++;
      });
    }

    const toBins = (counts) => BIN_LABELS.map((range, i) => ({ range, count: counts[i] }));

    res.status(200).json({
      success: true,
      totalParticipants,
      totalQuestions,
      overall: { bins: toBins(overallBins) },
      factors: FACTOR_GROUPS.map((g) => ({
        key: g.key,
        label: g.label,
        bins: toBins(factorBins[g.key]),
      })),
    });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({
      success: false,
      message: "Dagilim verileri hesaplanirken bir hata olustu.",
    });
  }
});

function pearsonCorrelation(xs, ys) {
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  const denominator = Math.sqrt(denomX * denomY);
  return denominator === 0 ? 0 : numerator / denominator;
}

app.get("/api/correlation-matrix", authenticate, requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const isMoldova = req.query.country === "md";
    const likertColumns = Array.from({ length: 51 }, (_, i) => `l${i + 1}`);
    const result = await pool.query(
      isMoldova
        ? `SELECT ${likertColumns.join(", ")} FROM anket_son_sayisal WHERE ulke = 'md'`
        : `SELECT ${likertColumns.join(", ")} FROM raw_survey_data`
    );
    const rows = result.rows;

    const rowAverages = rows.map((row) => computeRowRawAverages(row));
    const keys = FACTOR_GROUPS.map((g) => g.key);

    const valuesByKey = {};
    keys.forEach((key) => {
      valuesByKey[key] = rowAverages.map((avg) => avg[key]);
    });

    const correlationBetween = (keyA, keyB) => {
      if (keyA === keyB) return 1;
      const pairsX = [];
      const pairsY = [];
      for (let i = 0; i < rows.length; i++) {
        const x = valuesByKey[keyA][i];
        const y = valuesByKey[keyB][i];
        if (x !== null && y !== null) {
          pairsX.push(x);
          pairsY.push(y);
        }
      }
      return pairsX.length > 1 ? pearsonCorrelation(pairsX, pairsY) : 0;
    };

    const matrix = keys.map((keyA) => ({
      key: keyA,
      values: keys.map((keyB) => ({ key: keyB, r: correlationBetween(keyA, keyB) })),
    }));

    res.status(200).json({
      success: true,
      totalParticipants: rows.length,
      factors: FACTOR_GROUPS.map((g) => ({ key: g.key, label: g.label })),
      matrix,
    });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({
      success: false,
      message: "Korelasyon matrisi hesaplanirken bir hata olustu.",
    });
  }
});

const ML_DIR = path.join(__dirname, "ml");
const PYTHON_BIN = process.env.PYTHON_BIN || "python";

app.get("/api/classification-metrics", authenticate, requireAdminOrSuperAdmin, async (req, res) => {
  const isMoldova = req.query.country === "md";
  const metricsPath = path.join(ML_DIR, isMoldova ? "classification_metrics_moldova.json" : "classification_metrics.json");
  if (!fs.existsSync(metricsPath)) {
    return res.status(200).json({
      success: true,
      trained: false,
      message: isMoldova
        ? "Moldova siniflandirma modeli henuz egitilmemis. Terminalde 'python backend/scripts/train_classifier_moldova.py' komutunu calistirin."
        : "Siniflandirma modeli henuz egitilmemis. Terminalde 'python backend/scripts/train_classifier.py' komutunu calistirin.",
    });
  }

  // Moldova simulatorunun secenekleri, modelin egitildigi (goc_niyeti_siniflandirma
  // dolu) MD satirlarinin GERCEK ham degerlerinden uretilir - model ham degerlerle
  // egitildigi icin (ornegin gitmek_istedigi_ulke "Germania", "Italia" ...) tahmin
  // sirasinda da birebir ayni degerler gonderilmelidir.
  if (isMoldova) {
    try {
      const metrics = JSON.parse(fs.readFileSync(metricsPath, "utf8"));
      const mdDistinct = async (col) => {
        const result = await pool.query(
          `SELECT DISTINCT ${col}::text AS v FROM anket_son_sayisal
           WHERE ulke = 'md' AND goc_niyeti_siniflandirma IS NOT NULL AND ${col} IS NOT NULL ORDER BY v`
        );
        return result.rows.map((r) => r.v);
      };
      const [cinsiyet, egitim, istihdam, medeni, gelir, dilSayisi, aile, deneyim, hedef] = await Promise.all([
        mdDistinct("cinsiyet"),
        mdDistinct("egitim_level"),
        mdDistinct("istiftam"),
        mdDistinct("medeni_durum"),
        mdDistinct("gelir"),
        mdDistinct("dil_sayisi"),
        mdDistinct("yurt_disi_yasayan_aile_durumu"),
        mdDistinct("yurt_disi_bulunma_durumu"),
        mdDistinct("gitmek_istedigi_ulke"),
      ]);

      // GELIR etiketleri burada SABITLENMEZ - dile gore (TR/EN/RO) cevrilebilmesi
      // icin frontend'deki cp.optionLabels.gelirDuzeyi (i18n) sozlugunden okunur
      // (bkz. Classification.jsx, anahtarlar "1".."6" kod kitapciginda verilen
      // Euro araliklaridir).
      const simulatorOptions = {
        yasGrubu: Array.from({ length: 33 - 18 + 1 }, (_, i) => String(18 + i)),
        cinsiyet,
        egitimSeviyesi: egitim,
        istihdamDurumu: istihdam,
        medeniDurum: medeni,
        gelirDuzeyi: gelir,
        yurtDisindaAile: aile,
        yurtDisiDeneyimi: deneyim,
        hedefUlke: hedef,
        dilSayisi,
      };
      // cinsiyet/egitimSeviyesi/istihdamDurumu/medeniDurum/yurtDisindaAile/
      // yurtDisiDeneyimi burada ARTIK sabitlenmez - dile gore (TR/EN/RO)
      // cevrilebilmesi icin frontend'deki cp.optionLabels sozluklerinden
      // (Classification.jsx) okunur (anahtarlar Moldova ham kodlaridir: "1","2"...).
      const simulatorOptionLabels = {
        hedefUlke: Object.fromEntries(
          hedef.map((raw) => {
            const resolved = resolveTargetCountries(raw);
            return [raw, resolved.countries[0] || raw];
          })
        ),
      };
      return res.status(200).json({
        success: true,
        trained: true,
        ...metrics,
        simulatorOptions,
        simulatorOptionLabels,
      });
    } catch (err) {
      console.error(`[${req.method} ${req.originalUrl}]`, err);
      return res.status(500).json({ success: false, message: "Model metrikleri okunurken bir hata olustu." });
    }
  }

  try {
    const metrics = JSON.parse(fs.readFileSync(metricsPath, "utf8"));

    const [cinsiyet, egitim, istihdam, ikamet, gecmis, medeni, gelir] = await Promise.all([
      pool.query("SELECT DISTINCT cinsiyet FROM raw_survey_data WHERE cinsiyet IS NOT NULL ORDER BY cinsiyet"),
      pool.query(
        "SELECT DISTINCT egitim_seviyesi FROM raw_survey_data WHERE egitim_seviyesi IS NOT NULL ORDER BY egitim_seviyesi"
      ),
      pool.query(
        "SELECT DISTINCT istihdam_durumu FROM raw_survey_data WHERE istihdam_durumu IS NOT NULL ORDER BY istihdam_durumu"
      ),
      pool.query(
        "SELECT DISTINCT mevcut_ikamet_yeri FROM raw_survey_data WHERE mevcut_ikamet_yeri IS NOT NULL ORDER BY mevcut_ikamet_yeri"
      ),
      pool.query(
        "SELECT DISTINCT onceki_yurtdisi FROM raw_survey_data WHERE onceki_yurtdisi IS NOT NULL ORDER BY onceki_yurtdisi"
      ),
      pool.query(
        "SELECT DISTINCT medeni_durum FROM raw_survey_data WHERE medeni_durum IS NOT NULL ORDER BY medeni_durum"
      ),
      pool.query(
        "SELECT DISTINCT gelir_duzeyi FROM raw_survey_data WHERE gelir_duzeyi IS NOT NULL ORDER BY gelir_duzeyi"
      ),
    ]);

    // "Hedef Ulke" anket sorusu acik metin oldugundan (130+ dagitik/yazim hatali deger)
    // secim kutusu icin en sik gorulen, temiz ulke adlarindan kuratorlu bir liste kullanilir.
    const simulatorOptions = {
      yasGrubu: Array.from({ length: 30 - 18 + 1 }, (_, i) => String(18 + i)),
      cinsiyet: cinsiyet.rows.map((r) => r.cinsiyet),
      egitimSeviyesi: egitim.rows.map((r) => r.egitim_seviyesi),
      istihdamDurumu: istihdam.rows.map((r) => r.istihdam_durumu),
      medeniDurum: medeni.rows.map((r) => r.medeni_durum),
      ikametYeri: ikamet.rows.map((r) => r.mevcut_ikamet_yeri),
      gelirDuzeyi: gelir.rows.map((r) => r.gelir_duzeyi),
      aileYurtdisi: ["Evet", "Hayır"],
      yurtdisiDeneyimi: gecmis.rows.map((r) => r.onceki_yurtdisi),
      hedefUlke: [
        "Almanya",
        "Amerika Birleşik Devletleri",
        "İngiltere",
        "Kanada",
        "Fransa",
        "Hollanda",
        "İsviçre",
        "Norveç",
        "İsveç",
        "Avustralya",
        "İtalya",
        "İspanya",
        "Japonya",
        "Danimarka",
        "Belçika",
        "Avusturya",
        "Finlandiya",
        "Yeni Zelanda",
        "Diğer",
      ],
      dilYetkinligi: ["Yok", "Düşük", "Orta", "Yüksek"],
    };

    res.status(200).json({ success: true, trained: true, ...metrics, simulatorOptions });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({
      success: false,
      message: "Model metrikleri okunurken bir hata olustu.",
    });
  }
});

app.get("/api/decision-tree", authenticate, requireAdminOrSuperAdmin, async (req, res) => {
  const isMoldova = req.query.country === "md";
  const treePath = path.join(ML_DIR, isMoldova ? "decision_tree_moldova.json" : "decision_tree.json");
  if (!fs.existsSync(treePath)) {
    return res.status(200).json({
      success: true,
      trained: false,
      message: isMoldova
        ? "Moldova karar agaci modeli henuz egitilmemis. Terminalde 'python backend/scripts/train_decision_tree_moldova.py' komutunu calistirin."
        : "Karar agaci modeli henuz egitilmemis. Terminalde 'python backend/scripts/train_decision_tree.py' komutunu calistirin.",
    });
  }

  try {
    const tree = JSON.parse(fs.readFileSync(treePath, "utf8"));
    res.status(200).json({ success: true, trained: true, ...tree });
  } catch (err) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({
      success: false,
      message: "Karar agaci verileri okunurken bir hata olustu.",
    });
  }
});

app.post("/api/predict-simulation", authenticate, requireAdminOrSuperAdmin, (req, res) => {
  const isMoldova = req.body?.country === "md";
  const modelPath = path.join(ML_DIR, isMoldova ? "rf_model_moldova.joblib" : "rf_model.joblib");
  if (!fs.existsSync(modelPath)) {
    return res.status(200).json({
      success: false,
      message:
        "Siniflandirma modeli henuz egitilmemis. Terminalde 'python backend/scripts/train_classifier.py' komutunu calistirin.",
    });
  }

  // PYTHONIOENCODING: predict.py'nin sys.stdout.reconfigure("utf-8") cagrisina
  // ek guvenlik - Windows'ta konsol kod sayfasindan BAGIMSIZ olarak UTF-8
  // ciktiyi garanti eder (Turkce karakterlerin bozulmasini onler).
  const child = spawn(PYTHON_BIN, [path.join(__dirname, "scripts", "predict.py")], {
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk.toString("utf8")));
  child.stderr.on("data", (chunk) => (stderr += chunk.toString("utf8")));

  child.on("close", (code) => {
    if (code !== 0) {
      return res.status(500).json({
        success: false,
        message: "Tahmin hesaplanirken bir hata olustu.",
        error: stderr || `python exited with code ${code}`,
      });
    }
    try {
      const result = JSON.parse(stdout);
      res.status(200).json(result);
    } catch (err) {
      console.error(`[${req.method} ${req.originalUrl}]`, err);
      res.status(500).json({
        success: false,
        message: "Tahmin sonucu ayristirilamadi.",
      });
    }
  });

  child.stdin.write(JSON.stringify(req.body || {}));
  child.stdin.end();
});

// Siniflandirma Analizi sayfasindaki "Gelismis Tahmin Simulatoru" icin: 7
// faktor skoruna (0-100) gore, gercek anket kayitlarinin atandigi AYNI 5'li
// K-Means kumesine (K1-K5) olan eslesme yuzdelerini dondurur. Python/RF
// modelinden BAGIMSIZDIR - dogrudan utils/clustering.js'teki K-Means kume merkezleri
// ile Oklid mesafesi karsilastirmasi yapar (assignCluster ile ayni mantik).
app.post("/api/simulator/predict", authenticate, requireAdminOrSuperAdmin, (req, res) => {
  const factorKeys = [
    "ekonomik_istihdam",
    "aile_sosyal",
    "sosyo_politik",
    "egitim",
    "cevresel",
    "psikolojik",
    "kulturel",
  ];
  const scores = req.body?.scores;
  const isValid =
    scores &&
    typeof scores === "object" &&
    factorKeys.every((key) => typeof scores[key] === "number" && !Number.isNaN(scores[key]) && scores[key] >= 0 && scores[key] <= 100);

  if (!isValid) {
    return res.status(400).json({
      success: false,
      message: "7 faktor skorunun tamami 0-100 araliginda sayisal olarak gonderilmelidir.",
    });
  }

  const country = req.body?.country === "md" ? "md" : "tr";
  const distribution = getClusterDistribution(scores, country);
  if (!distribution) {
    return res.status(503).json({
      success: false,
      message: "Kume merkezleri henuz hesaplanmamis. Terminalde 'python backend/scripts/run_kmeans_pca.py' komutunu calistirin.",
    });
  }
  res.status(200).json({ success: true, dominantCluster: distribution[0], distribution });
});

app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} adresinde calisiyor.`);
});
