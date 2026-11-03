import { useMemo, useState } from 'react';
import PlayerControls, { usePlayer } from '../ui/Player';

type N = { id: number; n: string; p: number; d: number; sol?: boolean; h: number[] };

/** Árbol de la participación 9 (U5.3, lámina 34): 36 nodos, 35 aristas. */
function construir(): N[] {
	const t: N[] = [];
	const add = (n: string, p: number, sol = false) => {
		const id = t.length;
		t.push({ id, n, p, d: p < 0 ? 0 : t[p].d + 1, sol, h: [] });
		if (p >= 0) t[p].h.push(id);
		return id;
	};
	const hojas = (p: number, k: number) => {
		for (let i = 0; i < k; i++) add('', p);
	};
	const R = add('R', -1);
	const A = add('A', R), B = add('B', R), C = add('C', R);
	const a1 = add('a1', A), a2 = add('a2', A);
	const x1 = add('', a1), x2 = add('', a1), x3 = add('', a1);
	hojas(x1, 2); add('s1', x2, true); hojas(x3, 2);
	const y1 = add('', a2), y2 = add('', a2);
	hojas(y1, 1); hojas(y2, 1);
	const b1 = add('b1', B), b2 = add('b2', B);
	const z1 = add('', b1);
	hojas(z1, 1); add('s2', b1, true);
	const w1 = add('', b2), w2 = add('', b2);
	hojas(w1, 1); hojas(w2, 2);
	const c1 = add('c1', C);
	add('s3', C, true);
	for (let i = 0; i < 3; i++) hojas(add('', c1), 1);
	return t;
}

const T = construir();
const id = (n: string) => T.find((x) => x.n === n)!.id;

/** Aristas (identificadas por el nodo hijo) en orden DFS, limitado a profundidad `max`. */
function dfs(v: number, max = 99): number[] {
	const out: number[] = [];
	const go = (u: number) => {
		for (const h of T[u].h) {
			if (T[h].d > max) continue;
			out.push(h);
			go(h);
		}
	};
	go(v);
	return out;
}

type Proc = { nombre: string; tareas: { desde: number; aristas: number[]; que: string }[] };
type Modo = { clave: string; titulo: string; p: number; procs: Proc[]; nota: string };

const MODOS: Modo[] = [
	{
		clave: 'seq',
		titulo: 'Secuencial (DFS)',
		p: 1,
		procs: [{ nombre: 'P0', tareas: [{ desde: 1, aristas: dfs(id('R')), que: 'todo el árbol' }] }],
		nota: 'Un solo proceso recorre las 35 aristas de izquierda a derecha. Encuentra s1 en el paso 7, s2 en el 20 y s3 en el 35 (es el último nodo del recorrido).',
	},
	{
		clave: 'pws',
		titulo: 'PWS (m = 1, 2, 3)',
		p: 3,
		procs: [
			{ nombre: 'P0 · umbral m=1', tareas: [{ desde: 1, aristas: dfs(id('R'), 1), que: 'profundidad ≤ 1' }] },
			{ nombre: 'P1 · umbral m=2', tareas: [{ desde: 1, aristas: dfs(id('R'), 2), que: 'profundidad ≤ 2' }] },
			{ nombre: 'P2 · umbral m=3', tareas: [{ desde: 1, aristas: dfs(id('R'), 4), que: 'árbol completo' }] },
		],
		nota: 'Los tres procesos parten de la raíz con una copia del árbol. P0 y P1 repiten trabajo que P2 también hace (aristas con borde rojo). Hay TASKWAIT: el tiempo lo fija P2, que tarda lo mismo que el secuencial.',
	},
	{
		clave: 'dts1',
		titulo: 'DTS (corte en m = 1)',
		p: 3,
		procs: [
			{ nombre: 'P0', tareas: [{ desde: 1, aristas: [id('A'), id('B'), id('C')], que: 'expande R (secuencial)' }, { desde: 4, aristas: dfs(id('A')), que: 'subárbol A' }] },
			{ nombre: 'P1', tareas: [{ desde: 4, aristas: dfs(id('B')), que: 'subárbol B' }] },
			{ nombre: 'P2', tareas: [{ desde: 4, aristas: dfs(id('C')), que: 'subárbol C' }] },
		],
		nota: 'P0 genera la frontera A, B, C (3 pasos secuenciales) y cada proceso busca un subárbol. Termina cuando acaba el más grande (A, 14 aristas): 3 + 14 = 17.',
	},
	{
		clave: 'dts2',
		titulo: 'DTS (cortes en m = 1 y m = 2)',
		p: 6,
		procs: [
			{ nombre: 'P0', tareas: [{ desde: 1, aristas: [id('A'), id('B'), id('C')], que: 'expande R' }, { desde: 4, aristas: [id('a1'), id('a2')], que: 'expande A' }, { desde: 6, aristas: dfs(id('a1')), que: 'subárbol a1' }] },
			{ nombre: 'P1', tareas: [{ desde: 4, aristas: [id('b1'), id('b2')], que: 'expande B' }, { desde: 6, aristas: dfs(id('a2')), que: 'subárbol a2' }] },
			{ nombre: 'P2', tareas: [{ desde: 4, aristas: [id('c1'), id('s3')], que: 'expande C' }, { desde: 6, aristas: dfs(id('b1')), que: 'subárbol b1' }] },
			{ nombre: 'P3', tareas: [{ desde: 6, aristas: dfs(id('b2')), que: 'subárbol b2' }] },
			{ nombre: 'P4', tareas: [{ desde: 6, aristas: dfs(id('c1')), que: 'subárbol c1' }] },
			{ nombre: 'P5', tareas: [] },
		],
		nota: 'Dos momentos de partición (3 + 2 pasos) y 6 búsquedas locales. Manda el subárbol a1 (8 aristas): 5 + 8 = 13. P5 recibe directamente s3 y no tiene nada que buscar.',
	},
];

const COL = ['var(--pg-c1)', 'var(--pg-c2)', 'var(--pg-c3)', 'var(--pg-c4)', 'var(--pg-c5)', 'var(--pg-c6)'];
const TS = 35;

/** Coordenadas: hojas en orden DFS, padres al centro de sus hijos. */
function layout() {
	const pos: { x: number; y: number }[] = [];
	let hoja = 0;
	const go = (u: number): number => {
		const n = T[u];
		let x: number;
		if (n.h.length === 0) x = 30 + 44 * hoja++;
		else {
			const xs = n.h.map(go);
			x = (xs[0] + xs[xs.length - 1]) / 2;
		}
		pos[u] = { x, y: 26 + n.d * 62 };
		return x;
	};
	go(0);
	return pos;
}
const POS = layout();
const W = Math.max(...POS.map((p) => p.x)) + 40;

export default function BusquedaArbol() {
	const [m, setM] = useState(3);
	const modo = MODOS[m];

	/** eventos[t] = lista de (proceso, arista) que ocurren en el paso t. */
	const { eventos, Tp } = useMemo(() => {
		const ev: { p: number; e: number }[][] = [];
		let fin = 0;
		modo.procs.forEach((pr, pi) =>
			pr.tareas.forEach((ta) =>
				ta.aristas.forEach((e, i) => {
					const t = ta.desde + i;
					(ev[t] ??= []).push({ p: pi, e });
					fin = Math.max(fin, t);
				}),
			),
		);
		return { eventos: ev, Tp: fin };
	}, [modo]);

	const pl = usePlayer(Tp, 700);
	const k = pl.k;

	const primero = new Map<number, number>();
	const veces = new Map<number, number>();
	const encontrada = new Map<string, { t: number; p: number }>();
	const ahora = new Map<number, number>();
	let trabajo = 0;
	for (let t = 1; t <= k; t++)
		for (const { p, e } of eventos[t] ?? []) {
			trabajo++;
			if (!primero.has(e)) primero.set(e, p);
			veces.set(e, (veces.get(e) ?? 0) + 1);
			if (T[e].sol && !encontrada.has(T[e].n)) encontrada.set(T[e].n, { t, p });
			if (t === k) ahora.set(e, p);
		}
	const distintas = primero.size;
	const S = TS / Tp;
	const E = S / modo.p;

	const ocupado = (pi: number, t: number) => (eventos[t] ?? []).some((x) => x.p === pi);

	return (
		<div className="pg not-content">
			<h4>Búsqueda en el árbol de la participación 9: secuencial, PWS y DTS</h4>
			<p className="pg-sub">
				Un <b>paso</b> = recorrer una arista. Cada color es un proceso. Dale Play y mira quién trabaja en cada paso, dónde aparece cada solución y cuándo termina el último proceso.
			</p>
			<div className="pg-row">
				<div className="pg-seg" role="group" aria-label="Algoritmo">
					{MODOS.map((x, i) => (
						<button key={x.clave} className={i === m ? 'active' : ''} onClick={() => { setM(i); pl.reset(); }}>
							{x.titulo}
						</button>
					))}
				</div>
			</div>
			<PlayerControls pl={pl} />
			<div style={{ overflowX: 'auto' }}>
				<svg viewBox={`0 0 ${W} 300`} style={{ width: '100%', minWidth: 540 }} role="img" aria-label={`Árbol de búsqueda recorrido con ${modo.titulo}`}>
					{[1, 2, 4].map((d, i) => (
						<g key={d}>
							<line x1={6} x2={W - 44} y1={26 + d * 62} y2={26 + d * 62} stroke="var(--pg-bad)" strokeDasharray="4 4" opacity={0.45} />
							<text x={W - 4} y={26 + d * 62 + 4} fill="var(--pg-bad)" fontSize={11} textAnchor="end">m = {i + 1}</text>
						</g>
					))}
					{T.slice(1).map((n) => {
						const a = POS[n.p];
						const b = POS[n.id];
						const pr = primero.get(n.id);
						const red = (veces.get(n.id) ?? 0) > 1;
						return (
							<g key={n.id}>
								{red && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--pg-bad)" strokeWidth={8} opacity={0.35} />}
								<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={pr === undefined ? 'var(--sl-color-gray-5)' : COL[pr]} strokeWidth={pr === undefined ? 1.4 : 3.2} />
							</g>
						);
					})}
					{T.map((n) => {
						const q = POS[n.id];
						const ya = n.id === 0 || primero.has(n.id);
						const act = ahora.get(n.id);
						return (
							<g key={n.id}>
								{act !== undefined && <circle cx={q.x} cy={q.y} r={17} fill="none" stroke={COL[act]} strokeWidth={3} className="pg-pulse" />}
								<circle cx={q.x} cy={q.y} r={n.sol ? 13 : 11} fill={n.sol ? (encontrada.has(n.n) ? 'var(--pg-ok)' : 'color-mix(in srgb, var(--pg-c1) 45%, var(--pg-surface))') : ya ? 'var(--pg-surface-2)' : 'var(--pg-surface)'} stroke={ya ? 'var(--sl-color-gray-2)' : 'var(--sl-color-gray-4)'} strokeWidth={1.4} />
								{n.n && <text x={q.x} y={q.y + 4} fontSize={n.sol ? 11 : 10} fontWeight={700} textAnchor="middle" fill="var(--sl-color-white)">{n.n}</text>}
							</g>
						);
					})}
				</svg>
			</div>
			<div style={{ overflowX: 'auto' }}>
				<svg viewBox={`0 0 ${110 + TS * 15 + 10} ${16 + modo.procs.length * 20}`} style={{ width: '100%', minWidth: 540 }} role="img" aria-label="Diagrama de Gantt: pasos en que trabaja cada proceso">
					{Array.from({ length: TS }, (_, i) => (
						<text key={i} x={110 + i * 15 + 7} y={11} fontSize={8} textAnchor="middle" fill="var(--pg-muted)">{(i + 1) % 5 === 0 ? i + 1 : ''}</text>
					))}
					{modo.procs.map((pr, pi) => (
						<g key={pi}>
							<text x={104} y={16 + pi * 20 + 13} fontSize={11} textAnchor="end" fill={COL[pi]} fontWeight={700}>{pr.nombre}</text>
							{Array.from({ length: TS }, (_, i) => {
								const t = i + 1;
								const oc = ocupado(pi, t);
								return <rect key={i} x={110 + i * 15} y={16 + pi * 20} width={13} height={16} rx={2} fill={oc ? COL[pi] : 'transparent'} stroke="var(--pg-border)" opacity={oc ? (t <= k ? 1 : 0.22) : 1} />;
							})}
						</g>
					))}
					{k > 0 && <line x1={110 + k * 15 - 1} x2={110 + k * 15 - 1} y1={12} y2={16 + modo.procs.length * 20} stroke="var(--sl-color-white)" strokeWidth={1.5} />}
				</svg>
			</div>
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">T<sub>p</sub> (último proceso)</span><span className="v">{Tp} pasos</span></div>
				<div className="pg-stat"><span className="k">Trabajo hasta ahora</span><span className="v">{trabajo} aristas</span></div>
				<div className="pg-stat"><span className="k">Redundante</span><span className="v" style={{ color: trabajo - distintas ? 'var(--pg-bad)' : undefined }}>{trabajo - distintas}</span></div>
				<div className="pg-stat"><span className="k">S = 35 / T<sub>p</sub></span><span className="v">{S.toFixed(2)}</span></div>
				<div className="pg-stat"><span className="k">E = S / p (p = {modo.p})</span><span className="v">{E.toFixed(2)}</span></div>
			</div>
			<div className="pg-stats">
				{['s1', 's2', 's3'].map((s) => {
					const f = encontrada.get(s);
					return (
						<div className="pg-stat" key={s}>
							<span className="k">{s}</span>
							<span className="v" style={{ color: f ? 'var(--pg-ok)' : 'var(--pg-muted)' }}>{f ? `paso ${f.t} · ${modo.procs[f.p].nombre.split(' ')[0]}` : 'aún no'}</span>
						</div>
					);
				})}
			</div>
			<div className="pg-note">{modo.nota}</div>
		</div>
	);
}
