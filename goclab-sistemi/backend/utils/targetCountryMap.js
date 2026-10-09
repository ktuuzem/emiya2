// "Hedef ulke" (TR: raw_survey_data.hedef_ulke) ve "gitmek_istedigi_ulke" (MD:
// anket_son_sayisal.gitmek_istedigi_ulke) alanlari SERBEST METINDIR - TR'de
// 135, MD'de 39 farkli deger var (buyuk/kucuk harf varyasyonlari, yazim
// hatalari, birden fazla ulke sayan cumleler, "istemiyorum/kararsizim" gibi
// ulke OLMAYAN yanitlar, MD icin Romence ulke adlari). Bu dosya, bu serbest
// metni world-countries-110m.json'daki (Natural Earth, 110m) KANONIK Ingilizce
// ulke adlarina eslestirir. Esleme YONTEMI: metin kucuk harfe cevrilip, bilinen
// her varyant (TR/RO/EN/yazim hatasi) bir ALT DIZI olarak arandigi icin, "veya",
// "," "/" gibi ayracli VEYA aciklamali cumle icinde gecen BIRDEN FAZLA ulke de
// yakalanir (orn. "Almanya,Hollanda,Norveç" -> [Germany, Netherlands, Norway]).
//
// Kapsam disi (NULL donen) yanitlar: "istemiyorum/kararsizim/nu vreau/nu stiu"
// gibi ret/belirsiz ifadeler VE tek basina yorumlanamayan serbest metinler -
// bunlar haritaya YANSITILMAZ, ayri bir "belirsiz/gitmek istemiyor" sayaci
// olarak raporlanir (bkz. aggregateTargetCountries).

// variant -> kanonik ulke adi (world-countries-110m.json'daki tam isimle BIREBIR)
const VARIANT_TO_COUNTRY = {
  // Almanya / Germania / Germany
  "almanya": "Germany", "almanya,almanya": "Germany", "germania": "Germany",
  "germany": "Germany", "amanya": "Germany", "deutschland": "Germany",
  // Italya / Italia / Italy
  "italya": "Italy", "italia": "Italy", "italy": "Italy", "venedik": "Italy",
  // Isvicre / Elvetia / Switzerland
  "isviçre": "Switzerland", "isvicre": "Switzerland", "i̇svi̇çre": "Switzerland",
  "elveția": "Switzerland", "elvetia": "Switzerland", "switzerland": "Switzerland",
  // ABD / Amerika / USA / SUA
  "abd": "United States of America", "amerika": "United States of America",
  "amerika birleşik devletleri": "United States of America",
  "amerika birleşik devleti": "United States of America",
  "sua": "United States of America", "usa": "United States of America",
  "the united states of america": "United States of America",
  "united states": "United States of America", "miami": "United States of America",
  // Japonya / Japonia / Japan
  "japonya": "Japan", "japonia": "Japan", "japan": "Japan",
  // Ingiltere / Marea Britanie / UK
  "i̇ngiltere": "United Kingdom", "ingiltere": "United Kingdom",
  "i̇skoçya": "United Kingdom", "iskoçya": "United Kingdom",
  "marea britanie": "United Kingdom", "united kingdom": "United Kingdom",
  "londra": "United Kingdom",
  // Fransa / Franta / France
  "fransa": "France", "franța": "France", "franta": "France", "france": "France",
  // Kanada / Canada
  "kanada": "Canada", "canada": "Canada",
  // Norvec / Norvegia / Norway
  "norveç": "Norway", "norveç.": "Norway", "norvec": "Norway",
  "norvegia": "Norway", "norway": "Norway",
  // Ispanya / Spania / Spain
  "i̇spanya": "Spain", "ispanya": "Spain", "i̇spanya olabilir": "Spain",
  "spania": "Spain", "spain": "Spain", "barcelona": "Spain",
  // Hollanda / Olanda / Netherlands
  "hollanda": "Netherlands", "olanda": "Netherlands", "netherlands": "Netherlands",
  "amsterdam": "Netherlands",
  // Finlandiya / Finlanda / Finland
  "finlandiya": "Finland", "fınlandıya": "Finland", "finlandiye": "Finland",
  "finlanda": "Finland", "finland": "Finland",
  // Isvec / Suedia / Sweden
  "i̇sveç": "Sweden", "isveç": "Sweden", "isvec": "Sweden", "suedia": "Sweden",
  "sweden": "Sweden",
  // Guney Kore / Coreea de Sud / South Korea
  "güney kore": "South Korea", "kore": "South Korea",
  "coreea de sud": "South Korea", "south korea": "South Korea",
  // Rusya / Rusia / Russia
  "rusya": "Russia", "rusia": "Russia", "russia": "Russia",
  // Belcika / Belgia / Belgium
  "belçika": "Belgium", "belgia": "Belgium", "belgium": "Belgium",
  // Avustralya / Australia
  "avustralya": "Australia", "avusturalya": "Australia", "australia": "Australia",
  // Azerbaycan / Azerbaijan
  "azerbaycan": "Azerbaijan", "azerbeycan": "Azerbaijan", "azerbaijan": "Azerbaijan",
  // Brezilya / Brazil
  "brezilya": "Brazil", "brazil": "Brazil",
  // Polonya / Poland
  "polonya": "Poland", "poland": "Poland",
  // Cek Cumhuriyeti / Cehia / Czechia
  "çek cumhuriyeti": "Czechia", "çekya": "Czechia", "cehia": "Czechia", "czechia": "Czechia",
  // Avusturya / Austria
  "avusturya": "Austria", "viyana": "Austria", "austria": "Austria",
  // Danimarka / Danemarca / Denmark
  "danimarka": "Denmark", "danemarca": "Denmark", "denmark": "Denmark",
  "danimarka kopenhag": "Denmark",
  // Irlanda / Ireland
  "i̇rlanda": "Ireland", "irlanda": "Ireland", "ireland": "Ireland",
  // Bulgaristan / Bulgaria
  "bulgaristan": "Bulgaria", "bulgaria": "Bulgaria",
  // Arabistan / Suudi Arabistan / Saudi Arabia
  "arabistan": "Saudi Arabia", "suudi arabistan": "Saudi Arabia", "saudi arabia": "Saudi Arabia",
  // BAE / United Arab Emirates
  "arap birleşik emirlikleri": "United Arab Emirates",
  "birleşik arap emirlikleri": "United Arab Emirates",
  "united arab emirates": "United Arab Emirates",
  // Cin / China
  "çin": "China", "cin": "China", "china": "China",
  // Portekiz / Portugalia / Portugal
  "portekiz": "Portugal", "portugalia": "Portugal", "portugal": "Portugal",
  // Arjantin / Argentina
  "arjantin": "Argentina", "argentina": "Argentina",
  // Urdun / Jordan
  "ürdün": "Jordan", "jordan": "Jordan",
  // Malezya / Malaysia
  "malezya": "Malaysia", "malaysia": "Malaysia",
  // Yeni Zelanda / New Zealand
  "yeni zelanda": "New Zealand", "new zealand": "New Zealand",
  // Estonya / Estonia
  "estonya": "Estonia", "estonia": "Estonia",
  // Dominik Cumhuriyeti / Dominican Rep.
  "dominik cumhuriyeti": "Dominican Rep.",
  // Misir / Egypt
  "mısır": "Egypt", "egypt": "Egypt",
  // Sri Lanka
  "sri lanka": "Sri Lanka",
  // Meksika / Mexico
  "meksika": "Mexico", "mexico": "Mexico",
  // Ozbekistan / Uzbekistan
  "özbekistan": "Uzbekistan", "uzbekistan": "Uzbekistan",
  // Mogolistan / Mongolia
  "moğolistan": "Mongolia", "mongolia": "Mongolia",
  // Kazakistan / Kazakhstan
  "kazakistan": "Kazakhstan", "kazakhstan": "Kazakhstan",
  // Letonya / Letonia / Latvia
  "letonya": "Latvia", "letonia": "Latvia", "latvia": "Latvia",
  // Litvanya / Lithuania
  "litvanya": "Lithuania", "lithuania": "Lithuania",
  // Kosova / Kosovo
  "kosova": "Kosovo", "kosovo": "Kosovo",
  // Guney Afrika / South Africa
  "güney afrika": "South Africa", "south africa": "South Africa",
  // Yunanistan / Grecia / Greece
  "yunanistan": "Greece", "grecia": "Greece", "greece": "Greece",
  // Kuzey Kibris
  "kuzey kıbrıs türk cumhuriyeti": "N. Cyprus",
  // Romanya / Romania (TR cevaplarinda nadir, MD'de "Romania" kendi ulkesi - ayri ele alinir)
  "romanya": "Romania", "românia": "Romania", "romania": "Romania",
  // Turkiye (MD cevaplarinda "Turcia" - Moldovali bir katilimci icin bu "hedef"
  // olarak anlamli, TR verisinde kendisi zaten olmaz)
  "turcia": "Turkey", "türkiye": "Turkey", "turkey": "Turkey",
  // Afrika (kita, belirsiz - haritaya yansitilmaz, bkz. asagidaki null listesi)
  // Gurcistan / Georgia
  "georgia": "Georgia",
  // Ermenistan / Armenia
  "armenia": "Armenia",
  // Endonezya / Indonesia (Bali, Endonezya'nin bir adasidir)
  "indonezia": "Indonesia", "indonesia": "Indonesia", "bali": "Indonesia",
  // Israil / Israel
  "israel": "Israel",
  // Izlanda / Iceland
  "izlanda": "Iceland", "iceland": "Iceland",
  // Diger, nadir (110m haritada yok ama metinde geciyor - en yakin/kapsayici
  // bolgeye values atanmiyor, bu yuzden null birakilip ayri sayilir): malta,
  // singapore, luxembourg - 110m cozunurlukte cok kucuk olduklari icin
  // world-countries-110m.json'da zaten YOK, haritada gösterilemezler.
};

// Haritaya yansitilmayacak (ulke degil, ret/belirsiz/bolge/sehir-TR ya da
// yorumlanamayan serbest metin) yanitlar - normalize edilmis (kucuk harf,
// trim) tam metin eslesmesiyle kontrol edilir.
const NON_COUNTRY_RESPONSES = new Set([
  "istemiyorum", "i̇stemiyorum", "istemezdim", "istemem", "i̇stemem",
  "kararsızım", "hiçbiri", "-", ".", "fikrim yok",
  "ülkemde yaşamak istiyorum.", "i̇stanbul", "istanbul", "trabzon",
  "istemem sadece tatil için dunya ulkelerini gezerdim",
  "nu vreau", "nu știu", "nu stiu", "nici una", "doar să vizitez",
  "vreau să rămân în țara mea", "ue",
  "afrika", "herhangi bir avrupa ülkesi",
]);

// NOT: standart toLocaleLowerCase("tr") KASITLI OLARAK kullanilmiyor - Turkce
// kurali duz "I" harfini "ı" yapar (orn. "Italya" -> "ıtalya"), bu da
// Romence/Ingilizce kokenli (yabanci metinde duz I ile yazilan) "Italia",
// "Irlanda", "Israel", "Isveç" gibi kelimelerin eslesmesini kirar. Bunun
// yerine hem Turkce noktali İ hem duz I, standart (yabanci) kuralla "i"ye
// cevrilir; geri kalan harfler (ç, ğ, ö, ş, ü, ı) zaten varsayilan
// toLowerCase() ile dogru kucultulur.
function normalizeTr(text) {
  return String(text ?? "")
    .trim()
    .replace(/İ/g, "i")
    .replace(/I/g, "i")
    .toLowerCase();
}

// Metin icinde gecen TUM bilinen ulke adlarini (kelime siniri ile) bulur -
// "Almanya,Hollanda,Norveç" veya "Akdeniz ülkeleri yunanistan italya ispanya
// portekiz güney fransa" gibi coklu/aciklamali cumlelerde her ulkeyi yakalar.
function extractCountriesFromText(normalizedText) {
  const found = new Set();
  for (const [variant, country] of Object.entries(VARIANT_TO_COUNTRY)) {
    if (variant.length < 3) continue; // "ue" gibi asiri kisa/yanlis eslesebilecek varyantlari atla
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[^a-zçğıöşü])${escaped}([^a-zçğıöşü]|$)`, "i");
    if (pattern.test(normalizedText)) found.add(country);
  }
  return [...found];
}

// Bir ham "hedef ulke" metnini kanonik ulke adi listesine cevirir.
// Donus: { countries: string[], isNonCountry: boolean }
// - countries bos VE isNonCountry true ise: ret/belirsiz yanit (bkz. NON_COUNTRY_RESPONSES)
// - countries bos VE isNonCountry false ise: yorumlanamayan/bilinmeyen serbest metin
function resolveTargetCountries(rawText) {
  const normalized = normalizeTr(rawText);
  if (!normalized) return { countries: [], isNonCountry: false };
  if (NON_COUNTRY_RESPONSES.has(normalized)) return { countries: [], isNonCountry: true };

  const direct = VARIANT_TO_COUNTRY[normalized];
  if (direct) return { countries: [direct], isNonCountry: false };

  const extracted = extractCountriesFromText(normalized);
  if (extracted.length > 0) return { countries: extracted, isNonCountry: false };

  return { countries: [], isNonCountry: false };
}

module.exports = { resolveTargetCountries };
