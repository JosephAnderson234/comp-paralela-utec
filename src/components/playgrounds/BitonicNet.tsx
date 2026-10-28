import { useMemo, useState } from 'react';
import PlayerControls, { usePlayer } from '../ui/Player';

type Etapa = { k: number; j: number };

function etapas(n: number): Etapa[] {
	const out: Etapa[] = [];
	for (let k = 2; k <= n; k <<= 1) for (let j = k >> 1; j > 0; j >>= 1) out.push({ k, j });
	return out;
}

function aplicar(a: number[], { k, j }: Etapa): number[] {
	const b = a.slice();
	for (let i = 0; i < b.length; i++) {
		const l = i ^ j;
		if (l <= i) continue;
		const asc = (i & k) === 0;
		if ((asc && b[i] > b[l]) || (!asc && b[i] < b[l])) [b[i], b[l]] = [b[l], b[i]];
	}
	return b;
}

const EJEMPLO = [7, 3, 6, 8, 1, 5, 2, 4];

export default function BitonicNet() {
	const n = 8;
	const [entrada, setEntrada] = useState(EJEMPLO);
	const E = useMemo(() => etapas(n), []);
	const estados = useMemo(() => {
		const s = [entrada];
		for (const e of E) s.push(aplicar(s[s.length - 1], e));
		return s;
	}, [entrada, E]);
	const pl = usePlayer(E.length, 1400);
	const actual = estados[pl.k];

	const X0 = 70;
	const DX = 80;
	const Y0 = 34;
	const DY = 32;
	const W = X0 + DX * E.length + 70;
	const H = Y0 + DY * (n - 1) + 56;

	const nuevo = () => {
		const v = Array.from({ length: n }, (_, i) => i + 1);
		for (let i = n - 1; i > 0; i--) {
			const r = Math.floor(Math.random() * (i + 1));
			[v[i], v[r]] = [v[r], v[i]];
		}
		setEntrada(v);
		pl.reset();
	};

	const fase = pl.k === 0 ? null : E[pl.k - 1];
	const bloque = fase ? fase.k : 0;

	return (
		<div className="pg not-content">
			<h4>Red de ordenamiento bitónico (n = 8)</h4>
			<p className="pg-sub">
				Cada línea horizontal es una posición del arreglo. Cada barra vertical es un <b>comparar-intercambiar</b>: la flecha apunta a donde va el <b>mayor</b>. Todas las barras de una columna son independientes y se ejecutan <b>a la vez</b>.
			</p>
			<div className="pg-row">
				<button onClick={nuevo}>Nueva entrada al azar</button>
				<button onClick={() => { setEntrada(EJEMPLO); pl.reset(); }}>Ejemplo</button>
			</div>
			<div style={{ overflowX: 'auto' }}>
				<svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 560 }} role="img" aria-label="Red bitónica de 8 entradas con 6 columnas de comparadores">
					{Array.from({ length: n }, (_, i) => (
						<line key={i} x1={X0 - 20} y1={Y0 + i * DY} x2={W - 50} y2={Y0 + i * DY} stroke="var(--sl-color-gray-4)" />
					))}
					{E.map((e, c) => {
						const x = X0 + DX * c + DX / 2;
						const activa = c === pl.k - 1;
						const hecha = c < pl.k;
						const comps = [];
						for (let i = 0; i < n; i++) {
							const l = i ^ e.j;
							if (l <= i) continue;
							const asc = (i & e.k) === 0;
							const off = ((i % e.j) - (e.j - 1) / 2) * 9;
							const xx = x + (e.j > 1 ? off : 0);
							const ya = Y0 + i * DY;
							const yb = Y0 + l * DY;
							const col = asc ? 'var(--pg-c1)' : 'var(--pg-c2)';
							comps.push(
								<g key={i} opacity={activa ? 1 : hecha ? 0.55 : 0.25}>
									<line x1={xx} y1={ya} x2={xx} y2={yb} stroke={col} strokeWidth={activa ? 3 : 2} />
									<circle cx={xx} cy={ya} r={3.5} fill={col} />
									<path d={asc ? `M${xx - 5} ${yb - 9} L${xx + 5} ${yb - 9} L${xx} ${yb - 1}z` : `M${xx - 5} ${ya + 9} L${xx + 5} ${ya + 9} L${xx} ${ya + 1}z`} fill={col} />
								</g>,
							);
						}
						return (
							<g key={c}>
								{activa && <rect x={x - DX / 2 + 4} y={Y0 - 22} width={DX - 8} height={DY * (n - 1) + 40} rx={8} fill="var(--pg-c2)" opacity={0.08} />}
								{comps}
								<text x={x} y={H - 18} textAnchor="middle" fontSize={11} fill={activa ? 'var(--sl-color-white)' : 'var(--pg-muted)'}>k={e.k}, j={e.j}</text>
							</g>
						);
					})}
					{actual.map((v, i) => (
						<g key={i}>
							<text x={X0 - 32} y={Y0 + i * DY + 5} textAnchor="middle" fontSize={13} fill="var(--pg-muted)">{estados[0][i]}</text>
							<rect x={W - 46} y={Y0 + i * DY - 12} width={30} height={24} rx={5} fill="var(--pg-surface-2)" stroke={bloque && Math.floor(i / bloque) % 2 === 0 ? 'var(--pg-c1)' : bloque ? 'var(--pg-c2)' : 'var(--pg-border)'} />
							<text x={W - 31} y={Y0 + i * DY + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--sl-color-white)">{v}</text>
						</g>
					))}
					<text x={X0 - 32} y={16} textAnchor="middle" fontSize={11} fill="var(--pg-muted)">entrada</text>
					<text x={W - 31} y={16} textAnchor="middle" fontSize={11} fill="var(--pg-muted)">ahora</text>
				</svg>
			</div>
			<PlayerControls pl={pl} label="columna" />
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">columnas (pasos en paralelo)</span><span className="v">log n (log n + 1)/2 = {E.length}</span></div>
				<div className="pg-stat"><span className="k">comparadores por columna</span><span className="v">n/2 = {n / 2}</span></div>
				<div className="pg-stat"><span className="k">trabajo total</span><span className="v">{(E.length * n) / 2} comparaciones</span></div>
			</div>
			<div className="pg-note">
				{pl.k === 0 && <>Celeste = bloque que se ordena <b>creciente</b>, naranja = <b>decreciente</b>. Dale a ▶ y mira cómo se forman secuencias bitónicas cada vez más largas.</>}
				{fase && fase.j === fase.k / 2 && fase.k > 2 && <>Con k = {fase.k} empieza una nueva <b>mezcla bitónica</b>: cada bloque de {fase.k} es bitónico (sube y luego baja) y se compara el elemento i con el i + {fase.j}. Así quedan dos mitades bitónicas, y todo lo de una mitad es menor que todo lo de la otra.</>}
				{fase && (fase.j !== fase.k / 2 || fase.k === 2) && pl.k < E.length && <>k = {fase.k}, j = {fase.j}: se sigue partiendo cada mitad bitónica por la mitad (distancia {fase.j}).</>}
				{pl.k === E.length && <>Ordenado en {E.length} pasos paralelos. Se hicieron {(E.length * n) / 2} comparaciones; con n = 8 coincide con n·log n = 24, pero el trabajo crece como <b>n·log² n</b>: con n = 1024 serían 28 160 frente a ≈ 10 240 de un buen secuencial. El bitónico <b>no es óptimo en trabajo</b>.</>}
			</div>
		</div>
	);
}
