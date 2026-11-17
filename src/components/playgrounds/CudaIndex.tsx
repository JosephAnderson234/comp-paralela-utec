import { useState } from 'react';

const colors = ['var(--pg-c1)', 'var(--pg-c2)', 'var(--pg-c3)', 'var(--pg-c4)', 'var(--pg-c5)', 'var(--pg-c6)'];

export default function CudaIndex() {
	const [N, setN] = useState(20);
	const [B, setB] = useState(2);
	const [H, setH] = useState(4);
	const [loop, setLoop] = useState(true);
	const [sel, setSel] = useState(11);
	const total = B * H;
	const owner = Array.from({ length: N }, (_, i) => (loop ? i % total : i < total ? i : -1));
	const missing = owner.filter((o) => o < 0).length;
	const idle = Math.max(0, total - N);
	const perThread = loop ? Math.ceil(N / total) : 1;
	const s = Math.min(sel, N - 1);
	const o = owner[s];
	const preset = (n: number, b: number, h: number, l: boolean) => { setN(n); setB(b); setH(h); setLoop(l); };
	const cols = Math.min(N, 16);
	const rows = Math.ceil(N / cols);
	return (
		<div className="pg not-content">
			<h4>¿Qué hilo suma cada elemento?</h4>
			<p className="pg-sub">kernel&lt;&lt;&lt;B, H&gt;&gt;&gt; lanza B bloques de H hilos. Cada hilo calcula tid = threadIdx.x + blockIdx.x·blockDim.x. Haz clic en un elemento para ver su cuenta.</p>
			<div className="pg-row">
				<label className="pg-field"><span>N = {N} elementos</span><input type="range" min="1" max="64" value={N} onChange={(e) => setN(+e.target.value)} /></label>
				<label className="pg-field"><span>B = {B} bloques</span><input type="range" min="1" max="16" value={B} onChange={(e) => setB(+e.target.value)} /></label>
				<label className="pg-field"><span>H = {H} hilos/bloque</span><input type="range" min="1" max="16" value={H} onChange={(e) => setH(+e.target.value)} /></label>
			</div>
			<div className="pg-row">
				<div className="pg-seg" role="group" aria-label="Versión del kernel">
					<button className={!loop ? 'active' : ''} onClick={() => setLoop(false)}>if (tid &lt; N)</button>
					<button className={loop ? 'active' : ''} onClick={() => setLoop(true)}>while + salto</button>
				</div>
				<div className="pg-seg" role="group" aria-label="Ejemplos">
					<button onClick={() => preset(10, 10, 1, false)}>lámina: &lt;&lt;&lt;N,1&gt;&gt;&gt;</button>
					<button onClick={() => preset(37, 5, 8, false)}>(N+H−1)/H bloques</button>
					<button onClick={() => preset(37, 37 / 8 | 0, 8, false)}>N/H (división entera)</button>
				</div>
			</div>
			<div style={{ overflowX: 'auto' }}>
				<svg viewBox={`0 0 ${cols * 44 + 20} ${rows * 52 + 10}`} style={{ width: '100%', minWidth: 480, maxHeight: 260 }} role="img" aria-label="Vector con el hilo asignado a cada elemento">
					{owner.map((ow, i) => {
						const x = 10 + (i % cols) * 44, y = 6 + Math.floor(i / cols) * 52;
						const blk = ow < 0 ? -1 : Math.floor(ow / H);
						return (
							<g key={i} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
								<rect x={x} y={y} width="40" height="46" rx="5" fill={ow < 0 ? 'color-mix(in srgb, var(--pg-bad) 30%, var(--pg-surface))' : `color-mix(in srgb, ${colors[blk % 6]} 28%, var(--pg-surface))`} stroke={i === s ? 'var(--pg-ok)' : 'var(--pg-border)'} strokeWidth={i === s ? 3 : 1} />
								<text x={x + 20} y={y + 18} textAnchor="middle" fontSize="12" fill="var(--pg-muted)">{i}</text>
								<text x={x + 20} y={y + 36} textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor">{ow < 0 ? '✗' : `b${blk}t${ow % H}`}</text>
							</g>
						);
					})}
				</svg>
			</div>
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">hilos lanzados</span><span className="v">{B}·{H} = {total}</span></div>
				<div className="pg-stat"><span className="k">elementos sin sumar</span><span className="v" style={{ color: missing ? 'var(--pg-bad)' : undefined }}>{missing}</span></div>
				<div className="pg-stat"><span className="k">hilos ociosos</span><span className="v">{idle}</span></div>
				<div className="pg-stat"><span className="k">máx. elementos por hilo</span><span className="v">{missing ? 1 : perThread}</span></div>
			</div>
			<div className="pg-note">
				{o < 0
					? `Elemento ${s}: ningún hilo lo toca. Con if (tid < N) solo existen tids 0…${total - 1}; hacen falta más bloques o el bucle while.`
					: `Elemento ${s}: lo suma el hilo ${o % H} del bloque ${Math.floor(o / H)} → tid = ${o % H} + ${Math.floor(o / H)}·${H} = ${o}${loop && s !== o ? `, y llega a ${s} tras ${(s - o) / total} salto(s) de ${total}` : ''}.`}
			</div>
		</div>
	);
}
