import { useMemo, useState } from 'react';
import Tex from '../ui/Tex';

// Algoritmo no recursivo de 04_PRAM §7.1 (Jájá): up-sweep B(h,j), down-sweep C(h,j)
type Cell = { arr: 'A' | 'B' | 'C'; h: number; j: number };
type Op = { proc: number; write: Cell; reads: Cell[]; expr: string };
type Step = { title: string; phase: 'init' | 'up' | 'down'; ops: Op[] };

const OPS: Record<string, { sym: string; f: (a: number, b: number) => number }> = {
	'+': { sym: '+', f: (a, b) => a + b },
	max: { sym: 'max', f: (a, b) => Math.max(a, b) },
	'×': { sym: '×', f: (a, b) => a * b },
};

function buildSteps(n: number): Step[] {
	const k = Math.log2(n);
	const steps: Step[] = [];
	steps.push({
		title: 'Paso 1: B(0,j) ← A(j)',
		phase: 'init',
		ops: Array.from({ length: n }, (_, i) => ({ proc: i + 1, write: { arr: 'B', h: 0, j: i + 1 }, reads: [{ arr: 'A', h: 0, j: i + 1 }], expr: `B(0,${i + 1}) ← A(${i + 1})` })),
	});
	for (let h = 1; h <= k; h++) {
		steps.push({
			title: `Paso 2 (up-sweep), h=${h}: B(h,j) ← B(h−1,2j−1) ∗ B(h−1,2j)`,
			phase: 'up',
			ops: Array.from({ length: n / 2 ** h }, (_, i) => {
				const j = i + 1;
				return {
					proc: j,
					write: { arr: 'B', h, j },
					reads: [{ arr: 'B', h: h - 1, j: 2 * j - 1 }, { arr: 'B', h: h - 1, j: 2 * j }],
					expr: `B(${h},${j}) ← B(${h - 1},${2 * j - 1}) ∗ B(${h - 1},${2 * j})`,
				};
			}),
		});
	}
	for (let h = k; h >= 0; h--) {
		steps.push({
			title: `Paso 3 (down-sweep), h=${h}: C(h,j)`,
			phase: 'down',
			ops: Array.from({ length: n / 2 ** h }, (_, i) => {
				const j = i + 1;
				if (j === 1) return { proc: j, write: { arr: 'C', h, j }, reads: [{ arr: 'B', h, j: 1 }], expr: `C(${h},1) ← B(${h},1)` };
				if (j % 2 === 0) return { proc: j, write: { arr: 'C', h, j }, reads: [{ arr: 'C', h: h + 1, j: j / 2 }], expr: `C(${h},${j}) ← C(${h + 1},${j / 2})` };
				return {
					proc: j,
					write: { arr: 'C', h, j },
					reads: [{ arr: 'C', h: h + 1, j: (j - 1) / 2 }, { arr: 'B', h, j }],
					expr: `C(${h},${j}) ← C(${h + 1},${(j - 1) / 2}) ∗ B(${h},${j})`,
				};
			}),
		});
	}
	return steps;
}

const key = (c: Cell) => `${c.arr}${c.h},${c.j}`;

export default function PrefixSumStepper() {
	const [input, setInput] = useState('3 1 7 0 4 1 6 3');
	const [opName, setOpName] = useState<keyof typeof OPS>('+');
	const [step, setStep] = useState(0);

	const A = useMemo(() => {
		const v = input.split(/[\s,;]+/).filter(Boolean).map(Number).filter((x) => !isNaN(x));
		let n = 1;
		while (n * 2 <= Math.min(v.length, 16)) n *= 2;
		return v.slice(0, Math.max(2, n));
	}, [input]);
	const n = A.length;
	const k = Math.log2(n);
	const steps = useMemo(() => buildSteps(n), [n]);
	const s = Math.min(step, steps.length);

	// estado de memoria tras ejecutar los primeros s pasos
	const mem = useMemo(() => {
		const m = new Map<string, number>();
		A.forEach((v, i) => m.set(key({ arr: 'A', h: 0, j: i + 1 }), v));
		const f = OPS[opName].f;
		for (let t = 0; t < s; t++) {
			const results = steps[t].ops.map((o) => {
				const vals = o.reads.map((r) => m.get(key(r))!);
				return [key(o.write), vals.length === 1 ? vals[0] : f(vals[0], vals[1])] as const;
			});
			results.forEach(([kk, v]) => m.set(kk, v)); // escritura síncrona (PRAM)
		}
		return m;
	}, [A, s, steps, opName]);

	const cur = s > 0 ? steps[s - 1] : null;
	const readCount = new Map<string, number>();
	const writeSet = new Map<string, number>();
	cur?.ops.forEach((o) => {
		o.reads.forEach((r) => readCount.set(key(r), (readCount.get(key(r)) ?? 0) + 1));
		writeSet.set(key(o.write), o.proc);
	});
	const concurrentReads = [...readCount.entries()].filter(([, c]) => c > 1);
	const model = !cur ? '—' : concurrentReads.length ? 'CREW (lectura concurrente)' : 'EREW';
	const workSoFar = steps.slice(0, s).reduce((acc, st) => acc + st.ops.length, 0);
	const totalWork = steps.reduce((acc, st) => acc + st.ops.length, 0);

	const expected = useMemo(() => {
		const f = OPS[opName].f;
		const out: number[] = [];
		A.forEach((v, i) => out.push(i === 0 ? v : f(out[i - 1], v)));
		return out;
	}, [A, opName]);

	const W = 640;
	const levelY = (h: number) => 36 + (k - h) * 64;
	const cellX = (h: number, j: number) => {
		const width = W / (n / 2 ** h);
		return (j - 0.5) * width;
	};
	const H = levelY(0) + 70;

	const cellBox = (h: number, j: number) => {
		const bKey = key({ arr: 'B', h, j });
		const cKey = key({ arr: 'C', h, j });
		const x = cellX(h, j);
		const y = levelY(h);
		const bw = Math.min(64, W / (n / 2 ** h) - 8);
		const role = (kk: string) => (writeSet.has(kk) ? 'w' : readCount.has(kk) ? (readCount.get(kk)! > 1 ? 'rr' : 'r') : '');
		const color = (r: string) => (r === 'w' ? 'var(--pg-c2)' : r === 'rr' ? 'var(--pg-c5)' : r === 'r' ? 'var(--pg-c1)' : 'var(--pg-border)');
		const rb = role(bKey), rc = role(cKey);
		return (
			<g key={`${h}-${j}`}>
				<rect x={x - bw / 2} y={y - 16} width={bw} height={18} rx={4} fill="var(--sl-color-bg)" stroke={color(rb)} strokeWidth={rb ? 2.5 : 1} />
				<text x={x} y={y - 3} textAnchor="middle" fontSize={11}>
					<tspan style={{ fill: 'var(--pg-muted)' }}>B </tspan>
					<tspan fontWeight={700} style={{ fill: 'var(--sl-color-white)' }}>{mem.has(bKey) ? mem.get(bKey) : '·'}</tspan>
				</text>
				<rect x={x - bw / 2} y={y + 4} width={bw} height={18} rx={4} fill="var(--sl-color-bg)" stroke={color(rc)} strokeWidth={rc ? 2.5 : 1} />
				<text x={x} y={y + 17} textAnchor="middle" fontSize={11}>
					<tspan style={{ fill: 'var(--pg-muted)' }}>C </tspan>
					<tspan fontWeight={700} style={{ fill: 'var(--pg-c4)' }}>{mem.has(cKey) ? mem.get(cKey) : '·'}</tspan>
				</text>
				{writeSet.has(bKey) || writeSet.has(cKey) ? (
					<text x={x + bw / 2 + 2} y={y - 18} fontSize={9} style={{ fill: 'var(--pg-c2)' }}>
						P{writeSet.get(bKey) ?? writeSet.get(cKey)}
					</text>
				) : null}
			</g>
		);
	};

	return (
		<div className="pg">
			<h4>Suma de prefijos paso a paso (up-sweep / down-sweep)</h4>
			<p className="pg-sub">Algoritmo no recursivo del PRAM visto en clase. Cada nodo del árbol guarda B (up-sweep) y C (down-sweep, el prefijo).</p>
			<div className="pg-row">
				<label className="pg-field" style={{ flex: '3 1 16rem' }}>
					<span>Array A (se usa la mayor potencia de 2 ≤ 16)</span>
					<input type="text" value={input} onChange={(e) => { setInput(e.target.value); setStep(0); }} />
				</label>
				<div className="pg-seg">
					{Object.keys(OPS).map((o) => (
						<button key={o} className={opName === o ? 'active' : ''} onClick={() => setOpName(o as keyof typeof OPS)}>
							∗ = {o}
						</button>
					))}
				</div>
			</div>
			<div className="pg-row">
				<button onClick={() => setStep(0)}>⏮ Inicio</button>
				<button onClick={() => setStep(Math.max(0, s - 1))} disabled={s === 0}>◀ Atrás</button>
				<button className="primary" onClick={() => setStep(Math.min(steps.length, s + 1))} disabled={s === steps.length}>
					Paso ▶
				</button>
				<button onClick={() => setStep(steps.length)}>Fin ⏭</button>
				<span style={{ color: 'var(--pg-muted)' }}>
					paso {s}/{steps.length} · n = {n}, log n = {k}
				</span>
			</div>
			<div className="pg-note">{cur ? cur.title : 'Estado inicial: solo A está en memoria. Pulsa «Paso».'}</div>

			<div className="pg-scroll">
				<svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 520 }}>
					{Array.from({ length: k + 1 }, (_, h) => (
						<text key={h} x={2} y={levelY(h) - 24} fontSize={10}>
							h={h}
						</text>
					))}
					{Array.from({ length: k }, (_, i) => i + 1).flatMap((h) =>
						Array.from({ length: n / 2 ** h }, (_, i) => {
							const j = i + 1;
							return [2 * j - 1, 2 * j].map((cj) => (
								<line key={`${h}-${j}-${cj}`} x1={cellX(h, j)} y1={levelY(h) + 22} x2={cellX(h - 1, cj)} y2={levelY(h - 1) - 16} stroke="var(--pg-border)" />
							));
						}),
					)}
					{Array.from({ length: k + 1 }, (_, h) => Array.from({ length: n / 2 ** h }, (_, i) => cellBox(h, i + 1)))}
					{A.map((v, i) => {
						const kk = key({ arr: 'A', h: 0, j: i + 1 });
						const r = readCount.has(kk);
						return (
							<g key={'a' + i}>
								<text x={cellX(0, i + 1)} y={levelY(0) + 44} textAnchor="middle" fontSize={11} style={{ fill: r ? 'var(--pg-c1)' : 'var(--pg-muted)' }}>
									A({i + 1})={v}
								</text>
							</g>
						);
					})}
				</svg>
			</div>
			<div className="legend">
				<span><i style={{ background: 'var(--pg-c2)' }} />escribe</span>
				<span><i style={{ background: 'var(--pg-c1)' }} />lee (1 procesador)</span>
				<span><i style={{ background: 'var(--pg-c5)' }} />lectura concurrente (≥2 procesadores)</span>
			</div>

			<div className="pg-stats">
				<div className="pg-stat"><span className="k">Procesadores activos</span><span className="v">{cur ? cur.ops.length : 0}</span></div>
				<div className="pg-stat"><span className="k">Modelo requerido en este paso</span><span className="v" style={{ fontSize: '0.95rem' }}>{model}</span></div>
				<div className="pg-stat"><span className="k">Operaciones hasta ahora</span><span className="v">{workSoFar} / {totalWork}</span></div>
				<div className="pg-stat"><span className="k">Pasos paralelos</span><span className="v">{steps.length} = 2·log n + 2</span></div>
			</div>
			{cur && (
				<div className="pg-scroll">
					<table>
						<thead>
							<tr><th>Procesador</th><th>Operación</th></tr>
						</thead>
						<tbody>
							{cur.ops.map((o) => (
								<tr key={o.proc}>
									<td>P{o.proc}</td>
									<td style={{ textAlign: 'left', fontFamily: 'var(--__sl-font-mono, monospace)' }}>{o.expr.replaceAll('∗', OPS[opName].sym)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			{concurrentReads.length > 0 && (
				<div className="pg-note warn">
					Lectura concurrente: {concurrentReads.map(([kk, c]) => `${kk.replace(/^([BC])/, '$1(')}) leída por ${c} procesadores`).join(' · ')}. C(h,2m) y C(h,2m+1) necesitan ambos C(h+1,m) ⇒ el down-sweep, tal como está escrito, requiere lectura concurrente (<b>CREW</b>).
				</div>
			)}
			{s === steps.length && (
				<div className="pg-note ok">
					Resultado s = C(0,·) = [{A.map((_, i) => mem.get(key({ arr: 'C', h: 0, j: i + 1 }))).join(', ')}] · esperado (secuencial) = [{expected.join(', ')}]
				</div>
			)}
			<div className="pg-note">
				<Tex>{String.raw`W(n)=n+\sum_{m=1}^{k}\frac{n}{2^m}+\sum_{m=0}^{k}2^m=O(n)\qquad T(n)=2\log n+2=O(\log n)`}</Tex>
			</div>
		</div>
	);
}
