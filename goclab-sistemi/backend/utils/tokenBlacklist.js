// GUVENLIK: JWT'ler dogasi geregi "stateless" oldugundan, /api/logout onceden
// token'i gercekten gecersiz kilmiyordu - sadece bir denetim kaydi olusturup
// istemcide localStorage temizliyordu. Cikis yapilmis (veya calinmis/sizmis)
// bir token, suresi (7 gun) dolana kadar hala kullanilabiliyordu. Bu modul,
// cikis yapilan token'larin benzersiz kimligini (jti) suresi dolana kadar
// bellekte tutarak authenticate ara katmaninin bu token'lari reddetmesini saglar.
// Not: Bellek ici (in-memory) oldugundan sunucu yeniden baslatildiginda sifirlanir;
// bu, JWT_SECRET/veritabani gerektirmeyen hafif bir savunma katmanidir.
const revoked = new Map(); // jti -> expiresAtMs

function revokeToken(jti, expiresAtMs) {
  if (!jti) return;
  revoked.set(jti, expiresAtMs);
}

function isRevoked(jti) {
  if (!jti) return false;
  const expiresAtMs = revoked.get(jti);
  if (expiresAtMs === undefined) return false;
  if (expiresAtMs <= Date.now()) {
    revoked.delete(jti);
    return false;
  }
  return true;
}

// Suresi gecmis kayitlari periyodik olarak temizler (bellek sizintisini onler).
setInterval(() => {
  const now = Date.now();
  for (const [jti, expiresAtMs] of revoked) {
    if (expiresAtMs <= now) revoked.delete(jti);
  }
}, 60 * 60 * 1000).unref();

module.exports = { revokeToken, isRevoked };
