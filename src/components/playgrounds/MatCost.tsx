import { useState } from 'react';
import Chart, { fmt } from '../ui/Chart';

type Alg = { label: string; color: string; comm: (n: number, p: number, a: number, b: number) => number; pmax: (n: number) => number; dashed?: boolean };
const lg = Math.log2;
const algs: Alg[] = [
	{ label: 'filas/col (lámina)', color: 'var(--pg-c3)', comm: (n, p, a, b) => lg(p) * (a + (n * n / p) * b), pmax: (n) => n },
	{ label: 'filas/col (anillo)', color: 'var(--pg-c3)', dashed: true, comm: (n, p, a, b) => (p - 1) * (a + (n * n / p) * b), pmax: (n) => n },
	{ label: 'Fox', color: 'var(--pg-c2)', comm: (n, p, a, b) => Math.sqrt(p) * (lg(Math.sqrt(p)) + 1) * (a + (n * n / p) * b), pmax: (n) => n * n },
	{ label: 'Cannon', color: 'var(--pg-c1)', comm: (n, p, a, b) => Math.sqrt(p) * (a + (n * n / p) * b), pmax: (n) => n * n },
	{ label: 'DNS', color: 'var(--pg-c4)', comm: (n, p, a, b) => lg(p) * (a + (n * n / Math.pow(p, 2 / 3)) * b), pmax: (n) => n * n * n },
];
const P = [4, 16, 64, 256, 1024, 4096, 16384, 65536];

export default function MatCost() {
	const [ln, setLn] = useState(10);
	const [la, setLa] = useState(3);
	const [lb, setLb] = useState(0);
	const [pSel, setPSel] = useState(1024);
	const n = 2 ** ln, a = 10 ** la, b = 10 ** lb;
	const E = (g: Alg, p: number) => { const tp = (n ** 3) / p + g.comm(n, p, a, b); return (n ** 3) / (p * tp); };
	const series = algs.map((g) => ({ label: g.label, color: g.color, dashed: g.dashed, dots: true, data: P.filter((p) => p <= g.pmax(n)).map((p) => [p, E(g, p)] as [number, number]) }));
	return (
		<div className="pg not-content">
			<h4>¿Qué algoritmo mantiene mejor la eficiencia?</h4>
			<p className="pg-sub">Modelos de las láminas sin constantes ocultas: una multiplicación-suma cuesta 1, un mensaje de m números cuesta α + mβ. Son cálculos del modelo, no mediciones.</p>
			<div className="pg-row">
				<label className="pg-field"><span>n = {n}</span><input type="range" min="6" max="13" value={ln} onChange={(e) => setLn(+e.target.value)} /></label>
				<label className="pg-field"><span>α = {fmt(a)}</span><input type="range" min="0" max="5" step="0.5" value={la} onChange={(e) => setLa(+e.target.value)} /></label>
				<label className="pg-field"><span>β = {fmt(b)}</span><input type="range" min="-1" max="2" step="0.5" value={lb} onChange={(e) => setLb(+e.target.value)} /></label>
			</div>
			<Chart series={series} xLog xLabel="p procesos" yLabel="eficiencia E" yMin={0} yMax={1} vlines={[{ x: pSel, label: `p=${pSel}` }]} />
			<div className="pg-row">
				<div className="pg-seg" role="group" aria-label="p para la tabla">
					{[64, 1024, 16384].map((p) => <button key={p} className={p === pSel ? 'active' : ''} onClick={() => setPSel(p)}>p = {p}</button>)}
				</div>
			</div>
			<div className="pg-stats">
				{algs.map((g) => <div className="pg-stat" key={g.label}><span className="k">{g.label}</span><span className="v">{pSel <= g.pmax(n) ? `E = ${fmt(E(g, pSel), 2)}` : `p > ${g.pmax(n) === n ? 'n' : g.pmax(n) === n * n ? 'n²' : 'n³'}`}</span></div>)}
			</div>
			<div className="pg-note">Prueba con n = 1024, α = 1000, β = 1: en p = 1024 el anillo baja a ≈0.34, Fox a ≈0.73, DNS ≈0.90 y Cannon ≈0.94. Sube α a 10⁵ y baja β: DNS alcanza a Cannon, porque envía solo log p mensajes. La curva «filas/col (lámina)» sale demasiado buena: su comunicación cobra log p·(n²/p)β, menos de lo que exige juntar las p franjas (ver la nota de la página).</div>
		</div>
	);
}
