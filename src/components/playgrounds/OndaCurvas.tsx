import { useState } from 'react';
import Chart from '../ui/Chart';
import { ondaCurvas } from '../../data/u5';

const COL: Record<number, string> = { 10: 'var(--pg-c1)', 15: 'var(--pg-c2)', 20: 'var(--pg-c3)', 25: 'var(--pg-c4)' };
const MEDIDO: Record<number, { costa: number; max: number; x: number }> = {
	10: { costa: 13.67, max: 24.08, x: 0.836 },
	15: { costa: 12.07, max: 15.81, x: 0.965 },
	20: { costa: 10.59, max: 11.44, x: 0.809 },
	25: { costa: 9.12, max: 9.12, x: 0.033 },
};

export default function OndaCurvas() {
	const [on, setOn] = useState<Record<number, boolean>>({ 10: true, 15: true, 20: true, 25: true });
	const series = [10, 15, 20, 25].filter((k) => on[k]).map((k) => ({ label: `K = ${k}`, color: COL[k], data: ondaCurvas[k] }));
	return (
		<div className="pg not-content">
			<h4>Onda al final de la simulación (curvas superpuestas)</h4>
			<p className="pg-sub">Código del curso con el término del tsunami: 1024 puntos, 800 pasos, τ = 0.3, fronteras 0.1·sin y 0.1·cos. Calculado con la versión MPI de esta página (idéntica a la secuencial con p = 1, 2, 3, 4 y 8). La "costa" es x = 0.</p>
			<div className="pg-row">
				{[10, 15, 20, 25].map((k) => (
					<label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
						<input type="checkbox" checked={on[k]} onChange={() => setOn({ ...on, [k]: !on[k] })} />
						<span style={{ color: COL[k] }}>K = {k}</span>
					</label>
				))}
			</div>
			<Chart
				series={series}
				xLabel="x = i / 1024 (costa en x = 0)"
				yLabel="v(x)"
				height={300}
				yMin={-28}
				yMax={28}
				hlines={[{ y: 20, label: '+20' }, { y: -20, label: '−20' }]}
				vlines={[{ x: 0.11, label: 'zona costera' }]}
			/>
			<div className="pg-stats">
				{[10, 15, 20, 25].map((k) => (
					<div className="pg-stat" key={k}>
						<span className="k" style={{ color: COL[k] }}>K = {k}: ola en la costa</span>
						<span className="v">{MEDIDO[k].costa.toFixed(2)}</span>
						<span className="k">máx {MEDIDO[k].max.toFixed(2)} en x ≈ {MEDIDO[k].x}</span>
					</div>
				))}
			</div>
			<div className="pg-note">Ninguna ola de la zona costera (x ≤ 0.11) supera 20. La única que pasa de 20 es la de K = 10 (24.08), pero está en x ≈ 0.84, lejos de la costa. La amplitud <b>baja</b> al subir K.</div>
		</div>
	);
}
