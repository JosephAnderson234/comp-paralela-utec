import { useState } from 'react';
import Tex from '../ui/Tex';

const PRESETS: { name: string; a: number; b: number; k: number; j: number; ctx: string }[] = [
	{ name: 'Mergesort / P1 — trabajo W(n)', a: 2, b: 2, k: 1, j: 0, ctx: 'W(n) = 2W(n/2) + O(n)' },
	{ name: 'Mergesort paralelo — span T∞(n)', a: 1, b: 2, k: 1, j: 0, ctx: 'T∞(n) = T∞(n/2) + O(n)  (merge secuencial)' },
	{ name: 'Reducción / prefix sum recursivo — span', a: 1, b: 2, k: 0, j: 0, ctx: 'T(n) = T(n/2) + a' },
	{ name: 'Prefix sum recursivo — trabajo', a: 1, b: 2, k: 1, j: 0, ctx: 'W(n) = W(n/2) + bn' },
	{ name: 'Quicksort con prefix sum / P1 — span', a: 1, b: 2, k: 0, j: 1, ctx: 'T∞(n) = T∞(n/2) + O(log n)' },
	{ name: 'D&V binario con combinación O(1)', a: 2, b: 2, k: 0, j: 0, ctx: 'T(n) = 2T(n/2) + O(1)' },
	{ name: 'Mult. matrices por bloques (8 submult.)', a: 8, b: 2, k: 2, j: 0, ctx: 'T(n) = 8T(n/2) + O(n²)' },
];

function fTex(k: number, j: number) {
	const nk = k === 0 ? '' : k === 1 ? 'n' : `n^{${k}}`;
	const lj = j === 0 ? '' : j === 1 ? '\\log n' : `\\log^{${j}} n`;
	return nk || lj ? `${nk}${nk && lj ? '\\,' : ''}${lj}` : '1';
}

export default function MasterTheorem() {
	const [a, setA] = useState(2);
	const [b, setB] = useState(2);
	const [k, setK] = useState(1);
	const [j, setJ] = useState(0);
	const [pi, setPi] = useState(0);

	const c = Math.log(a) / Math.log(b);
	const cStr = Number.isInteger(Math.round(c * 1000) / 1000) ? String(Math.round(c)) : c.toFixed(3);
	const eps = 1e-9;
	let caso: 1 | 2 | 3;
	let res: string;
	if (k < c - eps) {
		caso = 1;
		res = c === 0 ? '1' : fTex(Number(cStr), 0);
	} else if (Math.abs(k - c) < eps) {
		caso = 2;
		res = fTex(k, j + 1);
	} else {
		caso = 3;
		res = fTex(k, j);
	}

	// árbol de recursión: costo por nivel a^i f(n/b^i) con n = b^L
	const L = 10;
	const n = b ** L;
	const levels = Array.from({ length: Math.min(L, 10) + 1 }, (_, i) => {
		const sz = n / b ** i;
		return a ** i * sz ** k * Math.max(Math.log2(sz), 1) ** j;
	});
	const maxLv = Math.max(...levels);

	return (
		<div className="pg not-content">
			<h4>Recurrencias Divide y Vencerás — Teorema maestro</h4>
			<p className="pg-sub">
				<Tex>{'T(n)=a\\,T(n/b)+f(n),\\quad f(n)=\\Theta(n^k\\log^j n)'}</Tex> — compara <Tex>{'n^{\\log_b a}'}</Tex> (hojas) con f(n) (raíz).
			</p>
			<div className="pg-row">
				<label className="pg-field" style={{ flex: '3 1 18rem' }}>
					<span>Recurrencia del curso</span>
					<select
						value={pi}
						onChange={(e) => {
							const P = PRESETS[+e.target.value];
							setPi(+e.target.value);
							setA(P.a); setB(P.b); setK(P.k); setJ(P.j);
						}}
					>
						{PRESETS.map((P, i) => <option key={i} value={i}>{P.name}</option>)}
					</select>
				</label>
			</div>
			<div className="pg-row">
				<label className="pg-field"><span>a (subproblemas) = <b>{a}</b></span><input type="range" min={1} max={8} value={a} onChange={(e) => setA(+e.target.value)} /></label>
				<label className="pg-field"><span>b (factor de división) = <b>{b}</b></span><input type="range" min={2} max={4} value={b} onChange={(e) => setB(+e.target.value)} /></label>
				<label className="pg-field"><span>k (exponente de n en f) = <b>{k}</b></span><input type="range" min={0} max={3} value={k} onChange={(e) => setK(+e.target.value)} /></label>
				<label className="pg-field"><span>j (potencia de log en f) = <b>{j}</b></span><input type="range" min={0} max={2} value={j} onChange={(e) => setJ(+e.target.value)} /></label>
			</div>
			<div className="pg-note">
				<Tex block>{String.raw`T(n)=${a === 1 ? '' : a}\,T\!\left(\tfrac{n}{${b}}\right)+\Theta\!\left(${fTex(k, j)}\right),\qquad \log_{${b}}${a}=${cStr}`}</Tex>
			</div>
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">Caso</span><span className="v">{caso}</span></div>
				<div className="pg-stat" style={{ gridColumn: 'span 2' }}>
					<span className="k">Resultado</span>
					<span className="v"><Tex>{`T(n)=\\Theta\\left(${res}\\right)`}</Tex></span>
				</div>
			</div>
			<div className={`pg-note ${caso === 2 ? 'warn' : 'ok'}`}>
				{caso === 1 && <>Caso 1: f(n) crece más lento que n^{'{log_b a}'} ⇒ dominan las <b>hojas</b> del árbol de recursión.</>}
				{caso === 2 && <>Caso 2: f(n) y n^{'{log_b a}'} crecen igual ⇒ cada uno de los log n niveles cuesta lo mismo: se multiplica por un <b>log n</b> extra.</>}
				{caso === 3 && <>Caso 3: f(n) domina ⇒ el costo lo pone la <b>raíz</b> (el trabajo de dividir/combinar del primer nivel).</>}
			</div>
			<b>Costo por nivel del árbol de recursión</b> (n = {b}^{L})
			<svg viewBox={`0 0 640 ${levels.length * 20 + 6}`}>
				{levels.map((v, i) => (
					<g key={i}>
						<text x={0} y={i * 20 + 14} fontSize={10}>nivel {i}</text>
						<rect x={52} y={i * 20 + 3} width={Math.max(1, (v / maxLv) * 560)} height={14} rx={3} fill={caso === 1 ? 'var(--pg-c1)' : caso === 2 ? 'var(--pg-c2)' : 'var(--pg-c3)'} opacity={0.85} />
					</g>
				))}
			</svg>
			<div className="pg-note" style={{ fontSize: '0.8rem' }}>
				Recurrencias “por resta” (no son del teorema maestro): <Tex>{'T(n)=T(n-1)+O(n)\\Rightarrow\\Theta(n^2)'}</Tex> · <Tex>{'T(n)=T(n-1)+O(1)\\Rightarrow\\Theta(n)'}</Tex> · Fibonacci <Tex>{'W(n)=W(n-1)+W(n-2)+1'}</Tex> ⇒ exponencial, <Tex>{'T_\\infty(n)=T_\\infty(n-1)+1\\Rightarrow\\Theta(n)'}</Tex>.
			</div>
		</div>
	);
}
