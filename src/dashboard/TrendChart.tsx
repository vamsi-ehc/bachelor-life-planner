const WIDTH = 320;
const HEIGHT = 96;
const PAD = 6;

export function TrendChart({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <p className="text-sm text-muted">Not enough history yet to show a trend.</p>;
  }

  const step = (WIDTH - PAD * 2) / (values.length - 1);
  const points = values.map((v, i) => {
    const x = PAD + i * step;
    const y = HEIGHT - PAD - (Math.min(v, 100) / 100) * (HEIGHT - PAD * 2);
    return [x, y] as const;
  });

  const lineD = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaD = `${lineD} L${points[points.length - 1][0].toFixed(1)},${HEIGHT} L${points[0][0].toFixed(1)},${HEIGHT} Z`;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="w-full h-24 block">
      <defs>
        <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3947C4" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#3947C4" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#trendArea)" />
      <path d={lineD} fill="none" stroke="#3947C4" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
      {points.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === points.length - 1 ? 3.6 : 2.2}
          fill={i === points.length - 1 ? '#3947C4' : '#FBFBF8'}
          stroke="#3947C4"
          strokeWidth={1.6}
        />
      ))}
    </svg>
  );
}
