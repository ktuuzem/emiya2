const GAUGE_ZONE_COLORS = ["#DC2626", "#F97316", "#FACC15", "#22C55E", "#0D9488"];

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  return `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;
}

// Yari-dairesel gosterge grafigi (0-100 skor). StudentReport.jsx (buyuk boy)
// ve SurveyHistory.jsx (mini boy) tarafindan ortak kullanilir.
export default function GaugeChart({ score, size = "large" }) {
  const clamped = Math.max(0, Math.min(100, score ?? 0));
  const cx = 130;
  const cy = 120;
  const r = 95;
  const needleAngle = 180 - (clamped / 100) * 180;
  const needleTip = polarToCartesian(cx, cy, r - 18, needleAngle);
  const zoneSpan = 180 / GAUGE_ZONE_COLORS.length;
  const isMini = size === "mini";

  return (
    <svg viewBox="0 0 260 150" className={isMini ? "w-full max-w-[130px]" : "w-full max-w-[280px]"}>
      {GAUGE_ZONE_COLORS.map((color, i) => {
        const startAngle = 180 - i * zoneSpan;
        const endAngle = 180 - (i + 1) * zoneSpan;
        return (
          <path
            key={color}
            d={describeArc(cx, cy, r, startAngle, endAngle)}
            fill="none"
            stroke={color}
            strokeWidth={isMini ? 20 : 16}
            strokeLinecap="round"
          />
        );
      })}
      <line
        x1={cx}
        y1={cy}
        x2={needleTip.x}
        y2={needleTip.y}
        stroke="#0F172A"
        strokeWidth={isMini ? 4.5 : 3.5}
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r={isMini ? 8 : 7} fill="#0F172A" />
      <text
        x={cx}
        y={cy - 24}
        textAnchor="middle"
        className="fill-[#001A3F]"
        style={{ fontSize: isMini ? 46 : 34, fontWeight: 800 }}
      >
        {score !== null ? (isMini ? Math.round(clamped) : clamped.toFixed(1)) : "-"}
      </text>
      {!isMini && (
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-gray-400" style={{ fontSize: 13, fontWeight: 600 }}>
          / 100
        </text>
      )}
    </svg>
  );
}
