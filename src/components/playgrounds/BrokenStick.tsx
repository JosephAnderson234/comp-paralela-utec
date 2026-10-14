import { useMemo, useState } from 'react';

type Muestra = { u: number; v: number; tri: boolean; obt: boolean; hilo: number };

function rng(seed: number) {
	let s = seed >>> 0;
	return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function muestrear(N: number, T: number, seed: number): Muestra[] {
	const out: Muestra[] = [];
	const chunk = Math.ceil(N / T);
	for (let t = 0; t < T; t++) {
		const r = rng(seed ^ (1664525 * (t + 1) + 1013904223));
		for (let i = t * chunk; i < Math.min(N, (t + 1) * chunk); i++) {
			const u = r(), v = r();
			const x = Math.min(u, v), y = Math.max(u, v);
			const a = x, b = y - x, c = 1 - y;
			const smax = Math.max(a, b, c);
			const tri = smax < 0.5;
			let obt = false;
			if (tri) {
				const q1 = a * a, q2 = b * b, q3 = c * c;
				obt = 2 * Math.max(q1, q2, q3) > q1 + q2 + q3;
			}
			out.push({ u, v, tri, obt, hilo: t });
		}
	}
	return out;
}

const P_TRI = 0.25;
const P_OBT = 9 / 4 - 3 * Math.log(2);
const HCOL = ['var(--pg-c1)', 'var(--pg-c2)', 'var(--pg-c3)', 'var(--pg-c4)', 'var(--pg-c5)', 'var(--pg-c6)', 'var(--pg-c1)', 'var(--pg-c2)'];

export default function BrokenStick() {
	const [N, setN] = useState(2000);
	const [T, setT] = useState(4);
	const [seed, setSeed] = useState(42);
	const [i, setI] = useState(0);
	const [colorHilo, setColorHilo] = useState(false);
	const ms = useMemo(() => muestrear(N, T, seed), [N, T, seed]);
	const tri = ms.filter((m) => m.tri).length;
	const obt = ms.filter((m) => m.obt).length;
	const porHilo = Array.from({ length: T }, (_, t) => ({ tri: ms.filter((m) => m.hilo === t && m.tri).length, obt: ms.filter((m) => m.hilo === t && m.obt).length }));
	const m = ms[Math.min(i, ms.length - 1)];
	const x = Math.min(m.u, m.v), y = Math.max(m.u, m.v);
	const S = 220;
	const col = (mm: Muestra) => (colorHilo ? HCOL[mm.hilo] : !mm.tri ? 'var(--pg-muted)' : mm.obt ? 'var(--pg-c5)' : 'var(--pg-ok)');

	const lados = [x, y - x, 1 - y];
	const L = 260;
	return (
		<div className="pg not-content">
			<h4>Monte Carlo: el palo roto</h4>
			<p className="pg-sub">Se corta un palo de largo 1 en dos puntos al azar <code>u</code>, <code>v</code>. ¿Con los 3 trozos se forma un triángulo? ¿Es obtuso? Cada punto del cuadrado es un intento.</p>
			<div className="pg-row">
				<label className="pg-field"><span>muestras N = <b>{N.toLocaleString('es')}</b></span><input type="range" min={200} max={20000} step={200} value={N} onChange={(e) => { setN(+e.target.value); setI(0); }} /></label>
				<label className="pg-field"><span>hilos = <b>{T}</b></span><input type="range" min={1} max={8} value={T} onChange={(e) => setT(+e.target.value)} /></label>
				<button onClick={() => setSeed(seed + 1)}>🎲 Otra semilla</button>
				<label className="pg-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
					<input type="checkbox" checked={colorHilo} onChange={(e) => setColorHilo(e.target.checked)} /><span>colorear por hilo (<code>schedule(static)</code>)</span>
				</label>
			</div>
			<div className="pg-grid-2" style={{ alignItems: 'start' }}>
				<svg viewBox={`-24 -8 ${S + 32} ${S + 32}`} style={{ maxWidth: 300, width: '100%' }} role="img" aria-label="Muestras en el cuadrado unitario">
					<rect x={0} y={0} width={S} height={S} fill="var(--pg-surface-2)" stroke="var(--pg-border)" />
					{ms.slice(0, 4000).map((mm, k) => (
						<circle key={k} cx={mm.u * S} cy={(1 - mm.v) * S} r={1.4} fill={col(mm)} opacity={0.8} />
					))}
					<circle cx={m.u * S} cy={(1 - m.v) * S} r={5} fill="none" stroke="var(--pg-bad)" strokeWidth={2} />
					<text x={S / 2} y={S + 18} textAnchor="middle" fontSize={11}>u</text>
					<text x={-14} y={S / 2} textAnchor="middle" fontSize={11}>v</text>
				</svg>
				<div style={{ display: 'grid', gap: 8 }}>
					<label className="pg-field"><span>intento #{i + 1}: u = {m.u.toFixed(3)}, v = {m.v.toFixed(3)}</span><input type="range" min={0} max={ms.length - 1} value={Math.min(i, ms.length - 1)} onChange={(e) => setI(+e.target.value)} /></label>
					<svg viewBox={`0 0 ${L + 20} 40`} style={{ width: '100%' }} role="img" aria-label="Palo cortado">
						{lados.map((l, k) => {
							const x0 = 10 + L * (k === 0 ? 0 : k === 1 ? x : y);
							return (
								<g key={k}>
									<rect x={x0} y={8} width={Math.max(1, L * l - 2)} height={12} rx={3} fill={HCOL[k + 1]} />
									<text x={x0 + (L * l) / 2} y={34} textAnchor="middle" fontSize={10}>{l.toFixed(2)}</text>
								</g>
							);
						})}
					</svg>
					<div className={`pg-note ${m.tri ? (m.obt ? 'warn' : 'ok') : 'bad'}`} style={{ margin: 0 }}>
						lado mayor = {Math.max(...lados).toFixed(3)} {m.tri ? '< 0.5 ⇒ forma triángulo' : '≥ 0.5 ⇒ no forma triángulo'}
						{m.tri && <> · {m.obt ? 'obtuso (2·máx² > a²+b²+c²)' : 'acutángulo'}</>}
					</div>
					<div className="legend"><span><i style={{ background: 'var(--pg-muted)' }} />no triángulo</span><span><i style={{ background: 'var(--pg-ok)' }} />acutángulo</span><span><i style={{ background: 'var(--pg-c5)' }} />obtuso</span></div>
				</div>
			</div>
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">P(triángulo)</span><span className="v">{(tri / N).toFixed(4)}</span><span className="k">teoría 1/4</span></div>
				<div className="pg-stat"><span className="k">P(obtuso)</span><span className="v">{(obt / N).toFixed(4)}</span><span className="k">teoría 9/4 − 3 ln 2 ≈ {P_OBT.toFixed(4)}</span></div>
				<div className="pg-stat"><span className="k">P(obtuso | triángulo)</span><span className="v">{tri ? (obt / tri).toFixed(4) : '—'}</span><span className="k">teoría ≈ {(P_OBT / P_TRI).toFixed(4)}</span></div>
			</div>
			<div className="pg-scroll">
				<table style={{ fontSize: 12 }}>
					<thead><tr><th>hilo</th><th>tri_cnt privado</th><th>obt_cnt privado</th></tr></thead>
					<tbody>{porHilo.map((h, t) => <tr key={t}><td style={{ color: HCOL[t] }}>{t}</td><td>{h.tri}</td><td>{h.obt}</td></tr>)}</tbody>
				</table>
			</div>
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">con <code>atomic</code>: escrituras protegidas</span><span className="v" style={{ color: 'var(--pg-bad)' }}>{(tri + obt).toLocaleString('es')}</span><span className="k">una por cada ++tri_cnt / ++obt_cnt</span></div>
				<div className="pg-stat"><span className="k">con <code>reduction</code>: combinaciones</span><span className="v" style={{ color: 'var(--pg-ok)' }}>{2 * T}</span><span className="k">2 contadores × {T} hilos, al final</span></div>
			</div>
		</div>
	);
}
