import { useRef, useState } from "react";
import FactorProfileList from "./FactorProfileList.jsx";

const TR_COLOR = "#287D8E";
const MD_COLOR = "#C49A55";

const VIEW = 440;
const MARGIN = { top: 16, right: 16, bottom: 40, left: 46 };
const PLOT_W = VIEW - MARGIN.left - MARGIN.right;
const PLOT_H = VIEW - MARGIN.top - MARGIN.bottom;
const TICKS = [0, 20, 40, 60, 80, 100];
const DRAG_THRESHOLD_PX = 6;

const xToPixel = (x) => MARGIN.left + (x / 100) * PLOT_W;
const yToPixel = (y) => MARGIN.top + PLOT_H - (y / 100) * PLOT_H;
const pixelToX = (px) => Math.max(0, Math.min(100, ((px - MARGIN.left) / PLOT_W) * 100));
const pixelToY = (py) => Math.max(0, Math.min(100, (1 - (py - MARGIN.top) / PLOT_H) * 100));
const clampPixelX = (px) => Math.max(MARGIN.left, Math.min(MARGIN.left + PLOT_W, px));
const clampPixelY = (py) => Math.max(MARGIN.top, Math.min(MARGIN.top + PLOT_H, py));

// Goc niyeti (x) x Goc kaygisi/psikolojik (y) kisi-bazinda dagilim grafigi.
// Fare ile surukleyerek bir dikdortgen secilir; secim PAYLASILAN (parent'ta
// tutulan) veri-uzayi koordinatlariyla ifade edildigi icin, HER IKI panelde
// de (Turkiye ve Moldova) AYNI araligi gosterir - hangi panelde surukleme
// baslatilirsa baslatilsin.
function ScatterPanel({ label, color, points, selection, onSelect, tc }) {
  const svgRef = useRef(null);
  const [dragStartPx, setDragStartPx] = useState(null);
  const [dragNowPx, setDragNowPx] = useState(null);

  const toSvgPoint = (clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = VIEW / rect.width;
    const scaleY = VIEW / rect.height;
    return { x: clampPixelX((clientX - rect.left) * scaleX), y: clampPixelY((clientY - rect.top) * scaleY) };
  };

  const handleMouseDown = (e) => {
    const p = toSvgPoint(e.clientX, e.clientY);
    setDragStartPx(p);
    setDragNowPx(p);
  };

  const handleMouseMove = (e) => {
    if (!dragStartPx) return;
    setDragNowPx(toSvgPoint(e.clientX, e.clientY));
  };

  const finishDrag = () => {
    if (!dragStartPx || !dragNowPx) {
      setDragStartPx(null);
      setDragNowPx(null);
      return;
    }
    const dx = Math.abs(dragNowPx.x - dragStartPx.x);
    const dy = Math.abs(dragNowPx.y - dragStartPx.y);
    if (dx < DRAG_THRESHOLD_PX && dy < DRAG_THRESHOLD_PX) {
      // Surukleme degil, basit bir tiklama -> secimi temizle.
      onSelect(null);
    } else {
      const xA = pixelToX(dragStartPx.x);
      const xB = pixelToX(dragNowPx.x);
      const yA = pixelToY(dragStartPx.y);
      const yB = pixelToY(dragNowPx.y);
      onSelect({ x1: Math.min(xA, xB), x2: Math.max(xA, xB), y1: Math.min(yA, yB), y2: Math.max(yA, yB) });
    }
    setDragStartPx(null);
    setDragNowPx(null);
  };

  const dragRectPx =
    dragStartPx && dragNowPx
      ? {
          x: Math.min(dragStartPx.x, dragNowPx.x),
          y: Math.min(dragStartPx.y, dragNowPx.y),
          width: Math.abs(dragNowPx.x - dragStartPx.x),
          height: Math.abs(dragNowPx.y - dragStartPx.y),
        }
      : null;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <h4 className="text-sm font-bold text-[#001A3F]">{label}</h4>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="w-full cursor-crosshair select-none touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={finishDrag}
        onMouseLeave={finishDrag}
      >
        <rect x={MARGIN.left} y={MARGIN.top} width={PLOT_W} height={PLOT_H} fill="#FAFAFA" stroke="#E5E7EB" />

        {TICKS.map((v) => (
          <g key={v}>
            <line x1={xToPixel(v)} x2={xToPixel(v)} y1={MARGIN.top} y2={MARGIN.top + PLOT_H} stroke="#F1F5F9" />
            <line y1={yToPixel(v)} y2={yToPixel(v)} x1={MARGIN.left} x2={MARGIN.left + PLOT_W} stroke="#F1F5F9" />
            <text x={xToPixel(v)} y={MARGIN.top + PLOT_H + 14} fontSize="9" textAnchor="middle" fill="#94A3B8">
              {v}
            </text>
            <text x={MARGIN.left - 6} y={yToPixel(v) + 3} fontSize="9" textAnchor="end" fill="#94A3B8">
              {v}
            </text>
          </g>
        ))}

        {/* 50 puan referans cizgileri - bilimsel bir siniflandirma esigi DEGIL,
            sadece 0-100 olceginin orta noktasi (gercek esik 33/66'dir, bkz.
            classifyScore). Bu yuzden "dusuk/yuksek" kadran etiketi KONULMAZ -
            sadece notrsir bir "50" referans etiketi gosterilir. */}
        <line x1={xToPixel(50)} x2={xToPixel(50)} y1={MARGIN.top} y2={MARGIN.top + PLOT_H} stroke="#CBD5E1" strokeDasharray="4 3" />
        <line y1={yToPixel(50)} y2={yToPixel(50)} x1={MARGIN.left} x2={MARGIN.left + PLOT_W} stroke="#CBD5E1" strokeDasharray="4 3" />
        <text x={xToPixel(50)} y={MARGIN.top + PLOT_H + 14} fontSize="9" textAnchor="middle" fill="#94A3B8">
          50
        </text>
        <text x={MARGIN.left - 6} y={yToPixel(50) + 3} fontSize="9" textAnchor="end" fill="#94A3B8">
          50
        </text>

        {points.map((p, i) => (
          <circle key={i} cx={xToPixel(p.goc_niyeti)} cy={yToPixel(p.psikolojik)} r={2.6} fill={color} fillOpacity={0.42} />
        ))}

        {selection && (
          <rect
            x={xToPixel(selection.x1)}
            y={yToPixel(selection.y2)}
            width={xToPixel(selection.x2) - xToPixel(selection.x1)}
            height={yToPixel(selection.y1) - yToPixel(selection.y2)}
            fill={color}
            fillOpacity={0.12}
            stroke={color}
            strokeWidth={1.5}
          />
        )}

        {dragRectPx && (
          <rect
            x={dragRectPx.x}
            y={dragRectPx.y}
            width={dragRectPx.width}
            height={dragRectPx.height}
            fill="#334155"
            fillOpacity={0.08}
            stroke="#334155"
            strokeDasharray="3 2"
          />
        )}

        <text x={MARGIN.left + PLOT_W / 2} y={VIEW - 2} fontSize="10" textAnchor="middle" fill="#64748B">
          {tc.xAxisLabel}
        </text>
        <text x={10} y={MARGIN.top + PLOT_H / 2} fontSize="10" textAnchor="middle" fill="#64748B" transform={`rotate(-90 10 ${MARGIN.top + PLOT_H / 2})`}>
          {tc.yAxisLabel}
        </text>
      </svg>
    </div>
  );
}

function averageScores(points, keys) {
  const scores = {};
  for (const key of keys) {
    const values = points.map((p) => p[key]).filter((v) => v !== null && v !== undefined);
    scores[key] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }
  return scores;
}

const FACTOR_KEYS = ["ekonomik_istihdam", "egitim", "aile_sosyal", "kulturel", "sosyo_politik", "cevresel", "psikolojik"];

// data: /api/comparison-scatter yaniti ({ turkey: {points}, moldova: {points} }),
// Comparison.jsx'teki paylasilan "Ortak Filtreler" durumuna gore ONCEDEN
// filtrelenmis olarak gelir. factorLabels: ov.factorLabels (Comparison.jsx'teki
// Faktor Karsilastirmasi ile AYNI etiketler, tutarlilik icin).
export default function IntentAnxietyRelation({ t, data, factorLabels }) {
  const tc = t.intentAnxietyPage;
  const [selection, setSelection] = useState(null);

  if (!data) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center rounded-2xl bg-white shadow-sm">
        <p className="text-sm font-medium text-gray-400">{tc.loading}</p>
      </div>
    );
  }

  const trPoints = data.turkey.points;
  const mdPoints = data.moldova.points;

  const inRange = (p) =>
    p.goc_niyeti >= selection.x1 && p.goc_niyeti <= selection.x2 && p.psikolojik >= selection.y1 && p.psikolojik <= selection.y2;
  const trSelected = selection ? trPoints.filter(inRange) : [];
  const mdSelected = selection ? mdPoints.filter(inRange) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-[#001A3F]">{tc.title}</h3>
        <p className="text-xs text-gray-400">{tc.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ScatterPanel label={tc.turkey} color={TR_COLOR} points={trPoints} selection={selection} onSelect={setSelection} tc={tc} />
        <ScatterPanel label={tc.moldova} color={MD_COLOR} points={mdPoints} selection={selection} onSelect={setSelection} tc={tc} />
      </div>
      <p className="-mt-3 text-xs text-gray-400">{tc.guideLineNote}</p>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-[#001A3F]">
            {tc.selectionTitle}
            {selection && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                {tc.xAxisLabel} {Math.round(selection.x1)}-{Math.round(selection.x2)}, {tc.yAxisLabel} {Math.round(selection.y1)}-
                {Math.round(selection.y2)}
              </span>
            )}
          </h3>
          {selection && (
            <button
              type="button"
              onClick={() => setSelection(null)}
              className="rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50"
            >
              {tc.clearSelection}
            </button>
          )}
        </div>

        {!selection ? (
          <p className="text-sm text-gray-400">{tc.dragHint}</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-xs text-gray-500">
                <span className="font-semibold text-[#001A3F]">{trSelected.length}</span> {tc.ofTotalLabel} {trPoints.length}{" "}
                {tc.personUnit}
              </p>
              {trSelected.length > 0 ? (
                <FactorProfileList
                  label={tc.turkey}
                  color={TR_COLOR}
                  scores={averageScores(trSelected, FACTOR_KEYS)}
                  factorKeys={FACTOR_KEYS}
                  factorLabels={factorLabels}
                />
              ) : (
                <p className="text-xs text-gray-400">{tc.noDataInSelection}</p>
              )}
            </div>
            <div>
              <p className="mb-3 text-xs text-gray-500">
                <span className="font-semibold text-[#001A3F]">{mdSelected.length}</span> {tc.ofTotalLabel} {mdPoints.length}{" "}
                {tc.personUnit}
              </p>
              {mdSelected.length > 0 ? (
                <FactorProfileList
                  label={tc.moldova}
                  color={MD_COLOR}
                  scores={averageScores(mdSelected, FACTOR_KEYS)}
                  factorKeys={FACTOR_KEYS}
                  factorLabels={factorLabels}
                />
              ) : (
                <p className="text-xs text-gray-400">{tc.noDataInSelection}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
