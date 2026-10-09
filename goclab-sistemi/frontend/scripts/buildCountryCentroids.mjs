// world-countries-110m.json (TopoJSON, Natural Earth) icindeki her ulkenin
// "duz koordinat sinirlayici kutu orta noktasini" (bkz. buildMoldovaGeo.mjs'deki
// winding-order notu - ayni nedenle d3-geo'nun geoCentroid'i degil, duz/planar
// min-max ortalamasi kullanilir) hesaplayip, "Ulke Adi" -> [lon, lat] seklinde
// backend/ml/country_centroids.json dosyasina yazar. Bu dosya, Goc Yonelim
// Haritasi'ndaki (Turkiye/Moldova -> hedef ulke) cizgilerin BITIS noktalarini
// belirlemek icin kullanilir.
// Calistirma: node scripts/buildCountryCentroids.mjs (frontend/ klasorunden)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { feature } from "topojson-client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const topology = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "public", "world-countries-110m.json"), "utf8"));
const geo = feature(topology, topology.objects.countries);

function walkCoords(coords, fn) {
  if (typeof coords[0] === "number") {
    fn(coords[0], coords[1]);
    return;
  }
  for (const c of coords) walkCoords(c, fn);
}

function boundsOf(ring) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  walkCoords(ring, (lon, lat) => {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });
  return { minLon, maxLon, minLat, maxLat, area: (maxLon - minLon) * (maxLat - minLat) };
}

// MultiPolygon ulkeler (orn. Fransa: anakaraya ek olarak Fransiz Guyanasi,
// Reunion gibi cok uzak denizasiri topraklari da AYNI geometri icinde tasir)
// icin, TUM parcalarin ortak sinirlayici kutusunu almak merkezi anlamsiz bir
// yere (orn. Atlantik ortasi) kaydirir. Bunun yerine SADECE EN BUYUK (bbox
// alani en genis) parcanin - yani ana kara parcasinin - merkezi kullanilir.
function mainLandCenter(geometry) {
  const polygons = geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
  let best = null;
  for (const poly of polygons) {
    const b = boundsOf(poly);
    if (!best || b.area > best.area) best = b;
  }
  return [(best.minLon + best.maxLon) / 2, (best.minLat + best.maxLat) / 2];
}

// Rusya (180. meridyeni asan tek bir ana kara parcasina sahip - "en buyuk
// parca" sececi bunu DUZELTEMEZ, cunku sorun parca SECIMINDE degil, O TEK
// parcanin KENDI ICINDEKI boylam sarmasindadir) icin elle duzeltilmis, haritada
// ulkeyi gercekten temsil eden (Avrupa yakasi agirlikli) bir nokta kullanilir.
const MANUAL_OVERRIDES = {
  Russia: [60, 61.5],
};

const centroids = {};
for (const f of geo.features) {
  const name = f.properties.name;
  if (!name || name === "Antarctica") continue;
  const center = MANUAL_OVERRIDES[name] || mainLandCenter(f.geometry);
  centroids[name] = center.map((v) => Math.round(v * 1000) / 1000);
}

// Turkiye ve Moldova'nin kendi merkezleri de akis cizgilerinin BASLANGIC
// noktalari olarak kullanilacak - ayni dosyadan (world-countries-110m.json)
// zaten "Turkey" ve "Moldova" olarak mevcutlar.
const outPath = path.join(__dirname, "..", "..", "backend", "ml", "country_centroids.json");
fs.writeFileSync(outPath, JSON.stringify(centroids, null, 1));
console.log(`Yazildi: ${outPath} (${Object.keys(centroids).length} ulke)`);
console.log("Turkey:", centroids["Turkey"], "| Moldova:", centroids["Moldova"], "| Germany:", centroids["Germany"]);
