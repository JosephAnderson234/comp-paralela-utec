import { useMemo, useState } from 'react';
import Chart, { fmt } from '../ui/Chart';
import Tex from '../ui/Tex';

// Ley generalizada (03_Amdahl_Gustafson §3.1): T_s = f_s + f_p p^α, T_p = f_s + f_p p^(α-1)
// α = 0 → Amdahl (strong), α = 1 → Gustafson (weak)
function speedup(fs: number, p: number, alpha: number) {
	const fp = 1 - fs;
	return (fs + fp * p ** alpha) / (fs + fp * p ** (alpha - 1));
}

export default function AmdahlGustafson() {
	const [fs, setFs] = useState(0.1);
	const [pmax, setPmax] = useState(1024);
	const [pSel, setPSel] = useState(64);
	const [alpha, setAlpha] = useState(0.5);
	const [showAlpha, setShowAlpha] = useState(false);

	const ps = useMemo(() => {
		const out: number[] = [];
		for (let p = 1; p <= pmax; p = p < 16 ? p + 1 : Math.round(p * 1.15)) out.push(p);
		if (out[out.length - 1] !== pmax) out.push(pmax);
		return out;
	}, [pmax]);

	const sA = ps.map((p) => [p, speedup(fs, p, 0)] as [number, number]);
	const sG = ps.map((p) => [p, speedup(fs, p, 1)] as [number, number]);
	const sX = ps.map((p) => [p, speedup(fs, p, alpha)] as [number, number]);
	const ideal = ps.map((p) => [p, p] as [number, number]);

	const sSeries = [
		{ label: 'Amdahl (strong)', color: 'var(--pg-c1)', data: sA },
		{ label: 'Gustafson (weak)', color: 'var(--pg-c2)', data: sG },
		...(showAlpha ? [{ label: `Generalizada α=${alpha}`, color: 'var(--pg-c3)', data: sX }] : []),
		{ label: 'Ideal S = p', color: 'var(--sl-color-gray-3)', data: ideal, dashed: true },
	];
	const eSeries = [
		{ label: 'Amdahl', color: 'var(--pg-c1)', data: sA.map(([p, s]) => [p, s / p] as [number, number]) },
		{ label: 'Gustafson', color: 'var(--pg-c2)', data: sG.map(([p, s]) => [p, s / p] as [number, number]) },
		...(showAlpha ? [{ label: `α=${alpha}`, color: 'var(--pg-c3)', data: sX.map(([p, s]) => [p, s / p] as [number, number]) }] : []),
	];

	const SA = speedup(fs, pSel, 0);
	const SG = speedup(fs, pSel, 1);

	return (
		<div className="pg">
			<h4>Amdahl vs Gustafson</h4>
			<p className="pg-sub">Mueve la fracción secuencial y observa el techo de Amdahl frente al crecimiento lineal de Gustafson.</p>
			<div className="pg-row">
				<label className="pg-field">
					<span>
						Fracción secuencial <Tex>{'f_s'}</Tex> = <b>{fs.toFixed(3)}</b>
					</span>
					<input type="range" min={0} max={0.95} step={0.005} value={fs} onChange={(e) => setFs(+e.target.value)} />
				</label>
				<label className="pg-field">
					<span>
						p evaluado = <b>{pSel}</b>
					</span>
					<input type="range" min={1} max={pmax} step={1} value={Math.min(pSel, pmax)} onChange={(e) => setPSel(+e.target.value)} />
				</label>
				<label className="pg-field" style={{ maxWidth: '10rem' }}>
					<span>p máximo</span>
					<select value={pmax} onChange={(e) => setPmax(+e.target.value)}>
						{[16, 64, 256, 1024, 4096].map((v) => (
							<option key={v}>{v}</option>
						))}
					</select>
				</label>
			</div>
			<div className="pg-row">
				<label style={{ margin: 0 }}>
					<input type="checkbox" checked={showAlpha} onChange={(e) => setShowAlpha(e.target.checked)} /> Mostrar ley generalizada (parámetro α)
				</label>
				{showAlpha && (
					<label className="pg-field" style={{ maxWidth: '18rem' }}>
						<span>
							α = <b>{alpha}</b> (0 = Amdahl, 1 = Gustafson)
						</span>
						<input type="range" min={0} max={2} step={0.1} value={alpha} onChange={(e) => setAlpha(+e.target.value)} />
					</label>
				)}
			</div>

			<div className="pg-stats">
				<div className="pg-stat">
					<span className="k">Amdahl S(p)</span>
					<span className="v">{fmt(SA)}</span>
				</div>
				<div className="pg-stat">
					<span className="k">Amdahl E(p)</span>
					<span className="v">{fmt(SA / pSel)}</span>
				</div>
				<div className="pg-stat">
					<span className="k">Límite 1/f_s</span>
					<span className="v">{fs > 0 ? fmt(1 / fs) : '∞'}</span>
				</div>
				<div className="pg-stat">
					<span className="k">Gustafson S(p)</span>
					<span className="v">{fmt(SG)}</span>
				</div>
				<div className="pg-stat">
					<span className="k">Gustafson E(p)</span>
					<span className="v">{fmt(SG / pSel)}</span>
				</div>
			</div>

			<div className="pg-grid-2">
				<div>
					<b>Speedup S(p)</b> (ejes log)
					<Chart
						series={sSeries}
						xLog
						yLog
						xLabel="p"
						yLabel="S"
						yMin={1}
						hlines={fs > 0 ? [{ y: 1 / fs, label: `1/f_s = ${fmt(1 / fs)}`, color: 'var(--pg-c1)' }] : []}
						vlines={[{ x: Math.max(1, pSel), label: `p=${pSel}` }]}
					/>
				</div>
				<div>
					<b>Eficiencia E(p) = S/p</b>
					<Chart series={eSeries} xLog xLabel="p" yLabel="E" yMin={0} yMax={1.02} vlines={[{ x: Math.max(1, pSel), label: `p=${pSel}` }]} />
				</div>
			</div>
			<div className="pg-note">
				<Tex>{String.raw`\text{Amdahl: } S=\frac{1}{f_s+\frac{f_p}{p}}\;\xrightarrow{p\to\infty}\;\frac{1}{f_s} \qquad \text{Gustafson: } S=f_s+p\,f_p`}</Tex>
			</div>
		</div>
	);
}
