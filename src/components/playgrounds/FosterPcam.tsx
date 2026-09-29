import { useState } from 'react';
import PlayerControls, { usePlayer } from '../ui/Player';

type Aglo = 'filas' | 'bloques';

const STAGES = [
	{ t: 'Inicio', d: 'Problema: stencil de 5 puntos sobre una malla N×N (cada celda se actualiza con sus 4 vecinos).' },
	{ t: '① Particionar', d: 'Descomposición de dominio: una tarea primitiva por celda ⇒ N² tareas (≫ p, de igual tamaño, crecen con N).' },
	{ t: '② Comunicar', d: 'Cada tarea necesita a sus 4 vecinos: comunicación local y estructurada. Cada flecha es un canal (overhead que no existe en secuencial).' },
	{ t: '③ Aglomerar', d: 'Agrupamos tareas en p subdominios. Los canales internos desaparecen: solo quedan los que cruzan fronteras (la “superficie”).' },
	{ t: '④ Mapear', d: 'Un subdominio por proceso: carga balanceada (mismo nº de celdas) y vecinos físicos comunicándose poco.' },
];

export default function FosterPcam() {
	const [N, setN] = useState(8);
	const [p, setP] = useState(4);
	const [aglo, setAglo] = useState<Aglo>('bloques');
	const pl = usePlayer(4, 1600);
	const st = pl.k;

	// bloques 2D: q×r con q·r = p lo más cuadrado posible
	let q = Math.floor(Math.sqrt(p));
	while (p % q) q--;
	const r = p / q;
	const grid = aglo === 'filas' ? { gr: p, gc: 1 } : { gr: q, gc: r };
	const blockOf = (i: number, j: number) => {
		const bi = Math.min(grid.gr - 1, Math.floor((i * grid.gr) / N));
		const bj = Math.min(grid.gc - 1, Math.floor((j * grid.gc) / N));
		return bi * grid.gc + bj;
	};

	// canales entre celdas vecinas (no dirigidos)
	const edges: { a: [number, number]; b: [number, number]; cut: boolean }[] = [];
	for (let i = 0; i < N; i++)
		for (let j = 0; j < N; j++) {
			if (j + 1 < N) edges.push({ a: [i, j], b: [i, j + 1], cut: blockOf(i, j) !== blockOf(i, j + 1) });
			if (i + 1 < N) edges.push({ a: [i, j], b: [i + 1, j], cut: blockOf(i, j) !== blockOf(i + 1, j) });
		}
	const cut = edges.filter((e) => e.cut).length;
	const loads = Array.from({ length: p }, (_, k) => {
		let c = 0;
		for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (blockOf(i, j) === k) c++;
		return c;
	});

	const S = 300, pad = 14, cs = (S - 2 * pad) / N;
	const cx = (j: number) => pad + (j + 0.5) * cs;
	const cy = (i: number) => pad + (i + 0.5) * cs;
	const colors = ['var(--pg-c1)', 'var(--pg-c2)', 'var(--pg-c3)', 'var(--pg-c4)', 'var(--pg-c5)', 'var(--pg-c6)'];
	const col = (k: number) => colors[k % colors.length];

	return (
		<div className="pg not-content">
			<h4>Foster paso a paso: P → C → A → M</h4>
			<p className="pg-sub">Compara aglomerar por <b>franjas de filas</b> vs <b>bloques 2D</b>: mismo cómputo, distinta comunicación.</p>
			<div className="pg-row">
				<label className="pg-field"><span>malla N = <b>{N}</b></span><input type="range" min={4} max={16} step={2} value={N} onChange={(e) => setN(+e.target.value)} /></label>
				<label className="pg-field"><span>procesos p = <b>{p}</b></span><input type="range" min={2} max={6} value={p} onChange={(e) => setP(+e.target.value)} /></label>
				<div className="pg-seg">
					<button className={aglo === 'filas' ? 'active' : ''} onClick={() => setAglo('filas')}>Franjas de filas</button>
					<button className={aglo === 'bloques' ? 'active' : ''} onClick={() => setAglo('bloques')}>Bloques 2D ({q}×{r})</button>
				</div>
			</div>
			<PlayerControls pl={pl} label="etapa" />
			<div className="pg-grid-2" style={{ alignItems: 'center' }}>
				<svg viewBox={`0 0 ${S} ${S}`} style={{ maxWidth: 360, width: '100%' }}>
					{/* regiones de aglomeración */}
					{st >= 3 &&
						Array.from({ length: p }, (_, k) => {
							const bi = Math.floor(k / grid.gc), bj = k % grid.gc;
							const i0 = Math.ceil((bi * N) / grid.gr), i1 = Math.ceil(((bi + 1) * N) / grid.gr);
							const j0 = Math.ceil((bj * N) / grid.gc), j1 = Math.ceil(((bj + 1) * N) / grid.gc);
							return (
								<rect key={`${aglo}${k}`} className="pg-pulse" x={pad + j0 * cs + 1} y={pad + i0 * cs + 1} width={(j1 - j0) * cs - 2} height={(i1 - i0) * cs - 2} rx={8}
									fill={st >= 4 ? col(k) : 'transparent'} fillOpacity={0.16} stroke={st >= 4 ? col(k) : 'var(--sl-color-gray-3)'} strokeWidth={2} strokeDasharray={st >= 4 ? undefined : '5 4'} style={{ animationDelay: `${k * 0.08}s` }} />
							);
						})}
					{/* canales */}
					{st >= 2 &&
						edges.map((e, idx) => {
							const hidden = st >= 3 && !e.cut;
							return (
								<line key={idx} className="pg-anim" x1={cx(e.a[1])} y1={cy(e.a[0])} x2={cx(e.b[1])} y2={cy(e.b[0])}
									stroke={st >= 3 && e.cut ? 'var(--pg-c5)' : 'var(--pg-c2)'} strokeWidth={st >= 3 && e.cut ? 2.2 : 1.2} opacity={hidden ? 0.06 : 0.9} />
							);
						})}
					{/* tareas */}
					{Array.from({ length: N * N }, (_, idx) => {
						const i = Math.floor(idx / N), j = idx % N;
						return (
							<circle key={idx} className={st >= 1 ? 'pg-anim pg-pulse' : 'pg-anim'} cx={cx(j)} cy={cy(i)} r={st >= 1 ? Math.min(6, cs * 0.22) : cs * 0.42}
								fill={st >= 4 ? col(blockOf(i, j)) : st >= 1 ? 'var(--sl-color-white)' : 'var(--pg-surface-2)'}
								stroke="var(--pg-border)" style={{ animationDelay: st === 1 ? `${(i + j) * 0.02}s` : undefined }} />
						);
					})}
					{st >= 4 &&
						Array.from({ length: p }, (_, k) => {
							const bi = Math.floor(k / grid.gc), bj = k % grid.gc;
							const i0 = Math.ceil((bi * N) / grid.gr), i1 = Math.ceil(((bi + 1) * N) / grid.gr);
							const j0 = Math.ceil((bj * N) / grid.gc), j1 = Math.ceil(((bj + 1) * N) / grid.gc);
							return (
								<text key={`t${k}`} x={pad + ((j0 + j1) / 2) * cs} y={pad + ((i0 + i1) / 2) * cs + 5} textAnchor="middle" fontSize={16} fontWeight={800} style={{ fill: 'var(--sl-color-white)', paintOrder: 'stroke', stroke: 'var(--pg-surface)', strokeWidth: 4 }}>
									P{k}
								</text>
							);
						})}
				</svg>
				<div>
					<div key={st} className="pg-pulse" style={{ fontWeight: 700, fontSize: '1.05rem', transformOrigin: 'left' }}>{STAGES[st].t}</div>
					<div className="pg-sub" style={{ margin: '4px 0 10px' }}>{STAGES[st].d}</div>
					<div className="pg-stats" style={{ gridTemplateColumns: '1fr 1fr' }}>
						<div className="pg-stat"><span className="k">tareas</span><span className="v">{st >= 1 ? (st >= 3 ? p : N * N) : '—'}</span></div>
						<div className="pg-stat"><span className="k">canales</span><span className="v">{st >= 2 ? (st >= 3 ? cut : edges.length) : '—'}</span></div>
						<div className="pg-stat"><span className="k">carga por proceso</span><span className="v">{st >= 4 ? `${Math.min(...loads)}–${Math.max(...loads)}` : '—'}</span></div>
						<div className="pg-stat"><span className="k">frontera (filas / bloques)</span><span className="v">{(p - 1) * N} / {(q - 1) * N + (r - 1) * N}</span></div>
					</div>
				</div>
			</div>
			{st >= 3 && (
				<div className="pg-note">
					Franjas: cada frontera interna corta <b>N</b> canales ⇒ <b>(p−1)·N</b>; comunicación por proceso <b>O(N)</b> sin importar p.
					Bloques √p×√p: cada proceso tiene perímetro <b>≈ 4N/√p</b> ⇒ la comunicación por proceso <b>baja con p</b> (mejor razón superficie/volumen).
				</div>
			)}
		</div>
	);
}
