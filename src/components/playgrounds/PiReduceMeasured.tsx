import { useState } from 'react';
import Chart, { fmt } from '../ui/Chart';

// session2/pi-reduce/ej03_res.txt — np, T(ms) para N = 1e2, 1e3, 1e4, 1e5, 1e6
const RAW: number[][] = [
	[1, 0.038438, 0.04643, 0.283472, 2.892212, 15.849574],
	[2, 0.059961, 0.029674, 0.201374, 1.928277, 12.727544],
	[4, 0.052549, 0.017779, 0.071254, 0.663223, 6.641444],
	[8, 0.06898, 0.028364, 0.058229, 0.491079, 4.388686],
	[16, 0.086202, 0.023621, 0.024208, 0.196048, 1.839138],
	[32, 0.196416, 0.029728, 0.034842, 0.14681, 1.300878],
	[64, 0.521179, 0.357218, 0.10023, 0.269385, 0.950722],
	[128, 1.499767, 4.851511, 0.522171, 0.272759, 1.114746],
];
const NS = [1e2, 1e3, 1e4, 1e5, 1e6];
const LABELS = ['10²', '10³', '10⁴', '10⁵', '10⁶'];
const COLORS = ['var(--pg-c5)', 'var(--pg-c6)', 'var(--pg-c3)', 'var(--pg-c1)', 'var(--pg-c4)'];
type Metric = 'T' | 'S' | 'E' | 'F';

export default function PiReduceMeasured() {
	const [metric, setMetric] = useState<Metric>('S');
	const [on, setOn] = useState([false, true, true, true, true]);
	const [sel, setSel] = useState(4);

	const val = (row: number[], c: number): number => {
		const T = row[c + 1];
		const T1 = RAW[0][c + 1];
		switch (metric) {
			case 'T': return T;
			case 'S': return T1 / T;
			case 'E': return T1 / T / row[0];
			case 'F': return (7 * NS[c]) / (T / 1000); // 7 FLOPs por iteración (como en ej03.plt)
		}
	};
	const series = NS.map((_, c) => ({ label: `N = ${LABELS[c]}`, color: COLORS[c], dots: true, data: RAW.map((r) => [r[0], val(r, c)] as [number, number]) })).filter((_, c) => on[c]);
	const best = RAW.reduce((a, r) => (r[sel + 1] < a[sel + 1] ? r : a));
	const maxT = Math.max(...RAW.map((r) => r[sel + 1]));

	const yl: Record<Metric, string> = { T: 'T (ms)', S: 'Speedup T(1)/T(np)', E: 'Eficiencia S/np', F: 'FLOP/s' };

	return (
		<div className="pg not-content">
			<h4>π con MPI_Reduce: tiempos medidos (np = 1 … 128)</h4>
			<p className="pg-sub">Datos reales del benchmark de <code>ejemplo03-PI-reduce.cpp</code> para 5 tamaños N. ¿Cuándo conviene paralelizar?</p>
			<div className="pg-row">
				<div className="pg-seg">
					{(['T', 'S', 'E', 'F'] as Metric[]).map((m) => (
						<button key={m} className={metric === m ? 'active' : ''} onClick={() => setMetric(m)}>{m === 'T' ? 'Tiempo' : m === 'S' ? 'Speedup' : m === 'E' ? 'Eficiencia' : 'FLOP/s'}</button>
					))}
				</div>
				<div className="pg-seg">
					{LABELS.map((l, c) => (
						<button key={c} className={on[c] ? 'active' : ''} onClick={() => setOn(on.map((x, k) => (k === c ? !x : x)))}>N={l}</button>
					))}
				</div>
			</div>
			<Chart
				series={series}
				xLabel="np"
				xLog
				yLog={metric === 'T' || metric === 'F'}
				yLabel={yl[metric]}
				hlines={metric === 'E' ? [{ y: 1, label: 'E = 1' }] : []}
				fmtX={(x) => String(Math.round(x))}
			/>
			<div className="pg-row" style={{ marginTop: 6 }}>
				<span className="pg-sub" style={{ margin: 0 }}>Carrera de tiempos para N =</span>
				<div className="pg-seg">
					{LABELS.map((l, c) => <button key={c} className={sel === c ? 'active' : ''} onClick={() => setSel(c)}>{l}</button>)}
				</div>
			</div>
			<div style={{ display: 'grid', gap: 4 }}>
				{RAW.map((r) => {
					const t = r[sel + 1];
					const isBest = r === best;
					return (
						<div key={r[0]} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 90px', alignItems: 'center', gap: 8, fontSize: 12 }}>
							<span>np={r[0]}</span>
							<div style={{ background: 'var(--pg-surface-2)', borderRadius: 6, height: 16, overflow: 'hidden' }}>
								<div className="pg-bar" style={{ width: `${(100 * t) / maxT}%`, height: '100%', borderRadius: 6, background: isBest ? 'var(--pg-ok)' : COLORS[sel] }} />
							</div>
							<span style={{ fontFamily: 'var(--sl-font-mono)' }}>{fmt(t)} ms{isBest ? ' ★' : ''}</span>
						</div>
					);
				})}
			</div>
			<div className="pg-note">
				Para N = {LABELS[sel]} el mínimo está en <b>np = {best[0]}</b> (S = {fmt(RAW[0][sel + 1] / best[sel + 1])}). Con N pequeño el costo de <code>MPI_Bcast</code>/<code>MPI_Reduce</code> (latencia ~α log p) supera al cómputo O(N/p): <b>más procesos = más lento</b>. Con N grande el punto óptimo se desplaza a más procesos — la misma lección que N-Body y la isoeficiencia.
				{metric === 'E' && <> Eficiencias &gt; 1 (superlineales) aparecen por efectos de caché y por el ruido de medir tiempos de décimas de ms.</>}
			</div>
		</div>
	);
}
