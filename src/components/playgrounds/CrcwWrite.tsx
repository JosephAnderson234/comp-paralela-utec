import { useMemo, useState } from 'react';
import PlayerControls, { Packet, usePlayer } from '../ui/Player';
import Tex from '../ui/Tex';

type Model = 'EREW' | 'CREW' | 'común' | 'arbitrario' | 'prioritario' | 'combinado (+)' | 'combinado (max)';
const MODELS: Model[] = ['EREW', 'CREW', 'común', 'arbitrario', 'prioritario', 'combinado (+)', 'combinado (max)'];

function resolve(model: Model, writers: { p: number; v: number }[], seed: number): { ok: boolean; value: number | null; why: string } {
	if (writers.length === 0) return { ok: true, value: null, why: 'Nadie escribe: la celda conserva su valor.' };
	if (writers.length === 1) return { ok: true, value: writers[0].v, why: `Solo P${writers[0].p} escribe: válido en cualquier modelo.` };
	switch (model) {
		case 'EREW':
		case 'CREW':
			return { ok: false, value: null, why: `${writers.length} procesadores escriben la misma celda en el mismo paso: ilegal en ${model} (escritura exclusiva).` };
		case 'común': {
			const same = writers.every((w) => w.v === writers[0].v);
			return same
				? { ok: true, value: writers[0].v, why: 'Común: todos escriben el mismo valor ⇒ válido.' }
				: { ok: false, value: null, why: 'Común: los valores difieren ⇒ el programa es ilegal en este submodelo.' };
		}
		case 'arbitrario': {
			const w = writers[seed % writers.length];
			return { ok: true, value: w.v, why: `Arbitrario: gana uno cualquiera (esta vez P${w.p}). El algoritmo debe ser correcto sea cual sea el ganador.` };
		}
		case 'prioritario': {
			const w = writers.reduce((a, b) => (b.p < a.p ? b : a));
			return { ok: true, value: w.v, why: `Prioritario: gana el de mayor prioridad (menor índice) ⇒ P${w.p}.` };
		}
		case 'combinado (+)':
			return { ok: true, value: writers.reduce((s, w) => s + w.v, 0), why: 'Combinado: la memoria acumula (reduce) los valores escritos con +.' };
		case 'combinado (max)':
			return { ok: true, value: Math.max(...writers.map((w) => w.v)), why: 'Combinado: la memoria acumula con max.' };
	}
}

function WriteTab() {
	const [n, setN] = useState(6);
	const [vals, setVals] = useState<(number | null)[]>([3, null, 3, 7, null, 3, 1, 5]);
	const [model, setModel] = useState<Model>('común');
	const [seed, setSeed] = useState(1);
	const pl = usePlayer(2, 1300);

	const writers = vals.slice(0, n).map((v, p) => ({ p, v })).filter((w): w is { p: number; v: number } => w.v !== null);
	const res = resolve(model, writers, seed);

	const W = 640, H = 230;
	const px = (p: number) => 50 + (p * (W - 100)) / Math.max(1, n - 1);
	const cellX = W / 2, cellY = 190;

	return (
		<>
			<div className="pg-row">
				<div className="pg-seg">
					{MODELS.map((m) => (
						<button key={m} className={model === m ? 'active' : ''} onClick={() => { setModel(m); pl.reset(); }}>{m.startsWith('E') || m.startsWith('CR') ? m : 'CRCW ' + m}</button>
					))}
				</div>
			</div>
			<div className="pg-row">
				<label className="pg-field">
					<span>procesadores n = <b>{n}</b></span>
					<input type="range" min={2} max={8} value={n} onChange={(e) => { setN(+e.target.value); pl.reset(); }} />
				</label>
				<button onClick={() => { setVals(vals.map(() => (Math.random() < 0.35 ? null : 1 + Math.floor(Math.random() * 9)))); pl.reset(); }}>🎲 Valores al azar</button>
				<button onClick={() => { setVals(vals.map(() => 1)); pl.reset(); }}>Todos escriben 1</button>
				<button onClick={() => { setVals(vals.map((_, i) => (i === 2 ? 4 : null))); pl.reset(); }}>Solo un escritor</button>
			</div>
			<div className="pg-row" style={{ gap: 6 }}>
				{vals.slice(0, n).map((v, p) => (
					<label key={p} className="pg-field" style={{ minWidth: 70, flex: '0 0 auto' }}>
						<span>P{p} escribe</span>
						<select value={v ?? ''} onChange={(e) => { const nv = [...vals]; nv[p] = e.target.value === '' ? null : +e.target.value; setVals(nv); pl.reset(); }}>
							<option value="">—</option>
							{Array.from({ length: 9 }, (_, i) => i + 1).map((x) => <option key={x} value={x}>{x}</option>)}
						</select>
					</label>
				))}
			</div>
			<PlayerControls pl={pl} label="fase" />
			<div className="pg-scroll">
				<svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 460 }}>
					{Array.from({ length: n }, (_, p) => {
						const v = vals[p];
						return (
							<g key={p}>
								<rect x={px(p) - 24} y={20} width={48} height={40} rx={8} fill="var(--sl-color-bg)" stroke={v !== null && pl.k >= 1 ? 'var(--pg-c2)' : 'var(--pg-border)'} strokeWidth={v !== null && pl.k >= 1 ? 2 : 1} className="pg-anim" />
								<text x={px(p)} y={37} textAnchor="middle" fontSize={11} fontWeight={700}>P{p}</text>
								<text x={px(p)} y={52} textAnchor="middle" fontSize={11} style={{ fill: v === null ? 'var(--pg-muted)' : 'var(--pg-c2)' }}>{v === null ? 'no escribe' : `w=${v}`}</text>
								{v !== null && pl.k >= 1 && <line x1={px(p)} y1={62} x2={cellX} y2={cellY - 24} stroke="var(--pg-c2)" strokeOpacity={0.35} strokeDasharray="3 4" />}
								{v !== null && pl.k === 1 && <Packet key={`pk${p}-${pl.k}-${seed}`} x1={px(p)} y1={62} x2={cellX} y2={cellY - 24} label={String(v)} />}
							</g>
						);
					})}
					<rect x={cellX - 70} y={cellY - 24} width={140} height={40} rx={8} fill="var(--sl-color-bg)" stroke={pl.k >= 2 ? (res.ok ? 'var(--pg-ok)' : 'var(--pg-bad)') : 'var(--pg-border)'} strokeWidth={pl.k >= 2 ? 2.5 : 1} className="pg-anim" />
					<text x={cellX - 64} y={cellY - 30} fontSize={10} style={{ fill: 'var(--pg-muted)' }}>memoria compartida: M[0]</text>
					{pl.k >= 2 && (
						<text key={`r${seed}${model}`} className="pg-pulse" x={cellX} y={cellY + 1} textAnchor="middle" fontSize={15} fontWeight={700} style={{ fill: res.ok ? 'var(--pg-ok)' : 'var(--pg-bad)' }}>
							{res.ok ? (res.value === null ? '(sin cambio)' : res.value) : '✖ conflicto'}
						</text>
					)}
					{pl.k === 0 && <text x={cellX} y={cellY + 1} textAnchor="middle" fontSize={12} style={{ fill: 'var(--pg-muted)' }}>?</text>}
				</svg>
			</div>
			{pl.k >= 2 && (
				<div className={`pg-note ${res.ok ? 'ok' : 'bad'}`}>
					{res.why}
					{model === 'arbitrario' && writers.length > 1 && (
						<> <button onClick={() => setSeed(seed + 1)} style={{ marginLeft: 8 }}>Repetir sorteo</button></>
					)}
				</div>
			)}
		</>
	);
}

function OrMaxTab() {
	const [mode, setMode] = useState<'or' | 'max'>('max');
	const [A, setA] = useState([4, 9, 2, 9, 5]);
	const [bits, setBits] = useState([0, 0, 1, 0, 0, 1, 0, 0]);
	const n = mode === 'max' ? A.length : bits.length;
	const total = mode === 'max' ? n + 2 : 2;
	const pl = usePlayer(total, 900);

	const B = useMemo(() => A.map((ai) => A.map((aj) => ai >= aj)), [A]);
	const M = B.map((row) => row.every(Boolean));
	// para el máximo: las filas i se van "llenando" una por paso (en PRAM es 1 solo paso con n² procesadores)
	const rowsShown = mode === 'max' ? Math.min(pl.k, n) : 0;
	const andDone = mode === 'max' && pl.k >= n + 1;
	const winnerDone = mode === 'max' && pl.k >= n + 2;
	const firstMax = M.findIndex(Boolean);

	return (
		<>
			<div className="pg-row">
				<div className="pg-seg">
					<button className={mode === 'max' ? 'active' : ''} onClick={() => { setMode('max'); pl.reset(); }}>Máximo en O(1) (n² procesadores)</button>
					<button className={mode === 'or' ? 'active' : ''} onClick={() => { setMode('or'); pl.reset(); }}>Global OR en O(1)</button>
				</div>
				{mode === 'max' ? (
					<button onClick={() => { setA(Array.from({ length: 3 + Math.floor(Math.random() * 4) }, () => 1 + Math.floor(Math.random() * 9))); pl.reset(); }}>🎲 Nuevo A</button>
				) : (
					<button onClick={() => { setBits(bits.map(() => (Math.random() < 0.2 ? 1 : 0))); pl.reset(); }}>🎲 Nuevos bits</button>
				)}
			</div>
			<PlayerControls pl={pl} label="paso" />
			{mode === 'max' ? (
				<>
					<div className="pg-grid-2">
						<div>
							<p className="pg-sub" style={{ margin: '0 0 .4rem' }}>
								<code>forall (i,j) pardo: B[i,j] ← A[i] ≥ A[j]</code> — lectura <b>concurrente</b> de A (CR).
							</p>
							<table style={{ textAlign: 'center' }}>
								<thead>
									<tr>
										<th>i \ j</th>
										{A.map((a, j) => <th key={j}>A[{j}]={a}</th>)}
										<th>M[i]=AND</th>
									</tr>
								</thead>
								<tbody>
									{A.map((a, i) => (
										<tr key={i} style={{ background: winnerDone && M[i] ? 'color-mix(in srgb, var(--pg-ok) 18%, transparent)' : undefined, transition: 'background .4s' }}>
											<th>A[{i}]={a}</th>
											{A.map((_, j) => (
												<td key={j}>
													{i < rowsShown ? (
														<span className="badge" style={{ color: B[i][j] ? 'var(--pg-ok)' : 'var(--pg-bad)' }}>{B[i][j] ? '1' : '0'}</span>
													) : (
														<span style={{ color: 'var(--pg-muted)' }}>·</span>
													)}
												</td>
											))}
											<td>{andDone ? <span className="badge" style={{ color: M[i] ? 'var(--pg-ok)' : 'var(--pg-bad)' }}>{M[i] ? '1' : '0'}</span> : '·'}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
					<div className="pg-stats">
						<div className="pg-stat"><span className="k">procesadores</span><span className="v">n² = {n * n}</span></div>
						<div className="pg-stat"><span className="k">T∞</span><span className="v">O(1)</span></div>
						<div className="pg-stat"><span className="k">W</span><span className="v">Θ(n²)</span></div>
						<div className="pg-stat"><span className="k">¿costo óptimo?</span><span className="v" style={{ color: 'var(--pg-bad)' }}>No (Tₛ = n)</span></div>
					</div>
					{winnerDone && (
						<div className="pg-note ok">
							Máximo = <b>{A[firstMax]}</b> (índice {firstMax}). La fila i tiene AND = 1 ⇔ A[i] ≥ todos. Con valores repetidos varias filas escriben M: se necesita <b>CRCW</b> (común: todas escriben el mismo máximo). El AND de cada fila también es O(1) con escritura concurrente (como Global AND).
						</div>
					)}
					<p className="pg-sub">La animación llena una fila por paso solo para poder verlo: en PRAM las n² comparaciones ocurren en <b>un único paso</b>.</p>
				</>
			) : (
				<>
					<div className="pg-scroll">
						<svg viewBox="0 0 640 170" style={{ minWidth: 460 }}>
							{bits.map((b, i) => {
								const x = 50 + i * 77;
								return (
									<g key={i}>
										<rect x={x - 22} y={14} width={44} height={40} rx={8} fill="var(--sl-color-bg)" stroke={pl.k >= 1 && b ? 'var(--pg-c2)' : 'var(--pg-border)'} strokeWidth={pl.k >= 1 && b ? 2 : 1} className="pg-anim" />
										<text x={x} y={30} textAnchor="middle" fontSize={10}>P{i}</text>
										<text x={x} y={46} textAnchor="middle" fontSize={12} fontWeight={700} style={{ fill: b ? 'var(--pg-c2)' : 'var(--pg-muted)' }}>x={b}</text>
										{pl.k === 1 && b === 1 && <Packet key={`o${i}-${pl.k}`} x1={x} y1={56} x2={320} y2={116} label="1" />}
									</g>
								);
							})}
							<rect x={250} y={116} width={140} height={38} rx={8} fill="var(--sl-color-bg)" stroke={pl.k >= 2 ? 'var(--pg-ok)' : 'var(--pg-border)'} strokeWidth={pl.k >= 2 ? 2.5 : 1} className="pg-anim" />
							<text x={320} y={140} textAnchor="middle" fontSize={13} fontWeight={700}>
								Result = {pl.k >= 2 ? (bits.some(Boolean) ? 1 : 0) : 0}
							</text>
						</svg>
					</div>
					<div className="pg-note">
						<code>Result ← 0; forall i pardo: if x[i] then Result ← 1</code>. Todos los que escriben escriben <b>el mismo valor (1)</b> ⇒ basta CRCW <b>común</b>. <Tex>{'T_\\infty=\\Theta(1),\\ W=\\Theta(n),\\ S=\\Theta(n),\\ E=\\Theta(1)'}</Tex>. En CREW/EREW haría falta una reducción: <Tex>{'\\Theta(\\log n)'}</Tex>.
					</div>
				</>
			)}
		</>
	);
}

export default function CrcwWrite() {
	const [tab, setTab] = useState<'w' | 'om'>('w');
	return (
		<div className="pg not-content">
			<h4>PRAM: escrituras concurrentes (EREW · CREW · CRCW)</h4>
			<p className="pg-sub">Fase 1: los procesadores envían su escritura a la misma celda. Fase 2: la memoria resuelve según el modelo.</p>
			<div className="pg-row">
				<div className="pg-seg">
					<button className={tab === 'w' ? 'active' : ''} onClick={() => setTab('w')}>Resolver escritura concurrente</button>
					<button className={tab === 'om' ? 'active' : ''} onClick={() => setTab('om')}>Global OR y máximo en O(1)</button>
				</div>
			</div>
			{tab === 'w' ? <WriteTab /> : <OrMaxTab />}
		</div>
	);
}
