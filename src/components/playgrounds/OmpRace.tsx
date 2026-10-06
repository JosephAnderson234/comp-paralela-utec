import { useMemo, useState } from 'react';
import PlayerControls, { usePlayer } from '../ui/Player';

type Mode = 'nada' | 'critical' | 'atomic' | 'reduction';
type Op = { t: number; kind: 'LOAD' | 'ADD' | 'STORE' | 'ATOMIC' | 'LOCK' | 'UNLOCK' | 'WAIT' | 'COMBINE'; note?: string };

const COL = ['var(--pg-c1)', 'var(--pg-c2)', 'var(--pg-c3)', 'var(--pg-c4)'];

function rng(seed: number) {
	let s = seed >>> 0;
	return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** Genera un intercalado de micro-operaciones y lo ejecuta, registrando el estado tras cada paso. */
function run(T: number, K: number, mode: Mode, seed: number) {
	const r = rng(seed);
	const ops: Op[] = [];
	const states: { mem: number; reg: number[]; priv: number[]; lock: number; lost: boolean }[] = [];
	let mem = 0, lock = -1;
	const reg = new Array(T).fill(0), priv = new Array(T).fill(0);
	const done = new Array(T).fill(0); // incrementos completados
	const pc = new Array(T).fill(0); // micro-paso dentro del incremento actual
	let lostCount = 0;
	const push = (op: Op, lost = false) => { ops.push(op); states.push({ mem, reg: [...reg], priv: [...priv], lock, lost }); };

	const alive = () => [...Array(T).keys()].filter((t) => done[t] < K);
	let guard = 0;
	while (alive().length && guard++ < 2000) {
		const cand = alive();
		let t = cand[Math.floor(r() * cand.length)];
		// con candado tomado, casi siempre avanza quien lo tiene (si no, la tabla se llena de esperas)
		if (mode === 'critical' && lock !== -1 && r() < 0.75) t = lock;
		if (mode === 'reduction') {
			priv[t]++; done[t]++;
			push({ t, kind: 'ADD', note: `cnt_priv[${t}]++` });
			continue;
		}
		if (mode === 'atomic') {
			mem++; done[t]++;
			push({ t, kind: 'ATOMIC', note: 'atomic: cnt++ indivisible' });
			continue;
		}
		if (mode === 'critical') {
			if (pc[t] === 0) {
				if (lock !== -1 && lock !== t) { push({ t, kind: 'WAIT', note: `espera: hilo ${lock} está dentro` }); continue; }
				lock = t; pc[t] = 1; push({ t, kind: 'LOCK', note: 'entra a critical' }); continue;
			}
		}
		const step = mode === 'critical' ? pc[t] - 1 : pc[t];
		if (step === 0) { reg[t] = mem; pc[t]++; push({ t, kind: 'LOAD', note: `reg ← cnt (${mem})` }); }
		else if (step === 1) { reg[t]++; pc[t]++; push({ t, kind: 'ADD', note: `reg ← reg+1 (${reg[t]})` }); }
		else {
			const lost = reg[t] <= mem; // pisa un incremento ajeno
			if (lost) lostCount++;
			mem = reg[t]; done[t]++; pc[t] = 0;
			if (mode === 'critical') { push({ t, kind: 'STORE', note: `cnt ← ${mem}` }); lock = -1; push({ t, kind: 'UNLOCK', note: 'sale de critical' }); }
			else push({ t, kind: 'STORE', note: lost ? `cnt ← ${mem}  ✖ pisa otro incremento` : `cnt ← ${mem}` }, lost);
		}
	}
	if (mode === 'reduction') {
		for (let t = 0; t < T; t++) { mem += priv[t]; push({ t, kind: 'COMBINE', note: `cnt += cnt_priv[${t}] (${priv[t]})` }); }
	}
	return { ops, states, final: mem, lost: lostCount };
}

export default function OmpRace() {
	const [T, setT] = useState(2);
	const [K, setK] = useState(3);
	const [mode, setMode] = useState<Mode>('nada');
	const [seed, setSeed] = useState(5);
	const res = useMemo(() => run(T, K, mode, seed), [T, K, mode, seed]);
	const pl = usePlayer(res.ops.length, 700);
	const k = pl.k;
	const st = k ? res.states[k - 1] : { mem: 0, reg: new Array(T).fill(0), priv: new Array(T).fill(0), lock: -1, lost: false };
	const cur = k ? res.ops[k - 1] : null;
	const steps = res.ops.length;

	const code: Record<Mode, string> = {
		nada: '#pragma omp parallel for\nfor (i = 0; i < n; i++)\n    cnt++;            // LOAD, ADD, STORE: ¡3 pasos!',
		critical: '#pragma omp parallel for\nfor (i = 0; i < n; i++) {\n    #pragma omp critical\n    cnt++;            // de a un hilo por vez\n}',
		atomic: '#pragma omp parallel for\nfor (i = 0; i < n; i++) {\n    #pragma omp atomic\n    cnt++;            // una sola instrucción indivisible\n}',
		reduction: '#pragma omp parallel for reduction(+:cnt)\nfor (i = 0; i < n; i++)\n    cnt++;            // cada hilo su copia, se suman al final',
	};

	return (
		<div className="pg not-content">
			<h4>Condición de carrera en <code>cnt++</code></h4>
			<p className="pg-sub"><code>cnt++</code> parece una sola cosa, pero la CPU hace 3: <b>leer</b> cnt a un registro, <b>sumar</b> 1, <b>escribir</b> de vuelta. Si dos hilos se intercalan, un incremento se pierde.</p>
			<div className="pg-row">
				<div className="pg-seg">
					{(['nada', 'critical', 'atomic', 'reduction'] as Mode[]).map((m) => (
						<button key={m} className={mode === m ? 'active' : ''} onClick={() => { setMode(m); pl.reset(); }}>{m === 'nada' ? 'sin protección' : m}</button>
					))}
				</div>
				<label className="pg-field"><span>hilos = <b>{T}</b></span><input type="range" min={2} max={4} value={T} onChange={(e) => { setT(+e.target.value); pl.reset(); }} /></label>
				<label className="pg-field"><span>incrementos por hilo = <b>{K}</b></span><input type="range" min={1} max={5} value={K} onChange={(e) => { setK(+e.target.value); pl.reset(); }} /></label>
				<button onClick={() => { setSeed(seed + 1); pl.reset(); }}>🎲 Otro intercalado</button>
			</div>
			<pre className="pg-code">{code[mode]}</pre>
			<PlayerControls pl={pl} label="micro-paso" />
			<div className="pg-grid-2" style={{ alignItems: 'start' }}>
				<div style={{ display: 'grid', gap: 6 }}>
					<div className="pg-stat" style={{ textAlign: 'center', borderColor: st.lost ? 'var(--pg-bad)' : undefined }}>
						<span className="k">memoria compartida: cnt</span>
						<span key={k} className="v pg-pulse" style={{ fontSize: '1.6rem', color: st.lost ? 'var(--pg-bad)' : undefined }}>{st.mem}</span>
						{mode === 'critical' && <span className="k">candado: {st.lock === -1 ? 'libre' : `hilo ${st.lock}`}</span>}
					</div>
					<div style={{ display: 'grid', gridTemplateColumns: `repeat(${T}, 1fr)`, gap: 6 }}>
						{Array.from({ length: T }, (_, t) => (
							<div key={t} className="pg-stat" style={{ borderColor: cur?.t === t ? COL[t] : undefined, borderWidth: cur?.t === t ? 2 : undefined, borderStyle: 'solid' }}>
								<span className="k" style={{ color: COL[t] }}>hilo {t}</span>
								<span className="v" style={{ fontSize: '1rem' }}>{mode === 'reduction' ? `cnt_priv = ${st.priv[t]}` : mode === 'atomic' ? '—' : `reg = ${st.reg[t]}`}</span>
							</div>
						))}
					</div>
					{cur && <div className={`pg-note ${st.lost ? 'bad' : ''}`} style={{ margin: 0 }}><b style={{ color: COL[cur.t] }}>hilo {cur.t}</b> · {cur.kind}: {cur.note}</div>}
				</div>
				<div className="pg-scroll" style={{ maxHeight: 260 }}>
					<table style={{ fontSize: 11 }}>
						<thead><tr><th>#</th><th>hilo</th><th>op</th><th>cnt</th></tr></thead>
						<tbody>
							{res.ops.slice(0, k).map((o, i) => {
								const bad = res.states[i].lost;
								const cell = bad ? { background: 'color-mix(in srgb, var(--pg-bad) 22%, transparent)', color: 'var(--pg-bad)', fontWeight: 700 } : undefined;
								return (
									<tr key={i}>
										<td style={cell}>{i + 1}</td><td style={{ ...cell, color: bad ? 'var(--pg-bad)' : COL[o.t] }}>{o.t}</td><td style={cell}>{o.kind}{bad ? ' ✖' : ''}</td><td style={cell}>{res.states[i].mem}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">esperado</span><span className="v">{T * K}</span></div>
				<div className="pg-stat"><span className="k">resultado</span><span className="v" style={{ color: res.final === T * K ? 'var(--pg-ok)' : 'var(--pg-bad)' }}>{k === steps ? res.final : '…'}</span></div>
				<div className="pg-stat"><span className="k">incrementos perdidos</span><span className="v">{k === steps ? T * K - res.final : '…'}</span></div>
				<div className="pg-stat"><span className="k">micro-pasos</span><span className="v">{steps}</span></div>
			</div>
			<div className={`pg-note ${mode === 'nada' ? 'warn' : 'ok'}`}>
				{mode === 'nada' && <>Sin protección el resultado <b>cambia entre corridas</b> (prueba otro intercalado). Medido con 4 hilos y 10⁶ incrementos: salió <b>250 087</b>, <b>359 273</b> y <b>250 328</b> en vez de 1 000 000.</>}
				{mode === 'critical' && <>Correcto, pero los hilos hacen <b>fila</b> en el candado: el bucle queda casi secuencial. Medido: <b>0.056 s</b> para 10⁶ incrementos.</>}
				{mode === 'atomic' && <>Correcto y más barato que critical: es un <b>mini-critical</b> hecho por hardware, solo para <b>una</b> instrucción simple (<code>x++</code>, <code>x += expr</code>…).</>}
				{mode === 'reduction' && <>Correcto y casi sin contención: cada hilo suma en <b>su copia privada</b> y OpenMP las combina una sola vez al final. Medido: <b>0.0002 s</b>, unas 200× más rápido que critical.</>}
			</div>
		</div>
	);
}
