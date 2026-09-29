import { useMemo, useState } from 'react';
import { fmt } from '../ui/Chart';
import PlayerControls, { usePlayer } from '../ui/Player';
import Tex from '../ui/Tex';

type MergeKind = 'secuencial' | 'paralelo';

function rand(n: number, seed: number) {
	let s = seed;
	return Array.from({ length: n }, () => {
		s = (s * 9301 + 49297) % 233280;
		return 1 + Math.floor((s / 233280) * 99);
	});
}

export default function MergesortTree() {
	const [logN, setLogN] = useState(3);
	const [seed, setSeed] = useState(5);
	const [kind, setKind] = useState<MergeKind>('secuencial');
	const [p, setP] = useState(4);
	const n = 2 ** logN;
	const A = useMemo(() => rand(n, seed), [n, seed]);

	// niveles: 0 = raíz (1 bloque de n), logN = hojas (n bloques de 1)
	// animación: logN pasos dividiendo, luego logN pasos combinando
	const pl = usePlayer(2 * logN, 1100);
	const k = pl.k;
	const divDepth = Math.min(k, logN); // hasta qué nivel se dividió
	const mergedUpTo = k > logN ? logN - (k - logN) : logN; // nivel más alto ya combinado

	// contenido de cada bloque (nivel, índice)
	const block = (lv: number, b: number) => {
		const size = n >> lv;
		const seg = A.slice(b * size, (b + 1) * size);
		return lv >= mergedUpTo ? [...seg].sort((x, y) => x - y) : seg;
	};

	// costo de span acumulado según tipo de merge
	const mergeSpan = (size: number) => (kind === 'secuencial' ? size : Math.log2(size) + 1);
	let span = 0, work = 0;
	for (let lv = logN - 1; lv >= mergedUpTo; lv--) {
		const size = n >> lv;
		span += mergeSpan(size);
		work += n; // cada nivel mezcla n elementos en total
	}
	span += divDepth; // cada división cuesta O(1)

	const W = 680, rowH = 44, top = 14;
	const H = top + (logN + 1) * rowH + 8;
	const colors = ['var(--pg-c1)', 'var(--pg-c2)', 'var(--pg-c3)', 'var(--pg-c4)', 'var(--pg-c5)', 'var(--pg-c6)', 'var(--pg-c1)', 'var(--pg-c2)'];
	const procOf = (lv: number, b: number) => {
		// asignación típica: cada proceso recibe n/p elementos; en niveles altos se combinan
		const size = n >> lv;
		return Math.floor((b * size * p) / n) % p;
	};

	const TsN = 1e6, Ts = TsN * Math.log2(TsN);
	const Tinf = kind === 'secuencial' ? 2 * TsN : Math.log2(TsN) ** 2;
	const Tp = Ts / p + Tinf;

	return (
		<div className="pg not-content">
			<h4>Mergesort paralelo: árbol de recursión animado</h4>
			<p className="pg-sub">Baja dividiendo (O(1) por nivel) y sube combinando. Las dos llamadas recursivas van en <code>pardo</code>; el <b>merge</b> decide el span.</p>
			<div className="pg-row">
				<label className="pg-field"><span>n = <b>{n}</b></span><input type="range" min={2} max={4} value={logN} onChange={(e) => { setLogN(+e.target.value); pl.reset(); }} /></label>
				<label className="pg-field"><span>procesos p = <b>{p}</b></span><input type="range" min={1} max={8} value={p} onChange={(e) => setP(+e.target.value)} /></label>
				<div className="pg-seg">
					<button className={kind === 'secuencial' ? 'active' : ''} onClick={() => setKind('secuencial')}>Merge secuencial O(n)</button>
					<button className={kind === 'paralelo' ? 'active' : ''} onClick={() => setKind('paralelo')}>Merge paralelo O(log n)</button>
				</div>
				<button onClick={() => { setSeed(seed + 7); pl.reset(); }}>🎲 Otro arreglo</button>
			</div>
			<PlayerControls pl={pl} label="paso" />
			<div className="pg-scroll">
				<svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 560 }}>
					{Array.from({ length: logN + 1 }, (_, lv) => {
						const nb = 2 ** lv;
						const visible = lv <= divDepth || lv >= mergedUpTo;
						if (!visible) return null;
						const bw = (W - 20) / nb;
						const size = n >> lv;
						const active = (k <= logN && lv === divDepth && k > 0) || (k > logN && lv === mergedUpTo);
						return (
							<g key={`${lv}-${mergedUpTo <= lv ? 's' : 'u'}`} className="pg-pulse">
								{Array.from({ length: nb }, (_, b) => {
									const x = 10 + b * bw;
									const y = top + lv * rowH;
									const vals = block(lv, b);
									const cw = Math.min(30, (bw - 8) / size);
									const sorted = lv >= mergedUpTo;
									return (
										<g key={b}>
											{lv > 0 && (
												<line x1={10 + Math.floor(b / 2) * bw * 2 + bw} y1={y - rowH + 30} x2={x + bw / 2} y2={y} stroke="var(--pg-border)" />
											)}
											<rect x={x + bw / 2 - (cw * size) / 2 - 3} y={y} width={cw * size + 6} height={28} rx={6} fill="var(--sl-color-bg)"
												stroke={active ? 'var(--pg-c2)' : p > 1 ? colors[procOf(lv, b)] : 'var(--pg-border)'} strokeWidth={active ? 2.2 : 1.2} className="pg-anim" />
											{vals.map((v, t) => (
												<text key={t} x={x + bw / 2 - (cw * size) / 2 + (t + 0.5) * cw} y={y + 18} textAnchor="middle" fontSize={cw < 18 ? 9 : 11} fontWeight={sorted && size > 1 ? 700 : 400}
													style={{ fill: sorted && size > 1 ? 'var(--pg-ok)' : 'var(--sl-color-white)' }}>{v}</text>
											))}
										</g>
									);
								})}
							</g>
						);
					})}
				</svg>
			</div>
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">fase</span><span className="v">{k === 0 ? 'inicio' : k <= logN ? `dividir (nivel ${k})` : `combinar (nivel ${mergedUpTo})`}</span></div>
				<div className="pg-stat"><span className="k">trabajo de merge acumulado</span><span className="v">{work} ops</span></div>
				<div className="pg-stat"><span className="k">span acumulado ({kind})</span><span className="v">{fmt(span)}</span></div>
				<div className="pg-stat"><span className="k">span total (n={n})</span><span className="v">{kind === 'secuencial' ? `≈ 2n = ${2 * n}` : `≈ log²n = ${logN * logN}`}</span></div>
			</div>
			<div className={`pg-note ${kind === 'secuencial' ? 'warn' : 'ok'}`}>
				{kind === 'secuencial' ? (
					<>
						<Tex>{'T_\\infty(n)=T_\\infty(n/2)+O(n)=O(n)'}</Tex>: el último merge (n elementos) lo hace <b>un solo</b> procesador ⇒ cuello de botella. Con n=10⁶ y p={p}: <Tex>{'T_p=O\\!\\left(\\tfrac{n\\log n}{p}+n\\right)'}</Tex> ≈ {fmt(Tp)} ⇒ S ≈ <b>{fmt(Ts / Tp)}</b> (tope <Tex>{'\\log n'}</Tex> ≈ {fmt(Math.log2(TsN))}).
					</>
				) : (
					<>
						Con merge paralelo <Tex>{'T_\\infty(n)=T_\\infty(n/2)+O(\\log n)=O(\\log^2 n)'}</Tex>. Con n=10⁶ y p={p}: <Tex>{'T_p=O\\!\\left(\\tfrac{n\\log n}{p}+\\log^2 n\\right)'}</Tex> ≈ {fmt(Tp)} ⇒ S ≈ <b>{fmt(Ts / Tp)}</b> (casi lineal).
					</>
				)}
				<br />En ambos casos <Tex>{'W(n)=2W(n/2)+O(n)=O(n\\log n)'}</Tex>. Los colores de borde muestran qué proceso tiene cada bloque (n/p elementos por proceso).
			</div>
		</div>
	);
}
