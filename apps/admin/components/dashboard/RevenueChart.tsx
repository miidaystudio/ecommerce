interface RevenueChartProps {
  data: { date: string; revenue: number }[];
  height?: number;
}

export function RevenueChart({ data, height = 200 }: RevenueChartProps) {
  const width = 600;
  const padding = 12;
  const max = Math.max(1, ...data.map((d) => d.revenue));

  const points = data.map((d, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * (width - padding * 2) + padding : width / 2;
    const y = height - padding - (d.revenue / max) * (height - padding * 2);
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath =
    points.length > 0
      ? `${linePath} L${points[points.length - 1].x.toFixed(1)},${height - padding} L${points[0].x.toFixed(1)},${height - padding} Z`
      : '';

  if (data.every((d) => d.revenue === 0)) {
    return (
      <div className="flex items-center justify-center text-sm text-text-secondary" style={{ height }}>
        No revenue in this period yet.
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <defs>
        <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4A4238" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#4A4238" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#revenueFill)" />
      <path d={linePath} fill="none" stroke="#4A4238" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
