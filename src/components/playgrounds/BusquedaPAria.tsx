import { useMemo, useState } from 'react';
import PlayerControls, { usePlayer } from '../ui/Player';

const N = 64;
const A = Array.from({ length: N }, (_, i) => 3 * i + 1);

type Iter = { lo: number; hi: number; piv: number[]; r: number };

/** Búsqueda p-aria: p − 1 pivotes dividen [lo, hi) en p regiones; se queda la que puede contener x. */
function pasos(x: number, p: number): Iter[] {
	const out: Iter[] = [];
	let lo = 0;
	let hi = N;
	while (hi - lo > 1) {
		const L = hi - lo;
		const piv = Array.from({ length: p - 1 }, (_, i) => lo + Math.floor((L * (i + 1)) / p));
		const r = piv.filter((q) => A[q] <= x).length;
		out.push({ lo, hi, piv, r });
		const nlo = lo + Math.floor((L * r) / p);
		const nhi = lo + Math.floor((L * (r + 1)) / p);
		lo = nlo;
		hi = nhi;
	}
	out.push({ lo, hi, piv: [], r: 0 });
	return out;
}

export default function BusquedaPAria() {
	const [p, setP] = useState(4);
	const [x, setX] = useState(A[45]);
	const it = useMemo(() => pasos(x, p), [x, p]);
	const pl = usePlayer(it.length - 1, 1300);
	const cur = it[pl.k];
	const fin = pl.k === it.length - 1;
	const cw = 11;
	const x0 = 10;

	return (
		<div className="pg not-content">
			<h4>Búsqueda binaria generalizada a p procesadores (búsqueda p-aria)</h4>
			<p className="pg-sub">
				Arreglo ordenado de n = 64. En cada iteración los <b>p − 1 procesadores</b> comparan su pivote con x <b>al mismo tiempo</b> (1 paso) y queda una sola de las p regiones. Con p = 2 es la binaria de siempre.
			</p>
			<div className="pg-row">
				<div className="pg-seg" role="group" aria-label="Procesadores">
					{[2, 4, 8].map((q) => (
						<button key={q} className={q === p ? 'active' : ''} onClick={() => { setP(q); pl.reset(); }}>
							p = {q}
						</button>
					))}
				</div>
				<label className="pg-field">
					<span>buscar x = <b>{x}</b></span>
					<input type="range" min={0} max={N - 1} value={A.indexOf(x)} onChange={(e) => { setX(A[+e.target.value]); pl.reset(); }} />
				</label>
			</div>
			<PlayerControls pl={pl} label="iteración" />
			<div style={{ overflowX: 'auto' }}>
				<svg viewBox={`0 0 ${x0 * 2 + N * cw} 92`} style={{ width: '100%', minWidth: 540 }} role="img" aria-label="Arreglo con el intervalo activo y los pivotes de cada procesador">
					{A.map((v, i) => {
						const dentro = i >= cur.lo && i < cur.hi;
						const esPiv = cur.piv.includes(i);
						const objetivo = v === x;
						return (
							<g key={i}>
								<rect x={x0 + i * cw} y={30} width={cw - 1.5} height={26} rx={2}
									fill={fin && objetivo ? 'var(--pg-ok)' : esPiv ? 'var(--pg-c2)' : dentro ? 'color-mix(in srgb, var(--pg-c1) 35%, var(--pg-surface))' : 'var(--pg-surface)'}
									stroke={objetivo ? 'var(--pg-ok)' : 'var(--pg-border)'} strokeWidth={objetivo ? 2 : 1} />
								{esPiv && <text x={x0 + i * cw + cw / 2} y={24} fontSize={9} textAnchor="middle" fill="var(--pg-c2)" fontWeight={700}>P{cur.piv.indexOf(i) + 1}</text>}
								{(i % 8 === 0 || esPiv) && <text x={x0 + i * cw + cw / 2} y={72} fontSize={8} textAnchor="middle" fill="var(--pg-muted)">{v}</text>}
							</g>
						);
					})}
					<text x={x0} y={88} fontSize={10} fill="var(--pg-muted)">celeste = intervalo que aún puede contener x · naranja = pivotes (uno por procesador)</text>
				</svg>
			</div>
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">Intervalo</span><span className="v">[{cur.lo}, {cur.hi}) · {cur.hi - cur.lo} elem.</span></div>
				<div className="pg-stat"><span className="k">Iteraciones totales</span><span className="v">{it.length - 1}</span></div>
				<div className="pg-stat"><span className="k">log<sub>p</sub> n = log 64 / log {p}</span><span className="v">{(6 / Math.log2(p)).toFixed(2)}</span></div>
				<div className="pg-stat"><span className="k">Speedup vs binaria (6 it.)</span><span className="v">{(6 / (it.length - 1)).toFixed(2)}</span></div>
			</div>
			<div className="pg-note">
				{fin
					? <>Encontrado en la posición {cur.lo}. Con p = {p} hicieron falta {it.length - 1} iteraciones en vez de 6: el speedup es log₂ p = {Math.log2(p)} (aprox.), pero se usan {p - 1} procesadores, así que la eficiencia es ≈ log₂ p / p = {(Math.log2(p) / p).toFixed(2)}.</>
					: <>Los {p - 1} pivotes se comparan con x a la vez. x = {x} es ≥ que {cur.r} de ellos, así que sigue en la región {cur.r + 1} de {p}.</>}
			</div>
		</div>
	);
}
