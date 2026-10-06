import { useMemo, useState } from 'react';
import PlayerControls, { usePlayer } from '../ui/Player';

type Dep = 'in' | 'out' | null;
type Task = { name: string; code: string; dep: Dep; act: (x: number) => { x: number; print?: string } } | { name: 'taskwait'; code: string; dep: null; wait: true };
type Scenario = { name: string; init: number; tasks: Task[]; expl: string };

const SCEN: Scenario[] = [
	{
		name: 'out → in: imprime 2', init: 1,
		tasks: [
			{ name: 'T1', code: '#pragma omp task shared(x) depend(out: x)\nx = 2;', dep: 'out', act: () => ({ x: 2 }) },
			{ name: 'T2', code: '#pragma omp task shared(x) depend(in: x)\nprintf("x = %d", x);', dep: 'in', act: (x) => ({ x, print: `x = ${x}` }) },
		],
		expl: 'T2 lee x (in) y T1, creada antes, la escribe (out) ⇒ T2 debe esperar a T1. Siempre imprime x = 2.',
	},
	{
		name: 'in → out: imprime 1', init: 1,
		tasks: [
			{ name: 'T1', code: '#pragma omp task shared(x) depend(in: x)\nprintf("x = %d", x);', dep: 'in', act: (x) => ({ x, print: `x = ${x}` }) },
			{ name: 'T2', code: '#pragma omp task shared(x) depend(out: x)\nx = 2;', dep: 'out', act: () => ({ x: 2 }) },
		],
		expl: 'Ahora la lectura se creó primero: la escritura (out) debe esperar a que T1 lea. Siempre imprime x = 1.',
	},
	{
		name: 'out, out + taskwait: imprime 2', init: 0,
		tasks: [
			{ name: 'T1', code: '#pragma omp task shared(x) depend(out: x)\nx = 1;', dep: 'out', act: () => ({ x: 1 }) },
			{ name: 'T2', code: '#pragma omp task shared(x) depend(out: x)\nx = 2;', dep: 'out', act: () => ({ x: 2 }) },
			{ name: 'taskwait', code: '#pragma omp taskwait', dep: null, wait: true },
			{ name: 'P', code: 'printf("x = %d", x);', dep: null, act: (x) => ({ x, print: `x = ${x}` }) },
		],
		expl: 'Dos escrituras (out → out) se ordenan: T2 después de T1. taskwait espera a ambas antes del printf ⇒ x = 2.',
	},
	{
		name: 'out → dos in: orden libre', init: 1,
		tasks: [
			{ name: 'T1', code: '#pragma omp task shared(x) depend(out: x)\nx = 2;', dep: 'out', act: () => ({ x: 2 }) },
			{ name: 'T2', code: '#pragma omp task shared(x) depend(in: x)\nprintf("x + 1 = %d. ", x + 1);', dep: 'in', act: (x) => ({ x, print: `x + 1 = ${x + 1}.` }) },
			{ name: 'T3', code: '#pragma omp task shared(x) depend(in: x)\nprintf("x + 2 = %d", x + 2);', dep: 'in', act: (x) => ({ x, print: `x + 2 = ${x + 2}` }) },
		],
		expl: 'T2 y T3 dependen de T1, pero NO entre ellas (dos lecturas no chocan). Salen “x+1 = 3, x+2 = 4” o al revés, según qué hilo llegue primero.',
	},
	{
		name: 'sin depend: orden aleatorio', init: 0,
		tasks: [
			{ name: 't1', code: '#pragma omp task\nprintf("t1 desde el hilo %d", tid);', dep: null, act: (x) => ({ x, print: 't1' }) },
			{ name: 't2', code: '#pragma omp task\nprintf("t2 desde el hilo %d", tid);', dep: null, act: (x) => ({ x, print: 't2' }) },
			{ name: 't3', code: '#pragma omp task\nprintf("t3 desde el hilo %d", tid);', dep: null, act: (x) => ({ x, print: 't3' }) },
		],
		expl: 'Sin dependencias, las tareas se ejecutan en cualquier orden y en cualquier hilo libre: cambia en cada corrida.',
	},
];

function deps(tasks: Task[]): number[][] {
	return tasks.map((t, i) => {
		const pre: number[] = [];
		if ('wait' in t) return tasks.slice(0, i).map((_, j) => j);
		const prevWait = tasks.slice(0, i).map((u, j) => ('wait' in u ? j : -1)).filter((j) => j >= 0).pop();
		if (prevWait !== undefined) pre.push(prevWait);
		if (!t.dep) return pre;
		tasks.slice(0, i).forEach((u, j) => {
			if ('wait' in u || !u.dep) return;
			if (t.dep === 'out' || u.dep === 'out') pre.push(j);
		});
		return pre;
	});
}

function simulate(tasks: Task[], init: number, seed: number) {
	let s = seed;
	const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
	const pre = deps(tasks);
	const done = new Set<number>();
	const order: { i: number; thread: number; out?: string; x: number }[] = [];
	let x = init;
	while (done.size < tasks.length) {
		const ready = tasks.map((_, i) => i).filter((i) => !done.has(i) && pre[i].every((j) => done.has(j)));
		const i = ready[Math.floor(r() * ready.length)];
		const t = tasks[i];
		if ('wait' in t) { order.push({ i, thread: -1, x }); done.add(i); continue; }
		const res = t.act(x);
		x = res.x;
		order.push({ i, thread: Math.floor(r() * 2), out: res.print, x });
		done.add(i);
	}
	return { pre, order };
}

export default function OmpTasks() {
	const [sc, setSc] = useState(0);
	const [seed, setSeed] = useState(3);
	const S = SCEN[sc];
	const sim = useMemo(() => simulate(S.tasks, S.init, seed), [sc, seed]);
	const pl = usePlayer(sim.order.length, 1000);
	const k = pl.k;
	const doneSet = new Set(sim.order.slice(0, k).map((o) => o.i));
	const xNow = k ? sim.order[k - 1].x : S.init;
	const outputs = sim.order.slice(0, k).filter((o) => o.out);

	const n = S.tasks.length, W = 620, H = 150;
	const nx = (i: number) => 70 + (i * (W - 140)) / Math.max(1, n - 1);
	return (
		<div className="pg not-content">
			<h4>Tareas con dependencias: <code>task depend(in/out)</code></h4>
			<p className="pg-sub">Un hilo (dentro de <code>single</code>) crea las tareas en orden; luego cualquier hilo libre las ejecuta. Las flechas son esperas obligatorias.</p>
			<div className="pg-row">
				<select value={sc} onChange={(e) => { setSc(+e.target.value); pl.reset(); }}>
					{SCEN.map((x, i) => <option key={i} value={i}>{x.name}</option>)}
				</select>
				<button onClick={() => { setSeed(seed + 1); pl.reset(); }}>🎲 Otra ejecución</button>
			</div>
			<pre className="pg-code">{`int x = ${S.init};\n#pragma omp parallel\n#pragma omp single\n{\n${S.tasks.map((t) => t.code.split('\n').map((l) => '    ' + l).join('\n')).join('\n')}\n}`}</pre>
			<PlayerControls pl={pl} label="tarea" />
			<div className="pg-scroll">
				<svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 460 }}>
					<defs>
						<marker id="tdep" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--pg-c3)" /></marker>
					</defs>
					{sim.pre.map((ps, i) => ps.map((j) => (
						<path key={`${j}-${i}`} d={`M${nx(j) + 34},${60} C${(nx(j) + nx(i)) / 2},${10} ${(nx(j) + nx(i)) / 2},${10} ${nx(i) - 34},${60}`} fill="none" stroke="var(--pg-c3)" strokeWidth={1.6} markerEnd="url(#tdep)" />
					)))}
					{S.tasks.map((t, i) => {
						const d = doneSet.has(i);
						const isCur = k > 0 && sim.order[k - 1].i === i;
						const th = sim.order.find((o) => o.i === i)?.thread;
						return (
							<g key={i}>
								<rect className="pg-anim" x={nx(i) - 34} y={50} width={68} height={40} rx={8} fill={d ? 'color-mix(in srgb, var(--pg-ok) 20%, transparent)' : 'var(--sl-color-bg)'} stroke={isCur ? 'var(--pg-c2)' : d ? 'var(--pg-ok)' : 'var(--pg-border)'} strokeWidth={isCur ? 2.5 : 1.4} />
								<text x={nx(i)} y={68} textAnchor="middle" fontSize={11} fontWeight={700}>{t.name}</text>
								<text x={nx(i)} y={82} textAnchor="middle" fontSize={9} style={{ fill: 'var(--pg-muted)' }}>{'wait' in t ? 'espera todo' : t.dep ? `depend(${t.dep}: x)` : 'sin depend'}</text>
								{d && th !== undefined && th >= 0 && <text x={nx(i)} y={106} textAnchor="middle" fontSize={9} style={{ fill: 'var(--pg-c2)' }}>hilo {th}</text>}
							</g>
						);
					})}
					<text x={10} y={136} fontSize={12} fontWeight={700}>x = {xNow}</text>
				</svg>
			</div>
			<pre className="pg-code" style={{ minHeight: 40 }}>{outputs.length ? outputs.map((o) => o.out).join('\n') : '(salida vacía)'}</pre>
			{k === pl.total && <div className="pg-note ok">{S.expl}</div>}
		</div>
	);
}
