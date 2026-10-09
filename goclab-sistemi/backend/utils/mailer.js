const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  // Yerel makinedeki antivirus/guvenlik yazilimlari HTTPS trafigini kendi
  // sertifikasiyla araya girerek tarayabiliyor ve Node.js buna güvenmiyor
  // ("self-signed certificate in certificate chain" hatasi). Bu satir sadece
  // gelistirme ortaminda bu engeli asar; canli (production) sunucuda kaldirilmali.
  tls: {
    rejectUnauthorized: false,
  },
});

async function sendActivationEmail(to, activationCode) {
  await transporter.sendMail({
    from: `"GÖÇLAB" <${process.env.GMAIL_USER}>`,
    to,
    subject: "GÖÇLAB Hesap Aktivasyon Kodu",
    text: `Aktivasyon kodunuz: ${activationCode}\n\nBu kodu 5 dakika icinde girmelisiniz.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #001A3F;">GÖÇLAB Hesap Aktivasyonu</h2>
        <p>Kaydınızı tamamlamak için aşağıdaki aktivasyon kodunu kullanın:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1D4ED8;">
          ${activationCode}
        </p>
        <p style="color: #6b7280;">Bu kodu 5 dakika içinde girmelisiniz.</p>
      </div>
    `,
  });
  console.log(`Aktivasyon e-postasi gonderildi: ${to}`);
}

async function sendPasswordResetEmail(to, resetLink) {
  await transporter.sendMail({
    from: `"GÖÇLAB" <${process.env.GMAIL_USER}>`,
    to,
    subject: "GÖÇLAB Şifre Sıfırlama",
    text: `Şifrenizi sıfırlamak için şu bağlantıya tıklayın: ${resetLink}\n\nBu bağlantı 1 saat içinde gecerliligini yitirecektir.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #001A3F;">Şifre Sıfırlama Talebi</h2>
        <p>Hesabınız için bir şifre sıfırlama talebi aldık. Yeni şifrenizi belirlemek için aşağıdaki bağlantıya tıklayın:</p>
        <p>
          <a href="${resetLink}" style="display: inline-block; padding: 12px 20px; background-color: #1D4ED8; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Şifremi Sıfırla
          </a>
        </p>
        <p style="color: #6b7280; font-size: 13px;">Bu bağlantı 1 saat içinde geçerliliğini yitirecektir. Bu talebi siz oluşturmadıysanız bu e-postayı yok sayabilirsiniz.</p>
      </div>
    `,
  });
  console.log(`Sifre sifirlama e-postasi gonderildi: ${to}`);
}

async function sendInstitutionApprovalEmail(to, institutionName, setupLink) {
  await transporter.sendMail({
    from: `"GÖÇLAB" <${process.env.GMAIL_USER}>`,
    to,
    subject: "GÖÇLAB Kurum Başvurunuz Onaylandı",
    text: `Merhaba, "${institutionName}" için yaptığınız kurum başvurusu onaylandı. Hesabınızı aktifleştirmek ve şifrenizi belirlemek için şu bağlantıya tıklayın: ${setupLink}\n\nBu bağlantı 24 saat içinde gecerliligini yitirecektir.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #001A3F;">Kurum Başvurunuz Onaylandı</h2>
        <p><strong>${institutionName}</strong> için yaptığınız kurum başvurusu onaylandı.</p>
        <p>Hesabınızı aktifleştirmek ve şifrenizi belirlemek için aşağıdaki bağlantıya tıklayın:</p>
        <p>
          <a href="${setupLink}" style="display: inline-block; padding: 12px 20px; background-color: #1D4ED8; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Şifremi Belirle
          </a>
        </p>
        <p style="color: #6b7280; font-size: 13px;">Bu bağlantı 24 saat içinde geçerliliğini yitirecektir.</p>
      </div>
    `,
  });
  console.log(`Kurum onay e-postasi gonderildi: ${to}`);
}

async function sendInstitutionPasswordResetEmail(to, institutionName, resetLink) {
  await transporter.sendMail({
    from: `"GÖÇLAB" <${process.env.GMAIL_USER}>`,
    to,
    subject: "GÖÇLAB Kurum Şifre Sıfırlama",
    text: `Merhaba, "${institutionName}" kurum hesabınız için bir şifre sıfırlama talebi aldık. Yeni şifrenizi belirlemek için şu bağlantıya tıklayın: ${resetLink}\n\nBu bağlantı 24 saat içinde gecerliligini yitirecektir. Bu talebi siz oluşturmadıysanız bu e-postayı yok sayabilirsiniz.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #001A3F;">Kurum Şifre Sıfırlama Talebi</h2>
        <p><strong>${institutionName}</strong> kurum hesabınız için bir şifre sıfırlama talebi aldık.</p>
        <p>Yeni şifrenizi belirlemek için aşağıdaki bağlantıya tıklayın:</p>
        <p>
          <a href="${resetLink}" style="display: inline-block; padding: 12px 20px; background-color: #1D4ED8; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Şifremi Sıfırla
          </a>
        </p>
        <p style="color: #6b7280; font-size: 13px;">Bu bağlantı 24 saat içinde geçerliliğini yitirecektir. Bu talebi siz oluşturmadıysanız bu e-postayı yok sayabilirsiniz.</p>
      </div>
    `,
  });
  console.log(`Kurum sifre sifirlama e-postasi gonderildi: ${to}`);
}

module.exports = {
  sendActivationEmail,
  sendPasswordResetEmail,
  sendInstitutionApprovalEmail,
  sendInstitutionPasswordResetEmail,
};
