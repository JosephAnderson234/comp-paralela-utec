import { useMemo, useState } from 'react';
import PlayerControls, { usePlayer } from '../ui/Player';

type Modo = 'nada' | 'critical' | 'locks' | 'local';
type Tick = { hist: number[]; actua: (number | null)[]; espera: boolean[]; perdidos: number; nota: string };

const COL = ['var(--pg-c1)', 'var(--pg-c2)', 'var(--pg-c3)', 'var(--pg-c4)'];

function rng(seed: number) {
	let s = seed >>> 0;
	return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function simular(T: number, B: number, K: number, modo: Modo, seed: number) {
	const r = rng(seed);
	const datos = Array.from({ length: T }, () => Array.from({ length: K }, () => Math.floor(r() * B)));
	const hist = Array(B).fill(0);
	const pos = Array(T).fill(0);
	const local = Array.from({ length: T }, () => Array(B).fill(0));
	const fusion = Array(T).fill(0);
	const ticks: Tick[] = [];
	let perdidos = 0;
	let turno = 0;
	for (let guard = 0; guard < 400; guard++) {
		const pend = [...Array(T).keys()].filter((t) => pos[t] < K || (modo === 'local' && fusion[t] < B));
		if (!pend.length) break;
		const actua: (number | null)[] = Array(T).fill(null);
		const espera = Array(T).fill(false);
		let nota = '';
		if (modo === 'critical') {
			const t = pend[turno % pend.length]; turno++;
			const b = datos[t][pos[t]++]; hist[b]++; actua[t] = b;
			pend.forEach((u) => { if (u !== t) espera[u] = true; });
			nota = `hilo ${t} dentro de critical: hist[${b}]++ · los demás hacen fila`;
		} else if (modo === 'local') {
			const enFusion = pend.filter((t) => pos[t] >= K);
			const libres = pend.filter((t) => pos[t] < K);
			libres.forEach((t) => { const b = datos[t][pos[t]++]; local[t][b]++; actua[t] = b; });
			if (enFusion.length) {
				const t = enFusion[turno % enFusion.length]; turno++;
				for (let b = 0; b < B; b++) hist[b] += local[t][b];
				fusion[t] = B; actua[t] = -1;
				enFusion.forEach((u) => { if (u !== t) espera[u] = true; });
				nota = `hilo ${t} entra a critical y suma TODO su histograma local en hist (una sola vez por hilo)`;
			} else nota = 'cada hilo suma en su histograma local: nadie espera';
		} else {
			const pedidos = new Map<number, number[]>();
			pend.forEach((t) => { const b = datos[t][pos[t]]; pedidos.set(b, [...(pedidos.get(b) ?? []), t]); });
			const partes: string[] = [];
			pedidos.forEach((ts, b) => {
				if (modo === 'locks') {
					const t = ts[0]; pos[t]++; hist[b]++; actua[t] = b;
					ts.slice(1).forEach((u) => { espera[u] = true; });
					if (ts.length > 1) partes.push(`bin ${b}: hilo ${t} tiene lock[${b}], ${ts.slice(1).map((u) => `hilo ${u}`).join(', ')} espera`);
				} else {
					ts.forEach((t) => { pos[t]++; actua[t] = b; });
					hist[b] += 1;
					if (ts.length > 1) { perdidos += ts.length - 1; partes.push(`bin ${b}: ${ts.length} hilos leen ${hist[b] - 1} y escriben ${hist[b]} ⇒ se pierden ${ts.length - 1}`); }
				}
			});
			nota = partes.length ? partes.join(' · ') : modo === 'locks' ? 'bins distintos ⇒ locks distintos: todos avanzan a la vez' : 'bins distintos: no chocan';
		}
		ticks.push({ hist: [...hist], actua, espera, perdidos, nota });
	}
	return { ticks, total: T * K };
}

export default function HistogramLocks() {
	const [modo, setModo] = useState<Modo>('nada');
	const [T, setT] = useState(4);
	const [B, setB] = useState(6);
	const [seed, setSeed] = useState(7);
	const K = 6;
	const { ticks, total } = useMemo(() => simular(T, B, K, modo, seed), [T, B, modo, seed]);
	const pl = usePlayer(ticks.length, 650);
	const cur = pl.k ? ticks[pl.k - 1] : null;
	const hist = cur ? cur.hist : Array(B).fill(0);
	const suma = hist.reduce((a, b) => a + b, 0);
	const maxH = Math.max(4, ...hist);
	const fin = pl.k === ticks.length;

	const code: Record<Modo, string> = {
		nada: '#pragma omp parallel for private(key)\nfor (i = 0; i < N; i++) {\n    key = inp[i];\n    hist[key]++;                 // carrera\n}',
		critical: '#pragma omp parallel for private(key)\nfor (i = 0; i < N; i++) {\n    key = inp[i];\n    #pragma omp critical         // UN candado para todo el arreglo\n    hist[key]++;\n}',
		locks: '#pragma omp parallel for private(key)\nfor (i = 0; i < N; i++) {\n    key = inp[i];\n    omp_set_lock(&lock[key]);    // un candado POR bin\n    hist[key]++;\n    omp_unset_lock(&lock[key]);\n}',
		local: '#pragma omp parallel\n{\n    vector<long long> local(B, 0);\n    #pragma omp for\n    for (i = 0; i < N; i++) local[data[i]]++;\n    #pragma omp critical         // una vez por hilo\n    for (b = 0; b < B; b++) hist[b] += local[b];\n}',
	};

	return (
		<div className="pg not-content">
			<h4>Histograma en paralelo: ¿cuánto bloquear?</h4>
			<p className="pg-sub">Cada hilo procesa {K} datos y suma 1 en <code>hist[key]</code>. Compara cuántos pasos tarda cada versión y si el total da {T * K}.</p>
			<div className="pg-row">
				<div className="pg-seg">
					{(['nada', 'critical', 'locks', 'local'] as Modo[]).map((m) => (
						<button key={m} className={modo === m ? 'active' : ''} onClick={() => { setModo(m); pl.reset(); }}>
							{m === 'nada' ? 'sin protección' : m === 'critical' ? 'critical' : m === 'locks' ? 'lock por bin' : 'local + fusión'}
						</button>
					))}
				</div>
				<label className="pg-field"><span>hilos = <b>{T}</b></span><input type="range" min={2} max={4} value={T} onChange={(e) => { setT(+e.target.value); pl.reset(); }} /></label>
				<label className="pg-field"><span>bins = <b>{B}</b></span><input type="range" min={2} max={12} value={B} onChange={(e) => { setB(+e.target.value); pl.reset(); }} /></label>
				<button onClick={() => { setSeed(seed + 1); pl.reset(); }}>🎲 Otros datos</button>
			</div>
			<pre className="pg-code">{code[modo]}</pre>
			<PlayerControls pl={pl} label="paso de tiempo" />
			<svg viewBox={`0 0 ${B * 40 + 20} 150`} style={{ width: '100%', maxWidth: 560 }} role="img" aria-label="Histograma">
				{hist.map((h, b) => {
					const hgt = (100 * h) / maxH;
					const quien = cur ? cur.actua.map((a, t) => (a === b ? t : -1)).filter((t) => t >= 0) : [];
					return (
						<g key={b}>
							<rect x={10 + b * 40} y={110 - hgt} width={30} height={hgt} rx={3} fill="var(--pg-c2)" opacity={0.75} />
							<text x={25 + b * 40} y={105 - hgt} textAnchor="middle" fontSize={11}>{h}</text>
							<text x={25 + b * 40} y={124} textAnchor="middle" fontSize={10} fill="var(--pg-muted)">bin {b}</text>
							{quien.map((t, j) => <circle key={t} cx={18 + b * 40 + j * 8} cy={138} r={4} fill={COL[t]} className="pg-pulse" />)}
						</g>
					);
				})}
			</svg>
			<div className="pg-row" style={{ gap: 6 }}>
				{Array.from({ length: T }, (_, t) => (
					<span key={t} className="pg-stat" style={{ padding: '2px 8px', borderColor: COL[t], borderStyle: 'solid', borderWidth: 2 }}>
						<span className="k" style={{ color: COL[t] }}>hilo {t}</span>{' '}
						<span style={{ fontSize: 12 }}>{!cur ? '—' : cur.espera[t] ? 'espera ⏳' : cur.actua[t] === -1 ? 'fusiona 🔒' : cur.actua[t] !== null ? `bin ${cur.actua[t]}` : 'terminó'}</span>
					</span>
				))}
			</div>
			{cur && <div className={`pg-note ${modo === 'nada' && cur.perdidos ? 'bad' : ''}`}>{cur.nota}</div>}
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">pasos de tiempo</span><span className="v">{ticks.length}</span><span className="k">ideal: {K}</span></div>
				<div className="pg-stat"><span className="k">suma del histograma</span><span className="v" style={{ color: fin ? (suma === total ? 'var(--pg-ok)' : 'var(--pg-bad)') : undefined }}>{suma}/{total}</span></div>
				<div className="pg-stat"><span className="k">actualizaciones perdidas</span><span className="v">{cur ? cur.perdidos : 0}</span></div>
			</div>
			{fin && (
				<div className={`pg-note ${modo === 'nada' && suma !== total ? 'bad' : 'ok'}`}>
					{modo === 'nada' && <>Sin protección, cuando dos hilos tocan el <b>mismo bin</b> a la vez uno pisa al otro: el total da menos de {total}.</>}
					{modo === 'critical' && <>Correcto, pero <b>un solo candado</b> para todo el arreglo: aunque los hilos vayan a bins distintos, entran de a uno. Tardó {ticks.length} pasos: es secuencial.</>}
					{modo === 'locks' && <>Correcto y mucho más paralelo: solo esperan los hilos que van al <b>mismo bin</b>. Con más bins hay menos choques (prueba bins = 12). Cuesta memoria: un <code>omp_lock_t</code> por bin.</>}
					{modo === 'local' && <>Correcto y casi sin espera: cada hilo cuenta en su copia y solo al final fusiona (una vez por bin y por hilo). Es la idea de <code>reduction(+:H[:B])</code>, la versión de <code>ejercicio01_reduction.cpp</code>.</>}
				</div>
			)}
		</div>
	);
}
