import { useMemo, useState } from 'react';
import PlayerControls, { usePlayer } from '../ui/Player';

const PCOL = ['var(--pg-c1)', 'var(--pg-c2)', 'var(--pg-c3)', 'var(--pg-c4)'];
const N = 26;
const UMAX = 100;

type Metodo = 'jacobi' | 'gs';

function iterar(u: number[], metodo: Metodo): number[] {
	const nu = u.slice();
	for (let i = 1; i < N - 1; i++) {
		const izq = metodo === 'gs' ? nu[i - 1] : u[i - 1];
		nu[i] = 0.5 * (izq + u[i + 1]);
	}
	return nu;
}

function historia(metodo: Metodo, pasos: number): number[][] {
	const h: number[][] = [];
	let u = Array.from({ length: N }, (_, i) => (i === N - 1 ? UMAX : 0));
	h.push(u);
	for (let k = 0; k < pasos; k++) {
		u = iterar(u, metodo);
		h.push(u);
	}
	return h;
}

function iterHasta(metodo: Metodo, tol: number): number {
	let u = Array.from({ length: N }, (_, i) => (i === N - 1 ? UMAX : 0));
	for (let k = 1; k < 100000; k++) {
		const nu = iterar(u, metodo);
		let e = 0;
		for (let i = 0; i < N; i++) e = Math.max(e, Math.abs(nu[i] - u[i]));
		u = nu;
		if (e < tol) return k;
	}
	return Infinity;
}

export default function JacobiHalo() {
	const [p, setP] = useState(3);
	const [metodo, setMetodo] = useState<Metodo>('jacobi');
	const PASOS = 400;
	const h = useMemo(() => historia(metodo, PASOS), [metodo]);
	const pl = usePlayer(PASOS, 120);
	const u = h[pl.k];
	const prev = h[Math.max(0, pl.k - 1)];
	const err = pl.k === 0 ? NaN : Math.max(...u.map((v, i) => Math.abs(v - prev[i])));
	const errExacta = Math.max(...u.map((v, i) => Math.abs(v - (UMAX * i) / (N - 1))));
	const itJ = useMemo(() => iterHasta('jacobi', 1e-3), []);
	const itG = useMemo(() => iterHasta('gs', 1e-3), []);

	const base = Math.floor(N / p);
	const resto = N % p;
	const dueno = (i: number) => {
		let acc = 0;
		for (let r = 0; r < p; r++) {
			const c = base + (r < resto ? 1 : 0);
			if (i < acc + c) return r;
			acc += c;
		}
		return p - 1;
	};
	const W = 720;
	const H = 230;
	const bw = W / N;
	const y = (v: number) => H - 40 - (v / UMAX) * (H - 70);

	return (
		<div className="pg not-content">
			<h4>Laplace 1D: Jacobi repartido entre procesos con halos</h4>
			<p className="pg-sub">
				{N} puntos, frontera u[0] = 0 y u[{N - 1}] = 100. La solución exacta es la recta u(x) = 100·x (línea punteada). Cada color es un proceso; en cada iteración cada proceso necesita <b>un valor del vecino</b> a cada lado (el halo).
			</p>
			<div className="pg-row">
				<span style={{ color: 'var(--pg-muted)' }}>procesos:</span>
				<div className="pg-seg">
					{[1, 2, 3, 4].map((v) => <button key={v} className={p === v ? 'active' : ''} onClick={() => setP(v)}>p = {v}</button>)}
				</div>
				<span style={{ color: 'var(--pg-muted)' }}>método:</span>
				<div className="pg-seg">
					<button className={metodo === 'jacobi' ? 'active' : ''} onClick={() => { setMetodo('jacobi'); pl.reset(); }}>Jacobi</button>
					<button className={metodo === 'gs' ? 'active' : ''} onClick={() => { setMetodo('gs'); pl.reset(); }}>Gauss-Seidel</button>
				</div>
			</div>
			<svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }} role="img" aria-label="Valores de u en cada punto, coloreados por proceso">
				<line x1={bw / 2} y1={y(0)} x2={W - bw / 2} y2={y(UMAX)} stroke="var(--pg-muted)" strokeDasharray="4 4" />
				{u.map((v, i) => {
					const r = dueno(i);
					const front = i === 0 || i === N - 1;
					const ini = i > 0 && dueno(i - 1) !== r;
					return (
						<g key={i}>
							<rect x={i * bw + 2} y={y(v)} width={bw - 4} height={Math.max(1, y(0) - y(v))} rx={2} fill={front ? 'var(--sl-color-gray-4)' : PCOL[r]} opacity={0.85} />
							{ini && <line x1={i * bw} y1={20} x2={i * bw} y2={H - 30} stroke="var(--pg-bad)" strokeWidth={2} strokeDasharray="5 3" />}
							{ini && <text x={i * bw} y={14} textAnchor="middle" fontSize={11} fill="var(--pg-bad)">⇄ halo</text>}
							<text x={i * bw + bw / 2} y={H - 22} textAnchor="middle" fontSize={10} fill="var(--pg-muted)">{i}</text>
						</g>
					);
				})}
				<text x={4} y={H - 6} fontSize={11} fill="var(--pg-muted)">gris = frontera fija · línea roja = borde entre procesos (se intercambian 2 valores por borde en cada iteración)</text>
			</svg>
			<PlayerControls pl={pl} label="iteración" />
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">cambio máx. en esta iteración</span><span className="v">{isNaN(err) ? '—' : err.toFixed(4)}</span></div>
				<div className="pg-stat"><span className="k">error vs. solución exacta</span><span className="v">{errExacta.toFixed(2)}</span></div>
				<div className="pg-stat"><span className="k">mensajes por iteración</span><span className="v">{2 * (p - 1)} + 1 Allreduce</span></div>
				<div className="pg-stat"><span className="k">iteraciones hasta cambio &lt; 10⁻³</span><span className="v">J: {itJ} · GS: {itG}</span></div>
			</div>
			<div className={`pg-note ${metodo === 'gs' ? 'warn' : ''}`}>
				{metodo === 'jacobi'
					? <>Jacobi usa <b>solo valores de la iteración anterior</b> (u_old): todos los puntos se pueden calcular a la vez, por eso se paraleliza fácil. El costo: la información de la frontera avanza <b>un punto por iteración</b>, así que hacen falta muchas iteraciones (crecen como N²).</>
					: <>Gauss-Seidel usa el valor <b>recién calculado</b> del vecino izquierdo: converge en menos iteraciones, pero el punto i depende del i−1 de la misma iteración y eso <b>serializa</b> el barrido. Para paralelizarlo hay que reordenar (por ejemplo, rojo-negro).</>}
			</div>
		</div>
	);
}
