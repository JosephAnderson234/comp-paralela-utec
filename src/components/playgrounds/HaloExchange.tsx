import { useMemo, useState } from 'react';
import { fmt } from '../ui/Chart';
import PlayerControls, { Packet, usePlayer } from '../ui/Player';
import Tex from '../ui/Tex';

type Borde = 'replica' | 'reducida';
type Signal = 'escalon' | 'pico' | 'ruido';

function initial(n: number, s: Signal): number[] {
	return Array.from({ length: n }, (_, i) => {
		if (s === 'escalon') return i < n / 2 ? 1 : 0;
		if (s === 'pico') return i === Math.floor(n / 2) || i === Math.floor(n / 2) - 1 ? 1 : 0;
		return Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
	});
}

function smoothStep(u: number[], borde: Borde): number[] {
	const n = u.length;
	return u.map((v, i) => {
		const hasL = i > 0, hasR = i < n - 1;
		if (borde === 'replica') return ((hasL ? u[i - 1] : v) + v + (hasR ? u[i + 1] : v)) / 3;
		const s = (hasL ? u[i - 1] : 0) + v + (hasR ? u[i + 1] : 0);
		return s / (1 + (hasL ? 1 : 0) + (hasR ? 1 : 0));
	});
}

export default function HaloExchange() {
	const [n, setN] = useState(24);
	const [p, setP] = useState(4);
	const [T, setT] = useState(6);
	const [sig, setSig] = useState<Signal>('escalon');
	const [borde, setBorde] = useState<Borde>('replica');
	// cada iteración = 2 fases: intercambio de halo + cómputo
	const pl = usePlayer(2 * T, 1000);

	const hist = useMemo(() => {
		const out = [initial(n, sig)];
		for (let t = 0; t < T; t++) out.push(smoothStep(out[t], borde));
		return out;
	}, [n, sig, T, borde]);

	const iter = Math.floor(pl.k / 2); // iteraciones ya completadas
	const phase = pl.k === 0 ? 'inicio' : pl.k % 2 === 1 ? 'halo' : 'computo';
	const u = hist[iter];

	const W = 660, H = 250, left = 20, right = 20;
	const cw = (W - left - right) / n;
	const base = 190, hmax = 120;
	const starts = Array.from({ length: p }, (_, k) => Math.ceil((k * n) / p));
	const ends = Array.from({ length: p }, (_, k) => Math.ceil(((k + 1) * n) / p) - 1);
	const owner = (i: number) => starts.filter((s) => s <= i).length - 1;
	const colors = ['var(--pg-c1)', 'var(--pg-c2)', 'var(--pg-c3)', 'var(--pg-c4)', 'var(--pg-c5)', 'var(--pg-c6)', 'var(--pg-c1)', 'var(--pg-c2)'];

	const tc = 1e-9, tw = 1e-8, N = 1e7, TT = 1000;
	const Ts = 3 * N * TT * tc;
	const Tp = (pp: number) => TT * (3 * (N / pp) * tc + (pp > 1 ? 8 * tw : 0));

	return (
		<div className="pg not-content">
			<h4>Suavizado 1D con intercambio de halo (PD01)</h4>
			<p className="pg-sub">
				<Tex>{'U_i^{t}=\\tfrac13\\left(U_{i-1}^{t-1}+U_i^{t-1}+U_{i+1}^{t-1}\\right)'}</Tex> · cada iteración: <b>① intercambio de celdas fantasma</b> entre vecinos → <b>② cómputo local</b>.
			</p>
			<div className="pg-row">
				<label className="pg-field"><span>pixels n = <b>{n}</b></span><input type="range" min={8} max={48} step={4} value={n} onChange={(e) => { setN(+e.target.value); pl.reset(); }} /></label>
				<label className="pg-field"><span>procesos p = <b>{p}</b></span><input type="range" min={1} max={6} value={p} onChange={(e) => { setP(+e.target.value); pl.reset(); }} /></label>
				<label className="pg-field"><span>iteraciones t = <b>{T}</b></span><input type="range" min={1} max={20} value={T} onChange={(e) => { setT(+e.target.value); pl.reset(); }} /></label>
			</div>
			<div className="pg-row">
				<div className="pg-seg">
					{(['escalon', 'pico', 'ruido'] as Signal[]).map((s) => <button key={s} className={sig === s ? 'active' : ''} onClick={() => { setSig(s); pl.reset(); }}>{s === 'escalon' ? 'Escalón' : s === 'pico' ? 'Pico' : 'Ruido'}</button>)}
				</div>
				<div className="pg-seg">
					<button className={borde === 'replica' ? 'active' : ''} onClick={() => setBorde('replica')}>Borde: pixel fantasma (réplica)</button>
					<button className={borde === 'reducida' ? 'active' : ''} onClick={() => setBorde('reducida')}>Borde: fórmula reducida (÷2)</button>
				</div>
			</div>
			<PlayerControls pl={pl} label="fase" />
			<div className="pg-scroll">
				<svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 520 }}>
					{/* subdominios */}
					{starts.map((s, k) => (
						<g key={k}>
							<rect x={left + s * cw} y={22} width={(ends[k] - s + 1) * cw} height={base - 22 + 26} rx={6} fill={colors[k]} opacity={0.07} />
							<text x={left + ((s + ends[k] + 1) / 2) * cw} y={16} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: colors[k] }}>
								P{k} · {ends[k] - s + 1} px
							</text>
						</g>
					))}
					{/* barras */}
					{u.map((v, i) => (
						<g key={i}>
							<rect className="pg-anim" x={left + i * cw + 1} y={base - v * hmax} width={cw - 2} height={Math.max(1, v * hmax)} rx={2} fill={colors[owner(i)]} opacity={phase === 'computo' ? 1 : 0.8} />
							<text x={left + (i + 0.5) * cw} y={base + 14} textAnchor="middle" fontSize={8} style={{ fill: 'var(--pg-muted)' }}>{i}</text>
						</g>
					))}
					<line x1={left} x2={W - right} y1={base} y2={base} stroke="var(--pg-border)" />
					{/* halos */}
					{phase === 'halo' &&
						starts.slice(1).map((s, idx) => {
							const k = idx + 1;
							const xB = left + s * cw; // frontera entre P(k-1) y Pk
							return (
								<g key={`h${k}-${pl.k}`}>
									<Packet x1={xB - cw / 2} y1={base + 28} x2={xB + cw / 2} y2={base + 46} color={colors[k - 1]} label={fmt(u[s - 1], 2)} />
									<Packet x1={xB + cw / 2} y1={base + 28} x2={xB - cw / 2} y2={base + 46} color={colors[k]} label={fmt(u[s], 2)} />
								</g>
							);
						})}
					{phase === 'halo' && p > 1 && (
						<text x={W / 2} y={H - 2} textAnchor="middle" fontSize={11} style={{ fill: 'var(--pg-c2)' }}>
							intercambio de halo: {2 * (p - 1)} mensajes de 1 float (4 B) en paralelo
						</text>
					)}
					{phase === 'computo' && (
						<text x={W / 2} y={H - 2} textAnchor="middle" fontSize={11} style={{ fill: 'var(--pg-ok)' }}>
							cómputo local de la iteración {iter}: cada Pk actualiza sus {Math.ceil(n / p)} pixels (3 ops c/u)
						</text>
					)}
				</svg>
			</div>
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">iteración</span><span className="v">{iter}/{T}</span></div>
				<div className="pg-stat"><span className="k">mensajes / iteración</span><span className="v">{2 * (p - 1)}</span></div>
				<div className="pg-stat"><span className="k">ops / proceso / iter.</span><span className="v">≈ {3 * Math.ceil(n / p)}</span></div>
				<div className="pg-stat"><span className="k">¿igual al secuencial?</span><span className="v" style={{ color: 'var(--pg-ok)' }}>sí ✓</span></div>
			</div>
			<div className="pg-note">
				Con los datos del PD01 (<Tex>{'t_c=10^{-9}'}</Tex>, <Tex>{'t_w=10^{-8}'}</Tex> s/B) y, por ejemplo, <Tex>{'n=10^7,\\ t=10^3'}</Tex>:{' '}
				<Tex>{'T_s=3nt\\,t_c'}</Tex> = <b>{fmt(Ts)} s</b>, <Tex>{'T_p=t\\left[3\\tfrac{n}{p}t_c+8t_w\\right]'}</Tex> = <b>{fmt(Tp(p))} s</b> ⇒ S = <b>{fmt(Ts / Tp(p))}</b>, E = <b>{fmt(Ts / Tp(p) / p)}</b>.
				<br />El halo es <b>O(1) por proceso</b> (2 floats) mientras el cómputo es <b>O(n/p)</b>: la razón comunicación/cómputo baja al crecer n/p.
			</div>
		</div>
	);
}
