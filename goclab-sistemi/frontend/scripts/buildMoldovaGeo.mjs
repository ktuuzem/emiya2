// Moldova raion (ilce) sinir verisini (geoBoundaries, CC-BY 4.0, 37 birim)
// okuyup her raion'a hangi istatistiksel bolgeye (Nord/Centru/Sud/Chisinau -
// Moldova Ulusal Istatistik Burosu'nun 2005'ten beri kullandigi 4 bolgeli
// siniflandirma) ait oldugunu etiketler; ayrica her bolge icin (etiket
// konumu amacli) raion merkezlerinin ortalamasini hesaplar.
// Calistirma: node scripts/buildMoldovaGeo.mjs (frontend/ klasorunden)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
// NOT: d3-geo'nun geoCentroid/geoBounds fonksiyonlari polygon "winding"
// yonune (saat yonu/tersi) duyarlidir; geoBoundaries kaynakli bu dosyada
// winding, GeoJSON'un beklenen sag-el-kurali (right-hand rule) yonunun
// tersiydi ve bu fonksiyonlar kurenin TAM KARSI TARAFINI (antipodal nokta /
// tum kure) dondurdu. Winding'den TAMAMEN BAGIMSIZ, duz (planar) koordinat
// gezinmesiyle min/maks hesaplanir - etiket konumlandirma icin dogru ve
// yeterlidir. (Haritanin kendisi - ComposableMap/geoMercator render'i - bu
// sorundan etkilenmez: tek halkali/basit poligonlarin SVG dolgusu winding
// yonune bagli degildir.)
function walkCoords(coords, fn) {
  if (typeof coords[0] === "number") {
    fn(coords[0], coords[1]);
    return;
  }
  for (const c of coords) walkCoords(c, fn);
}

// GeoJSON/d3-geo kurali (sag-el kurali): dis halka (exterior ring) kuzeyden
// bakildiginda SAAT YONUNUN TERSINE (CCW) olmalidir. geoBoundaries kaynakli
// bu dosyadaki halkalar TERS yondeydi (saat yonunde) - bu da hem geoCentroid/
// geoBounds'un (yukarida) hem de react-simple-maps'in ComposableMap render
// borusunun (d3-geo'nun kure/duzlem projeksiyon-kirpma mantigi winding'e
// bagimli) kucuk sekli "kurenin geri kalani" olarak yorumlamasina, yani
// haritanin neredeyse tamamen dolu/yanlis gorunmesine sebep oldu. Her halka,
// duzlemsel "shoelace" isaretli alan formuluyle yonu tespit edilip, dis
// halka icin CCW (isaretli alan > 0), ic halka (delik) icin CW (isaretli
// alan < 0) olacak sekilde gerekirse ters cevrilir.
function signedArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function rewindPolygon(rings) {
  return rings.map((ring, i) => {
    const area = signedArea(ring);
    const isExterior = i === 0;
    // AMPIRIK OLARAK DOGRULANDI (bkz. scripts/debugGeo3.mjs): d3-geo, GeoJSON/RFC7946'nin
    // "dis halka CCW" kuralinin TAM TERSINI bekliyor - dis halka SAAT YONUNDE (CW, negatif
    // isaretli alan) olmali, yoksa geoArea/geoBounds/ComposableMap render'i kureyi (veya
    // duzlemde neredeyse tum haritayi) "ic" olarak yorumluyor.
    const needsReverse = isExterior ? area > 0 : area < 0;
    return needsReverse ? [...ring].reverse() : ring;
  });
}

function rewindGeometry(geometry) {
  if (geometry.type === "Polygon") {
    return { ...geometry, coordinates: rewindPolygon(geometry.coordinates) };
  }
  if (geometry.type === "MultiPolygon") {
    return { ...geometry, coordinates: geometry.coordinates.map((poly) => rewindPolygon(poly)) };
  }
  return geometry;
}

function boundsCenter(feature) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  walkCoords(feature.geometry.coordinates, (lon, lat) => {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });
  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const RAW_PATH = path.join(PUBLIC_DIR, "moldova-raions-raw.geojson");
const raw = JSON.parse(fs.readFileSync(RAW_PATH, "utf8"));

// Moldova Ulusal Istatistik Burosu'nun 2005 siniflandirmasi (statistica.gov.md).
// Transnistria ve Bender (Tighina), bu resmi istatistiksel bolgelerin DISINDA
// tutulur (Moldova istatistiklerine dahil edilmez) - bu yuzden haritada gri/
// veri yok olarak kalacaklardir.
const RAION_TO_REGION = {
  // Nord
  Briceni: "nord", Edinet: "nord", Ocnita: "nord", Donduseni: "nord", Soroca: "nord",
  Drochia: "nord", RIscani: "nord", Glodeni: "nord", Falesti: "nord", SIngerei: "nord",
  Floresti: "nord", Soldanesti: "nord", Balti: "nord",
  // Centru
  Ungheni: "centru", Telenesti: "centru", Rezina: "centru", Orhei: "centru", Calarasi: "centru",
  Nisporeni: "centru", Straseni: "centru", Criuleni: "centru", Dubasari: "centru",
  "Anenii Noi": "centru", Ialoveni: "centru", Hincesti: "centru",
  // Sud (UTA Gagauzia dahil - NBS siniflandirmasi)
  Basarabeasca: "sud", Cahul: "sud", Cantemir: "sud", Causeni: "sud", Cimislia: "sud",
  Leova: "sud", "Stefan Voda": "sud", Taraclia: "sud", Gagauzia: "sud",
  // Chisinau (belediye)
  Chisinau: "chisinau",
};

const REGION_KEYS = ["nord", "centru", "sud", "chisinau"];

const taggedFeatures = raw.features.map((f) => {
  const name = f.properties.shapeName;
  const region = RAION_TO_REGION[name] ?? null;
  return {
    ...f,
    properties: { name, region },
    geometry: rewindGeometry(f.geometry),
  };
});

const raionsOut = { type: "FeatureCollection", features: taggedFeatures };
fs.writeFileSync(path.join(PUBLIC_DIR, "moldova-raions.geojson"), JSON.stringify(raionsOut));
console.log("moldova-raions.geojson yazildi. Toplam raion:", taggedFeatures.length);

const unmapped = taggedFeatures.filter((f) => !f.properties.region).map((f) => f.properties.name);
console.log("Bolgesiz (NBS siniflandirmasi disinda) birimler:", JSON.stringify(unmapped));

// Her bolge icin uye raion'larin centroid'lerinin ORTALAMASI (basit yaklasim,
// gercek "dissolve" degil - sadece etiket konumlandirma amaclidir).
const centroidsByRegion = {};
for (const key of REGION_KEYS) centroidsByRegion[key] = [];
for (const f of taggedFeatures) {
  if (!f.properties.region) continue;
  const c = boundsCenter(f);
  if (c && !Number.isNaN(c[0])) centroidsByRegion[f.properties.region].push(c);
}

const regionLabelPoints = {};
for (const key of REGION_KEYS) {
  const pts = centroidsByRegion[key];
  if (pts.length === 0) continue;
  const lon = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  regionLabelPoints[key] = [lon, lat];
}

fs.writeFileSync(
  path.join(PUBLIC_DIR, "moldova-region-labels.json"),
  JSON.stringify(regionLabelPoints, null, 1)
);
console.log("moldova-region-labels.json yazildi:", JSON.stringify(regionLabelPoints));
