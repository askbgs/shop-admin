import { lkr, lkrShort } from '@/lib/format';
import type { DayPoint } from '@/lib/queries';

// Server-rendered SVG bar chart: daily revenue (cancelled orders excluded).
export default function RevenueChart({ data }: { data: DayPoint[] }) {
  const W = 720;
  const H = 220;
  const pad = { l: 44, r: 8, t: 10, b: 26 };
  const max = Math.max(1, ...data.map((d) => d.revenue));
  const step = niceStep(max / 4);
  const nice = step * Math.max(1, Math.ceil(max / step));
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const bw = iw / Math.max(1, data.length);
  const ticks: number[] = [];
  for (let t = 0; t <= nice + 1e-9; t += step) ticks.push(t);
  const last = data.length - 1;
  const total = data.reduce((s, d) => s + d.revenue, 0);
  const orders = data.reduce((s, d) => s + d.orders, 0);

  return (
    <div>
      <div className="muted" style={{ marginBottom: 8 }}>
        {lkr(total)} from {orders} orders in the last {data.length} days
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Daily revenue, last 30 days">
        {ticks.map((t) => {
          const y = pad.t + ih - (t / nice) * ih;
          return (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="#ece8e1" />
              <text x={pad.l - 6} y={y + 4} fontSize="10" textAnchor="end" fill="#8a857c">{lkrShort(t)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.revenue / nice) * ih;
          const x = pad.l + i * bw + bw * 0.15;
          const y = pad.t + ih - h;
          const showLabel = i === last || (i % 7 === 0 && last - i >= 4);
          return (
            <g key={d.day}>
              <rect x={x} y={y} width={bw * 0.7} height={Math.max(h, d.revenue > 0 ? 2 : 0)} rx="2" fill="#b4532a">
                <title>{`${d.day}: ${lkr(d.revenue)} (${d.orders} orders)`}</title>
              </rect>
              {showLabel && (
                <text x={x + bw * 0.35} y={H - 8} fontSize="10" textAnchor="middle" fill="#8a857c">
                  {d.day.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Round a raw step up to 1, 2 or 5 x 10^n (in cents; minimum LKR 100)
function niceStep(v: number): number {
  const raw = Math.max(v, 10_000);
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / exp;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return n * exp;
}
