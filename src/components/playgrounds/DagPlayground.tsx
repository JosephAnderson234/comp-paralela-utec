import { useMemo, useState } from 'react';
import { fmt } from '../ui/Chart';
import Tex from '../ui/Tex';

type Node = { id: string; w: number; cx?: string; x?: number; y?: number; note?: string };
type Edge = { from: string; to: string; kind?: 'raw' | 'war' };
type Dag = { nodes: Node[]; edges: Edge[]; fixedLayout?: boolean; p0?: number; comment?: string };

const lg = (n: number) => Math.log2(Math.max(n, 2));

// ---------- DAGs del curso ----------
function dag18(): Dag {
	// U1.3 apuntes, Ejemplo 01 (coordenadas transcritas de la figura)
	const pos: Record<string, [number, number]> = {
		T1: [280, 208], T2: [282, 248], T3: [185, 282], T4: [135, 318], T5: [135, 398], T6: [230, 318],
		T7: [197, 355], T8: [197, 398], T9: [263, 355], T10: [263, 398], T11: [197, 440], T12: [275, 462],
		T13: [398, 300], T14: [356, 355], T15: [356, 425], T16: [443, 355], T17: [443, 398], T18: [356, 490],
	};
	const E = 'T1-T2 T2-T3 T2-T13 T3-T4 T3-T6 T4-T5 T6-T7 T6-T9 T7-T8 T9-T10 T5-T11 T8-T11 T10-T11 T11-T12 T12-T18 T13-T14 T13-T16 T14-T15 T15-T18 T16-T17 T17-T18';
	return {
		nodes: Object.entries(pos).map(([id, [x, y]]) => ({ id, w: 1, cx: 'O(1)', x: (x - 100) * 1.55 + 40, y: (y - 195) * 1.55 + 20 })),
		edges: E.split(' ').map((e) => {
			const [from, to] = e.split('-');
			return { from, to };
		}),
		fixedLayout: true,
		comment: 'Resultado de las notas: W = 18, T∞ = 9 (camino T1→T2→T3→T6→T7→T8→T11→T12→T18).',
	};
}

function dagFib(n: number): Dag {
	// U1.3 apuntes, Ejemplo 2: cada llamada no trivial = nodo "fork" f(k) + nodo "join" (+)
	const nodes: Node[] = [];
	const edges: Edge[] = [];
	let c = 0;
	const build = (k: number): { entry: string; exit: string } => {
		const id = `f(${k})#${c++}`;
		nodes.push({ id, w: 1, cx: 'O(1)', note: `f(${k})` });
		if (k <= 1) return { entry: id, exit: id };
		const a = build(k - 1);
		const b = build(k - 2);
		const j = `+#${c++}`;
		nodes.push({ id: j, w: 1, cx: 'O(1)', note: '+' });
		edges.push({ from: id, to: a.entry }, { from: id, to: b.entry }, { from: a.exit, to: j }, { from: b.exit, to: j });
		return { entry: id, exit: j };
	};
	build(n);
	return {
		nodes,
		edges,
		comment: `Recurrencias de las notas: W(n)=W(n−1)+W(n−2)+1, T∞(n)=max(T∞(n−1),T∞(n−2))+1. El DAG dibujado separa cada llamada en "fork" + "join" (como la figura de f(3)), por eso cuenta más nodos; el orden asintótico es el mismo.`,
	};
}

function dagReduccion(n: number, p: number): Dag {
	// U1.3 apuntes, Ejemplo 3: suma de n=16 con p procesadores (a lo más p sumas por paso)
	type V = { id: string | null; lvl: number };
	let vals: V[] = Array.from({ length: n }, () => ({ id: null, lvl: 0 }));
	const nodes: Node[] = [];
	const edges: Edge[] = [];
	let step = 0;
	while (vals.length > 1) {
		step++;
		vals.sort((a, b) => b.lvl - a.lvl);
		const k = Math.min(p, Math.floor(vals.length / 2));
		const next: V[] = [];
		for (let i = 0; i < k; i++) {
			const a = vals[2 * i], b = vals[2 * i + 1];
			const id = `s${step}.${i + 1}`;
			nodes.push({ id, w: 1, cx: 'O(1)', note: '+' });
			if (a.id) edges.push({ from: a.id, to: id });
			if (b.id) edges.push({ from: b.id, to: id });
			next.push({ id, lvl: step });
		}
		vals = next.concat(vals.slice(2 * k));
	}
	return {
		nodes,
		edges,
		p0: p,
		comment: `Construido con a lo más p=${p} sumas por paso. Notas: p=8 → T∞=4, S=15/4, E=0.47; p=5 → T∞=5, S=15/5, E=0.60 (menor speedup, mayor eficiencia).`,
	};
}

function dagEj4(n: number, hetero: boolean): Dag {
	// U1.3, Ejemplo 4: T1(a,&v) T2(b,&w) T3(b,&v) T4(c,&w) T5(c,&v) T6(a,&w) (leen y modifican ambos args)
	const c = hetero
		? { T1: ['O(n)', n], T2: ['O(n)', n], T3: ['O(n log n)', n * lg(n)], T4: ['O(log n)', lg(n)], T5: ['O(n)', n], T6: ['O(n²)', n * n] }
		: { T1: ['O(1)', 1], T2: ['O(1)', 1], T3: ['O(1)', 1], T4: ['O(1)', 1], T5: ['O(1)', 1], T6: ['O(1)', 1] };
	const args: Record<string, string> = { T1: 'a,v', T2: 'b,w', T3: 'b,v', T4: 'c,w', T5: 'c,v', T6: 'a,w' };
	return {
		nodes: Object.entries(c).map(([id, [cx, w]]) => ({ id, w: w as number, cx: cx as string, note: args[id] })),
		edges: 'T1-T3 T2-T3 T2-T4 T3-T5 T4-T5 T1-T6 T4-T6'.split(' ').map((e) => {
			const [from, to] = e.split('-');
			return { from, to };
		}),
		comment: hetero
			? 'Con complejidades heterogéneas el camino crítico lo decide T6 = O(n²): T∞ = O(n²) y W = O(n²) ⇒ S = O(1).'
			: 'Cada arista une dos tareas que comparten (y modifican) una variable, en orden del programa.',
	};
}

function dagPD01(n: number, war: boolean): Dag {
	// CS4052-PD01-S02, Ejercicio 2
	const t: [string, string, number, string][] = [
		['T1', '10n', 10 * n, 'T1(&a,&b)'],
		['T2', '2n', 2 * n, 'c=T2(a)'],
		['T3', '5n', 5 * n, 'c=T3(c)'],
		['T4', '9n²', 9 * n * n, 'd=T4(b)'],
		['T5', '9n²', 9 * n * n, 'e=T5(c)'],
		['T6', '11n', 11 * n, 'f=T6(c)'],
		['T7', '8n', 8 * n, 'b=T7(c)'],
	];
	const edges: Edge[] = 'T1-T2 T2-T3 T1-T4 T3-T5 T3-T6 T3-T7'.split(' ').map((e) => {
		const [from, to] = e.split('-');
		return { from, to };
	});
	if (war) edges.push({ from: 'T4', to: 'T7', kind: 'war' });
	return {
		nodes: t.map(([id, cx, w, note]) => ({ id, w, cx: cx + ' FLOP', note })),
		edges,
		comment: war
			? 'T7 sobrescribe b, que T4 lee: dependencia de anti-flujo (WAR, línea punteada). Con ella: Ts = 18n²+36n, T∞ = 9n²+18n ⇒ S = 2 exacto.'
			: 'Sin la arista WAR (p. ej. renombrando b en T7): T∞ = 10n+2n+5n+9n² = 9n²+17n.',
	};
}

function dagSistema(n: number): Dag {
	// 2025-II PD02 S01, Ejercicio 3
	return {
		nodes: [
			{ id: 'ini', w: 2 * n * n, cx: '2n²', note: 'ini(A,B)' },
			{ id: 't1', w: n * n, cx: 'O(n²)', note: 'a=tarea_1(A)' },
			{ id: 't2', w: n * n, cx: 'O(n²)', note: 'b=tarea_2(B)' },
			{ id: 's1', w: n, cx: 'O(n)', note: 's1=suma_prefijos1(B,a)' },
			{ id: 's2', w: n, cx: 'O(n)', note: 's2=suma_prefijos2(B,a,b)' },
			{ id: 'z', w: 1, cx: 'O(1)', note: 'z=s1+s2' },
		],
		edges: 'ini-t1 ini-t2 t1-s1 t1-s2 t2-s2 s1-z s2-z'.split(' ').map((e) => {
			const [from, to] = e.split('-');
			return { from, to };
		}),
		comment: 'Solución oficial: grado máximo de concurrencia 2; Ts = Tp = O(n²), S = O(1), E = O(1/p) (E = 0.5 con p = 2).',
	};
}

function dagOpArr(n: number): Dag {
	// 2025-II PD02 S02, Ejercicio 3
	return {
		nodes: [
			{ id: 'pref', w: n, cx: 'O(n)', note: 'suma_de_prefijos(A)' },
			{ id: 'qs', w: n * lg(n), cx: 'O(n log n)', note: 'quicksort(B)' },
			{ id: 'scan', w: n, cx: 'O(n)', note: 'scan_left(C+x)' },
			{ id: 't4', w: n * n, cx: 'O(n²)', note: 'tarea 4 (A,B→A,s1)' },
			{ id: 't5', w: n * n, cx: 'O(n²)', note: 'tarea 5 (B,C→C,s2)' },
			{ id: 'fin', w: n, cx: 'O(n)', note: 'a=s1/s2; res+=a·C[i]' },
		],
		edges: 'pref-t4 qs-t4 qs-t5 scan-t5 t4-fin t5-fin'.split(' ').map((e) => {
			const [from, to] = e.split('-');
			return { from, to };
		}),
		comment: 'Solución oficial: pref || quicksort || scan (concurrencia 3), luego tarea4 || tarea5. Ts = O(3n + n log n + 2n²), S = O(1), E = O(1/p).',
	};
}

function parseCustom(edgesTxt: string, weightsTxt: string): Dag {
	const nodes = new Map<string, Node>();
	const edges: Edge[] = [];
	const add = (id: string) => {
		if (!nodes.has(id)) nodes.set(id, { id, w: 1, cx: '1' });
	};
	for (const tok of edgesTxt.split(/[,\n;]+/)) {
		const parts = tok.split(/->|→/).map((s) => s.trim()).filter(Boolean);
		parts.forEach(add);
		for (let i = 0; i + 1 < parts.length; i++) edges.push({ from: parts[i], to: parts[i + 1] });
	}
	for (const tok of weightsTxt.split(/[,\n;]+/)) {
		const [id, w] = tok.split('=').map((s) => s.trim());
		if (id && w && !isNaN(+w)) {
			add(id);
			const nd = nodes.get(id)!;
			nd.w = +w;
			nd.cx = w;
		}
	}
	return { nodes: [...nodes.values()], edges };
}

// ---------- Análisis ----------
function analyze(d: Dag) {
	const ids = d.nodes.map((n) => n.id);
	const w = new Map(d.nodes.map((n) => [n.id, n.w]));
	const succ = new Map(ids.map((i) => [i, [] as string[]]));
	const pred = new Map(ids.map((i) => [i, [] as string[]]));
	for (const e of d.edges) {
		if (!succ.has(e.from) || !succ.has(e.to)) continue;
		succ.get(e.from)!.push(e.to);
		pred.get(e.to)!.push(e.from);
	}
	// orden topológico (Kahn)
	const indeg = new Map(ids.map((i) => [i, pred.get(i)!.length]));
	const q = ids.filter((i) => indeg.get(i) === 0);
	const topo: string[] = [];
	while (q.length) {
		const u = q.shift()!;
		topo.push(u);
		for (const v of succ.get(u)!) {
			indeg.set(v, indeg.get(v)! - 1);
			if (indeg.get(v) === 0) q.push(v);
		}
	}
	const cyclic = topo.length !== ids.length;
	// camino más largo (ponderado) y nivel ASAP (conteo de aristas)
	const dist = new Map<string, number>();
	const from = new Map<string, string | null>();
	const lvl = new Map<string, number>();
	for (const u of topo) {
		let best = 0, arg: string | null = null, L = 0;
		for (const p of pred.get(u)!) {
			if (dist.get(p)! > best) {
				best = dist.get(p)!;
				arg = p;
			}
			L = Math.max(L, lvl.get(p)! + 1);
		}
		dist.set(u, best + w.get(u)!);
		from.set(u, arg);
		lvl.set(u, L);
	}
	let end = topo[0];
	for (const u of topo) if (dist.get(u)! > dist.get(end)!) end = u;
	const crit = new Set<string>();
	const critEdges = new Set<string>();
	for (let u: string | null = end; u; u = from.get(u) ?? null) {
		crit.add(u);
		const f = from.get(u);
		if (f) critEdges.add(f + '|' + u);
	}
	const span = cyclic ? NaN : dist.get(end) ?? 0;
	const work = d.nodes.reduce((s, n) => s + n.w, 0);
	const widths = new Map<number, number>();
	for (const u of topo) widths.set(lvl.get(u)!, (widths.get(lvl.get(u)!) ?? 0) + 1);
	const maxWidth = Math.max(0, ...widths.values());
	// bottom level (prioridad para list scheduling)
	const bl = new Map<string, number>();
	for (const u of [...topo].reverse()) bl.set(u, w.get(u)! + Math.max(0, ...succ.get(u)!.map((v) => bl.get(v)!)));
	return { topo, succ, pred, crit, critEdges, span, work, lvl, maxWidth, bl, cyclic, depthLevels: widths.size };
}

// list scheduling greedy (prioridad: camino más largo restante)
function schedule(d: Dag, a: ReturnType<typeof analyze>, p: number) {
	const w = new Map(d.nodes.map((n) => [n.id, n.w]));
	const remainingPred = new Map(d.nodes.map((n) => [n.id, a.pred.get(n.id)!.length]));
	let ready = d.nodes.filter((n) => remainingPred.get(n.id) === 0).map((n) => n.id);
	const procFree = Array(p).fill(0);
	const readyAt = new Map<string, number>(ready.map((r) => [r, 0]));
	const slots: { id: string; proc: number; s: number; e: number }[] = [];
	const running: { id: string; e: number }[] = [];
	let t = 0;
	let done = 0;
	const N = d.nodes.length;
	let guard = 0;
	while (done < N && guard++ < 100000) {
		ready.sort((x, y) => a.bl.get(y)! - a.bl.get(x)!);
		for (let pi = 0; pi < p && ready.length; pi++) {
			if (procFree[pi] <= t) {
				const id = ready.shift()!;
				const e = t + w.get(id)!;
				slots.push({ id, proc: pi, s: t, e });
				procFree[pi] = e;
				running.push({ id, e });
			}
		}
		// avanzar al próximo fin
		running.sort((x, y) => x.e - y.e);
		const nxt = running.shift();
		if (!nxt) break;
		t = nxt.e;
		const finished = [nxt, ...running.filter((r) => r.e === t)];
		for (const f of finished) {
			if (f !== nxt) running.splice(running.indexOf(f), 1);
			done++;
			for (const v of a.succ.get(f.id)!) {
				remainingPred.set(v, remainingPred.get(v)! - 1);
				if (remainingPred.get(v) === 0) {
					ready.push(v);
					readyAt.set(v, t);
				}
			}
		}
	}
	const Tp = Math.max(0, ...slots.map((s) => s.e));
	return { slots, Tp };
}

// ---------- Layout ----------
function layout(d: Dag, a: ReturnType<typeof analyze>) {
	if (d.fixedLayout) return { pos: new Map(d.nodes.map((n) => [n.id, [n.x!, n.y!] as [number, number]])), H: 520 };
	const levels = new Map<number, string[]>();
	for (const u of a.topo) {
		const L = a.lvl.get(u)!;
		if (!levels.has(L)) levels.set(L, []);
		levels.get(L)!.push(u);
	}
	const pos = new Map<string, [number, number]>();
	const nL = levels.size;
	const gap = Math.min(70, 440 / Math.max(1, nL - 1));
	[...levels.keys()].sort((x, y) => x - y).forEach((L) => {
		let row = levels.get(L)!;
		if (L > 0) {
			const bary = (u: string) => {
				const ps = a.pred.get(u)!.map((p) => pos.get(p)?.[0] ?? 320);
				return ps.length ? ps.reduce((s, v) => s + v, 0) / ps.length : 320;
			};
			row = [...row].sort((x, y) => bary(x) - bary(y));
		}
		row.forEach((u, i) => pos.set(u, [((i + 1) * 640) / (row.length + 1), 30 + L * gap]));
	});
	return { pos, H: 60 + (nL - 1) * gap };
}

const PRESETS = {
	ej18: 'U1.3 Ej.1 — DAG de 18 tareas O(1)',
	fib: 'U1.3 Ej.2 — Fibonacci f(n)',
	red: 'U1.3 Ej.3 — Suma de 16 (reducción)',
	ej4: 'U1.3 Ej.4 — T1…T6 con variables compartidas',
	pd01: 'PD01 Ej.2 — T1…T7 en FLOP',
	sis: 'PD02 2025-II S01 Ej.3 — sistema()',
	oparr: 'PD02 2025-II S02 Ej.3 — OpArr()',
	custom: 'Personalizado (edítalo tú)',
} as const;
type PresetKey = keyof typeof PRESETS;

export default function DagPlayground({ initial = 'ej18' }: { initial?: PresetKey }) {
	const [preset, setPreset] = useState<PresetKey>(initial);
	const [n, setN] = useState(64);
	const [fibN, setFibN] = useState(4);
	const [redP, setRedP] = useState(8);
	const [hetero, setHetero] = useState(false);
	const [war, setWar] = useState(true);
	const [p, setP] = useState(2);
	const [edgesTxt, setEdgesTxt] = useState('A->B, A->C, B->D, C->D, D->E, C->E');
	const [weightsTxt, setWeightsTxt] = useState('A=1, B=3, C=1, D=2, E=1');

	const dag = useMemo<Dag>(() => {
		switch (preset) {
			case 'ej18': return dag18();
			case 'fib': return dagFib(fibN);
			case 'red': return dagReduccion(16, redP);
			case 'ej4': return dagEj4(n, hetero);
			case 'pd01': return dagPD01(n, war);
			case 'sis': return dagSistema(n);
			case 'oparr': return dagOpArr(n);
			default: return parseCustom(edgesTxt, weightsTxt);
		}
	}, [preset, n, fibN, redP, hetero, war, edgesTxt, weightsTxt]);

	const a = useMemo(() => analyze(dag), [dag]);
	const { pos, H } = useMemo(() => layout(dag, a), [dag, a]);
	const sched = useMemo(() => (a.cyclic ? null : schedule(dag, a, p)), [dag, a, p]);
	const usesN = ['ej4', 'pd01', 'sis', 'oparr'].includes(preset);
	const unit = dag.nodes.every((x) => x.w === 1);
	const r = unit ? 17 : 22;

	const brentUpper = Math.floor(a.work / p) + a.span;
	const lower = Math.max(a.work / p, a.span);

	return (
		<div className="pg not-content">
			<h4>DAG: trabajo, span y camino crítico</h4>
			<p className="pg-sub">
				W = suma de costos de todos los nodos · T∞ = camino más costoso (en <b>tiempo</b>, no en número de nodos) · resaltado en naranja.
			</p>
			<div className="pg-row">
				<label className="pg-field" style={{ flex: '2 1 18rem' }}>
					<span>DAG</span>
					<select value={preset} onChange={(e) => setPreset(e.target.value as PresetKey)}>
						{Object.entries(PRESETS).map(([k, v]) => (
							<option key={k} value={k}>
								{v}
							</option>
						))}
					</select>
				</label>
				{preset === 'fib' && (
					<label className="pg-field">
						<span>n = <b>{fibN}</b></span>
						<input type="range" min={2} max={6} value={fibN} onChange={(e) => setFibN(+e.target.value)} />
					</label>
				)}
				{preset === 'red' && (
					<div className="pg-seg">
						{[8, 5, 4, 2].map((v) => (
							<button key={v} className={redP === v ? 'active' : ''} onClick={() => { setRedP(v); setP(v); }}>
								construir con p={v}
							</button>
						))}
					</div>
				)}
				{usesN && (
					<label className="pg-field">
						<span>n = <b>{n}</b></span>
						<input type="range" min={4} max={512} step={4} value={n} onChange={(e) => setN(+e.target.value)} />
					</label>
				)}
				{preset === 'ej4' && (
					<label style={{ margin: 0 }}>
						<input type="checkbox" checked={hetero} onChange={(e) => setHetero(e.target.checked)} /> complejidades reales (O(n), O(n log n), O(n²)…)
					</label>
				)}
				{preset === 'pd01' && (
					<label style={{ margin: 0 }}>
						<input type="checkbox" checked={war} onChange={(e) => setWar(e.target.checked)} /> incluir dependencia WAR T4→T7 (b)
					</label>
				)}
			</div>
			{preset === 'custom' && (
				<div className="pg-grid-2">
					<label className="pg-field">
						<span>Aristas (A-&gt;B, separadas por coma o salto de línea; admite cadenas A-&gt;B-&gt;C)</span>
						<textarea rows={3} value={edgesTxt} onChange={(e) => setEdgesTxt(e.target.value)} style={{ font: 'inherit', background: 'var(--sl-color-bg)', color: 'var(--sl-color-white)', border: '1px solid var(--pg-border)', borderRadius: 6, padding: 6 }} />
					</label>
					<label className="pg-field">
						<span>Costos (A=3; por defecto 1)</span>
						<textarea rows={3} value={weightsTxt} onChange={(e) => setWeightsTxt(e.target.value)} style={{ font: 'inherit', background: 'var(--sl-color-bg)', color: 'var(--sl-color-white)', border: '1px solid var(--pg-border)', borderRadius: 6, padding: 6 }} />
					</label>
				</div>
			)}
			{a.cyclic && <div className="pg-note bad">El grafo tiene un ciclo: no es un DAG (no existe orden topológico).</div>}

			<div className="pg-scroll">
				<svg viewBox={`0 0 640 ${H}`} style={{ minWidth: 480 }}>
					<defs>
						<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
							<path d="M0,0 L10,5 L0,10 z" fill="var(--sl-color-gray-3)" />
						</marker>
						<marker id="arrC" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
							<path d="M0,0 L10,5 L0,10 z" fill="var(--pg-c2)" />
						</marker>
					</defs>
					{dag.edges.map((e, i) => {
						const A = pos.get(e.from), B = pos.get(e.to);
						if (!A || !B) return null;
						const dx = B[0] - A[0], dy = B[1] - A[1];
						const L = Math.hypot(dx, dy) || 1;
						const c = a.critEdges.has(e.from + '|' + e.to);
						return (
							<line
								key={i}
								x1={A[0] + (dx / L) * r}
								y1={A[1] + (dy / L) * r}
								x2={B[0] - (dx / L) * (r + 2)}
								y2={B[1] - (dy / L) * (r + 2)}
								stroke={c ? 'var(--pg-c2)' : 'var(--sl-color-gray-3)'}
								strokeWidth={c ? 2.6 : 1.4}
								strokeDasharray={e.kind === 'war' ? '5 4' : undefined}
								markerEnd={c ? 'url(#arrC)' : 'url(#arr)'}
							/>
						);
					})}
					{dag.nodes.map((nd) => {
						const P = pos.get(nd.id);
						if (!P) return null;
						const c = a.crit.has(nd.id);
						const label = nd.note && preset !== 'ej4' && preset !== 'pd01' && preset !== 'sis' && preset !== 'oparr' ? nd.note : nd.id;
						return (
							<g key={nd.id}>
								<title>{`${nd.id}${nd.note ? ' · ' + nd.note : ''} · costo ${nd.cx ?? nd.w}`}</title>
								<circle cx={P[0]} cy={P[1]} r={r} fill={c ? 'color-mix(in srgb, var(--pg-c2) 30%, var(--sl-color-bg))' : 'var(--sl-color-bg)'} stroke={c ? 'var(--pg-c2)' : 'var(--sl-color-gray-3)'} strokeWidth={c ? 2.4 : 1.4} />
								<text x={P[0]} y={P[1] + (unit ? 4 : 0)} textAnchor="middle" fontSize={label.length > 5 ? 9 : 11} fontWeight={600} style={{ fill: 'var(--sl-color-white)' }}>
									{label}
								</text>
								{!unit && (
									<text x={P[0]} y={P[1] + 12} textAnchor="middle" fontSize={8.5}>
										{nd.cx}
									</text>
								)}
							</g>
						);
					})}
				</svg>
			</div>

			<div className="pg-stats">
				<div className="pg-stat"><span className="k">Trabajo W = T_s</span><span className="v">{fmt(a.work, 6)}</span></div>
				<div className="pg-stat"><span className="k">Span T∞</span><span className="v">{fmt(a.span, 6)}</span></div>
				<div className="pg-stat"><span className="k">Paralelismo W/T∞ = S máx</span><span className="v">{fmt(a.work / a.span)}</span></div>
				<div className="pg-stat"><span className="k">Concurrencia máx. (ancho)</span><span className="v">{a.maxWidth}</span></div>
			</div>
			{dag.comment && <div className="pg-note">{dag.comment}</div>}

			<div className="pg-row">
				<label className="pg-field">
					<span>Procesadores p = <b>{p}</b></span>
					<input type="range" min={1} max={16} value={p} onChange={(e) => setP(+e.target.value)} />
				</label>
			</div>
			{sched && (
				<>
					<div className="pg-stats">
						<div className="pg-stat"><span className="k">Cota inferior max(W/p, T∞)</span><span className="v">{fmt(lower, 5)}</span></div>
						<div className="pg-stat"><span className="k">Brent ⌊W/p⌋ + T∞</span><span className="v">{fmt(brentUpper, 5)}</span></div>
						<div className="pg-stat"><span className="k">T_p (greedy, simulado)</span><span className="v">{fmt(sched.Tp, 5)}</span></div>
						<div className="pg-stat"><span className="k">S = W/T_p</span><span className="v">{fmt(a.work / sched.Tp)}</span></div>
						<div className="pg-stat"><span className="k">E = S/p</span><span className="v">{fmt(a.work / sched.Tp / p)}</span></div>
					</div>
					<Gantt slots={sched.slots} p={p} Tp={sched.Tp} crit={a.crit} />
					<div className="pg-note">
						<Tex>{String.raw`\max\!\left(\tfrac{W}{p},T_\infty\right)\;\le\;T_p\;\le\;\left\lfloor\tfrac{W}{p}\right\rfloor+T_\infty`}</Tex> — el schedule greedy (prioriza el camino más largo restante) siempre cae entre ambas cotas.
					</div>
				</>
			)}
		</div>
	);
}

function Gantt({ slots, p, Tp, crit }: { slots: { id: string; proc: number; s: number; e: number }[]; p: number; Tp: number; crit: Set<string> }) {
	const W = 640, rowH = 20, left = 40;
	const H = p * rowH + 24;
	const sx = (t: number) => left + (t / (Tp || 1)) * (W - left - 10);
	return (
		<div className="pg-scroll">
			<svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 480 }}>
				{Array.from({ length: p }, (_, i) => (
					<text key={i} x={4} y={i * rowH + 14} fontSize={10}>
						P{i}
					</text>
				))}
				{slots.map((s, i) => (
					<g key={i}>
						<title>{`${s.id}: [${fmt(s.s, 5)}, ${fmt(s.e, 5)}]`}</title>
						<rect x={sx(s.s)} y={s.proc * rowH + 2} width={Math.max(1, sx(s.e) - sx(s.s) - 1)} height={rowH - 4} rx={3} fill={crit.has(s.id) ? 'var(--pg-c2)' : 'var(--pg-c1)'} opacity={0.85} />
						{sx(s.e) - sx(s.s) > 26 && (
							<text x={sx(s.s) + 3} y={s.proc * rowH + 14} fontSize={9} style={{ fill: '#111' }}>
								{s.id.split('#')[0]}
							</text>
						)}
					</g>
				))}
				<text x={W - 10} y={H - 4} fontSize={10} textAnchor="end">
					t = {fmt(Tp, 5)}
				</text>
			</svg>
		</div>
	);
}
