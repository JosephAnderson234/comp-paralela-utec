import { useEffect, useMemo, useState } from 'react';
import { fmt } from '../ui/Chart';
import { TXT, useRaf } from '../ui/Player';

type CKind = 'for' | 'sections' | 'single' | 'master' | 'critical' | 'barrier';
type Construct = { kind: CKind; nowait: boolean };
type Seg = { t: number; a: number; b: number; type: 'work' | 'wait' | 'crit-wait' | 'skip'; label?: string };

const COL = ['var(--pg-c1)', 'var(--pg-c2)', 'var(--pg-c3)', 'var(--pg-c4)', 'var(--pg-c5)', 'var(--pg-c6)'];
const HAS_NOWAIT: Record<CKind, boolean> = { for: true, sections: true, single: true, master: false, critical: false, barrier: false };
const IMPLICIT: Record<CKind, string> = {
	for: 'barrera implícita al final (quítala con nowait)',
	sections: 'barrera implícita al final (quítala con nowait)',
	single: 'un hilo trabaja; los demás esperan al final (salvo nowait)',
	master: 'solo el hilo 0; los demás lo saltan SIN esperar',
	critical: 'de a un hilo por vez; no hay barrera al final',
	barrier: 'todos esperan al más lento',
};

const PRESETS: { name: string; prog: Construct[] }[] = [
	{ name: 'Libre', prog: [{ kind: 'for', nowait: false }, { kind: 'single', nowait: false }, { kind: 'for', nowait: false }] },
	{ name: 'U4.3: single con mensajes de avance', prog: [{ kind: 'single', nowait: false }, { kind: 'for', nowait: true }, { kind: 'single', nowait: false }, { kind: 'single', nowait: true }, { kind: 'for', nowait: false }] },
	{ name: 'Ejemp01_master: una vuelta del do-while', prog: [{ kind: 'for', nowait: false }, { kind: 'single', nowait: false }, { kind: 'for', nowait: false }, { kind: 'master', nowait: false }] },
	{ name: 'Ejemp05: contar ceros (for + critical)', prog: [{ kind: 'for', nowait: false }, { kind: 'critical', nowait: false }] },
	{ name: 'Ejemp03: sections nowait', prog: [{ kind: 'sections', nowait: true }] },
];

function simulate(prog: Construct[], T: number, seed: number) {
	let s = seed;
	const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
	const clock = new Array(T).fill(0);
	const segs: Seg[] = [];
	const barriers: { x: number; label: string }[] = [];
	const bar = (label: string) => {
		const m = Math.max(...clock);
		clock.forEach((c, t) => { if (m - c > 1e-9) segs.push({ t, a: c, b: m, type: 'wait' }); clock[t] = m; });
		barriers.push({ x: m, label });
	};
	prog.forEach((c, ci) => {
		const name = `${c.kind}${c.nowait ? ' nowait' : ''}`;
		if (c.kind === 'for') {
			clock.forEach((v, t) => { const w = 2 + 3 * r(); segs.push({ t, a: v, b: v + w, type: 'work', label: `for` }); clock[t] = v + w; });
			if (!c.nowait) bar(name);
		} else if (c.kind === 'sections') {
			const order = clock.map((v, t) => [v, t]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
			[0, 1].forEach((sec) => { const t = order[sec % T]; const w = 3 + 3 * r(); segs.push({ t, a: clock[t], b: clock[t] + w, type: 'work', label: `section ${sec + 1}` }); clock[t] += w; });
			if (!c.nowait) bar(name);
		} else if (c.kind === 'single') {
			const t0 = clock.indexOf(Math.min(...clock));
			const w = 1.5 + 2 * r();
			segs.push({ t: t0, a: clock[t0], b: clock[t0] + w, type: 'work', label: 'single' });
			clock[t0] += w;
			if (!c.nowait) bar(name);
		} else if (c.kind === 'master') {
			const w = 1 + 1.5 * r();
			segs.push({ t: 0, a: clock[0], b: clock[0] + w, type: 'work', label: 'master' });
			clock[0] += w;
		} else if (c.kind === 'critical') {
			let free = 0;
			const order = clock.map((v, t) => [v, t]).sort((a, b) => a[0] - b[0]);
			for (const [v, t] of order) {
				const st = Math.max(v, free);
				if (st - v > 1e-9) segs.push({ t, a: v, b: st, type: 'crit-wait' });
				const w = 0.8;
				segs.push({ t, a: st, b: st + w, type: 'work', label: 'critical' });
				clock[t] = st + w;
				free = st + w;
			}
		} else bar('barrier');
		void ci;
	});
	bar('fin de parallel');
	return { segs, barriers, end: Math.max(...clock) };
}

export default function OmpBarriers() {
	const [T, setT] = useState(4);
	const [preset, setPreset] = useState(0);
	const [prog, setProg] = useState<Construct[]>(PRESETS[0].prog);
	const [seed, setSeed] = useState(11);
	const [time, setTime] = useState(0);
	const [running, setRunning] = useState(false);
	const sim = useMemo(() => simulate(prog, T, seed), [prog, T, seed]);

	useEffect(() => { setTime(0); setRunning(false); }, [prog, T, seed]);
	useRaf(running, (dt) => setTime((x) => { const nx = x + dt * (sim.end / 4); if (nx >= sim.end) { setRunning(false); return sim.end; } return nx; }));

	const waitTotal = sim.segs.filter((g) => g.type !== 'work').reduce((a, g) => a + g.b - g.a, 0);
	const W = 660, left = 50, rowH = 28, top = 22;
	const H = top + T * rowH + 30;
	const sx = (v: number) => left + (v / sim.end) * (W - left - 10);
	const upd = (i: number, c: Construct) => { const p = [...prog]; p[i] = c; setProg(p); setPreset(0); };

	return (
		<div className="pg not-content">
			<h4>¿Quién espera a quién? Barreras implícitas</h4>
			<p className="pg-sub">Arma el cuerpo de un <code>#pragma omp parallel</code> y mira dónde se frenan los hilos. Rojo = esperando.</p>
			<div className="pg-row">
				<select value={preset} onChange={(e) => { setPreset(+e.target.value); setProg(PRESETS[+e.target.value].prog); }}>
					{PRESETS.map((p, i) => <option key={i} value={i}>{p.name}</option>)}
				</select>
				<label className="pg-field"><span>hilos = <b>{T}</b></span><input type="range" min={2} max={6} value={T} onChange={(e) => setT(+e.target.value)} /></label>
				<button onClick={() => setSeed(seed + 1)}>🎲 Otros tiempos</button>
				<button className="primary" onClick={() => { if (time >= sim.end) setTime(0); setRunning(!running); }}>{running ? `⏸${TXT} Pausa` : time >= sim.end ? '↻ Repetir' : `▶${TXT} Ejecutar`}</button>
			</div>
			<div className="pg-row" style={{ gap: 6 }}>
				{prog.map((c, i) => (
					<div key={i} className="pg-stat" style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '6px 8px' }}>
						<span style={{ color: 'var(--pg-muted)', fontSize: 11 }}>{i + 1}.</span>
						<select value={c.kind} onChange={(e) => upd(i, { kind: e.target.value as CKind, nowait: false })}>
							{(Object.keys(HAS_NOWAIT) as CKind[]).map((k) => <option key={k}>{k}</option>)}
						</select>
						{HAS_NOWAIT[c.kind] && (
							<label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12 }}>
								<input type="checkbox" checked={c.nowait} onChange={(e) => upd(i, { ...c, nowait: e.target.checked })} /> nowait
							</label>
						)}
						{prog.length > 1 && <button onClick={() => { setProg(prog.filter((_, k) => k !== i)); setPreset(0); }} aria-label="quitar">✕</button>}
					</div>
				))}
				{prog.length < 6 && <button onClick={() => { setProg([...prog, { kind: 'for', nowait: false }]); setPreset(0); }}>+ constructor</button>}
			</div>
			<div className="pg-scroll">
				<svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 520 }}>
					{Array.from({ length: T }, (_, t) => (
						<text key={t} x={4} y={top + t * rowH + 18} fontSize={11} fontWeight={700} style={{ fill: COL[t % COL.length] }}>hilo {t}</text>
					))}
					{sim.segs.map((g, i) => {
						const vis = Math.max(0, Math.min(g.b, time) - g.a);
						if (vis <= 0) return null;
						const x = sx(g.a), w = sx(g.a + vis) - x;
						const fill = g.type === 'work' ? COL[g.t % COL.length] : 'var(--pg-bad)';
						return (
							<g key={i}>
								<rect x={x} y={top + g.t * rowH + 5} width={Math.max(0, w - 1)} height={rowH - 10} rx={3} fill={fill} opacity={g.type === 'work' ? 0.9 : 0.25} />
								{g.label && w > 34 && <text x={x + 4} y={top + g.t * rowH + 18} fontSize={9} style={{ fill: 'var(--pg-surface)' }}>{g.label}</text>}
								{g.type === 'crit-wait' && w > 40 && <text x={x + 4} y={top + g.t * rowH + 18} fontSize={9} style={{ fill: 'var(--pg-bad)' }}>espera lock</text>}
							</g>
						);
					})}
					{sim.barriers.map((b, i) => b.x <= time + 1e-9 && (
						<g key={i} className="pg-pulse">
							<line x1={sx(b.x)} x2={sx(b.x)} y1={top - 4} y2={top + T * rowH} stroke="var(--pg-c3)" strokeWidth={2} />
							<text x={sx(b.x) - 3} y={top - 8} textAnchor="end" fontSize={9} style={{ fill: 'var(--pg-c3)' }}>{b.label}</text>
						</g>
					))}
					<line x1={sx(time)} x2={sx(time)} y1={top} y2={top + T * rowH} stroke="var(--sl-color-accent)" strokeWidth={1} />
				</svg>
			</div>
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">tiempo de la región</span><span className="v">{fmt(sim.end)}</span></div>
				<div className="pg-stat"><span className="k">tiempo perdido esperando (todos)</span><span className="v">{fmt(waitTotal)}</span></div>
				<div className="pg-stat"><span className="k">barreras</span><span className="v">{sim.barriers.length}</span></div>
			</div>
			<div className="pg-note">
				<ul style={{ margin: 0 }}>
					{[...new Set(prog.map((c) => c.kind))].map((k) => <li key={k}><code>{k}</code>: {IMPLICIT[k]}.</li>)}
					<li>El cierre de <code>parallel</code> siempre tiene barrera (es el <b>join</b>).</li>
				</ul>
			</div>
		</div>
	);
}
