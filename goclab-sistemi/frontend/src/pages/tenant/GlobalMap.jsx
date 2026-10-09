import { useMemo, useState } from "react";
import { Globe2, Filter, RotateCcw, ChevronDown, Info, ShieldCheck } from "lucide-react";
import { ComposableMap, Geographies, Geography, Marker, Line } from "react-simple-maps";
import { geoCentroid } from "d3-geo";
import { PROVINCE_TO_REGION, REGION_ORDER } from "../dashboard/turkeyRegions.js";

const WORLD_GEO_URL = "/world-countries-110m.json";
const TURKEY_COORDS = [35.2433, 38.9637];

// Hedef ulke (Demografik Bilgiler formundaki targetCountryOptions, Turkce)
// -> world-countries-110m.json topolojisindeki Ingilizce "name" alani
// eslestirmesi. Bu 110m (basitlestirilmis) topoloji kucuk ada devletlerinin
// cogunu icermez; eslesmeyen bir ulke secilirse o ulke siralama tablosunda
// gorunur ama haritada cizgi/marker olarak gosterilemez (koordinat yok).
const COUNTRY_NAME_TR_TO_EN = {
  Afganistan: "Afghanistan", Almanya: "Germany", "Amerika Birleşik Devletleri": "United States of America",
  Arjantin: "Argentina", Arnavutluk: "Albania", Avustralya: "Australia", Avusturya: "Austria",
  Azerbaycan: "Azerbaijan", Bahamalar: "Bahamas", Bangladeş: "Bangladesh", Belçika: "Belgium",
  Belize: "Belize", Benin: "Benin", "Beyaz Rusya": "Belarus", Bhutan: "Bhutan", Bolivya: "Bolivia",
  "Bosna Hersek": "Bosnia and Herz.", Botsvana: "Botswana", Brezilya: "Brazil", Brunei: "Brunei",
  Bulgaristan: "Bulgaria", "Burkina Faso": "Burkina Faso", Burundi: "Burundi", Cezayir: "Algeria",
  Cibuti: "Djibouti", Çad: "Chad", "Çek Cumhuriyeti": "Czechia", Çin: "China", Danimarka: "Denmark",
  "Doğu Timor": "Timor-Leste", "Dominik Cumhuriyeti": "Dominican Rep.", Ekvador: "Ecuador",
  "Ekvator Ginesi": "Eq. Guinea", "El Salvador": "El Salvador", Endonezya: "Indonesia", Eritre: "Eritrea",
  Ermenistan: "Armenia", Estonya: "Estonia", Esvatini: "eSwatini", Etiyopya: "Ethiopia", Fas: "Morocco",
  Fiji: "Fiji", "Fildişi Sahili": "CÃ´te d'Ivoire", Filipinler: "Philippines", Filistin: "Palestine",
  Finlandiya: "Finland", Fransa: "France", Gabon: "Gabon", Gambiya: "Gambia", Gana: "Ghana",
  Gine: "Guinea", "Gine-Bissau": "Guinea-Bissau", Guatemala: "Guatemala", Guyana: "Guyana",
  "Güney Afrika": "South Africa", "Güney Kore": "South Korea", "Güney Sudan": "S. Sudan",
  Gürcistan: "Georgia", Haiti: "Haiti", Hırvatistan: "Croatia", Hindistan: "India", Hollanda: "Netherlands",
  Honduras: "Honduras", Irak: "Iraq", İngiltere: "United Kingdom", İran: "Iran", İrlanda: "Ireland",
  İspanya: "Spain", İsrail: "Israel", İsveç: "Sweden", İsviçre: "Switzerland", İtalya: "Italy",
  İzlanda: "Iceland", Jamaika: "Jamaica", Japonya: "Japan", Kamboçya: "Cambodia", Kamerun: "Cameroon",
  Kanada: "Canada", Karadağ: "Montenegro", Katar: "Qatar", Kazakistan: "Kazakhstan", Kenya: "Kenya",
  Kırgızistan: "Kyrgyzstan", Kolombiya: "Colombia", "Kongo Cumhuriyeti": "Congo",
  "Kongo Demokratik Cumhuriyeti": "Dem. Rep. Congo", Kosova: "Kosovo", "Kosta Rika": "Costa Rica",
  Kuveyt: "Kuwait", "Kuzey Kore": "North Korea", "Kuzey Makedonya": "Macedonia", Küba: "Cuba",
  Laos: "Laos", Lesotho: "Lesotho", Letonya: "Latvia", Liberya: "Liberia", Libya: "Libya",
  Litvanya: "Lithuania", Lübnan: "Lebanon", Lüksemburg: "Luxembourg", Macaristan: "Hungary",
  Madagaskar: "Madagascar", Malavi: "Malawi", Malezya: "Malaysia", Mali: "Mali", Meksika: "Mexico",
  Mısır: "Egypt", Moğolistan: "Mongolia", Moldova: "Moldova", Moritanya: "Mauritania",
  Mozambik: "Mozambique", Myanmar: "Myanmar", Namibya: "Namibia", Nepal: "Nepal", Nijer: "Niger",
  Nijerya: "Nigeria", Nikaragua: "Nicaragua", Norveç: "Norway", "Orta Afrika Cumhuriyeti": "Central African Rep.",
  Özbekistan: "Uzbekistan", Pakistan: "Pakistan", Panama: "Panama", "Papua Yeni Gine": "Papua New Guinea",
  Paraguay: "Paraguay", Peru: "Peru", Polonya: "Poland", Portekiz: "Portugal", Romanya: "Romania",
  Ruanda: "Rwanda", Rusya: "Russia", Senegal: "Senegal", Sırbistan: "Serbia", "Sierra Leone": "Sierra Leone",
  Slovakya: "Slovakia", Slovenya: "Slovenia", "Solomon Adaları": "Solomon Is.", Somali: "Somalia",
  "Sri Lanka": "Sri Lanka", Sudan: "Sudan", Surinam: "Suriname", Suriye: "Syria",
  "Suudi Arabistan": "Saudi Arabia", Şili: "Chile", Tacikistan: "Tajikistan", Tanzanya: "Tanzania",
  Tayland: "Thailand", Tayvan: "Taiwan", Togo: "Togo", "Trinidad ve Tobago": "Trinidad and Tobago",
  Tunus: "Tunisia", Türkiye: "Turkey", Türkmenistan: "Turkmenistan", Uganda: "Uganda", Ukrayna: "Ukraine",
  Umman: "Oman", Uruguay: "Uruguay", Ürdün: "Jordan", Vanuatu: "Vanuatu", Venezuela: "Venezuela",
  Vietnam: "Vietnam", Yemen: "Yemen", "Yeni Zelanda": "New Zealand", Yunanistan: "Greece",
  Zambiya: "Zambia", Zimbabve: "Zimbabwe",
};

// Ayni TR anahtarlarin Romence karsiligi (COUNTRY_NAME_TR_TO_EN ile BIREBIR
// ayni anahtar kumesi) - getCountryDisplayName icin.
const COUNTRY_NAME_TR_TO_RO = {
  Afganistan: "Afganistan", Almanya: "Germania", "Amerika Birleşik Devletleri": "Statele Unite ale Americii",
  Arjantin: "Argentina", Arnavutluk: "Albania", Avustralya: "Australia", Avusturya: "Austria",
  Azerbaycan: "Azerbaidjan", Bahamalar: "Bahamas", Bangladeş: "Bangladesh", Belçika: "Belgia",
  Belize: "Belize", Benin: "Benin", "Beyaz Rusya": "Belarus", Bhutan: "Bhutan", Bolivya: "Bolivia",
  "Bosna Hersek": "Bosnia și Herțegovina", Botsvana: "Botswana", Brezilya: "Brazilia", Brunei: "Brunei",
  Bulgaristan: "Bulgaria", "Burkina Faso": "Burkina Faso", Burundi: "Burundi", Cezayir: "Algeria",
  Cibuti: "Djibouti", Çad: "Ciad", "Çek Cumhuriyeti": "Cehia", Çin: "China", Danimarka: "Danemarca",
  "Doğu Timor": "Timorul de Est", "Dominik Cumhuriyeti": "Republica Dominicană", Ekvador: "Ecuador",
  "Ekvator Ginesi": "Guineea Ecuatorială", "El Salvador": "El Salvador", Endonezya: "Indonezia", Eritre: "Eritreea",
  Ermenistan: "Armenia", Estonya: "Estonia", Esvatini: "Eswatini", Etiyopya: "Etiopia", Fas: "Maroc",
  Fiji: "Fiji", "Fildişi Sahili": "Coasta de Fildeș", Filipinler: "Filipine", Filistin: "Palestina",
  Finlandiya: "Finlanda", Fransa: "Franța", Gabon: "Gabon", Gambiya: "Gambia", Gana: "Ghana",
  Gine: "Guineea", "Gine-Bissau": "Guineea-Bissau", Guatemala: "Guatemala", Guyana: "Guyana",
  "Güney Afrika": "Africa de Sud", "Güney Kore": "Coreea de Sud", "Güney Sudan": "Sudanul de Sud",
  Gürcistan: "Georgia", Haiti: "Haiti", Hırvatistan: "Croația", Hindistan: "India", Hollanda: "Olanda",
  Honduras: "Honduras", Irak: "Irak", İngiltere: "Regatul Unit", İran: "Iran", İrlanda: "Irlanda",
  İspanya: "Spania", İsrail: "Israel", İsveç: "Suedia", İsviçre: "Elveția", İtalya: "Italia",
  İzlanda: "Islanda", Jamaika: "Jamaica", Japonya: "Japonia", Kamboçya: "Cambodgia", Kamerun: "Camerun",
  Kanada: "Canada", Karadağ: "Muntenegru", Katar: "Qatar", Kazakistan: "Kazahstan", Kenya: "Kenya",
  Kırgızistan: "Kârgâzstan", Kolombiya: "Columbia", "Kongo Cumhuriyeti": "Congo",
  "Kongo Demokratik Cumhuriyeti": "Republica Democrată Congo", Kosova: "Kosovo", "Kosta Rika": "Costa Rica",
  Kuveyt: "Kuweit", "Kuzey Kore": "Coreea de Nord", "Kuzey Makedonya": "Macedonia de Nord", Küba: "Cuba",
  Laos: "Laos", Lesotho: "Lesotho", Letonya: "Letonia", Liberya: "Liberia", Libya: "Libia",
  Litvanya: "Lituania", Lübnan: "Liban", Lüksemburg: "Luxemburg", Macaristan: "Ungaria",
  Madagaskar: "Madagascar", Malavi: "Malawi", Malezya: "Malaezia", Mali: "Mali", Meksika: "Mexic",
  Mısır: "Egipt", Moğolistan: "Mongolia", Moldova: "Moldova", Moritanya: "Mauritania",
  Mozambik: "Mozambic", Myanmar: "Myanmar", Namibya: "Namibia", Nepal: "Nepal", Nijer: "Niger",
  Nijerya: "Nigeria", Nikaragua: "Nicaragua", Norveç: "Norvegia", "Orta Afrika Cumhuriyeti": "Republica Centrafricană",
  Özbekistan: "Uzbekistan", Pakistan: "Pakistan", Panama: "Panama", "Papua Yeni Gine": "Papua Noua Guinee",
  Paraguay: "Paraguay", Peru: "Peru", Polonya: "Polonia", Portekiz: "Portugalia", Romanya: "România",
  Ruanda: "Rwanda", Rusya: "Rusia", Senegal: "Senegal", Sırbistan: "Serbia", "Sierra Leone": "Sierra Leone",
  Slovakya: "Slovacia", Slovenya: "Slovenia", "Solomon Adaları": "Insulele Solomon", Somali: "Somalia",
  "Sri Lanka": "Sri Lanka", Sudan: "Sudan", Surinam: "Surinam", Suriye: "Siria",
  "Suudi Arabistan": "Arabia Saudită", Şili: "Chile", Tacikistan: "Tadjikistan", Tanzanya: "Tanzania",
  Tayland: "Thailanda", Tayvan: "Taiwan", Togo: "Togo", "Trinidad ve Tobago": "Trinidad și Tobago",
  Tunus: "Tunisia", Türkiye: "Türkiye", Türkmenistan: "Turkmenistan", Uganda: "Uganda", Ukrayna: "Ucraina",
  Umman: "Oman", Uruguay: "Uruguay", Ürdün: "Iordania", Vanuatu: "Vanuatu", Venezuela: "Venezuela",
  Vietnam: "Vietnam", Yemen: "Yemen", "Yeni Zelanda": "Noua Zeelandă", Yunanistan: "Grecia",
  Zambiya: "Zambia", Zimbabve: "Zimbabwe",
};

// Ulke isimleri (demographics.target_country) veri tabaninda sabit Turkce
// deger olarak saklanir (anket formundaki secenekler Turkce oldugu icin).
// Goruntuleme (display) katmaninda dil secimine gore cevrilir.
function getCountryDisplayName(name, lang) {
  if (lang === "EN") return COUNTRY_NAME_TR_TO_EN[name] || name;
  if (lang === "RO") return COUNTRY_NAME_TR_TO_RO[name] || name;
  return name;
}

// Sirali (rank bazli, ulke kimligine gore degil) renk paleti.
const RANK_COLORS = ["#16A34A", "#2563EB", "#7C3AED", "#DC2626", "#0D9488"];

// Gercek demographics.education_level degerleriyle birebir ayni (Demographics.jsx
// formundaki egitim secenekleri) - eskiden burada uyumsuz bir liste vardi
// ("Ön Lisans" gibi gercekte hic kaydedilmeyen bir deger) ve filtre hicbir
// zaman gercek veriyle eslesmiyordu.
const AGE_OPTIONS = Array.from({ length: 13 }, (_, i) => String(18 + i));
const EDUCATION_OPTIONS = ["İlköğretim", "Lise", "Meslek Yüksekokulu", "Lisans", "Yüksek Lisans", "Doktora", "Diğer"];

// Turkiye'den her hedefe, iki nokta arasinda dik yonde hafifce kabaran
// (ucus rotasi hissi veren) kuadratik bezier ile ara noktalar uretir.
function arcPoints(from, to, steps = 28, bend = 0.18) {
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;
  const dx = lon2 - lon1;
  const dy = lat2 - lat1;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const midLon = (lon1 + lon2) / 2;
  const midLat = (lat1 + lat2) / 2;
  const perpLon = -dy / dist;
  const perpLat = dx / dist;
  const controlLon = midLon + perpLon * dist * bend;
  const controlLat = midLat + perpLat * dist * bend;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const tt = i / steps;
    const lon = (1 - tt) ** 2 * lon1 + 2 * (1 - tt) * tt * controlLon + tt ** 2 * lon2;
    const lat = (1 - tt) ** 2 * lat1 + 2 * (1 - tt) * tt * controlLat + tt ** 2 * lat2;
    points.push([lon, lat]);
  }
  return points;
}

const EMPTY_FILTERS = { cinsiyet: [], yas: [], egitim: [], bolge: [] };

function toggleInList(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// Kurumun gercek katilimcilarindan (demographics.target_country), secili
// filtrelere gore Top 5 hedef ulkeyi ve toplam (hedef ulkesi bilinen)
// katilimci sayisini hesaplar. Hic filtre secili degilse tum katilimcilar
// dahil edilir.
function computeTop5(appliedFilters, participants, regionLabelByProvince) {
  const filtered = participants.filter((p) => {
    if (appliedFilters.cinsiyet.length > 0 && !appliedFilters.cinsiyet.includes(p.gender)) return false;
    if (appliedFilters.yas.length > 0 && !appliedFilters.yas.includes(String(p.age))) return false;
    if (appliedFilters.egitim.length > 0 && !appliedFilters.egitim.includes(p.educationLevel)) return false;
    if (appliedFilters.bolge.length > 0) {
      const regionLabel = p.province ? regionLabelByProvince[p.province] : null;
      if (!regionLabel || !appliedFilters.bolge.includes(regionLabel)) return false;
    }
    return true;
  });

  const withCountry = filtered.filter((p) => p.targetCountry);
  const total = withCountry.length;

  const counts = {};
  withCountry.forEach((p) => {
    counts[p.targetCountry] = (counts[p.targetCountry] || 0) + 1;
  });

  const ranked = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count], i) => ({
      key: name,
      name,
      color: RANK_COLORS[i],
      count,
      pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }));

  return { total, countries: ranked };
}

function FilterCheckboxGroup({ options, selected, onToggle, columns = 1, labels }) {
  return (
    <div className={columns === 2 ? "grid grid-cols-2 gap-x-3 gap-y-1.5" : "flex flex-col gap-1.5"}>
      {options.map((opt) => (
        <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={() => onToggle(opt)}
            className="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          {labels?.[opt] || opt}
        </label>
      ))}
    </div>
  );
}

export default function GlobalMap({ t, lang, participants = [] }) {
  const gm = t.tenantGlobalMapPage;
  const rp = t.regionalHeatmapPage;
  const tp = t.tenantOverviewPage;
  const educationLabels = t.participantAnalysisPage.educationOptions;

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [isAgeOpen, setIsAgeOpen] = useState(false);
  const [ageSearch, setAgeSearch] = useState("");

  const regionLabelByProvince = useMemo(() => {
    const map = {};
    Object.entries(PROVINCE_TO_REGION).forEach(([province, regionKey]) => {
      map[province] = rp.regions[regionKey];
    });
    return map;
  }, [rp]);

  const { total, countries } = useMemo(
    () => computeTop5(appliedFilters, participants, regionLabelByProvince),
    [appliedFilters, participants, regionLabelByProvince]
  );

  const visibleAgeOptions = AGE_OPTIONS.filter((age) => age.includes(ageSearch.trim()));
  const ageSummary = filters.yas.length > 0 ? filters.yas.slice().sort((a, b) => Number(a) - Number(b)).join(", ") : gm.ageSelectPlaceholder;

  const toggleFilter = (group, value) => {
    setFilters((prev) => ({ ...prev, [group]: toggleInList(prev[group], value) }));
  };

  const handleClear = () => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  };

  const handleApply = () => {
    setIsAgeOpen(false);
    setAppliedFilters(filters);
  };

  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      {/* SOL ALAN: HARİTA + TABLO */}
      <div className="flex flex-1 flex-col gap-6">
        {/* KÜRESEL TERCİH HARİTASI */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50">
              <Globe2 size={20} className="text-blue-700" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#001A3F]">{gm.title}</h3>
              <p className="text-xs text-gray-400">{gm.subtitle}</p>
            </div>
          </div>

          <div className="w-full">
            <ComposableMap
              projection="geoEqualEarth"
              projectionConfig={{ scale: 165, center: [10, 15] }}
              width={980}
              height={430}
              style={{ width: "100%", height: "auto", display: "block" }}
            >
              <Geographies geography={WORLD_GEO_URL}>
                {({ geographies }) => {
                  // Bu render'da ihtiyac duyulan (Top 5 icindeki) ulkelerin
                  // merkez noktalarini, zaten yuklu olan dunya topolojisinden
                  // hesaplar (RegionalMap.jsx'teki il etiketleriyle ayni desen).
                  const centroidByEnglishName = {};
                  geographies.forEach((geo) => {
                    centroidByEnglishName[geo.properties.name] = geoCentroid(geo);
                  });
                  const countriesWithCoords = countries
                    .map((country) => ({
                      ...country,
                      coords: centroidByEnglishName[COUNTRY_NAME_TR_TO_EN[country.name]] ?? null,
                    }))
                    .filter((country) => country.coords && !Number.isNaN(country.coords[0]));

                  return (
                    <>
                      {geographies.map((geo) => (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill="#F3F4F6"
                          stroke="#E5E7EB"
                          strokeWidth={0.6}
                          style={{
                            default: { outline: "none" },
                            hover: { outline: "none" },
                            pressed: { outline: "none" },
                          }}
                        />
                      ))}

                      {countriesWithCoords.map((country) => (
                        <Line
                          key={country.key}
                          coordinates={arcPoints(TURKEY_COORDS, country.coords)}
                          stroke={country.color}
                          strokeWidth={2}
                          strokeLinecap="round"
                          fill="none"
                          style={{ pointerEvents: "none" }}
                        />
                      ))}

                      <Marker coordinates={TURKEY_COORDS}>
                        <circle r={6} fill="#0F172A" stroke="#ffffff" strokeWidth={2} />
                        <text
                          textAnchor="middle"
                          y={-12}
                          style={{ fontSize: 10, fontWeight: 800, fill: "#0F172A", pointerEvents: "none" }}
                        >
                          {gm.turkeyLabel}
                        </text>
                      </Marker>

                      {countriesWithCoords.map((country) => (
                        <Marker key={country.key} coordinates={country.coords}>
                          <circle r={7} fill={country.color} stroke="#ffffff" strokeWidth={2} />
                          <circle r={12} fill={country.color} fillOpacity={0.18} style={{ pointerEvents: "none" }} />
                          <text
                            textAnchor="middle"
                            y={-20}
                            style={{ fontSize: 10, fontWeight: 800, fill: country.color, pointerEvents: "none" }}
                          >
                            %{country.pct.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                          </text>
                          <text
                            textAnchor="middle"
                            y={-8}
                            style={{ fontSize: 9, fontWeight: 700, fill: "#0F172A", pointerEvents: "none" }}
                          >
                            {getCountryDisplayName(country.name, lang)}
                          </text>
                        </Marker>
                      ))}
                    </>
                  );
                }}
              </Geographies>
            </ComposableMap>
          </div>

          <div className="mt-3 border-t border-gray-100 pt-3">
            <p className="mb-2 text-xs font-bold tracking-wide text-gray-500">{gm.legendTitle}</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-600">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-10 rounded-full" style={{ background: "linear-gradient(to right, #cbd5e1, #0f172a)" }} />
                {gm.legendLowHigh}
              </div>
              {countries.map((country) => (
                <div key={country.key} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: country.color }} />
                  <span className="font-semibold text-[#001A3F]">{getCountryDisplayName(country.name, lang)}</span>
                  <span style={{ color: country.color }} className="font-bold">
                    %{country.pct.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ÜLKE SIRALAMASI TABLOSU */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50">
              <Globe2 size={20} className="text-blue-700" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#001A3F]">{gm.rankingTitle}</h3>
              <p className="text-xs text-gray-400">{gm.rankingSubtitle}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-bold uppercase tracking-wide text-gray-400">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">{gm.columnCountry}</th>
                  <th className="py-2 pr-3">{gm.columnIntensity}</th>
                  <th className="py-2 pr-3">{gm.columnParticipants}</th>
                  <th className="flex items-center gap-1 py-2 pr-3">
                    {gm.columnDistribution}
                    <Info size={12} className="text-gray-300" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {countries.map((country, index) => (
                  <tr key={country.key} className="border-b border-gray-50">
                    <td className="py-3 pr-3 font-bold text-gray-400">{index + 1}</td>
                    <td className="py-3 pr-3 font-bold text-[#001A3F]">{getCountryDisplayName(country.name, lang)}</td>
                    <td className="py-3 pr-3 font-bold" style={{ color: country.color }}>
                      %{country.pct.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </td>
                    <td className="py-3 pr-3 text-gray-500">
                      {country.count} {gm.personSuffix}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="h-2.5 w-full max-w-[180px] rounded-full bg-gray-100">
                        <div
                          className="h-2.5 rounded-full"
                          style={{ width: `${Math.min(100, country.pct)}%`, backgroundColor: country.color }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pt-3 font-bold text-[#001A3F]" colSpan={3}>
                    {gm.totalLabel}
                  </td>
                  <td className="pt-3 font-bold text-[#001A3F]" colSpan={2}>
                    {total} / {total} {gm.personSuffix}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700">
            <ShieldCheck size={16} className="shrink-0" />
            {gm.privacyNotice}
          </div>
        </div>
      </div>

      {/* SAĞ PANEL: FİLTRELEME */}
      <div className="w-full shrink-0 rounded-2xl bg-white p-5 shadow-sm xl:w-80">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <h3 className="text-sm font-extrabold tracking-wide text-[#001A3F]">{gm.filterTitle}</h3>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1 text-xs font-semibold text-gray-400 transition-colors hover:text-gray-600"
          >
            <RotateCcw size={12} />
            {gm.clearLabel}
          </button>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-[#001A3F]">
              {gm.genderLabel}
              <Info size={12} className="text-gray-300" />
            </div>
            <div className="flex items-center gap-5">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={filters.cinsiyet.includes(tp.genderFemale)}
                  onChange={() => toggleFilter("cinsiyet", tp.genderFemale)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {tp.genderFemale}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={filters.cinsiyet.includes(tp.genderMale)}
                  onChange={() => toggleFilter("cinsiyet", tp.genderMale)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {tp.genderMale}
              </label>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-[#001A3F]">
              {gm.ageLabel}
              <Info size={12} className="text-gray-300" />
            </div>
            <button
              type="button"
              onClick={() => setIsAgeOpen((v) => !v)}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                isAgeOpen ? "border-blue-400 text-blue-600" : "border-gray-200 text-gray-500"
              }`}
            >
              <span className="truncate">{ageSummary}</span>
              <ChevronDown size={15} className={`shrink-0 transition-transform ${isAgeOpen ? "rotate-180" : ""}`} />
            </button>
            {isAgeOpen && (
              <div className="mt-2 rounded-lg border border-gray-100 p-2">
                <input
                  type="text"
                  value={ageSearch}
                  onChange={(e) => setAgeSearch(e.target.value)}
                  placeholder={gm.searchPlaceholder}
                  className="mb-2 w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none"
                />
                <div className="flex max-h-40 flex-col gap-1 overflow-y-auto pr-1">
                  {visibleAgeOptions.map((age) => (
                    <label key={age} className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={filters.yas.includes(age)}
                        onChange={() => toggleFilter("yas", age)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {age}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-[#001A3F]">
              {gm.educationLabel}
              <Info size={12} className="text-gray-300" />
            </div>
            <FilterCheckboxGroup
              options={EDUCATION_OPTIONS}
              selected={filters.egitim}
              onToggle={(value) => toggleFilter("egitim", value)}
              labels={educationLabels}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-[#001A3F]">
              {gm.birthRegionLabel}
              <Info size={12} className="text-gray-300" />
            </div>
            <FilterCheckboxGroup
              options={REGION_ORDER.map((key) => rp.regions[key])}
              selected={filters.bolge}
              onToggle={(value) => toggleFilter("bolge", value)}
            />
          </div>

          <button
            type="button"
            onClick={handleApply}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Filter size={15} />
            {gm.filterButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
