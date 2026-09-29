import { useMemo, useState } from 'react';
import PlayerControls, { usePlayer } from '../ui/Player';
import Tex from '../ui/Tex';

type Idx = 'rotado' | 'ingenuo';

function Matrix({ n, label, cell, x, y, cs, onCell }: { n: number; label: string; cell: (i: number, j: number) => { fill?: string; text?: string; stroke?: string; bold?: boolean }; x: number; y: number; cs: number; onCell?: (i: number, j: number) => void }) {
	return (
		<g transform={`translate(${x},${y})`}>
			<text x={(n * cs) / 2} y={-8} textAnchor="middle" fontSize={13} fontWeight={700}>{label}</text>
			{Array.from({ length: n * n }, (_, t) => {
				const i = Math.floor(t / n), j = t % n;
				const c = cell(i, j);
				return (
					<g key={t} onClick={onCell ? () => onCell(i, j) : undefined} style={onCell ? { cursor: 'pointer' } : undefined}>
						<rect className="pg-anim" x={j * cs + 1} y={i * cs + 1} width={cs - 2} height={cs - 2} rx={5} fill={c.fill ?? 'var(--sl-color-bg)'} stroke={c.stroke ?? 'var(--pg-border)'} strokeWidth={c.stroke ? 2.2 : 1} />
						{c.text && <text x={j * cs + cs / 2} y={i * cs + cs / 2 + 4} textAnchor="middle" fontSize={cs > 34 ? 11 : 9} fontWeight={c.bold ? 700 : 400}>{c.text}</text>}
					</g>
				);
			})}
		</g>
	);
}

/** Arquetipo F: P(i,j) calcula C[i,j]; en el paso k lee A[i,idx] y B[idx,j]. */
function AccessTab() {
	const [n, setN] = useState(4);
	const [idx, setIdx] = useState<Idx>('rotado');
	const [sel, setSel] = useState<[number, number]>([1, 2]);
	const pl = usePlayer(n, 1200);
	const k = Math.max(0, pl.k - 1); // paso actual (0-based) cuando pl.k ≥ 1
	const kk = (i: number, j: number) => (idx === 'rotado' ? (i + j + k) % n : k);

	const readsA = useMemo(() => {
		const m = new Map<string, number>();
		if (pl.k === 0) return m;
		for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
			const key = `${i},${kk(i, j)}`;
			m.set(key, (m.get(key) ?? 0) + 1);
		}
		return m;
	}, [n, idx, pl.k]);
	const readsB = useMemo(() => {
		const m = new Map<string, number>();
		if (pl.k === 0) return m;
		for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
			const key = `${kk(i, j)},${j}`;
			m.set(key, (m.get(key) ?? 0) + 1);
		}
		return m;
	}, [n, idx, pl.k]);
	const maxA = Math.max(0, ...readsA.values()), maxB = Math.max(0, ...readsB.values());
	const conc = Math.max(maxA, maxB);
	const [si, sj] = [Math.min(sel[0], n - 1), Math.min(sel[1], n - 1)];

	const cs = n > 5 ? 26 : 38, gap = 36;
	const Wm = n * cs;
	const W = 3 * Wm + 2 * gap + 20;
	const heat = (c: number) => (c === 0 ? undefined : c === 1 ? 'color-mix(in srgb, var(--pg-ok) 35%, transparent)' : 'color-mix(in srgb, var(--pg-bad) 45%, transparent)');

	return (
		<>
			<div className="pg-row">
				<div className="pg-seg">
					<button className={idx === 'rotado' ? 'active' : ''} onClick={() => { setIdx('rotado'); pl.reset(); }}>k' = (i+j+k) mod n (PD02 2026-I)</button>
					<button className={idx === 'ingenuo' ? 'active' : ''} onClick={() => { setIdx('ingenuo'); pl.reset(); }}>k' = k (bucle ingenuo)</button>
				</div>
				<label className="pg-field"><span>n = <b>{n}</b></span><input type="range" min={2} max={7} value={n} onChange={(e) => { setN(+e.target.value); pl.reset(); }} /></label>
			</div>
			<PlayerControls pl={pl} label="k" />
			<p className="pg-sub" style={{ margin: 0 }}>Haz clic en una celda de C para seguir a ese procesador P(i,j). Verde = celda leída por 1 procesador; rojo = lectura <b>concurrente</b>.</p>
			<div className="pg-scroll">
				<svg viewBox={`0 0 ${W} ${Wm + 40}`} style={{ minWidth: 480 }}>
					<Matrix n={n} label="A" x={10} y={26} cs={cs} cell={(i, j) => {
						const c = readsA.get(`${i},${j}`) ?? 0;
						const mine = pl.k > 0 && i === si && j === kk(si, sj);
						return { fill: heat(c), text: c ? `×${c}` : '', stroke: mine ? 'var(--pg-c2)' : undefined, bold: true };
					}} />
					<Matrix n={n} label="B" x={10 + Wm + gap} y={26} cs={cs} cell={(i, j) => {
						const c = readsB.get(`${i},${j}`) ?? 0;
						const mine = pl.k > 0 && j === sj && i === kk(si, sj);
						return { fill: heat(c), text: c ? `×${c}` : '', stroke: mine ? 'var(--pg-c2)' : undefined, bold: true };
					}} />
					<Matrix n={n} label="C" x={10 + 2 * (Wm + gap)} y={26} cs={cs} onCell={(i, j) => setSel([i, j])} cell={(i, j) => ({
							fill: i === si && j === sj ? 'color-mix(in srgb, var(--pg-c2) 25%, transparent)' : pl.k > 0 ? 'color-mix(in srgb, var(--pg-c1) 12%, transparent)' : undefined,
							text: `${pl.k}/${n}`,
							stroke: i === si && j === sj ? 'var(--pg-c2)' : undefined,
						})} />
				</svg>
			</div>
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">P({si},{sj}) en paso k={pl.k ? k : '—'}</span><span className="v">{pl.k ? `A[${si},${kk(si, sj)}]·B[${kk(si, sj)},${sj}]` : '—'}</span></div>
				<div className="pg-stat"><span className="k">máx. lectores de una celda</span><span className="v" style={{ color: conc > 1 ? 'var(--pg-bad)' : 'var(--pg-ok)' }}>{pl.k ? conc : '—'}</span></div>
				<div className="pg-stat"><span className="k">escrituras en C[i,j]</span><span className="v">solo P(i,j)</span></div>
				<div className="pg-stat"><span className="k">modelo mínimo</span><span className="v">{pl.k ? (conc > 1 ? 'CREW' : 'EREW') : '—'}</span></div>
			</div>
			<div className={`pg-note ${idx === 'rotado' ? 'ok' : 'warn'}`}>
				{idx === 'rotado' ? (
					<>Con el índice rotado, en cada paso los n² procesadores leen <b>n² celdas distintas</b> de A y de B, y cada uno escribe solo su C[i,j] ⇒ <b>EREW</b>. Fila i fija: j distinto ⇒ columna (i+j+k) mod n distinta.</>
				) : (
					<>Con <code>k' = k</code> los n procesadores de la fila i leen <b>el mismo</b> A[i,k] a la vez (y los de la columna j el mismo B[k,j]) ⇒ lectura concurrente ⇒ <b>CREW</b>. Por eso el enunciado rota el índice.</>
				)}
				<br />
				<Tex>{'T_s=O(n^3)t_c,\\quad T_p=O\\!\\left(\\tfrac{n^3}{p}t_c+n\\right),\\quad E=\\tfrac{1}{1+\\frac{p}{t_cn^2}}'}</Tex> ⇒ débil: escala si <Tex>{'n\\propto\\sqrt p'}</Tex>.
			</div>
		</>
	);
}

/** Expansión (n³ productos en O(1)) + reducción en árbol (log n). */
function ExpandTab() {
	const n = 4;
	const [sel, setSel] = useState<[number, number]>([0, 0]);
	const A = [[1, 2, 0, 1], [3, 1, 2, 0], [0, 1, 1, 2], [2, 0, 1, 1]];
	const B = [[2, 1, 0, 1], [1, 0, 2, 1], [0, 3, 1, 0], [1, 1, 0, 2]];
	const pl = usePlayer(1 + Math.log2(n) + 1, 1300); // expansión, 2 niveles, resultado
	const [i, j] = sel;
	const prods = Array.from({ length: n }, (_, k) => A[i][k] * B[k][j]);
	const lvl1 = [prods[0] + prods[1], prods[2] + prods[3]];
	const res = lvl1[0] + lvl1[1];
	const C = A.map((row, a) => B[0].map((_, b) => row.reduce((s, v, k) => s + v * B[k][b], 0)));
	const st = pl.k;
	const W = 560, H = 230;
	const leafX = (k: number) => 90 + k * 125;
	const nodeCol = (on: boolean) => (on ? 'var(--pg-c4)' : 'var(--pg-border)');

	return (
		<>
			<div className="pg-row">
				<span className="pg-sub" style={{ margin: 0 }}>Elige C[i,j]:</span>
				<div className="pg-seg">
					{Array.from({ length: n * n }, (_, t) => {
						const a = Math.floor(t / n), b = t % n;
						return <button key={t} className={a === i && b === j ? 'active' : ''} onClick={() => { setSel([a, b]); pl.reset(); }}>{a}{b}</button>;
					})}
				</div>
			</div>
			<PlayerControls pl={pl} label="paso" />
			<div className="pg-scroll">
				<svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 460 }}>
					{prods.map((v, k) => (
						<g key={k}>
							<rect className="pg-anim" x={leafX(k) - 52} y={170} width={104} height={40} rx={8} fill="var(--sl-color-bg)" stroke={nodeCol(st >= 1)} strokeWidth={st >= 1 ? 2 : 1} />
							<text x={leafX(k)} y={186} textAnchor="middle" fontSize={10} style={{ fill: 'var(--pg-muted)' }}>A[{i},{k}]·B[{k},{j}]</text>
							{st >= 1 && <text key={`v${st}`} className="pg-pulse" x={leafX(k)} y={203} textAnchor="middle" fontSize={13} fontWeight={700}>{A[i][k]}·{B[k][j]} = {v}</text>}
						</g>
					))}
					{[0, 1].map((h) => {
						const x = (leafX(2 * h) + leafX(2 * h + 1)) / 2;
						return (
							<g key={h}>
								<line x1={leafX(2 * h)} y1={170} x2={x} y2={124} stroke={nodeCol(st >= 2)} />
								<line x1={leafX(2 * h + 1)} y1={170} x2={x} y2={124} stroke={nodeCol(st >= 2)} />
								<circle className="pg-anim" cx={x} cy={110} r={18} fill="var(--sl-color-bg)" stroke={nodeCol(st >= 2)} strokeWidth={st >= 2 ? 2 : 1} />
								<text x={x} y={115} textAnchor="middle" fontSize={12} fontWeight={700}>{st >= 2 ? lvl1[h] : '+'}</text>
							</g>
						);
					})}
					<line x1={(leafX(0) + leafX(1)) / 2} y1={92} x2={W / 2 - 10} y2={58} stroke={nodeCol(st >= 3)} />
					<line x1={(leafX(2) + leafX(3)) / 2} y1={92} x2={W / 2 - 10} y2={58} stroke={nodeCol(st >= 3)} />
					<circle className="pg-anim" cx={W / 2 - 10} cy={42} r={20} fill="var(--sl-color-bg)" stroke={nodeCol(st >= 3)} strokeWidth={st >= 3 ? 2.5 : 1} />
					<text x={W / 2 - 10} y={47} textAnchor="middle" fontSize={13} fontWeight={700}>{st >= 3 ? res : '+'}</text>
					<text x={W / 2 + 20} y={46} fontSize={11} style={{ fill: 'var(--pg-muted)' }}>{st >= 4 ? `→ C[${i},${j}] = ${C[i][j]} ✓` : ''}</text>
					<text x={8} y={196} fontSize={10} style={{ fill: 'var(--pg-muted)' }}>expansión</text>
					<text x={8} y={114} fontSize={10} style={{ fill: 'var(--pg-muted)' }}>nivel 1</text>
					<text x={8} y={46} fontSize={10} style={{ fill: 'var(--pg-muted)' }}>nivel 2</text>
				</svg>
			</div>
			<div className="pg-note">
				Las <b>n²</b> celdas hacen este mismo árbol <b>a la vez</b>: expansión de <b>n³</b> productos en O(1) + reducción binaria de profundidad log n. <Tex>{'W=O(n^3),\\ T_\\infty=O(\\log n),\\ T_p=O\\!\\left(\\tfrac{n^3}{p}+\\log n\\right)'}</Tex>.
			</div>
		</>
	);
}

export default function MatMulParallel() {
	const [tab, setTab] = useState<'acc' | 'exp'>('acc');
	return (
		<div className="pg not-content">
			<h4>Multiplicación de matrices en paralelo</h4>
			<div className="pg-row">
				<div className="pg-seg">
					<button className={tab === 'acc' ? 'active' : ''} onClick={() => setTab('acc')}>Arquetipo F: ¿EREW o CREW?</button>
					<button className={tab === 'exp' ? 'active' : ''} onClick={() => setTab('exp')}>Expansión + reducción (DAG)</button>
				</div>
			</div>
			{tab === 'acc' ? <AccessTab /> : <ExpandTab />}
		</div>
	);
}
