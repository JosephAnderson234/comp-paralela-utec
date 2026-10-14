import { useState } from 'react';

const PCOL = ['var(--pg-c1)', 'var(--pg-c2)', 'var(--pg-c3)', 'var(--pg-c4)', 'var(--pg-c5)', 'var(--pg-c6)'];

export default function HaloRatio() {
	const L = 12;
	const [P, setP] = useState(4);
	const [n3, setN3] = useState(10);
	const k = Math.round(Math.sqrt(P));
	const m = L / k;
	const celdas = m * m;
	const haloProc = 4 * m;
	const haloTotal = P * haloProc;
	const cs = 13;
	const gap = 14;
	const lado = k * (m + 2) * cs + (k - 1) * gap;

	const tot3 = (n3 + 2) ** 3;
	const halo3 = tot3 - n3 ** 3;

	return (
		<div className="pg not-content">
			<h4>Descomposición de dominio y celdas de halo</h4>
			<p className="pg-sub">Una malla de {L}×{L} se reparte entre <b>P</b> procesos MPI. Cada proceso guarda una <b>copia del borde</b> de sus vecinos (halo) y la actualiza por mensajes en cada iteración.</p>
			<div className="pg-row">
				<span style={{ color: 'var(--pg-muted)' }}>procesos MPI en el nodo:</span>
				<div className="pg-seg">
					{[1, 4, 9, 16].map((v) => <button key={v} className={P === v ? 'active' : ''} onClick={() => setP(v)}>P = {v}{v === 1 ? ' (1 proceso + hilos)' : ''}</button>)}
				</div>
			</div>
			<div className="pg-grid-2" style={{ alignItems: 'center' }}>
				<svg viewBox={`-4 -4 ${lado + 8} ${lado + 8}`} style={{ maxWidth: 330, width: '100%' }} role="img" aria-label="Subdominios con halo">
					{Array.from({ length: P }, (_, q) => {
						const bx = (q % k) * ((m + 2) * cs + gap);
						const by = Math.floor(q / k) * ((m + 2) * cs + gap);
						const col = PCOL[q % PCOL.length];
						const cells = [];
						for (let i = 0; i < m + 2; i++)
							for (let j = 0; j < m + 2; j++) {
								const borde = i === 0 || j === 0 || i === m + 1 || j === m + 1;
								const esquina = (i === 0 || i === m + 1) && (j === 0 || j === m + 1);
								if (esquina) continue;
								cells.push(<rect key={`${i}-${j}`} x={bx + j * cs} y={by + i * cs} width={cs - 1} height={cs - 1} rx={2} fill={borde ? 'transparent' : col} stroke={borde ? col : 'none'} strokeDasharray={borde ? '2 2' : undefined} opacity={borde ? 0.9 : 0.75} />);
							}
						return <g key={q}>{cells}</g>;
					})}
				</svg>
				<div style={{ display: 'grid', gap: 8 }}>
					<div className="pg-stats" style={{ marginTop: 0 }}>
						<div className="pg-stat"><span className="k">celdas por proceso</span><span className="v">{m}×{m} = {celdas}</span></div>
						<div className="pg-stat"><span className="k">halo por proceso</span><span className="v">{haloProc}</span></div>
						<div className="pg-stat"><span className="k">halo total en el nodo</span><span className="v" style={{ color: P > 1 ? 'var(--pg-bad)' : 'var(--pg-ok)' }}>{haloTotal}</span></div>
						<div className="pg-stat"><span className="k">halo / celdas</span><span className="v">{((100 * haloProc) / celdas).toFixed(0)} %</span></div>
					</div>
					<div className="legend"><span><i style={{ background: 'var(--pg-c1)' }} />celdas propias</span><span><i style={{ border: '1px dashed var(--pg-c1)' }} />halo (copia del vecino)</span></div>
				</div>
			</div>
			<div className={`pg-note ${P === 1 ? 'ok' : 'warn'}`}>
				{P === 1
					? <>Con <b>un proceso por nodo</b> y hilos OpenMP, los hilos leen directo de la memoria compartida: solo hay halo en el borde del nodo ({haloTotal} celdas). Menos memoria duplicada y menos datos que comunicar.</>
					: <>Con {P} procesos cada uno computa {celdas} celdas (1/{P} del total), pero el halo por proceso solo bajó a {haloProc}: el halo total del nodo es <b>{haloTotal}</b>, {Math.round(haloTotal / (4 * L))}× el de un solo proceso. El trabajo se divide entre P, pero el halo por proceso solo entre √P.</>}
			</div>
			<h4 style={{ marginTop: 16 }}>En 3D: un cubo de n³ celdas con 1 celda de halo</h4>
			<div className="pg-row">
				<label className="pg-field"><span>n = <b>{n3}</b></span><input type="range" min={4} max={60} value={n3} onChange={(e) => setN3(+e.target.value)} /></label>
			</div>
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">cubo con halo</span><span className="v">{n3 + 2}³ = {tot3.toLocaleString('es')}</span></div>
				<div className="pg-stat"><span className="k">celdas de halo</span><span className="v">{halo3.toLocaleString('es')}</span></div>
				<div className="pg-stat"><span className="k">% de halo</span><span className="v">{((100 * halo3) / tot3).toFixed(0)} %</span></div>
			</div>
			<div className="pg-note">Valores de la lámina: 10³ → 12³ (728 celdas, 42 %), 20³ → 22³ (2648, 25 %), 40³ → 42³ (10 088, 14 %). Cuanto <b>más pequeño</b> el subdominio de cada proceso, mayor es la fracción de memoria gastada en halos.</div>
		</div>
	);
}
