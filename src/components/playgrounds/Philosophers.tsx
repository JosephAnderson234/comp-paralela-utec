import { useMemo, useState } from 'react';
import PlayerControls, { usePlayer } from '../ui/Player';

type Estrategia = 'izq' | 'orden';
type Plan = 'rr' | 'azar';
type Est = 'piensa' | 'espera1' | 'espera2' | 'come' | 'fin';
type Snap = { est: Est[]; dueno: number[]; comidas: number[]; actor: number; nota: string };

function rng(seed: number) {
	let s = seed >>> 0;
	return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function simular(N: number, estr: Estrategia, plan: Plan, seed: number, M: number) {
	const r = rng(seed);
	const izq = (p: number) => p;
	const der = (p: number) => (p + 1) % N;
	const primero = (p: number) => (estr === 'izq' ? izq(p) : Math.min(izq(p), der(p)));
	const segundo = (p: number) => (estr === 'izq' ? der(p) : Math.max(izq(p), der(p)));
	const est: Est[] = Array(N).fill('piensa');
	const dueno: number[] = Array(N).fill(-1);
	const comidas: number[] = Array(N).fill(0);
	const cont: number[] = Array(N).fill(0).map(() => (plan === 'azar' ? Math.floor(r() * 3) : 0));
	const trace: Snap[] = [];
	const push = (actor: number, nota: string) => trace.push({ est: [...est], dueno: [...dueno], comidas: [...comidas], actor, nota });
	let turno = 0;
	let deadlock = false;
	for (let paso = 0; paso < 400; paso++) {
		const vivos = [...Array(N).keys()].filter((p) => est[p] !== 'fin');
		if (!vivos.length) break;
		const puede = (p: number) =>
			(est[p] === 'espera1' && dueno[primero(p)] === -1) || (est[p] === 'espera2' && dueno[segundo(p)] === -1) || est[p] === 'piensa' || est[p] === 'come';
		if (!vivos.some(puede)) { deadlock = true; break; }
		let p: number;
		if (plan === 'rr') { p = vivos[turno % vivos.length]; turno++; }
		else p = vivos[Math.floor(r() * vivos.length)];
		if (est[p] === 'piensa') {
			if (cont[p] > 0) { cont[p]--; push(p, `F${p} piensa…`); }
			else { est[p] = 'espera1'; push(p, `F${p} tiene hambre: quiere el tenedor ${primero(p)}`); }
		} else if (est[p] === 'espera1') {
			const t = primero(p);
			if (dueno[t] === -1) { dueno[t] = p; est[p] = 'espera2'; push(p, `F${p} toma el tenedor ${t} (omp_set_lock)`); }
			else push(p, `F${p} espera el tenedor ${t}: lo tiene F${dueno[t]}`);
		} else if (est[p] === 'espera2') {
			const t = segundo(p);
			if (dueno[t] === -1) { dueno[t] = p; est[p] = 'come'; cont[p] = 1; push(p, `F${p} toma el tenedor ${t} y come`); }
			else push(p, `F${p} tiene el ${primero(p)} y espera el ${t}: lo tiene F${dueno[t]}`);
		} else if (est[p] === 'come') {
			if (cont[p] > 0) { cont[p]--; push(p, `F${p} sigue comiendo`); }
			else {
				dueno[izq(p)] = -1; dueno[der(p)] = -1; comidas[p]++;
				est[p] = comidas[p] >= M ? 'fin' : 'piensa';
				cont[p] = plan === 'azar' ? Math.floor(r() * 3) : 0;
				push(p, `F${p} suelta los tenedores ${izq(p)} y ${der(p)} (omp_unset_lock)${est[p] === 'fin' ? ' y termina' : ''}`);
			}
		}
	}
	return { trace, deadlock };
}

const ESTCOL: Record<Est, string> = { piensa: 'var(--pg-muted)', espera1: 'var(--pg-warn)', espera2: 'var(--pg-c5)', come: 'var(--pg-ok)', fin: 'var(--pg-c1)' };
const ESTTXT: Record<Est, string> = { piensa: 'piensa', espera1: 'hambre', espera2: 'tiene 1', come: 'come', fin: 'terminó' };

export default function Philosophers() {
	const [N, setN] = useState(5);
	const [estr, setEstr] = useState<Estrategia>('izq');
	const [plan, setPlan] = useState<Plan>('rr');
	const [seed, setSeed] = useState(3);
	const M = 2;
	const { trace, deadlock } = useMemo(() => simular(N, estr, plan, seed, M), [N, estr, plan, seed]);
	const pl = usePlayer(trace.length, 500);
	const snap: Snap = pl.k ? trace[pl.k - 1] : { est: Array(N).fill('piensa'), dueno: Array(N).fill(-1), comidas: Array(N).fill(0), actor: -1, nota: 'Todos piensan.' };
	const fin = pl.k === trace.length;

	const W = 300, cx = 150, cy = 150, R = 95;
	const ang = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / N;
	const pos = (i: number, rad: number) => [cx + rad * Math.cos(ang(i)), cy + rad * Math.sin(ang(i))];
	const posT = (t: number, rad: number) => [cx + rad * Math.cos(ang(t) - Math.PI / N), cy + rad * Math.sin(ang(t) - Math.PI / N)];

	const code = estr === 'izq'
		? 'omp_set_lock(&forks[left]);    // primero el izquierdo\nomp_set_lock(&forks[right]);   // luego el derecho'
		: 'int a = min(left, right), b = max(left, right);\nomp_set_lock(&forks[a]);       // siempre el de menor número\nomp_set_lock(&forks[b]);';

	return (
		<div className="pg not-content">
			<h4>Los filósofos y los locks</h4>
			<p className="pg-sub">Cada tenedor es un <code>omp_lock_t</code> y cada filósofo, un hilo. Con el <b>turno rotativo</b> todos toman su tenedor izquierdo a la vez: es el peor caso posible.</p>
			<div className="pg-row">
				<div className="pg-seg">
					<button className={estr === 'izq' ? 'active' : ''} onClick={() => { setEstr('izq'); pl.reset(); }}>izquierdo primero (clase)</button>
					<button className={estr === 'orden' ? 'active' : ''} onClick={() => { setEstr('orden'); pl.reset(); }}>menor número primero</button>
				</div>
				<div className="pg-seg">
					<button className={plan === 'rr' ? 'active' : ''} onClick={() => { setPlan('rr'); pl.reset(); }}>turno rotativo</button>
					<button className={plan === 'azar' ? 'active' : ''} onClick={() => { setPlan('azar'); pl.reset(); }}>al azar</button>
				</div>
				<label className="pg-field"><span>filósofos = <b>{N}</b></span><input type="range" min={3} max={7} value={N} onChange={(e) => { setN(+e.target.value); pl.reset(); }} /></label>
				{plan === 'azar' && <button onClick={() => { setSeed(seed + 1); pl.reset(); }}>🎲 Otro orden</button>}
			</div>
			<pre className="pg-code">{code}</pre>
			<PlayerControls pl={pl} label="paso" />
			<div className="pg-grid-2" style={{ alignItems: 'center' }}>
				<svg viewBox={`0 0 ${W} ${W}`} style={{ maxWidth: 320, width: '100%' }} role="img" aria-label="Mesa de los filósofos">
					<circle cx={cx} cy={cy} r={62} fill="var(--pg-surface-2)" stroke="var(--pg-border)" />
					{Array.from({ length: N }, (_, t) => {
						const d = snap.dueno[t];
						const [x, y] = d === -1 ? posT(t, 50) : (() => { const [px, py] = pos(d, R); const [tx, ty] = posT(t, 50); return [px * 0.6 + tx * 0.4, py * 0.6 + ty * 0.4]; })();
						return (
							<g key={t} style={{ transition: 'transform .3s' }}>
								<rect x={x - 4} y={y - 13} width={8} height={26} rx={3} fill={d === -1 ? 'var(--pg-muted)' : 'var(--pg-c6)'} stroke="var(--pg-border)" />
								<text x={x} y={y + 25} textAnchor="middle" fontSize={10} fill="var(--pg-muted)">t{t}</text>
							</g>
						);
					})}
					{Array.from({ length: N }, (_, p) => {
						const [x, y] = pos(p, R);
						const e = snap.est[p];
						return (
							<g key={p}>
								<circle cx={x} cy={y} r={22} fill="var(--pg-surface)" stroke={ESTCOL[e]} strokeWidth={snap.actor === p ? 4 : 2.5} className={snap.actor === p ? 'pg-pulse' : ''} />
								<text x={x} y={y - 2} textAnchor="middle" fontSize={12} fontWeight={700}>F{p}</text>
								<text x={x} y={y + 11} textAnchor="middle" fontSize={8.5} fill={ESTCOL[e]}>{ESTTXT[e]}</text>
							</g>
						);
					})}
					{fin && deadlock && <text x={cx} y={cy + 4} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--pg-bad)">DEADLOCK</text>}
				</svg>
				<div style={{ display: 'grid', gap: 8 }}>
					<div className="pg-note" style={{ margin: 0 }}>{snap.nota}</div>
					<div className="pg-stats" style={{ marginTop: 0 }}>
						{Array.from({ length: N }, (_, p) => (
							<div key={p} className="pg-stat"><span className="k">F{p} comió</span><span className="v">{snap.comidas[p]}/{M}</span></div>
						))}
					</div>
				</div>
			</div>
			{fin && (
				<div className={`pg-note ${deadlock ? 'bad' : 'ok'}`}>
					{deadlock
						? <><b>Interbloqueo (deadlock):</b> cada filósofo tiene un tenedor y espera el de su vecino, que nunca lo suelta. Es una espera circular F0 → F1 → … → F{N - 1} → F0 y el programa se queda colgado para siempre.</>
						: <>Todos comieron {M} veces y el programa terminó. {estr === 'orden' ? <>Tomar <b>siempre el tenedor de menor número</b> primero rompe el círculo: el último filósofo pide el tenedor 0 antes que el {N - 1}, así que no puede quedarse con uno y esperar el otro.</> : <>Con este orden hubo suerte, pero <b>no está garantizado</b>: prueba el turno rotativo.</>}</>}
				</div>
			)}
		</div>
	);
}
