import { useMemo, useState } from 'react';

export type Series = {
	label: string;
	color: string;
	data: [number, number][];
	dashed?: boolean;
	dots?: boolean;
};

type Props = {
	series: Series[];
	xLabel?: string;
	yLabel?: string;
	xLog?: boolean;
	yLog?: boolean;
	yMin?: number;
	yMax?: number;
	hlines?: { y: number; label: string; color?: string }[];
	vlines?: { x: number; label: string; color?: string }[];
	height?: number;
	fmtX?: (x: number) => string;
	fmtY?: (y: number) => string;
};

const W = 640;

export function fmt(v: number, digits = 3): string {
	if (!isFinite(v)) return '∞';
	const a = Math.abs(v);
	if (a !== 0 && (a >= 1e5 || a < 1e-3)) return v.toExponential(2).replace('e+', 'e');
	return Number(v.toPrecision(digits)).toString();
}

function ticks(min: number, max: number, log: boolean, n = 5): number[] {
	if (log) {
		const out: number[] = [];
		const a = Math.floor(Math.log10(min));
		const b = Math.ceil(Math.log10(max));
		const step = Math.max(1, Math.ceil((b - a) / 6));
		for (let e = a; e <= b; e += step) out.push(10 ** e);
		return out.filter((t) => t >= min * 0.999 && t <= max * 1.001);
	}
	const span = max - min || 1;
	const raw = span / n;
	const mag = 10 ** Math.floor(Math.log10(raw));
	const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n + 1) ?? mag * 10;
	const out: number[] = [];
	for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-9; t += step) out.push(Number(t.toPrecision(10)));
	return out;
}

export default function Chart({
	series,
	xLabel,
	yLabel,
	xLog,
	yLog,
	yMin,
	yMax,
	hlines = [],
	vlines = [],
	height = 300,
	fmtX = (x) => fmt(x),
	fmtY = (y) => fmt(y),
}: Props) {
	const H = height;
	const m = { l: 56, r: 16, t: 14, b: 44 };
	const [hover, setHover] = useState<number | null>(null);

	const { x0, x1, y0, y1 } = useMemo(() => {
		const xs = series.flatMap((s) => s.data.map((d) => d[0])).filter((v) => isFinite(v) && (!xLog || v > 0));
		const ys = series
			.flatMap((s) => s.data.map((d) => d[1]))
			.concat(hlines.map((h) => h.y))
			.filter((v) => isFinite(v) && (!yLog || v > 0));
		let x0 = Math.min(...xs), x1 = Math.max(...xs);
		let y0 = yMin ?? Math.min(0, ...ys), y1 = yMax ?? Math.max(...ys);
		if (yLog) y0 = yMin ?? Math.min(...ys);
		if (x0 === x1) x1 = x0 + 1;
		if (y0 === y1) y1 = y0 + 1;
		if (!yLog && yMax === undefined) y1 = y1 + (y1 - y0) * 0.06;
		return { x0, x1, y0, y1 };
	}, [series, hlines, xLog, yLog, yMin, yMax]);

	const sx = (x: number) => {
		const t = xLog ? (Math.log10(x) - Math.log10(x0)) / (Math.log10(x1) - Math.log10(x0)) : (x - x0) / (x1 - x0);
		return m.l + t * (W - m.l - m.r);
	};
	const sy = (y: number) => {
		const yc = Math.min(Math.max(y, y0), y1);
		const t = yLog ? (Math.log10(yc) - Math.log10(y0)) / (Math.log10(y1) - Math.log10(y0)) : (yc - y0) / (y1 - y0);
		return H - m.b - t * (H - m.t - m.b);
	};
	const invX = (px: number) => {
		const t = (px - m.l) / (W - m.l - m.r);
		return xLog ? 10 ** (Math.log10(x0) + t * (Math.log10(x1) - Math.log10(x0))) : x0 + t * (x1 - x0);
	};

	const xt = ticks(x0, x1, !!xLog);
	const yt = ticks(y0, y1, !!yLog);

	const hoverPts =
		hover === null
			? []
			: series.map((s) => {
					let best = s.data[0];
					let bd = Infinity;
					for (const d of s.data) {
						const dd = Math.abs(sx(d[0]) - sx(hover));
						if (dd < bd) {
							bd = dd;
							best = d;
						}
					}
					return { s, d: best };
				});

	return (
		<div style={{ margin: 0 }}>
			<svg
				viewBox={`0 0 ${W} ${H}`}
				role="img"
				aria-label={`${yLabel ?? ''} vs ${xLabel ?? ''}`}
				onMouseMove={(e) => {
					const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
					const px = ((e.clientX - r.left) / r.width) * W;
					if (px < m.l || px > W - m.r) return setHover(null);
					setHover(invX(px));
				}}
				onMouseLeave={() => setHover(null)}
			>
				{yt.map((t) => (
					<g key={'y' + t}>
						<line x1={m.l} x2={W - m.r} y1={sy(t)} y2={sy(t)} stroke="var(--pg-border)" strokeWidth={1} />
						<text x={m.l - 6} y={sy(t) + 4} textAnchor="end" fontSize={11}>
							{fmtY(t)}
						</text>
					</g>
				))}
				{xt.map((t) => (
					<g key={'x' + t}>
						<line x1={sx(t)} x2={sx(t)} y1={m.t} y2={H - m.b} stroke="var(--pg-border)" strokeWidth={0.6} />
						<text x={sx(t)} y={H - m.b + 16} textAnchor="middle" fontSize={11}>
							{fmtX(t)}
						</text>
					</g>
				))}
				<line x1={m.l} x2={m.l} y1={m.t} y2={H - m.b} stroke="var(--sl-color-gray-3)" />
				<line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} stroke="var(--sl-color-gray-3)" />
				{xLabel && (
					<text x={(m.l + W - m.r) / 2} y={H - 6} textAnchor="middle" fontSize={12}>
						{xLabel}
					</text>
				)}
				{yLabel && (
					<text x={14} y={(m.t + H - m.b) / 2} textAnchor="middle" fontSize={12} transform={`rotate(-90 14 ${(m.t + H - m.b) / 2})`}>
						{yLabel}
					</text>
				)}
				{hlines.map((h) => (
					<g key={'h' + h.label}>
						<line x1={m.l} x2={W - m.r} y1={sy(h.y)} y2={sy(h.y)} stroke={h.color ?? 'var(--sl-color-gray-2)'} strokeDasharray="6 4" />
						<text x={W - m.r - 4} y={sy(h.y) - 5} textAnchor="end" fontSize={11} style={{ fill: h.color ?? 'var(--sl-color-gray-2)' }}>
							{h.label}
						</text>
					</g>
				))}
				{vlines.map((v) => (
					<g key={'v' + v.label}>
						<line x1={sx(v.x)} x2={sx(v.x)} y1={m.t} y2={H - m.b} stroke={v.color ?? 'var(--sl-color-gray-2)'} strokeDasharray="4 4" />
						<text x={sx(v.x) + 4} y={m.t + 12} fontSize={11} style={{ fill: v.color ?? 'var(--sl-color-gray-2)' }}>
							{v.label}
						</text>
					</g>
				))}
				{series.map((s) => {
					const pts = s.data.filter((d) => isFinite(d[1]) && (!yLog || d[1] > 0) && (!xLog || d[0] > 0));
					const path = pts.map((d, i) => `${i ? 'L' : 'M'}${sx(d[0]).toFixed(1)},${sy(d[1]).toFixed(1)}`).join('');
					return (
						<g key={s.label}>
							<path d={path} fill="none" stroke={s.color} strokeWidth={2.2} strokeDasharray={s.dashed ? '7 5' : undefined} />
							{s.dots && pts.map((d, i) => <circle key={i} cx={sx(d[0])} cy={sy(d[1])} r={3.2} fill={s.color} />)}
						</g>
					);
				})}
				{hover !== null && hoverPts.length > 0 && (
					<g pointerEvents="none">
						<line x1={sx(hoverPts[0].d[0])} x2={sx(hoverPts[0].d[0])} y1={m.t} y2={H - m.b} stroke="var(--sl-color-gray-2)" strokeWidth={0.8} />
						{hoverPts.map(({ s, d }) => (
							<circle key={s.label} cx={sx(d[0])} cy={sy(d[1])} r={4.5} fill={s.color} stroke="var(--sl-color-bg)" strokeWidth={1.5} />
						))}
					</g>
				)}
			</svg>
			<div className="legend">
				{series.map((s) => (
					<span key={s.label}>
						<i style={{ background: s.color }} />
						{s.label}
						{hover !== null && (() => {
							const hp = hoverPts.find((h) => h.s === s);
							return hp ? <b style={{ marginLeft: 4 }}>{fmtY(hp.d[1])}</b> : null;
						})()}
					</span>
				))}
				{hover !== null && hoverPts[0] && (
					<span style={{ color: 'var(--pg-muted)' }}>
						{xLabel ?? 'x'} = {fmtX(hoverPts[0].d[0])}
					</span>
				)}
			</div>
		</div>
	);
}
