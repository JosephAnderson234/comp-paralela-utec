import { useState } from 'react';
import Chart from '../ui/Chart';

const lg = Math.log2;

/** log2 de n necesario para mantener E constante (constante K = 1). */
const malla = (p: number) => Math.sqrt(p);
const hiper = (p: number) => lg(p) ** 2;
function hyk(p: number) {
	const objetivo = p * lg(p) ** 2;
	let a = 1;
	let b = 200;
	for (let i = 0; i < 80; i++) {
		const m = (a + b) / 2;
		if (2 ** m * m < objetivo) a = m;
		else b = m;
	}
	return a;
}

export default function IsoSort() {
	const [e, setE] = useState(10);
	const p = 2 ** e;
	const xs = Array.from({ length: 24 }, (_, i) => i + 1);
	const series = [
		{ label: 'bitónico en malla: n ∝ 2^√p', color: 'var(--pg-c1)', data: xs.map((x) => [x, malla(2 ** x)] as [number, number]) },
		{ label: 'bitónico en hipercubo: n ∝ 2^(log² p)', color: 'var(--pg-c4)', data: xs.map((x) => [x, hiper(2 ** x)] as [number, number]) },
		{ label: 'Hyksort: n log n ∝ p log² p', color: 'var(--pg-c3)', data: xs.map((x) => [x, hyk(2 ** x)] as [number, number]) },
	];
	const filas = [
		{ n: 'Bitónico · malla', v: malla(p), c: 'var(--pg-c1)' },
		{ n: 'Bitónico · hipercubo', v: hiper(p), c: 'var(--pg-c4)' },
		{ n: 'Hyksort', v: hyk(p), c: 'var(--pg-c3)' },
	];
	const minV = Math.min(...filas.map((f) => f.v));
	return (
		<div className="pg not-content">
			<h4>¿Cuántos datos hacen falta para mantener la eficiencia?</h4>
			<p className="pg-sub">
				La función de isoeficiencia dice cuánto debe crecer el problema <b>n</b> cuando crece <b>p</b> para que E no baje. El eje vertical es <b>log₂ n</b> (constante K = 1): cada unidad más es <b>el doble</b> de datos. Menos es mejor (más escalable).
			</p>
			<div className="pg-row">
				<label className="pg-field">
					<span>p = 2^{e} = <b>{p.toLocaleString('es')}</b></span>
					<input type="range" min={1} max={24} value={e} onChange={(ev) => setE(+ev.target.value)} />
				</label>
			</div>
			<Chart series={series} xLabel="log₂ p" yLabel="log₂ n necesario" yLog vlines={[{ x: e, label: `p = 2^${e}` }, { x: 16, label: 'cruce 2^16', color: 'var(--pg-bad)' }]} />
			<div className="pg-stats">
				{filas.map((f) => (
					<div className="pg-stat" key={f.n}>
						<span className="k" style={{ color: f.c }}>{f.n}</span>
						<span className="v" style={{ color: f.v === minV ? 'var(--pg-ok)' : undefined }}>n ≈ 2^{f.v < 100 ? f.v.toFixed(1) : f.v.toExponential(1)}</span>
					</div>
				))}
			</div>
			<div className={`pg-note ${e < 16 ? '' : 'warn'}`}>
				{e < 16
					? <>Con p = 2^{e}: √p = {malla(p).toFixed(1)} &lt; log²p = {hiper(p).toFixed(0)}, así que la <b>malla</b> necesita menos datos que el hipercubo (esta es la respuesta de la PD5). Hyksort necesita muchísimo menos que ambos: crece de forma polinomial, no exponencial.</>
					: e === 16
						? <>En p = 2^16 se cruzan: √p = log²p = 256. A partir de aquí cambia el ganador entre malla e hipercubo.</>
						: <>Con p = 2^{e}: √p = {malla(p).toFixed(0)} &gt; log²p = {hiper(p).toFixed(0)}. Para p tan grandes el <b>hipercubo</b> escala mejor que la malla (es la conclusión asintótica de los libros). Hyksort sigue siendo el mejor.</>}
			</div>
		</div>
	);
}
