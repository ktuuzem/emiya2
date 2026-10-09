// frontend/src/pages/dashboard/turkeyRegions.js ile ayni bolunumu kullanir
// (il -> 7 cografi bolge eslestirmesi); "Bireysel Katilimci Izleme" panelinin
// "Bolge" filtresi icin backend tarafinda da gerekli.
const PROVINCE_TO_REGION = {
  // Marmara
  Balıkesir: "marmara", Bilecik: "marmara", Bursa: "marmara", Çanakkale: "marmara",
  Edirne: "marmara", İstanbul: "marmara", Kırklareli: "marmara", Kocaeli: "marmara",
  Sakarya: "marmara", Tekirdağ: "marmara", Yalova: "marmara",
  // Ege
  Afyon: "ege", Aydın: "ege", Denizli: "ege", İzmir: "ege", Kütahya: "ege",
  Manisa: "ege", Muğla: "ege", Uşak: "ege",
  // Akdeniz
  Adana: "akdeniz", Antalya: "akdeniz", Burdur: "akdeniz", Hatay: "akdeniz",
  Isparta: "akdeniz", Kahramanmaraş: "akdeniz", Mersin: "akdeniz", Osmaniye: "akdeniz",
  // Ic Anadolu
  Aksaray: "icAnadolu", Ankara: "icAnadolu", Çankırı: "icAnadolu", Eskişehir: "icAnadolu",
  Karaman: "icAnadolu", Kayseri: "icAnadolu", Kırıkkale: "icAnadolu", Kırşehir: "icAnadolu",
  Konya: "icAnadolu", Nevşehir: "icAnadolu", Niğde: "icAnadolu", Sivas: "icAnadolu", Yozgat: "icAnadolu",
  // Karadeniz
  Amasya: "karadeniz", Artvin: "karadeniz", Bartın: "karadeniz", Bayburt: "karadeniz",
  Bolu: "karadeniz", Çorum: "karadeniz", Düzce: "karadeniz", Giresun: "karadeniz",
  Gümüşhane: "karadeniz", Kastamonu: "karadeniz", Karabük: "karadeniz", Ordu: "karadeniz",
  Rize: "karadeniz", Samsun: "karadeniz", Sinop: "karadeniz", Tokat: "karadeniz",
  Trabzon: "karadeniz", Zonguldak: "karadeniz",
  // Dogu Anadolu
  Ağrı: "doguAnadolu", Ardahan: "doguAnadolu", Bingöl: "doguAnadolu", Bitlis: "doguAnadolu",
  Elazığ: "doguAnadolu", Erzincan: "doguAnadolu", Erzurum: "doguAnadolu", Hakkari: "doguAnadolu",
  Iğdır: "doguAnadolu", Kars: "doguAnadolu", Malatya: "doguAnadolu", Muş: "doguAnadolu",
  Tunceli: "doguAnadolu", Van: "doguAnadolu",
  // Guneydogu Anadolu
  Adıyaman: "guneydoguAnadolu", Batman: "guneydoguAnadolu", Diyarbakır: "guneydoguAnadolu",
  Gaziantep: "guneydoguAnadolu", Kilis: "guneydoguAnadolu", Mardin: "guneydoguAnadolu",
  Siirt: "guneydoguAnadolu", Şanlıurfa: "guneydoguAnadolu", Şırnak: "guneydoguAnadolu",
};

const REGION_ORDER = ["marmara", "ege", "akdeniz", "icAnadolu", "karadeniz", "doguAnadolu", "guneydoguAnadolu"];

function provincesForRegion(regionKey) {
  return Object.keys(PROVINCE_TO_REGION).filter((province) => PROVINCE_TO_REGION[province] === regionKey);
}

module.exports = { PROVINCE_TO_REGION, REGION_ORDER, provincesForRegion };
