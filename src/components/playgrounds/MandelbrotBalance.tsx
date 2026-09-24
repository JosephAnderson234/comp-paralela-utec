import { useEffect, useMemo, useRef, useState } from 'react';
import Chart, { fmt } from '../ui/Chart';

const COLORS = ['#4cc3d9', '#f2a541', '#b38cf2', '#6fd08c', '#f27a7a', '#e8d15a', '#7fa7ff', '#ff8fd1', '#9be3c9', '#d9a0ff', '#ffc38a', '#a0d0ff', '#e0e070', '#ff9f9f', '#9fffb5', '#c0c0ff'];
const NX = 120, NY = 80;

function mandel(kmax: number): Int32Array {
	const out = new Int32Array(NX * NY);
	for (let i = 0; i < NY; i++)
		for (let j = 0; j < NX; j++) {
			const cr = -2.2 + (3.2 * j) / NX, ci = -1.2 + (2.4 * i) / NY;
			let zr = 0, zi = 0, k = 0;
			while (zr * zr + zi * zi <= 4 && k < kmax) {
				const t = zr * zr - zi * zi + cr;
				zi = 2 * zr * zi + ci;
				zr = t;
				k++;
			}
			out[i * NX + j] = k;
		}
	return out;
}

type Strat = 'bloques' | 'ciclico' | 'pool';

function assign(rowCost: number[], p: number, strat: Strat, chunk: number, overhead: number) {
	const owner = new Array<number>(NY);
	const load = new Array<number>(p).fill(0);
	if (strat === 'bloques') {
		const per = Math.ceil(NY / p);
		rowCost.forEach((c, i) => {
			owner[i] = Math.min(p - 1, Math.floor(i / per));
			load[owner[i]] += c;
		});
	} else if (strat === 'ciclico') {
		rowCost.forEach((c, i) => {
			owner[i] = i % p;
			load[i % p] += c;
		});
	} else {
		// work pool: el proceso que queda libre primero toma el siguiente paquete de `chunk` filas
		for (let start = 0; start < NY; start += chunk) {
			let w = 0;
			for (let r = 1; r < p; r++) if (load[r] < load[w]) w = r;
			let c = overhead; // T_msg + T_sched por tarea
			for (let i = start; i < Math.min(NY, start + chunk); i++) {
				owner[i] = w;
				c += rowCost[i];
			}
			load[w] += c;
		}
	}
	return { owner, load };
}

export default function MandelbrotBalance() {
	const [kmax, setKmax] = useState(300);
	const [p, setP] = useState(4);
	const [strat, setStrat] = useState<Strat>('bloques');
	const [chunk, setChunk] = useState(2);
	const [ovh, setOvh] = useState(200);
	const it = useMemo(() => mandel(kmax), [kmax]);
	const rowCost = useMemo(() => Array.from({ length: NY }, (_, i) => it.slice(i * NX, (i + 1) * NX).reduce((s, v) => s + v, 0)), [it]);
	const Ts = rowCost.reduce((s, v) => s + v, 0);
	const { owner, load } = useMemo(() => assign(rowCost, p, strat, chunk, ovh), [rowCost, p, strat, chunk, ovh]);
	const Tp = Math.max(...load);
	const canvas = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const c = canvas.current;
		if (!c) return;
		const ctx = c.getContext('2d')!;
		const img = ctx.createImageData(NX, NY);
		for (let i = 0; i < NY; i++)
			for (let j = 0; j < NX; j++) {
				const k = it[i * NX + j];
				const hex = COLORS[owner[i] % 16];
				const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
				const f = k >= kmax ? 1 : 0.18 + 0.5 * Math.sqrt(k / kmax);
				const o = (i * NX + j) * 4;
				img.data[o] = r * f;
				img.data[o + 1] = g * f;
				img.data[o + 2] = b * f;
				img.data[o + 3] = 255;
			}
		ctx.putImageData(img, 0, 0);
	}, [it, owner, kmax]);

	const curve = (s: Strat) =>
		[1, 2, 3, 4, 6, 8, 10, 12, 16].map((pp) => {
			const L = assign(rowCost, pp, s, chunk, ovh).load;
			return [pp, Ts / (pp * Math.max(...L))] as [number, number];
		});

	return (
		<div className="pg">
			<h4>Mandelbrot: balance de carga estático vs work pool</h4>
			<p className="pg-sub">Cada píxel itera z ← z² + c hasta |z| &gt; 2 o K_max. Costo de una fila = suma de iteraciones de sus píxeles. Color = proceso dueño, brillo = iteraciones.</p>
			<div className="pg-row">
				<div className="pg-seg">
					<button className={strat === 'bloques' ? 'active' : ''} onClick={() => setStrat('bloques')}>Estático: bloques de filas</button>
					<button className={strat === 'ciclico' ? 'active' : ''} onClick={() => setStrat('ciclico')}>Estático: filas cíclicas</button>
					<button className={strat === 'pool' ? 'active' : ''} onClick={() => setStrat('pool')}>Dinámico: work pool</button>
				</div>
			</div>
			<div className="pg-row">
				<label className="pg-field"><span>p = <b>{p}</b></span><input type="range" min={1} max={16} value={p} onChange={(e) => setP(+e.target.value)} /></label>
				<label className="pg-field"><span>K_max = <b>{kmax}</b></span><input type="range" min={50} max={1000} step={50} value={kmax} onChange={(e) => setKmax(+e.target.value)} /></label>
				{strat === 'pool' && (
					<>
						<label className="pg-field"><span>filas por tarea = <b>{chunk}</b></span><input type="range" min={1} max={20} value={chunk} onChange={(e) => setChunk(+e.target.value)} /></label>
						<label className="pg-field"><span>overhead/tarea (T_msg+T_sched) = <b>{ovh}</b> it.</span><input type="range" min={0} max={5000} step={100} value={ovh} onChange={(e) => setOvh(+e.target.value)} /></label>
					</>
				)}
			</div>
			<div className="pg-grid-2">
				<canvas ref={canvas} width={NX} height={NY} style={{ width: '100%', imageRendering: 'pixelated', borderRadius: 8 }} />
				<div style={{ margin: 0 }}>
					<b>Carga por proceso</b> (iteraciones)
					<svg viewBox={`0 0 300 ${p * 16 + 8}`}>
						{load.map((l, r) => (
							<g key={r}>
								<text x={0} y={r * 16 + 13} fontSize={10}>P{r}</text>
								<rect x={26} y={r * 16 + 3} width={Math.max(1, (l / Tp) * 230)} height={12} rx={2} fill={COLORS[r % 16]} />
								<text x={30 + (l / Tp) * 230} y={r * 16 + 13} fontSize={9}>{fmt(l)}</text>
							</g>
						))}
					</svg>
				</div>
			</div>
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">T_s (Σ iteraciones)</span><span className="v">{fmt(Ts)}</span></div>
				<div className="pg-stat"><span className="k">T_p = máx. carga</span><span className="v">{fmt(Tp)}</span></div>
				<div className="pg-stat"><span className="k">S</span><span className="v">{fmt(Ts / Tp)}</span></div>
				<div className="pg-stat"><span className="k">E</span><span className="v">{fmt(Ts / Tp / p)}</span></div>
				<div className="pg-stat"><span className="k">desbalance máx/prom</span><span className="v">{fmt(Tp / (load.reduce((s, v) => s + v, 0) / p))}</span></div>
			</div>
			<b>Eficiencia vs p</b>
			<Chart
				xLabel="p"
				yLabel="E"
				yMin={0}
				yMax={1.02}
				series={[
					{ label: 'bloques', color: 'var(--pg-c1)', data: curve('bloques'), dots: true },
					{ label: 'cíclico', color: 'var(--pg-c3)', data: curve('ciclico'), dots: true },
					{ label: `work pool (${chunk} filas, ovh ${ovh})`, color: 'var(--pg-c2)', data: curve('pool'), dots: true },
				]}
			/>
			<div className="pg-note">
				Con bloques, los procesos que reciben filas del interior del conjunto (K_max iteraciones por píxel) terminan mucho después: <b>desbalance</b>. El work pool lo corrige a cambio de overhead por tarea; con tareas muy chicas y overhead alto, el overhead domina.
			</div>
		</div>
	);
}
