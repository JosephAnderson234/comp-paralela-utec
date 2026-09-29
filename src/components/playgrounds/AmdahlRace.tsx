import { useEffect, useState } from 'react';
import { fmt } from '../ui/Chart';
import { TXT, useRaf } from '../ui/Player';
import Tex from '../ui/Tex';

type Law = 'amdahl' | 'gustafson';

export default function AmdahlRace() {
	const [fs, setFs] = useState(0.2);
	const [p, setP] = useState(4);
	const [law, setLaw] = useState<Law>('amdahl');
	const [t, setT] = useState(0);
	const [running, setRunning] = useState(false);

	// tiempo normalizado: secuencial con 1 proceso = 1 (Amdahl); en Gustafson Tp = 1 y el trabajo crece
	const fp = 1 - fs;
	const Tseq = law === 'amdahl' ? 1 : fs + p * fp; // tiempo de la versión 1-procesador del problema
	const Tpar = law === 'amdahl' ? fs + fp / p : 1;
	const S = Tseq / Tpar;
	const horizon = Math.max(Tseq, Tpar);

	useEffect(() => {
		setT(0);
		setRunning(false);
	}, [fs, p, law]);
	useRaf(running, (dt) => {
		setT((x) => {
			const nx = x + dt * (horizon / 3.2);
			if (nx >= horizon) {
				setRunning(false);
				return horizon;
			}
			return nx;
		});
	});

	const pct = (v: number) => (100 * v) / horizon;
	const lane = (label: string, segs: { from: number; to: number; color: string; txt?: string }[], done: number) => (
		<div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', alignItems: 'center', gap: 8, fontSize: 12 }}>
			<span>{label}</span>
			<div style={{ position: 'relative', height: 18, background: 'var(--pg-surface-2)', borderRadius: 5, overflow: 'hidden' }}>
				{segs.map((s, i) => {
					const vis = Math.max(0, Math.min(s.to, t) - s.from);
					return (
						<div key={i} style={{ position: 'absolute', left: `${pct(s.from)}%`, width: `${pct(vis)}%`, top: 0, bottom: 0, background: s.color, opacity: 0.85 }} />
					);
				})}
				{t >= done && done > 0 && <span className="badge" style={{ position: 'absolute', left: `calc(${pct(done)}% + 4px)`, top: 0, fontSize: 10 }}>✓</span>}
			</div>
		</div>
	);

	const lanesPar = Array.from({ length: p }, (_, r) => {
		const segs = r === 0 ? [{ from: 0, to: fs, color: 'var(--pg-c5)' }] : [{ from: 0, to: fs, color: 'transparent' }];
		segs.push({ from: fs, to: fs + (law === 'amdahl' ? fp / p : fp), color: 'var(--pg-c1)' });
		return lane(`P${r}`, segs, Tpar);
	});

	return (
		<div className="pg not-content">
			<h4>Carrera: 1 procesador vs p procesadores</h4>
			<p className="pg-sub">Rojo = parte secuencial (solo P0 trabaja, el resto espera); azul = parte paralelizable repartida.</p>
			<div className="pg-row">
				<div className="pg-seg">
					<button className={law === 'amdahl' ? 'active' : ''} onClick={() => setLaw('amdahl')}>Amdahl (n fijo)</button>
					<button className={law === 'gustafson' ? 'active' : ''} onClick={() => setLaw('gustafson')}>Gustafson (n crece con p)</button>
				</div>
				<label className="pg-field"><span>f_s = <b>{fs.toFixed(2)}</b></span><input type="range" min={0} max={0.9} step={0.05} value={fs} onChange={(e) => setFs(+e.target.value)} /></label>
				<label className="pg-field"><span>p = <b>{p}</b></span><input type="range" min={1} max={12} value={p} onChange={(e) => setP(+e.target.value)} /></label>
				<button className="primary" onClick={() => { if (t >= horizon) setT(0); setRunning(!running); }}>{running ? `⏸${TXT} Pausa` : t >= horizon ? '↻ Repetir' : `▶${TXT} Correr`}</button>
			</div>
			<div style={{ display: 'grid', gap: 5 }}>
				<b style={{ fontSize: 12 }}>Secuencial (1 procesador){law === 'gustafson' ? ` — el problema de tamaño p·n` : ''}</b>
				{lane('P0', [{ from: 0, to: fs, color: 'var(--pg-c5)' }, { from: fs, to: Tseq, color: 'var(--pg-c1)' }], Tseq)}
				<b style={{ fontSize: 12, marginTop: 6 }}>Paralelo ({p} procesadores)</b>
				{lanesPar}
				<div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 8 }}>
					<span />
					<div style={{ position: 'relative', height: 14 }}>
						<div style={{ position: 'absolute', left: `${pct(t)}%`, top: 0, width: 2, height: 14, background: 'var(--sl-color-accent)' }} />
						<span style={{ position: 'absolute', left: `calc(${Math.min(88, pct(t))}% + 6px)`, fontSize: 10, color: 'var(--pg-muted)' }}>t = {fmt(t, 2)}</span>
					</div>
				</div>
			</div>
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">Tₛ</span><span className="v">{fmt(Tseq)}</span></div>
				<div className="pg-stat"><span className="k">Tₚ</span><span className="v">{fmt(Tpar)}</span></div>
				<div className="pg-stat"><span className="k">S</span><span className="v">{fmt(S)}</span></div>
				<div className="pg-stat"><span className="k">E</span><span className="v">{fmt(S / p)}</span></div>
				<div className="pg-stat"><span className="k">{law === 'amdahl' ? 'tope 1/f_s' : 'S lineal en p'}</span><span className="v">{law === 'amdahl' ? (fs > 0 ? fmt(1 / fs) : '∞') : `pendiente f_p=${fmt(fp)}`}</span></div>
			</div>
			<div className="pg-note">
				{law === 'amdahl' ? (
					<><Tex>{'T_p=f_s+\\tfrac{f_p}{p},\\ S=\\tfrac{1}{f_s+f_p/p}'}</Tex>. Con más procesadores la barra azul se encoge, pero la roja <b>no</b>: S nunca pasa de 1/f_s.</>
				) : (
					<><Tex>{'T_p=f_s+f_p=1,\\ T_s=f_s+pf_p,\\ S=f_s+pf_p'}</Tex>. Cada procesador recibe la misma cantidad de trabajo; la versión secuencial tendría que hacer <b>p veces</b> la parte paralela.</>
				)}
			</div>
		</div>
	);
}
