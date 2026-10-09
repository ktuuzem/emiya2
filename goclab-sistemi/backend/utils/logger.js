// Sistem Yoneticisi panelindeki Log Izleme sayfasi icin kritik hareketleri
// system_logs tablosuna kaydeden ortak yardimci fonksiyon. Kayit sirasinda
// bir hata olursa (ornegin veri tabani gecici olarak erisilemezse) cagiran
// endpoint'in asil islemini (giris, sifre degisimi vb.) ENGELLEMEMESI icin
// hata sessizce loglanir, asla throw edilmez.
async function logAction(
  pool,
  { userId = null, userName = null, userRole = null, actionType, ipAddress = null, status = "Başarılı", loginTime = null, logoutTime = null }
) {
  try {
    await pool.query(
      `INSERT INTO system_logs (user_id, user_name, user_role, action_type, ip_address, status, login_time, logout_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, userName, userRole, actionType, ipAddress, status, loginTime, logoutTime]
    );
  } catch (err) {
    console.error("Log kaydi olusturulamadi:", err.message);
  }
}

module.exports = { logAction };
