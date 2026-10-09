const fs = require("fs");
const path = require("path");

// K-Means kume merkezleri (centroid), 7 faktor skoruna (0-100, normalize) gore.
// Degerler sabit DEGIL: backend/scripts/run_kmeans_pca.py (Turkiye) /
// run_kmeans_pca_moldova.py (Moldova) her calistiginda gercek K-Means
// sonucundan ilgili JSON dosyasina yazilir ve buradan okunur (dosya degisince
// otomatik yeniden yuklenir). Boylece canli anketten atanan kume, Yonetici
// panelindeki K-Means kumeleriyle birebir aynidir.
const CENTROIDS_PATH_BY_COUNTRY = {
  tr: path.join(__dirname, "..", "ml", "cluster_centroids.json"),
  md: path.join(__dirname, "..", "ml", "cluster_centroids_moldova.json"),
};
const CLUSTER_KEYS = ["K1", "K2", "K3", "K4", "K5"];

// "Ortak Goc Profilleri" icin TEK, TR+MD BIRLESIK (pooled) merkez seti -
// yukaridaki per-ulke (tr/md ayri ayri) kumelerden FARKLI: burada ayni P1-P5
// etiketi HER IKI ulkede de ayni anlami tasir (bkz. backend/scripts/
// run_pooled_profiles.py). Ulke, modelin GIRDISI degildir - sadece sonradan
// dagilim karsilastirmasi icin kullanilir.
const POOLED_CENTROIDS_PATH = path.join(__dirname, "..", "ml", "cluster_centroids_pooled.json");
const POOLED_PROFILE_KEYS = ["P1", "P2", "P3", "P4", "P5"];

const centroidsCacheByCountry = {};
let pooledCache = null;

// Merkezler SABITTIR (run_pooled_profiles.py disinda, ornegin bir filtre
// degisiminde YENIDEN KURULMAZ) - bu fonksiyon sadece dosyadan okur/cache'ler.
function getPooledProfileData() {
  try {
    const { mtimeMs } = fs.statSync(POOLED_CENTROIDS_PATH);
    if (!pooledCache || pooledCache.mtimeMs !== mtimeMs) {
      const parsed = JSON.parse(fs.readFileSync(POOLED_CENTROIDS_PATH, "utf8"));
      pooledCache = { mtimeMs, centroids: parsed.centroids, titles: parsed.titles };
    }
    return pooledCache;
  } catch (err) {
    console.error("Ortak profil merkezleri okunamadi:", err.message);
    return null;
  }
}

function getPooledProfileCentroids() {
  return getPooledProfileData()?.centroids ?? null;
}

function getPooledProfileTitles() {
  return getPooledProfileData()?.titles ?? null;
}

// 7 faktor skoruna en yakin (Oklid mesafesi en kisa) ORTAK profili (P1-P5)
// dondurur - assignCluster ile AYNI mantik, ama pooled (TR+MD birlesik)
// merkezlere gore.
function assignPooledProfile(scores) {
  const centroids = getPooledProfileCentroids();
  if (!centroids) return null;
  const keys = Object.keys(centroids.P1);
  let bestKey = null;
  let bestDistance = Infinity;
  for (const [profileKey, centroid] of Object.entries(centroids)) {
    const distance = euclideanDistance(scores, centroid, keys);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestKey = profileKey;
    }
  }
  return bestKey;
}

function getClusterCentroids(country = "tr") {
  const centroidsPath = CENTROIDS_PATH_BY_COUNTRY[country];
  if (!centroidsPath) return null;
  try {
    const { mtimeMs } = fs.statSync(centroidsPath);
    const cached = centroidsCacheByCountry[country];
    if (!cached || cached.mtimeMs !== mtimeMs) {
      const parsed = JSON.parse(fs.readFileSync(centroidsPath, "utf8"));
      centroidsCacheByCountry[country] = { mtimeMs, centroids: parsed.centroids };
    }
    return centroidsCacheByCountry[country].centroids;
  } catch (err) {
    console.error(`Kume merkezleri okunamadi (${country}):`, err.message);
    return null;
  }
}

// Baslikllar, Yonetici panelindeki K-Means sayfasinin (KMeansPage.jsx / i18n.jsx
// kMeansPage.clusters) kume adlarindan birebir alinmistir.
// GUNCELLEME: K3/K4/K5 basliklari, Ek A yeniden eslemesinden sonra gercek
// K-Means merkezleriyle (ml/cluster_centroids.json) karsilastirilarak yeniden
// yazildi - eski metinler (Egitim Odakli / Politik Guven Sorunu / Kaygi
// Yuksek) o kumelerin gercek verisiyle artik uyusmuyordu (orn. K5'in
// psikolojik/kaygi skoru kumeler arasinda EN DUSUK ikinci deger, "kaygi
// yuksek" iddiasiyla dogrudan celisiyordu). K1/K2 gercek veriyle byuk olcude
// tutarli bulundugu icin degistirilmedi.
const CLUSTER_TITLES = {
  K1: "Ekonomik / İstihdam Baskısı Yüksek Gençler",
  K2: "Sosyal Ağ Etkisi Yüksek Gençler",
  K3: "Kültürel Uyum ve Göç Kaygısı Taşıyan Gençler",
  K4: "Sosyal Bağı Zayıf, Çevresel Kaygısı Yüksek Gençler",
  K5: "Göç Niyeti Düşük Gençler",
};

const CLUSTER_DESCRIPTIONS = {
  K1: "Bu kümedeki bireyler, göç etme konusunda güçlü bir motivasyona sahiptir. Ekonomik beklentileri yüksektir, sosyal ağları güçlüdür ve kurumsal faktörlere ilişkin algıları daha olumludur. Göç kaygıları düşüktür ve hedeflerine ulaşmak için kararlı adımlar atmaya yatkındırlar.",
  K2: "Bu kümedeki bireylerin göç niyetini en çok etkileyen faktör sosyal çevredir; aile ve akraba bağlantıları, arkadaş çevresi ve yurt dışındaki tanıdıkların deneyimleri göç kararlarında belirleyici rol oynar. Ekonomik kaygılar görece geri plandadır.",
  K3: "Bu kümedeki bireyler için eğitim beklentisi diğer kümelerden belirgin şekilde farklı değildir; onları asıl ayıran özellik, kültürel/dini uyum kaygıları ile yeni bir ülkede yeniden başlamaya dair psikolojik kaygıların görece yüksek olmasıdır. Göç niyetleri örneklem ortalamasına yakın, orta düzeydedir.",
  K4: "Bu kümedeki bireylerin göç kararında aile ve sosyal çevrenin etkisi oldukça sınırlıdır; buna karşılık ülkedeki çevresel koşullara (iklim değişikliği, çevresel sorunlar) ilişkin kaygıları belirgin şekilde yüksektir. Politik/kurumsal güven düzeyleri diğer kümelerle kıyaslandığında ayırt edici bir unsur değildir.",
  K5: "Bu kümedeki bireyler, incelenen hemen hemen tüm faktörlerde (ekonomik, eğitim, sosyal, sosyo-politik, çevresel) örneklemin en düşük skorlarına sahiptir; göç kaygıları da yüksek değil, aksine diğer kümelere göre düşüktür. Göç niyeti örneklemdeki en düşük düzeydedir ve göç konusuna genel olarak mesafeli bir tutum sergilerler.",
};

// "Anket Gecmisim" listesindeki kume ozeti maddeleri (3'er madde).
const CLUSTER_SUMMARY_BULLETS = {
  K1: ["Ekonomik baskı ve istihdam kaygısı yüksek", "Gelir ve yaşam standartları arayışı güçlü", "Kısa vadede göç niyeti yüksek"],
  K2: ["Arkadaş ve çevre etkisi belirleyici", "Sosyal medya ve deneyim paylaşımı etkili", "Göç kararı sosyal çevreden besleniyor"],
  K3: ["Kültürel/dini uyum kaygısı öne çıkıyor", "Yeni ülkede yeniden başlama kaygısı mevcut", "Göç niyeti orta düzeyde"],
  K4: ["Aile ve sosyal çevre etkisi çok zayıf", "Çevresel koşul kaygısı belirgin şekilde yüksek", "Göç niyeti düşük-orta düzeyde"],
  K5: ["Tüm faktörlerde görece düşük skorlar", "Göç kaygısı da diğer kümelere göre düşük", "Göç niyeti örneklemde en düşük"],
};

// Kurum panelindeki Kume Profilleri (Overview.jsx CLUSTER_MOCK) ile ayni renk kimligi.
const CLUSTER_COLORS = {
  K1: "#16A34A",
  K2: "#2563EB",
  K3: "#7C3AED",
  K4: "#DC2626",
  K5: "#EA580C",
};

// Moldova (anket_son_sayisal, ulke='md') icin ayri kume merkezleriyle (483
// katilimci, bkz. run_kmeans_pca_moldova.py) hesaplanmis, veriye dayali
// basliklar/aciklamalar. Turkiye'nin K1-K5 etiketleriyle AYNI isimlendirme
// kurali kullanilir (K1=ekonomik en yuksek, K2=sosyal en yuksek, K3=egitim
// en yuksek, K4=sosyo-politik en yuksek, K5=kalan) ama iki ulkenin kumeleri
// FARKLI gruplardir - ayni Kx etiketi iki ulkede ayni profili TEMSIL ETMEZ.
const CLUSTER_TITLES_MD = {
  K1: "Göç Eğilimi Yüksek Gençler",
  K2: "Sosyal Ağ ve Eğitim Etkisi Yüksek Gençler",
  K3: "Çevresel Kaygısı Düşük, Eğitim Odaklı Gençler",
  K4: "Çevresel Kaygısı Yüksek Gençler",
  K5: "Göç Niyeti Düşük Gençler",
};

const CLUSTER_DESCRIPTIONS_MD = {
  K1: "Bu kümedeki bireyler, incelenen hemen hemen tüm faktörlerde (ekonomik, kültürel, sosyo-politik, çevresel, psikolojik) örneklemin en yüksek skorlarına sahiptir ve göç niyetleri de örneklemdeki en yüksek düzeydedir.",
  K2: "Bu kümedeki bireyleri en çok ayıran özellik, güçlü sosyal ağ bağlantıları (aile/akraba/arkadaş çevresi) ve yüksek eğitim beklentisidir; göç niyetleri örneklem ortalamasının belirgin şekilde üzerindedir.",
  K3: "Bu kümedeki bireyler için eğitim beklentisi görece yüksek olsa da, onları asıl ayıran özellik çevresel koşullara (iklim değişikliği, çevresel sorunlar) ilişkin kaygılarının örneklemdeki en düşük düzeyde olmasıdır. Göç niyetleri orta düzeydedir.",
  K4: "Bu kümedeki bireyleri diğerlerinden ayıran temel özellik, ülkedeki çevresel koşullara ilişkin belirgin şekilde yüksek kaygı duymalarıdır; diğer faktörlerde örneklem ortalamasına yakın veya altında değerler gösterirler.",
  K5: "Bu kümedeki bireyler, incelenen tüm faktörlerde (özellikle sosyal ağ, sosyo-politik ve ekonomik boyutlarda) örneklemin en düşük skorlarına sahiptir. Göç niyeti örneklemdeki en düşük düzeydedir.",
};

const CLUSTER_SUMMARY_BULLETS_MD = {
  K1: ["Tüm faktörlerde yüksek skorlar", "Göç niyeti örneklemde en yüksek", "Kültürel ve sosyo-politik uyum güçlü"],
  K2: ["Sosyal ağ etkisi belirgin şekilde güçlü", "Eğitim beklentisi yüksek", "Göç niyeti ortalamanın üzerinde"],
  K3: ["Çevresel kaygı örneklemde en düşük", "Eğitim beklentisi görece yüksek", "Göç niyeti orta düzeyde"],
  K4: ["Çevresel kaygı belirgin şekilde yüksek", "Diğer faktörler ortalama düzeyde", "Göç niyeti düşük-orta düzeyde"],
  K5: ["Sosyal ağ ve sosyo-politik skorlar en düşük", "Tüm faktörlerde görece düşük profil", "Göç niyeti örneklemde en düşük"],
};

function euclideanDistance(scores, centroid, keys) {
  return Math.sqrt(
    keys.reduce((sum, key) => {
      const value = scores[key];
      if (value === null || value === undefined) return sum;
      return sum + (value - centroid[key]) ** 2;
    }, 0)
  );
}

// 7 faktor skoruna (scores = { ekonomik_istihdam, aile_sosyal, sosyo_politik,
// egitim, cevresel, psikolojik, kulturel }) en yakin (Oklid mesafesi en kisa)
// kumeyi (K1-K5) dondurur. country parametresi verilmezse varsayilan "tr"
// (canli ogrenci anketi/simulator hep Turkiye merkezlerini kullanir).
function assignCluster(scores, country = "tr") {
  const centroids = getClusterCentroids(country);
  if (!centroids) return null;
  const keys = Object.keys(centroids.K1);
  let bestKey = null;
  let bestDistance = Infinity;
  for (const [clusterKey, centroid] of Object.entries(centroids)) {
    const distance = euclideanDistance(scores, centroid, keys);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestKey = clusterKey;
    }
  }
  return bestKey;
}

// 7 faktor skoruna gore 5 kumenin TAMAMI icin bir eslesme yuzdesi (toplam
// %100) dondurur - Gelismis Tahmin Simulatoru'ndeki 5'li dagilim karti icin
// kullanilir. Her kumeye olan Oklid mesafesi, ters mesafe agirligiyla
// (1 / (1 + mesafe)) benzerlige cevrilip normalize edilir; en yakin (en kucuk
// mesafeli) kume en yuksek yuzdeyi alir. Yuzdeler, tam sayiya yuvarlanirken
// toplamin kesin 100 olmasi icin "buyuk kalan yontemi" (largest remainder)
// ile dagitilir.
function getClusterDistribution(scores, country = "tr") {
  const centroids = getClusterCentroids(country);
  if (!centroids) return null;
  const titles = country === "md" ? CLUSTER_TITLES_MD : CLUSTER_TITLES;
  const keys = Object.keys(centroids.K1);
  const similarities = Object.entries(centroids).map(([clusterKey, centroid]) => {
    const distance = euclideanDistance(scores, centroid, keys);
    return { key: clusterKey, similarity: 1 / (1 + distance) };
  });
  const totalSimilarity = similarities.reduce((sum, s) => sum + s.similarity, 0);

  const raw = similarities.map((s) => ({
    key: s.key,
    value: totalSimilarity > 0 ? (s.similarity / totalSimilarity) * 100 : 100 / similarities.length,
  }));
  const floored = raw.map((r) => ({ key: r.key, floor: Math.floor(r.value), remainder: r.value - Math.floor(r.value) }));
  let remaining = 100 - floored.reduce((sum, f) => sum + f.floor, 0);
  const byRemainder = [...floored].sort((a, b) => b.remainder - a.remainder);
  const percentageByKey = {};
  floored.forEach((f) => {
    percentageByKey[f.key] = f.floor;
  });
  for (let i = 0; i < remaining && i < byRemainder.length; i++) {
    percentageByKey[byRemainder[i].key] += 1;
  }

  return CLUSTER_KEYS
    .map((key) => ({
      key,
      title: titles[key],
      color: CLUSTER_COLORS[key],
      percentage: percentageByKey[key],
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

module.exports = {
  CLUSTER_KEYS,
  getClusterCentroids,
  CLUSTER_TITLES,
  CLUSTER_DESCRIPTIONS,
  CLUSTER_SUMMARY_BULLETS,
  CLUSTER_TITLES_MD,
  CLUSTER_DESCRIPTIONS_MD,
  CLUSTER_SUMMARY_BULLETS_MD,
  CLUSTER_COLORS,
  assignCluster,
  getClusterDistribution,
  POOLED_PROFILE_KEYS,
  getPooledProfileCentroids,
  getPooledProfileTitles,
  assignPooledProfile,
};
