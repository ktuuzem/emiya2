const crypto = require("crypto");

// GUVENLIK: Math.random() kriptografik olarak guvenli degildir (tahmin
// edilebilir). Aktivasyon kodu bir hesabin aktiflestirilmesini kontrol ettigi
// icin crypto.randomInt (CSPRNG) ile uretilir.
function generateActivationCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

module.exports = { generateActivationCode };
