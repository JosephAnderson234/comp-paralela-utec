import { useState } from 'react';
import Chart, { fmt } from '../ui/Chart';
import Tex from '../ui/Tex';
import { eficiencia, fijo5040 } from '../../data/practica3';

type Scheme = 'filas' | 'columnas' | 'bloques';
const COLORS = ['#4cc3d9', '#f2a541', '#b38cf2', '#6fd08c', '#f27a7a', '#e8d15a', '#7fa7ff', '#ff8fd1', '#9be3c9', '#d9a0ff', '#ffc38a', '#a0d0ff', '#e0e070', '#ff9f9f', '#9fffb5', '#c0c0ff'];

export default function MatVecPartition() {
	const [scheme, setScheme] = useState<Scheme>('filas');
	const [p, setP] = useState(4);
	const N = 8;
	const q = Math.round(Math.sqrt(p));
	const blocksOk = q * q === p && N % q === 0;
	const sch: Scheme = scheme === 'bloques' && !blocksOk ? 'filas' : scheme;

	const owner = (i: number, j: number) => {
		if (sch === 'filas') return Math.floor(i / (N / p));
		if (sch === 'columnas') return Math.floor(j / (N / p));
		return Math.floor(i / (N / q)) * q + Math.floor(j / (N / q));
	};
	const vNeed = (j: number) => {
		if (sch === 'filas') return 'todos';
		if (sch === 'columnas') return `P${Math.floor(j / (N / p))}`;
		return `col. de bloques ${Math.floor(j / (N / q))}`;
	};

	// modelo teórico (exámenes 2025-II): T_filas = γn²/p + α log p + βn ; T_bloques = γn²/p + 2α log √p + β n/√p
	const [logN, setLogN] = useState(3);
	const [lg, setLg] = useState(-9);
	const [la, setLa] = useState(-6);
	const [lb, setLb] = useState(-8);
	const n = 10 ** logN, gamma = 10 ** lg, alpha = 10 ** la, beta = 10 ** lb;
	const ps = [1, 2, 4, 9, 16, 25, 36, 64, 100, 144, 256, 400, 576, 1024, 2025, 4096];
	const Tf = (pp: number) => (gamma * n * n) / pp + alpha * Math.log2(pp) + beta * n;
	const Tb = (pp: number) => (gamma * n * n) / pp + 2 * alpha * Math.log2(Math.sqrt(pp)) + beta * (n / Math.sqrt(pp));
	const Ts = gamma * n * n;

	const effSeries = (caso: 'row' | 'col') =>
		[240, 360, 480, 600].map((NN, k) => ({
			label: `N=${NN}`,
			color: `var(--pg-c${k + 1})`,
			dots: true,
			data: eficiencia.filter((r) => r.caso === caso && r.N === NN).map((r) => [r.p, r.E] as [number, number]),
		}));

	return (
		<div className="pg not-content">
			<h4>Matriz × vector: filas vs columnas vs bloques</h4>
			<p className="pg-sub">A de N×N (aquí N=8) repartida entre p procesos. Color = proceso dueño de la celda.</p>
			<div className="pg-row">
				<div className="pg-seg">
					{(['filas', 'columnas', 'bloques'] as Scheme[]).map((s) => (
						<button key={s} className={sch === s ? 'active' : ''} onClick={() => setScheme(s)}>{s}</button>
					))}
				</div>
				<div className="pg-seg">
					{[2, 4, 8, 16].map((v) => (
						<button key={v} className={p === v ? 'active' : ''} onClick={() => setP(v)}>p={v}</button>
					))}
				</div>
			</div>
			{scheme === 'bloques' && !blocksOk && <div className="pg-note warn">Bloques √p×√p requiere p cuadrado perfecto (4 o 16). Se muestra por filas.</div>}
			<div className="pg-grid-2">
				<svg viewBox="0 0 330 300">
					<text x={4} y={12} fontSize={11}>A</text>
					{Array.from({ length: N * N }, (_, k) => {
						const i = Math.floor(k / N), j = k % N;
						const o = owner(i, j);
						return (
							<g key={k}>
								<rect x={16 + j * 30} y={18 + i * 30} width={28} height={28} rx={3} fill={COLORS[o % 16]} opacity={0.8} />
								{(sch === 'filas' ? j === 0 : sch === 'columnas' ? i === 0 : i % (N / q) === 0 && j % (N / q) === 0) && (
									<text x={16 + j * 30 + 4} y={18 + i * 30 + 12} fontSize={9} style={{ fill: '#111' }}>P{o}</text>
								)}
							</g>
						);
					})}
					<text x={272} y={12} fontSize={11}>v</text>
					{Array.from({ length: N }, (_, j) => (
						<g key={j}>
							<rect x={272} y={18 + j * 30} width={28} height={28} rx={3} fill={sch === 'filas' ? 'var(--pg-border)' : COLORS[(sch === 'columnas' ? Math.floor(j / (N / p)) : Math.floor(j / (N / q))) % 16]} opacity={0.8} />
							<text x={304} y={36 + j * 30} fontSize={8}>{sch === 'filas' ? 'Bcast' : ''}</text>
						</g>
					))}
				</svg>
				<div style={{ margin: 0 }}>
					<table>
						<thead><tr><th>Fase</th><th>{sch}</th></tr></thead>
						<tbody>
							{sch === 'filas' && (
								<>
									<tr><td>Distribuir A</td><td>MPI_Scatter de N/p filas contiguas</td></tr>
									<tr><td>Distribuir v</td><td>MPI_Bcast de v completo (N)</td></tr>
									<tr><td>Cómputo</td><td>N/p productos punto de largo N</td></tr>
									<tr><td>Resultado</td><td>MPI_Gather de N/p elementos de x</td></tr>
								</>
							)}
							{sch === 'columnas' && (
								<>
									<tr><td>Distribuir A</td><td>Send con MPI_Type_vector(N, N/p, N) (no contiguo)</td></tr>
									<tr><td>Distribuir v</td><td>solo el tramo j ∈ bloque (N/p)</td></tr>
									<tr><td>Cómputo</td><td>x parcial de largo N (suma parcial)</td></tr>
									<tr><td>Resultado</td><td>MPI_Reduce(SUM) de N elementos</td></tr>
								</>
							)}
							{sch === 'bloques' && (
								<>
									<tr><td>Distribuir A</td><td>bloques (N/√p)×(N/√p)</td></tr>
									<tr><td>Distribuir v</td><td>tramo de N/√p por columna de procesos</td></tr>
									<tr><td>Cómputo</td><td>x parcial de largo N/√p</td></tr>
									<tr><td>Resultado</td><td>reducción por fila de procesos (log √p)</td></tr>
								</>
							)}
						</tbody>
					</table>
					<div style={{ color: 'var(--pg-muted)', fontSize: '0.8rem' }}>v[j] necesario por: {vNeed(0)}{sch !== 'filas' && ' (cada tramo solo a sus dueños)'}</div>
				</div>
			</div>

			<h4 style={{ marginTop: '1.25rem' }}>Modelo teórico del examen (arquetipo B)</h4>
			<div className="pg-note">
				<Tex>{String.raw`T_p^{filas}=\gamma\frac{n^2}{p}+\alpha\log p+\beta n\qquad T_p^{bloques}=\gamma\frac{n^2}{p}+2\alpha\log\sqrt p+\beta\frac{n}{\sqrt p}`}</Tex>
			</div>
			<div className="pg-row">
				<label className="pg-field"><span>n = <b>1e{logN}</b></span><input type="range" min={2} max={6} value={logN} onChange={(e) => setLogN(+e.target.value)} /></label>
				<label className="pg-field"><span>γ = <b>1e{lg}</b></span><input type="range" min={-11} max={-7} value={lg} onChange={(e) => setLg(+e.target.value)} /></label>
				<label className="pg-field"><span>α = <b>1e{la}</b></span><input type="range" min={-9} max={-3} value={la} onChange={(e) => setLa(+e.target.value)} /></label>
				<label className="pg-field"><span>β = <b>1e{lb}</b></span><input type="range" min={-10} max={-6} value={lb} onChange={(e) => setLb(+e.target.value)} /></label>
			</div>
			<div className="pg-grid-2">
				<div>
					<b>Eficiencia teórica E(p)</b>
					<Chart
						xLog
						xLabel="p"
						yLabel="E"
						yMin={0}
						yMax={1.02}
						series={[
							{ label: 'filas', color: 'var(--pg-c1)', data: ps.map((pp) => [pp, Ts / (pp * Tf(pp))] as [number, number]) },
							{ label: 'bloques', color: 'var(--pg-c2)', data: ps.map((pp) => [pp, Ts / (pp * Tb(pp))] as [number, number]) },
						]}
					/>
				</div>
				<div>
					<b>Granularidad G = T_comp / T_comm</b>
					<Chart
						xLog
						yLog
						xLabel="p"
						yLabel="G"
						series={[
							{ label: 'filas', color: 'var(--pg-c1)', data: ps.slice(1).map((pp) => [pp, (gamma * n * n) / pp / (alpha * Math.log2(pp) + beta * n)] as [number, number]) },
							{ label: 'bloques', color: 'var(--pg-c2)', data: ps.slice(1).map((pp) => [pp, (gamma * n * n) / pp / (2 * alpha * Math.log2(Math.sqrt(pp)) + beta * (n / Math.sqrt(pp)))] as [number, number]) },
						]}
					/>
				</div>
			</div>
			<div className="pg-note ok">
				Bloques: denominador de G más chico ⇒ <b>mayor granularidad</b>. Escalabilidad (oficial): filas <Tex>{'n\\propto p'}</Tex>; bloques <Tex>{'n\\propto\\sqrt{p\\log p}'}</Tex> ⇒ bloques necesita menos crecimiento de n para mantener E: <b>más escalable</b>.
			</div>

			<h4 style={{ marginTop: '1.25rem' }}>Datos medidos (practica_3_ofi, laptop, p = 1…10)</h4>
			<div className="pg-grid-2">
				<div>
					<b>Filas (Bcast + Scatter/Gather)</b>
					<Chart xLabel="p" yLabel="E" yMin={0} yMax={1.02} series={effSeries('row')} />
				</div>
				<div>
					<b>Columnas (Send + vector + Reduce)</b>
					<Chart xLabel="p" yLabel="E" yMin={0} yMax={1.02} series={effSeries('col')} />
				</div>
			</div>
			<div className="pg-scroll">
				<table>
					<thead>
						<tr><th rowSpan={2}>p</th><th colSpan={3}>filas, N=5040 (s)</th><th colSpan={3}>columnas, N=5040 (s)</th></tr>
						<tr><th>T_ej</th><th>T_comp</th><th>T_comm</th><th>T_ej</th><th>T_comp</th><th>T_comm</th></tr>
					</thead>
					<tbody>
						{[2, 4, 6, 8, 10].map((pp) => {
							const r = fijo5040.find((x) => x.caso === 'row' && x.p === pp)!;
							const c = fijo5040.find((x) => x.caso === 'col' && x.p === pp)!;
							return (
								<tr key={pp}>
									<td>{pp}</td>
									<td>{fmt(r.Tej)}</td><td>{fmt(r.Tcomp)}</td><td>{fmt(r.Tcomm)}</td>
									<td>{fmt(c.Tej)}</td><td>{fmt(c.Tcomp)}</td><td>{fmt(c.Tcomm)}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
			<div className="pg-note">
				E(p=10): filas 0.058 → 0.184 al pasar de N=240 a 600 (mejora con N); columnas 0.048 → 0.030 (no mejora). Con N fijo el tiempo total crece con p: el problema es <b>communication-bound</b> en este rango (T_comm ≫ T_comp).
			</div>
		</div>
	);
}
