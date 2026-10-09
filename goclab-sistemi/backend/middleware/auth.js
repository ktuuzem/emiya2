const jwt = require("jsonwebtoken");
const { isRevoked } = require("../utils/tokenBlacklist");

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: "Yetkilendirme token'i bulunamadi." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // GUVENLIK: Cikis yapilmis (revoke edilmis) token'lar suresi dolmadan da
    // reddedilir (bkz. utils/tokenBlacklist.js ve POST /api/logout).
    if (isRevoked(decoded.jti)) {
      return res.status(401).json({ success: false, message: "Oturum sonlandirilmis. Lutfen tekrar giris yapin." });
    }

    req.studentId = decoded.studentId;
    req.role = decoded.role;
    // Kurum yetkilisi (role='admin') icin kendi kurumunun id'si; super_admin
    // icin bu deger hep undefined kalir (asagidaki endpoint'ler bunu "filtre
    // uygulama, tum kurumlari goster" olarak yorumlar).
    req.institutionId = decoded.institutionId;
    req.tokenId = decoded.jti;
    req.tokenExpiresAtMs = decoded.exp ? decoded.exp * 1000 : null;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Gecersiz veya suresi dolmus token." });
  }
}

module.exports = { authenticate };
