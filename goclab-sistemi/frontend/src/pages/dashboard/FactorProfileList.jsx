function formatScore(value) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// Tek bir grubun/alt kumenin 7 faktorluk profilini dikey bar listesi olarak
// gosterir - Iliskisel Analiz (secili aralik) ve Yurt Disi Baglantisi
// (secili grup) sayfalarinda ORTAK kullanilir. scores: {factorKey: 0-100|null}.
export default function FactorProfileList({ label, color, scores, factorKeys, factorLabels }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <h4 className="text-sm font-bold text-[#001A3F]">{label}</h4>
      </div>
      <div className="flex flex-col gap-2.5">
        {factorKeys.map((key) => {
          const value = scores[key];
          return (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-gray-600">{factorLabels[key] || key}</span>
                <span className="shrink-0 text-xs font-bold" style={{ color }}>
                  {formatScore(value)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full" style={{ width: `${value ?? 0}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
