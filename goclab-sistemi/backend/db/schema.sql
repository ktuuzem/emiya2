-- GÖÇLAB - Öğrenci kayıt tablosu

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  institution VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  activation_code VARCHAR(6) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Sifre sifirlama akisi icin (var olan tablolarda da calisir, idempotent)
ALTER TABLE students ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE students ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;

-- Iliskisel sema: kurumlar, demografik bilgiler, anket yanitlari (students tablosu uzerinden)

CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- NOT: "İçişleri Bakanlığı" (bosluksuz) kasitli olarak burada YOK - gercek
-- kurum basvuru formuyla olusturulan ve sifresi olan "İç işleri Bakanlığı"
-- (bosluklu) ile ayni kurumu temsil eden, sifresiz/admini olmayan bir
-- duplikasyondu; ogrenciler yanlislikla bu bosluksuz surumu secince
-- Kurum panelinde veri hic gorunmuyordu. Duplike satir manuel silindi; bu
-- seed'in tekrar olusturmamasi icin isim listesinden tamamen cikarildi.
--
-- NOT: "Dışişleri Bakanlığı" ve "Millî Eğitim Bakanlığı" de kasitli olarak
-- burada YOK - onceden sahte/on-tanimli (hicbir zaman gercek basvuru
-- surecinden gecmemis, sifresiz) satirlar olarak vardi. Kullanici talebiyle
-- silindi; bu kurumlar artik SADECE gercek Kurum Basvuru Formu uzerinden
-- (InstitutionApply.jsx -> POST /api/institution-applications) basvuru
-- yapilip Sistem Yoneticisi tarafindan onaylandiginda veri tabaninda
-- olusacak (status='Beklemede' ile baslar).
INSERT INTO institutions (name)
VALUES ('İç işleri Bakanlığı')
ON CONFLICT (name) DO NOTHING;

-- Kurum Basvuru Formu (InstitutionApply.jsx) ve Sistem Yoneticisi panelindeki
-- Kurum Yonetimi sayfasi icin gerekli ek sutunlar (idempotent).
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS institution_type VARCHAR(100);
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255);
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS contact_title VARCHAR(255);
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS application_reason TEXT;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS kvkk_accepted BOOLEAN NOT NULL DEFAULT true;
-- durum: 'Beklemede' (yeni basvuru) | 'Aktif' (onaylanmis) | 'Reddedildi'
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'Beklemede';
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

-- kurumsal_eposta alaninin benzersiz (UNIQUE) olmasini garanti eder (idempotent:
-- kisit zaten varsa hata vermeden atlar).
DO $$
BEGIN
  ALTER TABLE institutions ADD CONSTRAINT institutions_contact_email_key UNIQUE (contact_email);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN
  NULL;
END $$;

-- updated_at sutununu her UPDATE'te otomatik guncelleyen tetikleyici
-- (ORM'lerdeki onupdate davranisinin veri tabani seviyesindeki karsiligi).
CREATE OR REPLACE FUNCTION set_institutions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_institutions_updated_at ON institutions;
CREATE TRIGGER trg_institutions_updated_at
BEFORE UPDATE ON institutions
FOR EACH ROW
EXECUTE FUNCTION set_institutions_updated_at();

-- Kurum onaylandiginda kurumun kendi hesabi icin belirleyecegi sifre ve bu
-- islemi tek kullanimlik bir baglantiyla dogrulayan token (idempotent).
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS password_setup_token VARCHAR(255);
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS password_setup_token_expires TIMESTAMP;

-- students tablosuna kurum, onam ve sifre sifirlama icin eksik sutunlar (idempotent)
ALTER TABLE students ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id);
ALTER TABLE students ADD COLUMN IF NOT EXISTS consent_given BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE students ADD COLUMN IF NOT EXISTS consent_date TIMESTAMP;

CREATE TABLE IF NOT EXISTS demographics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  gender VARCHAR(20),
  age INTEGER,
  marital_status VARCHAR(100),
  education_level VARCHAR(100),
  income_level VARCHAR(100),
  province VARCHAR(100),
  target_country VARCHAR(100),
  employment_status VARCHAR(100),
  employment_sector VARCHAR(100),
  foreign_language VARCHAR(100),
  language_level VARCHAR(100)
);

-- Mevcut (onceden olusturulmus) demographics tablosuna gender sutununu ekler
-- (idempotent); Kurum Dashboard'undaki cinsiyet kirilim grafigi bu sutuna dayanir.
ALTER TABLE demographics ADD COLUMN IF NOT EXISTS gender VARCHAR(20);

CREATE TABLE IF NOT EXISTS likert_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  q1 INTEGER, q2 INTEGER, q3 INTEGER, q4 INTEGER, q5 INTEGER,
  q6 INTEGER, q7 INTEGER, q8 INTEGER, q9 INTEGER, q10 INTEGER,
  q11 INTEGER, q12 INTEGER, q13 INTEGER, q14 INTEGER, q15 INTEGER,
  q16 INTEGER, q17 INTEGER, q18 INTEGER, q19 INTEGER, q20 INTEGER,
  q21 INTEGER, q22 INTEGER, q23 INTEGER, q24 INTEGER, q25 INTEGER,
  q26 INTEGER, q27 INTEGER, q28 INTEGER, q29 INTEGER, q30 INTEGER,
  q31 INTEGER, q32 INTEGER, q33 INTEGER, q34 INTEGER, q35 INTEGER, q36 INTEGER
);

-- Canli anket 35 maddeden 36 maddeye cikarildi (eksik olan ilk madde eklendi);
-- mevcut veri tabanlari icin q36 sutunu (idempotent).
ALTER TABLE likert_responses ADD COLUMN IF NOT EXISTS q36 INTEGER;

-- Onceki hatali surumden kalan gereksiz tablo, artik students kullaniliyor
DROP TABLE IF EXISTS users CASCADE;

-- Yonetici/ogrenci ayrimi icin rol sutunu (idempotent)
ALTER TABLE students ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'student';

-- Test yonetici hesabi icin kurum kaydi (idempotent). Hesabin kendisi ve
-- sifresi ARTIK burada degil, db/migrate.js icinde SEED_YONETICI_PASSWORD
-- ortam degiskeninden (veya rastgele uretilerek) olusturulur - bkz. asagidaki NOT.
INSERT INTO institutions (name)
VALUES ('GÖÇLAB')
ON CONFLICT (name) DO NOTHING;

-- Onceden seed edilen (sistem) kurumlar, yeni basvuru mekanizmasindan farkli
-- olarak zaten aktif kabul edilir (idempotent). "Dışişleri Bakanlığı" ve
-- "Millî Eğitim Bakanlığı" BİLİNÇLİ OLARAK burada YOK - artik sadece gercek
-- Kurum Basvuru Formu ile basvurulup Sistem Yoneticisi tarafindan manuel
-- onaylandiginda aktif olacaklar (bkz. yukaridaki NOT).
UPDATE institutions SET status = 'Aktif'
WHERE name IN ('İç işleri Bakanlığı', 'GÖÇLAB')
  AND status = 'Beklemede';

-- GUVENLIK: "Yonetici Hesabi" (yonetici@goclab.com) hesabinin sifresi ONCEDEN
-- burada duz metin olarak yazili idi (crypt('goclab2026', ...)) - kaynak kodu
-- goren HERKES bu sifreyi bilebiliyordu. Bu hesap artik db/migrate.js
-- tarafindan, SEED_YONETICI_PASSWORD ortam degiskeninden (yoksa rastgele
-- uretilip bir kereligine konsola yazdirilarak) olusturulur.

-- Onceki surumde yanlislikla students tablosuna eklenmis sistem yoneticisi
-- satirini temizler (bir kereye mahsus, idempotent - artik system_admins
-- tablosunda tutulur).
DELETE FROM students WHERE email = 'admin@goclab.com' AND role = 'super_admin';

-- Sistem yoneticileri (Super Admin): kurum/ogrenci hesaplarindan tamamen
-- ayri, kendi tablosunda tutulur. Gizli rotadan (SysAdminLogin) giris yapar;
-- dis kayit kapali oldugu icin tek giris yolu bu seed'dir (idempotent;
-- sifre bcrypt-uyumlu pgcrypto blowfish hash'i ile saklanir, duz metin degildir).
CREATE TABLE IF NOT EXISTS system_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'super_admin',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- GUVENLIK: Sistem yoneticisi (admin@goclab.com) hesabinin sifresi ONCEDEN
-- burada duz metin olarak yazili idi (crypt('Admin1234!', ...)). Bu hesap
-- artik db/migrate.js tarafindan, SEED_SYSADMIN_PASSWORD ortam degiskeninden
-- (yoksa rastgele uretilip bir kereligine konsola yazdirilarak) olusturulur.

-- Excel'den (sonuclar.xlsx) aktarilan ham anket verisi icin bagimsiz, iliskisiz duz tablo.
-- Hicbir Foreign Key icermez; students/demographics/likert_responses ile bagi yoktur.
-- Sutunlar, Excel dosyasindaki gercek basliklarla birebir (satir ve sutun sirasi korunarak) eslesir.
CREATE TABLE IF NOT EXISTS raw_survey_data (
  id SERIAL PRIMARY KEY,
  row_number INTEGER,
  yanit_kodu INTEGER,
  gonderildigi_tarih VARCHAR(50),
  son_bakilan_sayfa INTEGER,
  baslangic_dili VARCHAR(20),
  tohum BIGINT,
  baslangic_tarihi VARCHAR(50),
  son_islem_tarihi VARCHAR(50),
  gelinen_adres TEXT,
  cinsiyet VARCHAR(50),
  yas INTEGER,
  medeni_durum VARCHAR(100),
  egitim_seviyesi VARCHAR(150),
  istihdam_durumu VARCHAR(200),
  sektor VARCHAR(200),
  sektor_diger VARCHAR(200),
  gelir_duzeyi VARCHAR(150),
  il VARCHAR(100),
  mevcut_ikamet_yeri VARCHAR(150),
  yabanci_dil_yok VARCHAR(10),
  yabanci_dil_ingilizce VARCHAR(10),
  yabanci_dil_almanca VARCHAR(10),
  yabanci_dil_fransizca VARCHAR(10),
  yabanci_dil_rusca VARCHAR(10),
  yabanci_dil_arapca VARCHAR(10),
  yabanci_dil_diger VARCHAR(10),
  ingilizce_duzeyi VARCHAR(50),
  almanca_duzeyi VARCHAR(50),
  fransizca_duzeyi VARCHAR(50),
  rusca_duzeyi VARCHAR(50),
  arapca_duzeyi VARCHAR(50),
  diger_dil_adi VARCHAR(100),
  diger_dil_duzeyi VARCHAR(50),
  aile_yurtdisi VARCHAR(50),
  onceki_yurtdisi VARCHAR(50),
  dogum_yeri VARCHAR(150),
  hedef_ulke VARCHAR(150),
  l1 VARCHAR(50), l2 VARCHAR(50), l3 VARCHAR(50), l4 VARCHAR(50), l5 VARCHAR(50),
  l6 VARCHAR(50), l7 VARCHAR(50), l8 VARCHAR(50), l9 VARCHAR(50), l10 VARCHAR(50),
  l11 VARCHAR(50), l12 VARCHAR(50), l13 VARCHAR(50), l14 VARCHAR(50), l15 VARCHAR(50),
  l16 VARCHAR(50), l17 VARCHAR(50), l18 VARCHAR(50), l19 VARCHAR(50), l20 VARCHAR(50),
  l21 VARCHAR(50), l22 VARCHAR(50), l23 VARCHAR(50), l24 VARCHAR(50), l25 VARCHAR(50),
  l26 VARCHAR(50), l27 VARCHAR(50), l28 VARCHAR(50), l29 VARCHAR(50), l30 VARCHAR(50),
  l31 VARCHAR(50), l32 VARCHAR(50), l33 VARCHAR(50), l34 VARCHAR(50), l35 VARCHAR(50), l36 VARCHAR(50),
  extra_data JSONB,
  imported_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tez Ek A'daki olcek gelistirme tablosunda L50'ye kadar madde kodu
-- kullanildigi tespit edildi (sonuclar3.xlsx - 51 maddelik tam madde havuzu).
-- Onceki sonuclar.xlsx yalnizca L1-L36 iceriyordu VE bu L-numaralari
-- sonuclar3.xlsx'teki AYNI numaralarla eslesmiyordu (ayni katilimcilarda
-- L1-L36 karsilastirmasinda %59 fark bulundu) - yani eski dosyanin madde
-- numaralandirmasi tez Ek A'siyla tutarsizdi. Bu yuzden L37-L51 sutunlari
-- eklenip tum ham veri sonuclar3.xlsx'ten yeniden aktarilmistir (idempotent).
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS l37 VARCHAR(50);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS l38 VARCHAR(50);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS l39 VARCHAR(50);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS l40 VARCHAR(50);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS l41 VARCHAR(50);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS l42 VARCHAR(50);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS l43 VARCHAR(50);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS l44 VARCHAR(50);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS l45 VARCHAR(50);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS l46 VARCHAR(50);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS l47 VARCHAR(50);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS l48 VARCHAR(50);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS l49 VARCHAR(50);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS l50 VARCHAR(50);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS l51 VARCHAR(50);

-- Faktor bazli, satir bazinda hesaplanan ortalama skorlar (0-100, normallestirilmis).
-- Her satirin ortalama hesabinin veritabaninda goruntulenebilmesi icin idempotent sekilde eklenir.
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS score_ekonomik_istihdam NUMERIC(5,2);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS score_egitim NUMERIC(5,2);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS score_aile_sosyal NUMERIC(5,2);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS score_kulturel NUMERIC(5,2);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS score_sosyo_politik NUMERIC(5,2);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS score_cevresel NUMERIC(5,2);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS score_goc_niyeti NUMERIC(5,2);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS score_psikolojik NUMERIC(5,2);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS goc_niyeti_siniflandirma VARCHAR(10);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS scores_computed_at TIMESTAMP;

-- K-Means kumeleme ve PCA boyut indirgeme sonuclari (backend/scripts/run_kmeans_pca.py ile hesaplanir).
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS cluster_label VARCHAR(10);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS pca_x NUMERIC(10,4);
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS pca_y NUMERIC(10,4);

-- Kurum panelindeki "Yetki Talebi" modalindan (PermissionRequestModal.jsx)
-- gonderilen, Turkiye geneli sistem verilerine erisim taleplerini tutar.
-- Ad Soyad ve Kurum bilgisi burada tekrar edilmez; Sistem Yoneticisi
-- panelindeki Yetki Yonetimi sayfasi bunlari institutions tablosuyla JOIN
-- ederek (contact_person, name) okur.
-- durum: 'Onay Bekliyor' | 'Onaylandi' | 'Reddedildi'
CREATE TABLE IF NOT EXISTS permission_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'Onay Bekliyor',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_permission_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_permission_requests_updated_at ON permission_requests;
CREATE TRIGGER trg_permission_requests_updated_at
BEFORE UPDATE ON permission_requests
FOR EACH ROW
EXECUTE FUNCTION set_permission_requests_updated_at();

-- Iliskisel kopru: raw_survey_data'yi institutions'a baglayan yabanci anahtar
-- (idempotent, nullable). Excel'den toplu aktarilan mevcut ~2485 satirin
-- hangi kuruma ait oldugunu gosteren guvenilir bir kaynak olmadigi icin
-- gecmis satirlar bilincli olarak NULL birakilir (veri uydurulmaz); bu sutun
-- yalnizca ileride kuruma ozel veri girisi/atamasi yapildiginda doldurulur.
-- Mevcut "Yonetici" analiz sayfalari (Genel Bakis, K-Means, Korelasyon,
-- Siniflandirma, Karar Agaci, Isi Haritasi) bu sutuna gore filtrelenmez;
-- ulke geneli/arastirma bulgulari gorunumu oldugu gibi korunur.
ALTER TABLE raw_survey_data ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id);
CREATE INDEX IF NOT EXISTS idx_raw_survey_data_institution_id ON raw_survey_data(institution_id);

-- Ogrencinin canli anket yanitlarindan (q1-q36) hesaplanan faktor skorlari,
-- genel goc niyeti skoru ve en yakin kume atamasi (idempotent, nullable).
ALTER TABLE likert_responses ADD COLUMN IF NOT EXISTS goc_niyeti_skoru NUMERIC(5,2);
ALTER TABLE likert_responses ADD COLUMN IF NOT EXISTS normalize_skor NUMERIC(5,2);
ALTER TABLE likert_responses ADD COLUMN IF NOT EXISTS ekonomik_skor NUMERIC(5,2);
ALTER TABLE likert_responses ADD COLUMN IF NOT EXISTS egitim_skor NUMERIC(5,2);
ALTER TABLE likert_responses ADD COLUMN IF NOT EXISTS sosyal_skor NUMERIC(5,2);
ALTER TABLE likert_responses ADD COLUMN IF NOT EXISTS kulturel_skor NUMERIC(5,2);
ALTER TABLE likert_responses ADD COLUMN IF NOT EXISTS sosyo_politik_skor NUMERIC(5,2);
ALTER TABLE likert_responses ADD COLUMN IF NOT EXISTS cevresel_skor NUMERIC(5,2);
ALTER TABLE likert_responses ADD COLUMN IF NOT EXISTS psikolojik_skor NUMERIC(5,2);
ALTER TABLE likert_responses ADD COLUMN IF NOT EXISTS assigned_cluster VARCHAR(10);

-- Bire-cok (1:N) iliski: bir ogrencinin birden fazla anket gonderimi olabilir
-- (Anket Gecmisim). Her satir ayri bir anket denemesini temsil eder; student_id
-- uzerinde UNIQUE kisitlama yoktur, tamamlama tarihi bu sutunla izlenir.
ALTER TABLE likert_responses ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();

-- Sistem Yoneticisi panelindeki Log Izleme sayfasi icin: giris/cikis, sifre
-- degisimi, yetki onayi ve yetkisiz erisim denemeleri gibi kritik hareketleri
-- tutar (bkz. backend/utils/logger.js). user_id BILINCLI OLARAK sabit bir
-- FOREIGN KEY tasimaz - islemi yapan hesap uc farkli tablodan (students,
-- institutions, system_admins) gelebilir ve Postgres tek bir sutunda
-- polimorfik FK'yi native desteklemez. Bunun yerine, denetim gunlugu
-- pratiginde standart olan sekilde, kayit anindaki Ad Soyad (user_name) ve
-- rol (user_role) DENORMALIZE edilerek saklanir - boylece ilgili hesap daha
-- sonra silinse/degisse bile log kaydi kendi baglaminda okunabilir kalir.
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_name VARCHAR(255),
  user_role VARCHAR(20),
  action_type VARCHAR(100) NOT NULL,
  ip_address VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'Başarılı',
  login_time TIMESTAMP,
  logout_time TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);

-- Excel'den (data/anket-son-sayisal.xlsx) aktarilan, Turkiye (tr) ve Moldova
-- (md) katilimcilarinin birlesik ham anket verisi icin bagimsiz, iliskisiz
-- duz tablo. raw_survey_data (sadece Turkiye, 890 satir, sonuclar3.xlsx) ile
-- hicbir iliskisi/FK'si yoktur - kullanici talebiyle AYRI bir tablo olarak
-- tutulur. Sutunlar, Excel'deki gercek basliklarla birebir eslesir; L1-L51
-- kaynakta zaten sayisal (1-5) oldugu icin burada da INTEGER'dir (raw_survey_data'daki
-- gibi metin donusumu gerekmez).
CREATE TABLE IF NOT EXISTS anket_son_sayisal (
  id SERIAL PRIMARY KEY,
  ulke VARCHAR(10) NOT NULL,
  dil INTEGER,
  cinsiyet INTEGER,
  yas INTEGER,
  medeni_durum VARCHAR(100),
  egitim_level VARCHAR(100),
  istiftam VARCHAR(200),
  sektor_type VARCHAR(200),
  gelir VARCHAR(100),
  bolge INTEGER,
  ikamet VARCHAR(50),
  yabanci_dil_bilgisi_yok INTEGER,
  dil_sayisi INTEGER,
  yurt_disi_yasayan_aile_durumu INTEGER,
  yurt_disi_bulunma_durumu INTEGER,
  gitmek_istedigi_ulke VARCHAR(100),
  gitmek_istedigi_ulke_2 VARCHAR(100),
  gitmek_istedigi_ulke_3 VARCHAR(100),
  gitmek_istedigi_ulke_4 VARCHAR(100),
  l1 INTEGER, l2 INTEGER, l3 INTEGER, l4 INTEGER, l5 INTEGER,
  l6 INTEGER, l7 INTEGER, l8 INTEGER, l9 INTEGER, l10 INTEGER,
  l11 INTEGER, l12 INTEGER, l13 INTEGER, l14 INTEGER, l15 INTEGER,
  l16 INTEGER, l17 INTEGER, l18 INTEGER, l19 INTEGER, l20 INTEGER,
  l21 INTEGER, l22 INTEGER, l23 INTEGER, l24 INTEGER, l25 INTEGER,
  l26 INTEGER, l27 INTEGER, l28 INTEGER, l29 INTEGER, l30 INTEGER,
  l31 INTEGER, l32 INTEGER, l33 INTEGER, l34 INTEGER, l35 INTEGER,
  l36 INTEGER, l37 INTEGER, l38 INTEGER, l39 INTEGER, l40 INTEGER,
  l41 INTEGER, l42 INTEGER, l43 INTEGER, l44 INTEGER, l45 INTEGER,
  l46 INTEGER, l47 INTEGER, l48 INTEGER, l49 INTEGER, l50 INTEGER,
  l51 INTEGER,
  imported_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_anket_son_sayisal_ulke ON anket_son_sayisal(ulke);

-- Moldova (ulke='md') katilimcilari icin "Goc Niyeti Arastirmasi Sonuclari"
-- dashboard'unu beslemek uzere, raw_survey_data ile BIREBIR AYNI isimde
-- faktor skoru/kume sutunlari (idempotent, nullable). Su an icin SADECE
-- ulke='md' satirlari icin doldurulur (bkz. scripts/computeMoldovaScores.js,
-- scripts/run_kmeans_pca_moldova.py); tr satirlari bu sutunlarda NULL kalir -
-- Turkiye'nin kendi otoriter kaynagi raw_survey_data'dir.
ALTER TABLE anket_son_sayisal ADD COLUMN IF NOT EXISTS score_ekonomik_istihdam NUMERIC(5,2);
ALTER TABLE anket_son_sayisal ADD COLUMN IF NOT EXISTS score_egitim NUMERIC(5,2);
ALTER TABLE anket_son_sayisal ADD COLUMN IF NOT EXISTS score_aile_sosyal NUMERIC(5,2);
ALTER TABLE anket_son_sayisal ADD COLUMN IF NOT EXISTS score_kulturel NUMERIC(5,2);
ALTER TABLE anket_son_sayisal ADD COLUMN IF NOT EXISTS score_sosyo_politik NUMERIC(5,2);
ALTER TABLE anket_son_sayisal ADD COLUMN IF NOT EXISTS score_cevresel NUMERIC(5,2);
ALTER TABLE anket_son_sayisal ADD COLUMN IF NOT EXISTS score_goc_niyeti NUMERIC(5,2);
ALTER TABLE anket_son_sayisal ADD COLUMN IF NOT EXISTS score_psikolojik NUMERIC(5,2);
ALTER TABLE anket_son_sayisal ADD COLUMN IF NOT EXISTS goc_niyeti_siniflandirma VARCHAR(10);
ALTER TABLE anket_son_sayisal ADD COLUMN IF NOT EXISTS scores_computed_at TIMESTAMP;
ALTER TABLE anket_son_sayisal ADD COLUMN IF NOT EXISTS cluster_label VARCHAR(10);
ALTER TABLE anket_son_sayisal ADD COLUMN IF NOT EXISTS pca_x NUMERIC(10,4);
ALTER TABLE anket_son_sayisal ADD COLUMN IF NOT EXISTS pca_y NUMERIC(10,4);

-- Kisisel Rapor'daki "Skor Karsilastirmasi" grafiginin Kurum/Turkiye
-- sutunlari artik CANLI hesaplanmiyor - anket gonderildigi ANDA hesaplanip
-- bu satira SABIT (snapshot) olarak yazilir (bkz. POST /api/likert-responses).
-- Boylece baska ogrenciler daha sonra anket doldurdukca GECMIS raporlarin
-- ortalamalari geriye donuk degismez.
ALTER TABLE likert_responses ADD COLUMN IF NOT EXISTS snapshot_institution_avg NUMERIC(5,2);
ALTER TABLE likert_responses ADD COLUMN IF NOT EXISTS snapshot_turkey_avg NUMERIC(5,2);

-- Bu ozellik eklenmeden ONCE olusturulmus satirlar icin bir kerelik geriye
-- donuk doldurma (backfill) - idempotent: sadece hala NULL olan satirlari
-- doldurur, "su anki" kurum/Turkiye ortalamasini (her ogrencinin sadece en
-- son anketi baz alinarak) kullanir.
UPDATE likert_responses lr
SET snapshot_turkey_avg = sub.turkey_avg
FROM (
  SELECT AVG(l.normalize_skor) AS turkey_avg
  FROM (
    SELECT DISTINCT ON (student_id) * FROM likert_responses ORDER BY student_id, created_at DESC
  ) l
  WHERE l.normalize_skor IS NOT NULL
) sub
WHERE lr.snapshot_turkey_avg IS NULL AND lr.normalize_skor IS NOT NULL;

UPDATE likert_responses lr
SET snapshot_institution_avg = inst.avg_score
FROM students s,
     LATERAL (
       SELECT AVG(l2.normalize_skor) AS avg_score
       FROM students s2
       JOIN (
         SELECT DISTINCT ON (student_id) * FROM likert_responses ORDER BY student_id, created_at DESC
       ) l2 ON l2.student_id = s2.id
       WHERE s2.institution_id = s.institution_id AND l2.normalize_skor IS NOT NULL
     ) inst
WHERE lr.student_id = s.id
  AND lr.snapshot_institution_avg IS NULL
  AND lr.normalize_skor IS NOT NULL
  AND s.institution_id IS NOT NULL;
