import { useMemo, useState } from 'react';
import Chart, { fmt } from '../ui/Chart';
import Tex from '../ui/Tex';

// f(n) = n^a · log2(n)^b
type F = { a: number; b: number; tex: string };
const FUNCS: Record<string, F> = {
	'1': { a: 0, b: 0, tex: '1' },
	'log n': { a: 0, b: 1, tex: '\\log n' },
	'log² n': { a: 0, b: 2, tex: '\\log^2 n' },
	'√n': { a: 0.5, b: 0, tex: '\\sqrt{n}' },
	n: { a: 1, b: 0, tex: 'n' },
	'n log n': { a: 1, b: 1, tex: 'n\\log n' },
	'n²': { a: 2, b: 0, tex: 'n^2' },
	'n³': { a: 3, b: 0, tex: 'n^3' },
};
type FK = keyof typeof FUNCS;
const ev = (f: F, n: number) => n ** f.a * Math.log2(Math.max(n, 2)) ** f.b;

const COMM = {
	none: { label: 'sin término extra', tex: '', f: (_p: number) => 0 },
	logp: { label: '+ log p (colectiva en árbol)', tex: '+\\log p', f: (p: number) => (p > 1 ? Math.log2(p) : 0) },
	p: { label: '+ p (colectiva lineal)', tex: '+p', f: (p: number) => (p > 1 ? p : 0) },
} as const;
type CK = keyof typeof COMM;

const PRESETS: { name: string; W: FK; T: FK; comm: CK; note: string }[] = [
	{ name: 'P1 — Subsecuencia máxima (D&V + prefix)', W: 'n log n', T: 'log² n', comm: 'none', note: 'P1.md: E = 1/(1 + p log n / n) ⇒ débil si p ∝ n / log n.' },
	{ name: 'PD02 2025-I — Quicksort con prefix sum (a)', W: 'n log n', T: 'log² n', comm: 'none', note: 'Oficial: T_p = O(n log n/p + log² n), escala si p ∝ n / log n.' },
	{ name: 'PD02 2025-I — Quicksort + comunicación log p (b)', W: 'n log n', T: 'log² n', comm: 'logp', note: 'Oficial: dos condiciones, p ∝ n/log n y p log p ∝ n log n; la segunda domina.' },
	{ name: 'Mergesort paralelo (merge secuencial)', W: 'n log n', T: 'n', comm: 'none', note: '07_NBody_DivideVenceras: E = 1/(1 + p/log n) ⇒ p ∝ log n (pésima).' },
	{ name: 'Suma por reducción / prefix sum', W: 'n', T: 'log n', comm: 'none', note: '04_PRAM: T_p = O(n/p + log n), costo óptimo si p = O(n / log n).' },
	{ name: 'Mult. matrices 3D (expansión + reducción)', W: 'n³', T: 'log n', comm: 'none', note: '07_NBody_DivideVenceras §4: T_p = O(n³/p + log n).' },
	{ name: 'PD02 2026-I — Mult. matrices por proceso P(i,j)', W: 'n³', T: 'n', comm: 'none', note: 'Oficial: T_p = O(n³ t_c / p + n), E = 1/(1 + p/(t_c n²)) ⇒ débil si n ∝ √p.' },
	{ name: 'PD02 2026-I — Árbol 2-3 (variable m, log n fijo)', W: 'n', T: '1', comm: 'none', note: 'Aquí “n” representa m (número de búsquedas): W = m log n, T∞ = log n ⇒ E = 1/(1 + p/m) ⇒ p ∝ m.' },
];

function texRatio(a: number, b: number) {
	const parts: string[] = [];
	if (a !== 0) parts.push(a === 1 ? 'n' : a === 0.5 ? '\\sqrt{n}' : `n^{${a}}`);
	if (b !== 0) parts.push(b === 1 ? '\\log n' : `\\log^{${b}} n`);
	if (parts.length === 0) return '1';
	if (a < 0 || b < 0) {
		const num: string[] = [], den: string[] = [];
		if (a > 0) num.push(a === 1 ? 'n' : `n^{${a}}`);
		if (a < 0) den.push(a === -1 ? 'n' : `n^{${-a}}`);
		if (b > 0) num.push(b === 1 ? '\\log n' : `\\log^{${b}} n`);
		if (b < 0) den.push(b === -1 ? '\\log n' : `\\log^{${-b}} n`);
		return `\\frac{${num.join(' ') || '1'}}{${den.join(' ')}}`;
	}
	return parts.join(' ');
}

export default function BrentScalability() {
	const [pi, setPi] = useState(0);
	const [Wk, setWk] = useState<FK>(PRESETS[0].W);
	const [Tk, setTk] = useState<FK>(PRESETS[0].T);
	const [comm, setComm] = useState<CK>(PRESETS[0].comm);
	const [n, setN] = useState(2 ** 16);
	const [E0, setE0] = useState(0.5);

	const applyPreset = (i: number) => {
		setPi(i);
		setWk(PRESETS[i].W);
		setTk(PRESETS[i].T);
		setComm(PRESETS[i].comm);
	};

	const Wf = FUNCS[Wk], Tf = FUNCS[Tk];
	const Tp = (nn: number, p: number) => ev(Wf, nn) / p + ev(Tf, nn) + COMM[comm].f(p);
	const E = (nn: number, p: number) => ev(Wf, nn) / Tp(nn, p) / p;

	const ps = useMemo(() => Array.from({ length: 41 }, (_, i) => Math.round(2 ** (i * 0.35))).filter((v, i, arr) => arr.indexOf(v) === i), []);

	const strong = [
		{ label: `E(p), n = ${fmt(n)}`, color: 'var(--pg-c1)', data: ps.map((p) => [p, E(n, p)] as [number, number]) },
		{ label: `E(p), n = ${fmt(n * 16)}`, color: 'var(--pg-c3)', data: ps.map((p) => [p, E(n * 16, p)] as [number, number]) },
	];
	const speed = [
		{ label: `S(p), n = ${fmt(n)}`, color: 'var(--pg-c1)', data: ps.map((p) => [p, E(n, p) * p] as [number, number]) },
		{ label: 'S = p', color: 'var(--sl-color-gray-3)', dashed: true, data: ps.map((p) => [p, p] as [number, number]) },
		{ label: `W/T∞ (paralelismo) = ${fmt(ev(Wf, n) / ev(Tf, n))}`, color: 'var(--pg-c2)', dashed: true, data: ps.map((p) => [p, ev(Wf, n) / ev(Tf, n)] as [number, number]) },
	];

	// isoeficiencia: n mínimo tal que E(n,p) ≥ E0 (búsqueda en escala log)
	const iso = useMemo(() => {
		const out: [number, number][] = [];
		for (const p of ps) {
			if (p < 2) continue;
			let lo = 1, hi = 60; // log2 n
			if (E(2 ** hi, p) < E0) continue;
			for (let it = 0; it < 60; it++) {
				const mid = (lo + hi) / 2;
				if (E(2 ** mid, p) >= E0) hi = mid;
				else lo = mid;
			}
			out.push([p, 2 ** hi]);
		}
		return out;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [Wk, Tk, comm, E0, ps]);

	const ra = Wf.a - Tf.a, rb = Wf.b - Tf.b;
	const commTex = COMM[comm].tex;
	const eTex =
		comm === 'none'
			? String.raw`E=\frac{1}{1+\dfrac{p\,${Tf.tex}}{${Wf.tex}}}`
			: String.raw`E=\frac{1}{1+\dfrac{p\,${Tf.tex}}{${Wf.tex}}+\dfrac{p\,${comm === 'logp' ? '\\log p' : 'p'}}{${Wf.tex}}}`;

	return (
		<div className="pg">
			<h4>Calculadora Brent → S, E y escalabilidad</h4>
			<p className="pg-sub">Elige W(n) y T∞(n) (o un ejercicio previo). Se asume T_s = W (costo óptimo) y la cota de Brent T_p = W/p + T∞ {commTex && '+ comunicación'}.</p>
			<div className="pg-row">
				<label className="pg-field" style={{ flex: '3 1 20rem' }}>
					<span>Ejercicio / plantilla</span>
					<select value={pi} onChange={(e) => applyPreset(+e.target.value)}>
						{PRESETS.map((p, i) => (
							<option key={i} value={i}>{p.name}</option>
						))}
					</select>
				</label>
				<label className="pg-field">
					<span>W(n) = T_s(n)</span>
					<select value={Wk} onChange={(e) => setWk(e.target.value as FK)}>
						{Object.keys(FUNCS).map((k) => <option key={k}>{k}</option>)}
					</select>
				</label>
				<label className="pg-field">
					<span>T∞(n)</span>
					<select value={Tk} onChange={(e) => setTk(e.target.value as FK)}>
						{Object.keys(FUNCS).map((k) => <option key={k}>{k}</option>)}
					</select>
				</label>
				<label className="pg-field">
					<span>Comunicación</span>
					<select value={comm} onChange={(e) => setComm(e.target.value as CK)}>
						{Object.entries(COMM).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
					</select>
				</label>
			</div>
			<div className="pg-note">{PRESETS[pi].note}</div>

			<div className="pg-note">
				<Tex block>{String.raw`T_p(n,p)=O\!\left(\frac{${Wf.tex}}{p}+${Tf.tex}${commTex}\right)\qquad S=\frac{${Wf.tex}}{T_p}\qquad ${eTex}`}</Tex>
			</div>

			<div className="pg-row">
				<label className="pg-field">
					<span>n = 2^{Math.log2(n)} = <b>{fmt(n)}</b></span>
					<input type="range" min={4} max={40} value={Math.log2(n)} onChange={(e) => setN(2 ** +e.target.value)} />
				</label>
				<label className="pg-field">
					<span>Eficiencia objetivo E₀ = <b>{E0}</b></span>
					<input type="range" min={0.1} max={0.95} step={0.05} value={E0} onChange={(e) => setE0(+e.target.value)} />
				</label>
			</div>

			<div className="pg-grid-2">
				<div>
					<b>Escalabilidad fuerte:</b> n fijo, crece p
					<Chart series={strong} xLog xLabel="p" yLabel="E" yMin={0} yMax={1.02} hlines={[{ y: E0, label: `E₀=${E0}` }]} />
				</div>
				<div>
					<b>Speedup</b> — se satura en W/T∞
					<Chart series={speed} xLog yLog xLabel="p" yLabel="S" yMin={1} />
				</div>
			</div>
			<div style={{ marginTop: '1rem' }}>
				<b>Escalabilidad débil:</b> n mínimo para sostener E ≥ {E0} (función de isoeficiencia, numérica)
				<Chart
					series={[
						{ label: 'n(p) numérico', color: 'var(--pg-c4)', data: iso, dots: true },
						{ label: 'referencia n ∝ p', color: 'var(--sl-color-gray-3)', dashed: true, data: iso.map(([p]) => [p, (iso[0]?.[1] ?? 1) * (p / (iso[0]?.[0] ?? 1))] as [number, number]) },
					]}
					xLog
					yLog
					xLabel="p"
					yLabel="n necesario"
				/>
			</div>
			<div className="pg-note ok">
				<b>Lectura para el examen.</b> Fuerte (n constante): <Tex>{'E\\to 0'}</Tex> al crecer p ⇒ <b>no escala en forma fuerte</b>.{' '}
				Débil: E constante si <Tex>{String.raw`p\,${Tf.tex}\propto ${Wf.tex}`}</Tex>, es decir <Tex>{String.raw`p\propto ${texRatio(ra, rb)}`}</Tex>
				{comm === 'logp' && (
					<>
						{' '}y además <Tex>{String.raw`p\log p\propto ${Wf.tex}`}</Tex> (esta segunda suele ser la dominante)
					</>
				)}
				{comm === 'p' && (
					<>
						{' '}y además <Tex>{String.raw`p^2\propto ${Wf.tex}`}</Tex>
					</>
				)}
				.
			</div>
		</div>
	);
}
