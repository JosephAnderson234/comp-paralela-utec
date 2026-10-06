import { useEffect, useMemo, useState } from 'react';
import { fmt } from '../ui/Chart';
import { TXT, useRaf } from '../ui/Player';

type Kind = 'static' | 'static,c' | 'dynamic,c' | 'guided,c';
type Cost = 'uniforme' | 'creciente' | 'aleatorio' | 'un pico';
type Chunk = { t: number; from: number; to: number; start: number; end: number };

const COL = ['var(--pg-c1)', 'var(--pg-c2)', 'var(--pg-c3)', 'var(--pg-c4)', 'var(--pg-c5)', 'var(--pg-c6)', 'var(--pg-c1)', 'var(--pg-c2)'];

function costs(N: number, kind: Cost, seed: number): number[] {
	let s = seed;
	const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
	return Array.from({ length: N }, (_, i) => {
		if (kind === 'uniforme') return 1;
		if (kind === 'creciente') return 0.2 + (1.8 * i) / Math.max(1, N - 1);
		if (kind === 'aleatorio') return 0.3 + 1.7 * r();
		return i === Math.floor(N / 3) ? 8 : 1;
	});
}

function schedule(N: number, T: number, kind: Kind, c: number, cost: number[], ov: number): Chunk[] {
	const out: Chunk[] = [];
	const sum = (a: number, b: number) => cost.slice(a, b).reduce((x, y) => x + y, 0);
	if (kind === 'static' || kind === 'static,c') {
		const clock = new Array(T).fill(0);
		const pieces: [number, number, number][] = [];
		if (kind === 'static') {
			const q = Math.floor(N / T), r = N % T;
			let i = 0;
			for (let t = 0; t < T; t++) {
				const n = q + (t < r ? 1 : 0);
				if (n) pieces.push([t, i, i + n]);
				i += n;
			}
		} else {
			for (let j = 0, i = 0; i < N; j++, i += c) pieces.push([j % T, i, Math.min(N, i + c)]);
		}
		for (const [t, a, b] of pieces) {
			const d = sum(a, b);
			out.push({ t, from: a, to: b, start: clock[t], end: clock[t] + d });
			clock[t] += d;
		}
		return out;
	}
	// dynamic / guided: el hilo que se libera primero pide el siguiente bloque
	const clock = new Array(T).fill(0);
	let i = 0;
	while (i < N) {
		const rem = N - i;
		const size = kind === 'dynamic,c' ? Math.min(c, rem) : Math.min(rem, Math.max(c, Math.ceil(rem / T)));
		let t = 0;
		for (let k = 1; k < T; k++) if (clock[k] < clock[t]) t = k;
		const d = sum(i, i + size) + ov;
		out.push({ t, from: i, to: i + size, start: clock[t], end: clock[t] + d });
		clock[t] += d;
		i += size;
	}
	return out;
}

export default function OmpSchedule() {
	const [N, setN] = useState(16);
	const [T, setT] = useState(4);
	const [kind, setKind] = useState<Kind>('static');
	const [c, setC] = useState(3);
	const [cost, setCost] = useState<Cost>('uniforme');
	const [ov, setOv] = useState(0.15);
	const [seed, setSeed] = useState(7);
	const [time, setTime] = useState(0);
	const [running, setRunning] = useState(false);

	const cs = useMemo(() => costs(N, cost, seed), [N, cost, seed]);
	const chunks = useMemo(() => schedule(N, T, kind, c, cs, kind.startsWith('static') ? 0 : ov), [N, T, kind, c, cs, ov]);
	const makespan = Math.max(...chunks.map((k) => k.end));
	const total = cs.reduce((a, b) => a + b, 0);
	const loads = Array.from({ length: T }, (_, t) => chunks.filter((k) => k.t === t).reduce((a, k) => a + k.end - k.start, 0));
	const owner = new Array(N).fill(0);
	chunks.forEach((k) => { for (let i = k.from; i < k.to; i++) owner[i] = k.t; });

	useEffect(() => { setTime(0); setRunning(false); }, [N, T, kind, c, cost, ov, seed]);
	useRaf(running, (dt) => {
		setTime((x) => {
			const nx = x + dt * (makespan / 3.5);
			if (nx >= makespan) { setRunning(false); return makespan; }
			return nx;
		});
	});
	const shown = time > 0 ? time : 0;

	const W = 660, left = 54, rowH = 26, top = 8;
	const H = top + T * rowH + 26;
	const sx = (v: number) => left + (v / makespan) * (W - left - 10);

	const pragma = kind === 'static' ? 'schedule(static)' : kind === 'static,c' ? `schedule(static, ${c})` : kind === 'dynamic,c' ? `schedule(dynamic, ${c})` : `schedule(guided, ${c})`;

	return (
		<div className="pg not-content">
			<h4>¿Qué hilo hace cada iteración? <code>#pragma omp for {pragma}</code></h4>
			<p className="pg-sub">Cada bloque es un <b>chunk</b> (grupo de iteraciones seguidas). El ancho es lo que tarda. Pulsa «Ejecutar» para ver a los hilos trabajar.</p>
			<div className="pg-row">
				<div className="pg-seg">
					{(['static', 'static,c', 'dynamic,c', 'guided,c'] as Kind[]).map((k) => (
						<button key={k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>{k.replace(',c', ', chunk')}</button>
					))}
				</div>
			</div>
			<div className="pg-row">
				<label className="pg-field"><span>iteraciones N = <b>{N}</b></span><input type="range" min={4} max={48} value={N} onChange={(e) => setN(+e.target.value)} /></label>
				<label className="pg-field"><span>hilos = <b>{T}</b></span><input type="range" min={2} max={8} value={T} onChange={(e) => setT(+e.target.value)} /></label>
				<label className="pg-field" style={{ opacity: kind === 'static' ? 0.4 : 1 }}><span>chunk = <b>{c}</b></span><input type="range" min={1} max={8} value={c} disabled={kind === 'static'} onChange={(e) => setC(+e.target.value)} /></label>
				<label className="pg-field" style={{ opacity: kind.startsWith('static') ? 0.4 : 1 }}><span>costo de pedir un chunk = <b>{ov.toFixed(2)}</b></span><input type="range" min={0} max={1} step={0.05} value={ov} disabled={kind.startsWith('static')} onChange={(e) => setOv(+e.target.value)} /></label>
			</div>
			<div className="pg-row">
				<span className="pg-sub" style={{ margin: 0 }}>costo de cada iteración:</span>
				<div className="pg-seg">
					{(['uniforme', 'creciente', 'aleatorio', 'un pico'] as Cost[]).map((k) => (
						<button key={k} className={cost === k ? 'active' : ''} onClick={() => setCost(k)}>{k}</button>
					))}
				</div>
				{cost === 'aleatorio' && <button onClick={() => setSeed(seed + 1)}>🎲</button>}
				<button className="primary" onClick={() => { if (time >= makespan) setTime(0); setRunning(!running); }}>{running ? `⏸${TXT} Pausa` : time >= makespan ? '↻ Repetir' : `▶${TXT} Ejecutar`}</button>
			</div>

			{/* tira de iteraciones coloreada por dueño */}
			<div style={{ display: 'grid', gridTemplateColumns: `repeat(${N}, 1fr)`, gap: 2 }} aria-label="dueño de cada iteración">
				{owner.map((t, i) => {
					const done = chunks.some((k) => k.t === t && i >= k.from && i < k.to && k.end <= shown + 1e-9);
					return (
						<div key={i} title={`i=${i} → hilo ${t}`} style={{ height: 30, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontFamily: 'var(--sl-font-mono)', background: `color-mix(in srgb, ${COL[t]} ${done ? 80 : 30}%, transparent)`, transition: 'background-color .3s' }}>
							{i}
						</div>
					);
				})}
			</div>

			<div className="pg-scroll">
				<svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 520 }}>
					{Array.from({ length: T }, (_, t) => (
						<g key={t}>
							<text x={4} y={top + t * rowH + 17} fontSize={11} fontWeight={700} style={{ fill: COL[t] }}>hilo {t}</text>
							<rect x={left} y={top + t * rowH + 4} width={W - left - 10} height={rowH - 8} rx={4} fill="var(--pg-surface-2)" />
						</g>
					))}
					{chunks.map((k, idx) => {
						const vis = Math.max(0, Math.min(k.end, shown) - k.start);
						const full = k.end - k.start;
						const x = sx(k.start), w = sx(k.start + full) - x;
						return (
							<g key={idx}>
								<rect x={x + 0.5} y={top + k.t * rowH + 4} width={Math.max(0, w - 1)} height={rowH - 8} rx={4} fill="none" stroke={COL[k.t]} strokeOpacity={0.5} />
								<rect x={x + 0.5} y={top + k.t * rowH + 4} width={Math.max(0, sx(k.start + vis) - x - 1)} height={rowH - 8} rx={4} fill={COL[k.t]} />
								{w > 22 && <text x={x + w / 2} y={top + k.t * rowH + 17} textAnchor="middle" fontSize={9} style={{ fill: 'var(--sl-color-white)', paintOrder: 'stroke', stroke: 'var(--pg-surface)', strokeWidth: 3 }}>{k.to - k.from > 1 ? `${k.from}–${k.to - 1}` : k.from}</text>}
							</g>
						);
					})}
					<line x1={sx(shown)} x2={sx(shown)} y1={top} y2={top + T * rowH} stroke="var(--sl-color-accent)" strokeWidth={1.5} />
					<line x1={sx(total / T)} x2={sx(total / T)} y1={top} y2={top + T * rowH} stroke="var(--pg-ok)" strokeDasharray="4 4" />
					<text x={sx(total / T) + 3} y={H - 6} fontSize={10} style={{ fill: 'var(--pg-ok)' }}>ideal = trabajo/hilos</text>
				</svg>
			</div>

			<div className="pg-stats">
				<div className="pg-stat"><span className="k">tiempo total (el hilo más lento)</span><span className="v">{fmt(makespan)}</span></div>
				<div className="pg-stat"><span className="k">ideal (reparto perfecto)</span><span className="v">{fmt(total / T)}</span></div>
				<div className="pg-stat"><span className="k">eficiencia</span><span className="v">{Math.round((100 * total) / (T * makespan))}%</span></div>
				<div className="pg-stat"><span className="k">chunks repartidos</span><span className="v">{chunks.length}</span></div>
				<div className="pg-stat"><span className="k">carga por hilo</span><span className="v" style={{ fontSize: '0.85rem' }}>{loads.map((l) => fmt(l, 2)).join(' · ')}</span></div>
			</div>
			<div className="pg-note">
				{kind === 'static' && <>Sin chunk, <b>static</b> parte las {N} iteraciones en {T} bloques <b>contiguos</b> casi iguales, decididos <b>antes</b> de empezar. Perfecto si todas cuestan lo mismo; si el costo crece, el último hilo carga con lo pesado.</>}
				{kind === 'static,c' && <><b>static, {c}</b> reparte bloques de {c} en <b>turno rotativo</b> (hilo 0, 1, …, {T - 1}, 0, …), también fijado de antemano. Mezclar bloques ayuda cuando el costo crece con i.</>}
				{kind === 'dynamic,c' && <><b>dynamic, {c}</b>: cada hilo que termina <b>pide</b> el siguiente bloque. Se adapta a costos desiguales, pero cada pedido cuesta (<b>{ov.toFixed(2)}</b>): con chunk 1 y costos iguales puede ser más lento que static.</>}
				{kind === 'guided,c' && <><b>guided, {c}</b>: como dynamic, pero los bloques empiezan grandes (≈ restantes/hilos) y se achican hasta {c}. Menos pedidos que dynamic y buen balance al final.</>}
			</div>
		</div>
	);
}
