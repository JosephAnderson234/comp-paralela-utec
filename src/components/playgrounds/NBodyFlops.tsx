import { useState } from 'react';
import Chart, { fmt } from '../ui/Chart';
import Tex from '../ui/Tex';

// Arquetipo D (PD02 2025-I Ej.2 y 2026-I Ej.1): V(n,p) ≈ γ N^{2+x} / (α N^{2+x}/p + β log p)
export default function NBodyFlops() {
	const [logN, setLogN] = useState(6);
	const [p, setP] = useState(5000);
	const [base, setBase] = useState<'2' | 'e' | '10'>('2');
	const gamma = 500, alpha = 1e-9, beta = 1, x = 0.31;
	const log = (v: number) => (base === '2' ? Math.log2(v) : base === 'e' ? Math.log(v) : Math.log10(v));
	const V = (N: number, pp: number) => (gamma * N ** (2 + x)) / ((alpha * N ** (2 + x)) / pp + beta * log(pp));
	const N = 10 ** logN;
	const t1 = (alpha * N ** (2 + x)) / p, t2 = beta * log(p);
	const lim = (gamma * p) / alpha;
	const ns = Array.from({ length: 41 }, (_, i) => 10 ** (3 + i * 0.1));

	return (
		<div className="pg not-content">
			<h4>FLOPs teóricos del N-Body</h4>
			<Tex block>{String.raw`V(n,p)\approx\frac{\gamma N^{2+x}}{\alpha N^{2+x}/p+\beta\log p},\quad \gamma=500,\ \alpha=10^{-9},\ \beta=1,\ x=0.31`}</Tex>
			<div className="pg-row">
				<label className="pg-field"><span>N = 10^{logN.toFixed(1)} = <b>{fmt(N)}</b></span><input type="range" min={3} max={7} step={0.1} value={logN} onChange={(e) => setLogN(+e.target.value)} /></label>
				<label className="pg-field"><span>p (nodos) = <b>{p}</b></span><input type="range" min={10} max={20000} step={10} value={p} onChange={(e) => setP(+e.target.value)} /></label>
				<label className="pg-field" style={{ maxWidth: '9rem' }}><span>base del log</span>
					<select value={base} onChange={(e) => setBase(e.target.value as '2' | 'e' | '10')}><option value="2">log₂</option><option value="e">ln</option><option value="10">log₁₀</option></select>
				</label>
			</div>
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">αN^(2+x)/p</span><span className="v">{fmt(t1)}</span></div>
				<div className="pg-stat"><span className="k">β log p</span><span className="v">{fmt(t2)}</span></div>
				<div className="pg-stat"><span className="k">V(N,p)</span><span className="v">{fmt(V(N, p))} FLOP/s</span></div>
				<div className="pg-stat"><span className="k">Límite γp/α (N→∞)</span><span className="v">{fmt(lim)}</span></div>
			</div>
			<div className={`pg-note ${t1 > 5 * t2 ? 'ok' : 'warn'}`}>
				{t1 > 5 * t2
					? <>Domina αN^(2+x)/p ⇒ V ≈ γp/α = {fmt(lim)} (con p=5000: 2.5·10¹⁵ = <b>2.5 PFLOP</b>) y casi <b>no depende de N</b>.</>
					: <>Ambos términos son comparables (o domina β log p) ⇒ V <b>sí depende de N</b>. Por eso 2025-I dice «no depende» y 2026-I «depende ligeramente»: justifica con el cálculo, no de memoria.</>}
			</div>
			<Chart
				xLog
				yLog
				xLabel="N"
				yLabel="V (FLOP/s)"
				series={[
					{ label: `V(N), p=${p}`, color: 'var(--pg-c1)', data: ns.map((n) => [n, V(n, p)] as [number, number]) },
					{ label: 'γp/α', color: 'var(--pg-c2)', dashed: true, data: ns.map((n) => [n, lim] as [number, number]) },
				]}
				vlines={[{ x: N, label: 'N' }]}
			/>
		</div>
	);
}
