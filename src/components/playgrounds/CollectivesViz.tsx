import { useMemo, useState } from 'react';
import { fmt } from '../ui/Chart';
import Tex from '../ui/Tex';

type OpName = 'Bcast' | 'Scatter' | 'Gather' | 'Reduce' | 'Allreduce';
type Topo = 'lineal' | 'arbol';
type Msg = { from: number; to: number; chunks?: number[]; val?: boolean; size: number };
type Buf = { chunks: number[]; val: number | null };

const CHUNK_COLORS = ['#4cc3d9', '#f2a541', '#b38cf2', '#6fd08c', '#f27a7a', '#e8d15a', '#7fa7ff', '#ff8fd1'];

function initial(op: OpName, p: number): Buf[] {
	return Array.from({ length: p }, (_, r) => {
		switch (op) {
			case 'Bcast': return { chunks: r === 0 ? [0] : [], val: null };
			case 'Scatter': return { chunks: r === 0 ? Array.from({ length: p }, (_, i) => i) : [], val: null };
			case 'Gather': return { chunks: [r], val: null };
			default: return { chunks: [], val: r + 1 };
		}
	});
}

function steps(op: OpName, topo: Topo, p: number, m: number): Msg[][] {
	const out: Msg[][] = [];
	const D = 2 ** Math.ceil(Math.log2(p));
	const treeBcast = (val: boolean) => {
		for (let d = 1; d < p; d *= 2) {
			const st: Msg[] = [];
			for (let r = 0; r < d; r++) if (r + d < p) st.push({ from: r, to: r + d, chunks: val ? undefined : [0], val, size: m });
			out.push(st);
		}
	};
	const treeReduce = () => {
		for (let d = 1; d < p; d *= 2) {
			const st: Msg[] = [];
			for (let r = 0; r + d < p; r += 2 * d) st.push({ from: r + d, to: r, val: true, size: m });
			out.push(st);
		}
	};
	if (topo === 'lineal') {
		switch (op) {
			case 'Bcast':
				for (let k = 1; k < p; k++) out.push([{ from: k - 1, to: k, chunks: [0], size: m }]);
				break;
			case 'Scatter':
				for (let k = 1; k < p; k++) out.push([{ from: 0, to: k, chunks: [k], size: m / p }]);
				break;
			case 'Gather':
				for (let k = 1; k < p; k++) out.push([{ from: k, to: 0, chunks: [k], size: m / p }]);
				break;
			case 'Reduce':
				for (let k = 1; k < p; k++) out.push([{ from: k, to: 0, val: true, size: m }]);
				break;
			case 'Allreduce':
				for (let k = 1; k < p; k++) out.push([{ from: k, to: 0, val: true, size: m }]);
				for (let k = 1; k < p; k++) out.push([{ from: k - 1, to: k, val: true, size: m }]);
				break;
		}
		return out;
	}
	switch (op) {
		case 'Bcast':
			treeBcast(false);
			break;
		case 'Scatter':
			for (let d = D / 2; d >= 1; d /= 2) {
				const st: Msg[] = [];
				for (let r = 0; r < p; r += 2 * d) {
					if (r + d >= p) continue;
					const chunks = Array.from({ length: Math.min(r + 2 * d, p) - (r + d) }, (_, i) => r + d + i);
					st.push({ from: r, to: r + d, chunks, size: (chunks.length * m) / p });
				}
				out.push(st);
			}
			break;
		case 'Gather':
			for (let d = 1; d < p; d *= 2) {
				const st: Msg[] = [];
				for (let r = 0; r + d < p; r += 2 * d) {
					const chunks = Array.from({ length: Math.min(r + 2 * d, p) - (r + d) }, (_, i) => r + d + i);
					st.push({ from: r + d, to: r, chunks, size: (chunks.length * m) / p });
				}
				out.push(st);
			}
			break;
		case 'Reduce':
			treeReduce();
			break;
		case 'Allreduce':
			treeReduce();
			treeBcast(true);
			break;
	}
	return out;
}

function apply(bufs: Buf[], st: Msg[], op: OpName): Buf[] {
	const next = bufs.map((b) => ({ chunks: [...b.chunks], val: b.val }));
	for (const m of st) {
		if (m.val) {
			const v = bufs[m.from].val ?? 0;
			next[m.to].val = next[m.to].val === null ? v : next[m.to].val! + v;
		}
		if (m.chunks) {
			next[m.to].chunks = [...new Set([...next[m.to].chunks, ...m.chunks])].sort((a, b) => a - b);
			if (op === 'Scatter') next[m.from].chunks = next[m.from].chunks.filter((c) => !m.chunks!.includes(c) || m.from === c);
		}
	}
	return next;
}

export default function CollectivesViz() {
	const [op, setOp] = useState<OpName>('Bcast');
	const [topo, setTopo] = useState<Topo>('arbol');
	const [p, setP] = useState(8);
	const [k, setK] = useState(0);
	const [logA, setLogA] = useState(-6); // α
	const [logB, setLogB] = useState(-9); // β
	const [logM, setLogM] = useState(6); // m

	const alpha = 10 ** logA, beta = 10 ** logB, m = 10 ** logM;
	const S = useMemo(() => steps(op, topo, p, m), [op, topo, p, m]);
	const kk = Math.min(k, S.length);

	// Allreduce: en la fase de difusión el receptor reemplaza (no suma)
	const bufs = useMemo(() => {
		let b = initial(op, p);
		const reducePhase = op === 'Allreduce' ? Math.ceil(topo === 'lineal' ? p - 1 : Math.log2(p)) : Infinity;
		for (let i = 0; i < kk; i++) {
			if (op === 'Allreduce' && i >= reducePhase) {
				const nb = b.map((x) => ({ ...x }));
				for (const msg of S[i]) nb[msg.to].val = b[msg.from].val;
				b = nb;
			} else b = apply(b, S[i], op);
		}
		return b;
	}, [op, p, kk, S, topo]);

	const cost = (list: Msg[][]) => list.reduce((acc, st) => acc + alpha + beta * Math.max(...st.map((x) => x.size)), 0);
	const other = steps(op, topo === 'lineal' ? 'arbol' : 'lineal', p, m);
	const cur = kk > 0 ? S[kk - 1] : [];
	const lg = Math.log2(p);

	const formulas: Record<OpName, { lin: string; tree: string }> = {
		Bcast: { lin: 'O(p(\\alpha+m\\beta))', tree: 'O(\\log p\\,(\\alpha+m\\beta))' },
		Scatter: { lin: '(p-1)(\\alpha+\\beta\\tfrac{m}{p})=O(\\alpha p+\\beta m)', tree: '\\alpha\\log p+\\beta m(1-\\tfrac1p)=O(\\alpha\\log p+\\beta m)' },
		Gather: { lin: '(p-1)(\\alpha+\\beta\\tfrac{m}{p})=O(\\alpha p+\\beta m)', tree: '\\alpha\\log p+\\beta m(1-\\tfrac1p)=O(\\alpha\\log p+\\beta m)' },
		Reduce: { lin: 'O(p(\\alpha+m\\beta))', tree: 'O(\\log p\\,(\\alpha+m\\beta))' },
		Allreduce: { lin: '\\approx 2(p-1)(\\alpha+m\\beta)', tree: '\\approx 2\\log p\\,(\\alpha+m\\beta)' },
	};

	// layout: procesos en círculo
	const W = 640, H = 300, cx = W / 2, cy = H / 2 + 4, R = 112;
	const posOf = (r: number) => {
		const a = -Math.PI / 2 + (2 * Math.PI * r) / p;
		return [cx + R * 1.9 * Math.cos(a) * 0.62, cy + R * Math.sin(a)] as [number, number];
	};

	return (
		<div className="pg">
			<h4>Colectivas MPI: lineal vs árbol</h4>
			<p className="pg-sub">Cada paso = mensajes simultáneos; costo del paso = α + β·(mensaje más grande). La raíz es P0.</p>
			<div className="pg-row">
				<div className="pg-seg">
					{(['Bcast', 'Scatter', 'Gather', 'Reduce', 'Allreduce'] as OpName[]).map((o) => (
						<button key={o} className={op === o ? 'active' : ''} onClick={() => { setOp(o); setK(0); }}>MPI_{o}</button>
					))}
				</div>
				<div className="pg-seg">
					<button className={topo === 'lineal' ? 'active' : ''} onClick={() => { setTopo('lineal'); setK(0); }}>Topología lineal</button>
					<button className={topo === 'arbol' ? 'active' : ''} onClick={() => { setTopo('arbol'); setK(0); }}>Árbol binario</button>
				</div>
			</div>
			<div className="pg-row">
				<label className="pg-field">
					<span>p = <b>{p}</b></span>
					<input type="range" min={2} max={16} value={p} onChange={(e) => { setP(+e.target.value); setK(0); }} />
				</label>
				<label className="pg-field">
					<span>α (latencia) = <b>1e{logA} s</b></span>
					<input type="range" min={-9} max={-3} value={logA} onChange={(e) => setLogA(+e.target.value)} />
				</label>
				<label className="pg-field">
					<span>β (s/elemento) = <b>1e{logB} s</b></span>
					<input type="range" min={-10} max={-6} value={logB} onChange={(e) => setLogB(+e.target.value)} />
				</label>
				<label className="pg-field">
					<span>m (elementos) = <b>1e{logM}</b></span>
					<input type="range" min={0} max={9} value={logM} onChange={(e) => setLogM(+e.target.value)} />
				</label>
			</div>
			<div className="pg-row">
				<button onClick={() => setK(0)}>⏮</button>
				<button onClick={() => setK(Math.max(0, kk - 1))} disabled={kk === 0}>◀</button>
				<button className="primary" onClick={() => setK(Math.min(S.length, kk + 1))} disabled={kk === S.length}>Paso ▶</button>
				<button onClick={() => setK(S.length)}>⏭</button>
				<span style={{ color: 'var(--pg-muted)' }}>paso {kk}/{S.length}</span>
			</div>

			<div className="pg-scroll">
				<svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 480 }}>
					<defs>
						<marker id="carr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
							<path d="M0,0 L10,5 L0,10 z" fill="var(--pg-c2)" />
						</marker>
					</defs>
					{cur.map((msg, i) => {
						const [x1, y1] = posOf(msg.from), [x2, y2] = posOf(msg.to);
						const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
						return (
							<g key={i}>
								<line x1={x1 + (dx / L) * 30} y1={y1 + (dy / L) * 22} x2={x2 - (dx / L) * 32} y2={y2 - (dy / L) * 24} stroke="var(--pg-c2)" strokeWidth={2.5} markerEnd="url(#carr)" />
								<text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4} fontSize={10} textAnchor="middle" style={{ fill: 'var(--pg-c2)' }}>
									{msg.val ? 'valor' : `{${msg.chunks!.join(',')}}`}
								</text>
							</g>
						);
					})}
					{bufs.map((b, r) => {
						const [x, y] = posOf(r);
						const active = cur.some((mm) => mm.to === r || mm.from === r);
						return (
							<g key={r}>
								<rect x={x - 30} y={y - 22} width={60} height={44} rx={8} fill="var(--sl-color-bg)" stroke={active ? 'var(--pg-c2)' : 'var(--pg-border)'} strokeWidth={active ? 2.2 : 1} />
								<text x={x} y={y - 9} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: 'var(--sl-color-white)' }}>P{r}</text>
								{b.val !== null ? (
									<text x={x} y={y + 12} textAnchor="middle" fontSize={11} style={{ fill: 'var(--pg-c4)' }}>Σ={b.val}</text>
								) : (
									b.chunks.slice(0, 8).map((c, i) => {
										const n = Math.min(b.chunks.length, 8);
										const w = Math.min(12, 52 / n);
										return <rect key={c} x={x - (n * w) / 2 + i * w} y={y + 2} width={w - 1.5} height={12} rx={2} fill={op === 'Bcast' ? 'var(--pg-c1)' : CHUNK_COLORS[c % 8]} />;
									})
								)}
								{b.chunks.length > 8 && <text x={x + 28} y={y + 13} fontSize={9}>+</text>}
							</g>
						);
					})}
				</svg>
			</div>

			<div className="pg-stats">
				<div className="pg-stat"><span className="k">Pasos ({topo})</span><span className="v">{S.length}</span></div>
				<div className="pg-stat"><span className="k">T simulado ({topo})</span><span className="v">{fmt(cost(S))} s</span></div>
				<div className="pg-stat"><span className="k">Pasos ({topo === 'lineal' ? 'árbol' : 'lineal'})</span><span className="v">{other.length}</span></div>
				<div className="pg-stat"><span className="k">T ({topo === 'lineal' ? 'árbol' : 'lineal'})</span><span className="v">{fmt(cost(other))} s</span></div>
				<div className="pg-stat"><span className="k">log₂ p</span><span className="v">{fmt(lg)}</span></div>
			</div>
			<div className="pg-note">
				<b>Lineal:</b> <Tex>{formulas[op].lin}</Tex> &nbsp;·&nbsp; <b>Árbol:</b> <Tex>{formulas[op].tree}</Tex>
				<br />
				El árbol reduce el término de <b>latencia</b> de αp a α log p; en Scatter/Gather el término βm no cambia (el volumen total de datos es el mismo).
			</div>
		</div>
	);
}
