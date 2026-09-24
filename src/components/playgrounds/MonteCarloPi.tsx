import { useEffect, useMemo, useRef, useState } from 'react';
import Chart, { fmt } from '../ui/Chart';

const A = 16807, M = 2147483647; // LCG de la lámina U2.6: x_{i+1} = a x_i mod m (c = 0)
const COLORS = ['#4cc3d9', '#f2a541', '#b38cf2', '#6fd08c', '#f27a7a', '#e8d15a', '#7fa7ff', '#ff8fd1'];

function lcgStream(seed: number, n: number): number[] {
	const out = new Array<number>(n);
	let x = seed;
	for (let i = 0; i < n; i++) {
		x = (A * x) % M;
		out[i] = x / M;
	}
	return out;
}

type Strat = 'misma' | 'replicativa' | 'leapfrog' | 'splitting';
const STRATS: Record<Strat, { label: string; desc: string }> = {
	misma: { label: 'Replicativa, misma semilla', desc: 'Todos los procesos usan el mismo generador y la MISMA semilla: generan exactamente los mismos puntos. Con p procesos solo hay N/p puntos distintos.' },
	replicativa: { label: 'Replicativa, semilla = rank+1', desc: 'Mismo LCG, semillas distintas. Con c = 0 la secuencia de la semilla s es s·(secuencia de semilla 1) mod m ⇒ streams correlacionados (lámina: “puede crear correlaciones”).' },
	leapfrog: { label: 'Leapfrog (complemento)', desc: 'Un solo stream global; el proceso r toma los elementos r, r+p, r+2p, … Sin solapamiento ni comunicación. (Técnica estándar; no aparece con este nombre en las slides.)' },
	splitting: { label: 'Sequence splitting (complemento)', desc: 'Un solo stream global partido en bloques contiguos de N/p números, uno por proceso — la idea de streams/substreams de MRG32k3a.' },
};

function genPoints(strat: Strat, p: number, perProc: number): { x: number; y: number; r: number }[][] {
	const need = 2 * perProc;
	const procs: { x: number; y: number; r: number }[][] = [];
	const global = strat === 'leapfrog' || strat === 'splitting' ? lcgStream(12345, need * p) : [];
	for (let r = 0; r < p; r++) {
		let u: number[];
		if (strat === 'misma') u = lcgStream(12345, need);
		else if (strat === 'replicativa') u = lcgStream(r + 1, need);
		else if (strat === 'leapfrog') u = Array.from({ length: need }, (_, k) => global[k * p + r]);
		else u = global.slice(r * need, (r + 1) * need);
		const pts = [];
		for (let k = 0; k < perProc; k++) pts.push({ x: u[2 * k], y: u[2 * k + 1], r });
		procs.push(pts);
	}
	return procs;
}

function corr(a: number[], b: number[]) {
	const n = Math.min(a.length, b.length);
	let ma = 0, mb = 0;
	for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
	ma /= n; mb /= n;
	let c = 0, va = 0, vb = 0;
	for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
	return c / Math.sqrt(va * vb);
}

export default function MonteCarloPi() {
	const [tab, setTab] = useState<'mc' | 'int'>('mc');
	return (
		<div className="pg not-content">
			<h4>π en paralelo</h4>
			<div className="pg-row">
				<div className="pg-seg">
					<button className={tab === 'mc' ? 'active' : ''} onClick={() => setTab('mc')}>Montecarlo (puntos al azar)</button>
					<button className={tab === 'int' ? 'active' : ''} onClick={() => setTab('int')}>Integración: pi-reduce.cpp</button>
				</div>
			</div>
			{tab === 'mc' ? <MC /> : <Integ />}
		</div>
	);
}

function MC() {
	const [p, setP] = useState(4);
	const [logN, setLogN] = useState(12);
	const [strat, setStrat] = useState<Strat>('leapfrog');
	const N = 2 ** logN;
	const perProc = Math.floor(N / p);
	const procs = useMemo(() => genPoints(strat, p, perProc), [strat, p, perProc]);
	const canvas = useRef<HTMLCanvasElement>(null);

	const counts = procs.map((pts) => pts.filter((q) => q.x * q.x + q.y * q.y <= 1).length);
	const total = counts.reduce((s, c) => s + c, 0);
	const Ntot = perProc * p;
	const pi = (4 * total) / Ntot;
	const unique = new Set(procs.flat().map((q) => q.x + ',' + q.y)).size;
	const rho = p > 1 ? corr(procs[0].map((q) => q.x), procs[1].map((q) => q.x)) : 0;

	// convergencia: |error| vs número de puntos acumulados (orden de reducción: interleaved)
	const conv = useMemo(() => {
		const out: [number, number][] = [];
		let inside = 0, k = 0;
		for (let i = 0; i < perProc; i++)
			for (let r = 0; r < p; r++) {
				const q = procs[r][i];
				k++;
				if (q.x * q.x + q.y * q.y <= 1) inside++;
				if (k >= 16 && (k & (k - 1)) === 0) out.push([k, Math.abs((4 * inside) / k - Math.PI)]);
			}
		return out;
	}, [procs, p, perProc]);

	useEffect(() => {
		const c = canvas.current;
		if (!c) return;
		const ctx = c.getContext('2d')!;
		const S = c.width;
		ctx.clearRect(0, 0, S, S);
		ctx.strokeStyle = 'rgba(150,150,150,0.8)';
		ctx.lineWidth = 1.5;
		ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
		ctx.beginPath();
		ctx.arc(0, S, S, -Math.PI / 2, 0);
		ctx.stroke();
		const maxDraw = 6000;
		const step = Math.max(1, Math.ceil((perProc * p) / maxDraw));
		procs.forEach((pts, r) => {
			ctx.fillStyle = COLORS[r % 8];
			for (let i = 0; i < pts.length; i += step) ctx.fillRect(pts[i].x * S - 1, (1 - pts[i].y) * S - 1, 2.2, 2.2);
		});
	}, [procs, perProc, p]);

	return (
		<>
			<p className="pg-sub">Cada proceso genera N/p puntos en [0,1]², cuenta los que caen en el cuarto de círculo y se hace <span className="kbd">MPI_Reduce(SUM)</span>: π ≈ 4·n/N.</p>
			<div className="pg-row">
				<label className="pg-field"><span>p = <b>{p}</b></span><input type="range" min={1} max={8} value={p} onChange={(e) => setP(+e.target.value)} /></label>
				<label className="pg-field"><span>N = 2^{logN} = <b>{N}</b></span><input type="range" min={8} max={17} value={logN} onChange={(e) => setLogN(+e.target.value)} /></label>
				<label className="pg-field" style={{ flex: '2 1 14rem' }}>
					<span>Estrategia de números aleatorios</span>
					<select value={strat} onChange={(e) => setStrat(e.target.value as Strat)}>
						{Object.entries(STRATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
					</select>
				</label>
			</div>
			<div className="pg-grid-2">
				<canvas ref={canvas} width={320} height={320} style={{ width: '100%', maxWidth: 320, aspectRatio: '1', background: 'var(--sl-color-bg)', borderRadius: 8 }} />
				<div style={{ margin: 0 }}>
					<table>
						<thead><tr><th>rank</th><th>puntos</th><th>dentro</th><th>π local</th></tr></thead>
						<tbody>
							{counts.map((c, r) => (
								<tr key={r}><td style={{ color: COLORS[r % 8], fontWeight: 700 }}>P{r}</td><td>{perProc}</td><td>{c}</td><td>{fmt((4 * c) / perProc, 5)}</td></tr>
							))}
						</tbody>
					</table>
					<div className="pg-stats">
						<div className="pg-stat"><span className="k">π (tras Reduce)</span><span className="v">{pi.toFixed(5)}</span></div>
						<div className="pg-stat"><span className="k">|error|</span><span className="v">{fmt(Math.abs(pi - Math.PI))}</span></div>
						<div className="pg-stat"><span className="k">puntos distintos</span><span className="v">{unique}/{Ntot}</span></div>
						<div className="pg-stat"><span className="k">corr(P0,P1)</span><span className="v">{p > 1 ? fmt(rho, 2) : '—'}</span></div>
					</div>
				</div>
			</div>
			<div className={`pg-note ${strat === 'misma' || strat === 'replicativa' ? 'warn' : 'ok'}`}>{STRATS[strat].desc}</div>
			<b>Convergencia</b> — el error de Montecarlo baja como ~1/√N
			<Chart
				xLog
				yLog
				xLabel="N acumulado"
				yLabel="|π̂ − π|"
				series={[
					{ label: 'error medido', color: 'var(--pg-c1)', data: conv, dots: true },
					{ label: '1/√N', color: 'var(--sl-color-gray-3)', dashed: true, data: conv.map(([k]) => [k, 1 / Math.sqrt(k)] as [number, number]) },
				]}
			/>
		</>
	);
}

function Integ() {
	const [iter, setIter] = useState(10);
	const [size, setSize] = useState(3);
	const n = 2 ** iter;
	const ranges = Array.from({ length: size }, (_, r) => [Math.floor(n / size) * r + 1, Math.floor(n / size) * (r + 1)] as [number, number]);
	const partial = ranges.map(([a, b]) => {
		let s = 0;
		for (let i = a; i <= b; i++) s += 4 / (1 + ((i - 0.5) / n) ** 2);
		return s;
	});
	const result = partial.reduce((s, v) => s + v, 0) / n;
	const lost = n - Math.floor(n / size) * size;
	return (
		<>
			<p className="pg-sub">
				Regla del punto medio: π ≈ (1/n) Σ 4/(1+((i−0.5)/n)²). El maestro hace <span className="kbd">MPI_Bcast(&n)</span>, cada rank suma su tramo y <span className="kbd">MPI_Reduce</span> junta.
			</p>
			<pre className="pg-code">
				{`for (int i = (n / mpi_size * mpi_rank) + 1; i <= (n / mpi_size * (mpi_rank + 1)); ++i)
  local_sum += (4 / (1 + pow((i - 0.5) / n, 2)));
MPI_Reduce(&local_sum, &global_sum, 1, MPI_DOUBLE, MPI_SUM, 0, MPI_COMM_WORLD);`
					.split('\n')
					.map((l, i) => <div className="ln" key={i}><span>{l}</span></div>)}
			</pre>
			<div className="pg-row">
				<label className="pg-field"><span>n = 2^{iter} = <b>{n}</b></span><input type="range" min={4} max={20} value={iter} onChange={(e) => setIter(+e.target.value)} /></label>
				<label className="pg-field"><span>mpi_size = <b>{size}</b></span><input type="range" min={1} max={8} value={size} onChange={(e) => setSize(+e.target.value)} /></label>
			</div>
			<table>
				<thead><tr><th>rank</th><th>i desde</th><th>i hasta</th><th>iteraciones</th></tr></thead>
				<tbody>{ranges.map(([a, b], r) => <tr key={r}><td>{r}</td><td>{a}</td><td>{b}</td><td>{b - a + 1}</td></tr>)}</tbody>
			</table>
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">π calculado</span><span className="v">{result.toFixed(8)}</span></div>
				<div className="pg-stat"><span className="k">error</span><span className="v">{fmt(Math.PI - result)}</span></div>
				<div className="pg-stat"><span className="k">iteraciones perdidas</span><span className="v">{lost}</span></div>
			</div>
			{lost > 0 ? (
				<div className="pg-note bad">
					n = 2^{iter} no es divisible por {size}: la división entera n/size deja fuera {lost} término(s) (los últimos i) y el error ya no baja como debería. Con p potencia de 2 no pasa.
				</div>
			) : (
				<div className="pg-note ok">Reparto exacto: cada rank hace n/p iteraciones ⇒ S(n) = O(p), E(n) = O(1) (comentario del código).</div>
			)}
		</>
	);
}
