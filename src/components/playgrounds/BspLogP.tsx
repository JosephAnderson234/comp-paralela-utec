import { useMemo, useState } from 'react';
import { fmt } from '../ui/Chart';
import PlayerControls, { usePlayer } from '../ui/Player';
import Tex from '../ui/Tex';

function rng(seed: number) {
	let s = seed >>> 0;
	return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function BspTab() {
	const [p, setP] = useState(4);
	const [S, setS] = useState(3);
	const [g, setG] = useState(2);
	const [L, setL] = useState(6);
	const [desb, setDesb] = useState(0.5);
	const [seed, setSeed] = useState(7);

	const steps = useMemo(() => {
		const r = rng(seed);
		return Array.from({ length: S }, () => {
			const w = Array.from({ length: p }, () => Math.round(6 + 10 * (1 - desb) + r() * 14 * desb));
			const h = Array.from({ length: p }, () => 1 + Math.floor(r() * 4));
			return { w, h, wmax: Math.max(...w), hmax: Math.max(...h) };
		});
	}, [p, S, desb, seed]);

	// total de "eventos" de la animación: por superstep 3 fases
	const pl = usePlayer(3 * S, 900);
	const cost = steps.map((s) => s.wmax + g * s.hmax + L);
	const total = cost.reduce((a, b) => a + b, 0);
	const W = 660, rowH = 26, top = 30, left = 40;
	const scale = (W - left - 16) / total;

	let t0 = 0;
	const blocks = steps.map((s, si) => {
		const x0 = t0;
		t0 += cost[si];
		return { ...s, x0, si };
	});

	return (
		<>
			<div className="pg-row">
				<label className="pg-field"><span>p = <b>{p}</b></span><input type="range" min={2} max={8} value={p} onChange={(e) => setP(+e.target.value)} /></label>
				<label className="pg-field"><span>supersteps S = <b>{S}</b></span><input type="range" min={1} max={5} value={S} onChange={(e) => { setS(+e.target.value); pl.reset(); }} /></label>
				<label className="pg-field"><span>g (costo/palabra) = <b>{g}</b></span><input type="range" min={0} max={8} value={g} onChange={(e) => setG(+e.target.value)} /></label>
				<label className="pg-field"><span>L (barrera) = <b>{L}</b></span><input type="range" min={0} max={20} value={L} onChange={(e) => setL(+e.target.value)} /></label>
				<label className="pg-field"><span>desbalance = <b>{Math.round(desb * 100)}%</b></span><input type="range" min={0} max={1} step={0.1} value={desb} onChange={(e) => setDesb(+e.target.value)} /></label>
				<button onClick={() => setSeed(seed + 1)}>🎲 Otra carga</button>
			</div>
			<PlayerControls pl={pl} label="fase" />
			<div className="pg-scroll">
				<svg viewBox={`0 0 ${W} ${top + p * rowH + 40}`} style={{ minWidth: 520 }}>
					{Array.from({ length: p }, (_, r) => (
						<text key={r} x={4} y={top + r * rowH + 17} fontSize={11} fontWeight={700}>P{r}</text>
					))}
					{blocks.map((b) => {
						const shownPhase = pl.k - 3 * b.si; // 1: cómputo, 2: comunicación, 3: barrera
						const xs = left + b.x0 * scale;
						return (
							<g key={b.si}>
								<text x={xs + 2} y={top - 10} fontSize={10} style={{ fill: 'var(--pg-muted)' }}>superstep {b.si + 1}</text>
								{b.w.map((w, r) => (
									<g key={r}>
										{shownPhase >= 1 && (
											<>
												<rect className="pg-anim" x={xs} y={top + r * rowH + 3} width={w * scale} height={rowH - 8} rx={3} fill="var(--pg-c1)" />
												{w < b.wmax && <rect x={xs + w * scale} y={top + r * rowH + 3} width={(b.wmax - w) * scale} height={rowH - 8} fill="var(--pg-bad)" opacity={0.15} />}
											</>
										)}
										{shownPhase >= 2 && <rect className="pg-anim" x={xs + b.wmax * scale} y={top + r * rowH + 3} width={g * b.h[r] * scale} height={rowH - 8} rx={3} fill="var(--pg-c2)" />}
									</g>
								))}
								{shownPhase >= 3 && (
									<>
										<rect x={xs + (b.wmax + g * b.hmax) * scale} y={top} width={L * scale} height={p * rowH - 4} fill="var(--pg-c3)" opacity={0.35} rx={3} />
										<line className="pg-blink" x1={xs + cost[b.si] * scale} x2={xs + cost[b.si] * scale} y1={top - 4} y2={top + p * rowH} stroke="var(--pg-c3)" strokeWidth={2} />
									</>
								)}
							</g>
						);
					})}
					<g transform={`translate(${left}, ${top + p * rowH + 16})`} fontSize={11}>
						<rect width={12} height={10} fill="var(--pg-c1)" rx={2} /><text x={16} y={9}>cómputo w</text>
						<rect x={100} width={12} height={10} fill="var(--pg-c2)" rx={2} /><text x={116} y={9}>comunicación g·h</text>
						<rect x={240} width={12} height={10} fill="var(--pg-c3)" opacity={0.5} rx={2} /><text x={256} y={9}>barrera L</text>
						<rect x={340} width={12} height={10} fill="var(--pg-bad)" opacity={0.25} rx={2} /><text x={356} y={9}>espera por desbalance</text>
					</g>
				</svg>
			</div>
			<div className="pg-stats">
				{cost.map((c, i) => (
					<div className="pg-stat" key={i}><span className="k">superstep {i + 1}</span><span className="v">{steps[i].wmax}+{g}·{steps[i].hmax}+{L} = {c}</span></div>
				))}
				<div className="pg-stat"><span className="k">T_BSP</span><span className="v">{total}</span></div>
			</div>
			<div className="pg-note">
				<Tex>{'T_{superstep}=w+gh+L'}</Tex> con <Tex>{'w=\\max_i w_i'}</Tex> y <Tex>{'h=\\max_i h_i'}</Tex> (h-relación). <Tex>{'T_{BSP}=\\sum_s w_s+g\\sum_s h_s+S\\,L'}</Tex>. El proceso más lento marca el paso: sube el desbalance y mira crecer la zona roja.
			</div>
		</>
	);
}

function LogPTab() {
	const [p, setP] = useState(8);
	const [Lat, setLat] = useState(6);
	const [o, setO] = useState(2);
	const [g, setG] = useState(3);
	const [np, setNp] = useState(64);
	const levels = Math.ceil(Math.log2(p));
	const pl = usePlayer(levels, 1200);
	const local = np / p;
	const per = Lat + o + g;
	const total = local + levels * per;
	const W = 660, H = 60 + p * 24;
	const scale = (W - 60) / (local + levels * (per + 1) + 2);

	return (
		<>
			<div className="pg-row">
				<label className="pg-field"><span>P = <b>{p}</b></span><input type="range" min={2} max={16} value={p} onChange={(e) => { setP(+e.target.value); pl.reset(); }} /></label>
				<label className="pg-field"><span>L (latencia) = <b>{Lat}</b></span><input type="range" min={1} max={20} value={Lat} onChange={(e) => setLat(+e.target.value)} /></label>
				<label className="pg-field"><span>o (overhead CPU) = <b>{o}</b></span><input type="range" min={0} max={10} value={o} onChange={(e) => setO(+e.target.value)} /></label>
				<label className="pg-field"><span>g (gap) = <b>{g}</b></span><input type="range" min={0} max={10} value={g} onChange={(e) => setG(+e.target.value)} /></label>
				<label className="pg-field"><span>n = <b>{np}</b></span><input type="range" min={8} max={256} step={8} value={np} onChange={(e) => setNp(+e.target.value)} /></label>
			</div>
			<PlayerControls pl={pl} label="nivel" />
			<div className="pg-scroll">
				<svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 520 }}>
					{Array.from({ length: p }, (_, r) => {
						const y = 30 + r * 24;
						return (
							<g key={r}>
								<text x={4} y={y + 12} fontSize={11} fontWeight={700}>P{r}</text>
								<rect x={40} y={y + 2} width={local * scale} height={14} rx={3} fill="var(--pg-c1)" />
							</g>
						);
					})}
					{Array.from({ length: Math.min(pl.k, levels) }, (_, lv) => {
						const d = 2 ** lv;
						const x0 = 40 + (local + lv * (per + 1)) * scale;
						const out = [];
						for (let r = 0; r + d < p; r += 2 * d) {
							const ys = 30 + (r + d) * 24 + 9, yd = 30 + r * 24 + 9;
							out.push(
								<g key={`${lv}-${r}`}>
									<rect x={x0} y={ys - 7} width={o * scale} height={14} fill="var(--pg-c3)" rx={2} />
									<line className="pg-anim" x1={x0 + o * scale} y1={ys} x2={x0 + (o + Lat) * scale} y2={yd} stroke="var(--pg-c2)" strokeWidth={2} />
									<rect x={x0 + (o + Lat) * scale} y={yd - 7} width={o * scale} height={14} fill="var(--pg-c3)" rx={2} />
									<rect x={x0 + (2 * o + Lat) * scale} y={yd - 7} width={Math.max(2, (per - 2 * o - Lat + 1) * scale)} height={14} fill="var(--pg-c4)" opacity={0.6} rx={2} />
								</g>,
							);
						}
						return <g key={lv}>{out}<text x={x0} y={22} fontSize={10} style={{ fill: 'var(--pg-muted)' }}>nivel {lv + 1}</text></g>;
					})}
				</svg>
			</div>
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">cómputo local n/P</span><span className="v">{fmt(local)}</span></div>
				<div className="pg-stat"><span className="k">niveles ⌈log₂P⌉</span><span className="v">{levels}</span></div>
				<div className="pg-stat"><span className="k">por nivel ≈ L+o+g</span><span className="v">{per}</span></div>
				<div className="pg-stat"><span className="k">T_LogP ≈</span><span className="v">{fmt(total)}</span></div>
			</div>
			<div className="pg-note">
				Reducción en LogP: <Tex>{'T_{LogP}=O\\left(\\tfrac{n}{P}+\\log P\\,(L+o+g)\\right)'}</Tex>. Morado = <b>o</b> (CPU ocupada enviando/recibiendo), línea naranja = <b>L</b> (tránsito), verde = gap <b>g</b> entre envíos. A diferencia de BSP, no hay barrera global: cada par avanza a su ritmo (asíncrono).
			</div>
		</>
	);
}

export default function BspLogP() {
	const [tab, setTab] = useState<'bsp' | 'logp'>('bsp');
	return (
		<div className="pg not-content">
			<h4>BSP y LogP en una línea de tiempo</h4>
			<div className="pg-row">
				<div className="pg-seg">
					<button className={tab === 'bsp' ? 'active' : ''} onClick={() => setTab('bsp')}>BSP: supersteps (w + gh + L)</button>
					<button className={tab === 'logp' ? 'active' : ''} onClick={() => setTab('logp')}>LogP: reducción (L, o, g, P)</button>
				</div>
			</div>
			{tab === 'bsp' ? <BspTab /> : <LogPTab />}
		</div>
	);
}
