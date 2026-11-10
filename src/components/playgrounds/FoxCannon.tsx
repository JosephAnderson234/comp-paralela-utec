import { useState } from 'react';
import PlayerControls, { usePlayer } from '../ui/Player';

const q = 3;
const R = [0, 1, 2];
const sb = (s: string) => s.replace(/[0-9]/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[+d]);
type Mode = 'fox' | 'cannon';
type Cell = { a: string; b: string; root: boolean; used: boolean };

function state(mode: Mode, k: number) {
	const cells: Cell[][] = R.map((i) => R.map((j) => ({ a: `${i}${j}`, b: `${i}${j}`, root: false, used: false })));
	const terms: string[][][] = R.map(() => R.map(() => []));
	let msg = '';
	if (mode === 'fox') {
		const steps = Math.min(k, q);
		for (let l = 0; l < steps; l++) R.forEach((i) => R.forEach((j) => { const s = (i + l) % q; terms[i][j].push(`A${sb(`${i}${s}`)}B${sb(`${s}${j}`)}`); }));
		if (k === 0) msg = 'Inicio: cada P(i,j) guarda A(i,j), B(i,j) y C(i,j)=0. Sin comunicación todavía.';
		else {
			const l = k - 1;
			R.forEach((i) => R.forEach((j) => { const s = (i + l) % q; cells[i][j] = { a: `${i}${s}`, b: `${s}${j}`, root: j === s, used: true }; }));
			msg = `Paso l=${l}: en cada fila i, el proceso de la columna (i+${l}) mod 3 difunde su bloque de A (naranja). Todos multiplican lo recibido por el B que tienen y suman a C. Después, B sube una fila.`;
		}
	} else {
		if (k === 0) msg = 'Inicio: cada P(i,j) guarda A(i,j) y B(i,j). Con esos bloques aún no se puede multiplicar nada útil en todas las celdas.';
		else if (k === 1) {
			R.forEach((i) => R.forEach((j) => { const s = (i + j) % q; cells[i][j] = { a: `${i}${s}`, b: `${s}${j}`, root: false, used: false }; }));
			msg = 'Alineación: la fila i de A se desplaza i posiciones a la izquierda y la columna j de B j posiciones hacia arriba. Ahora cada celda tiene índices internos iguales.';
		} else {
			const l = k - 2;
			for (let t = 0; t <= l; t++) R.forEach((i) => R.forEach((j) => { const s = (i + j + t) % q; terms[i][j].push(`A${sb(`${i}${s}`)}B${sb(`${s}${j}`)}`); }));
			R.forEach((i) => R.forEach((j) => { const s = (i + j + l) % q; cells[i][j] = { a: `${i}${s}`, b: `${s}${j}`, root: false, used: true }; }));
			msg = `Paso l=${l}: todos multiplican el par que tienen (sin broadcast). Luego A se desplaza 1 a la izquierda y B 1 hacia arriba, ambos de forma circular.`;
		}
	}
	return { cells, terms, msg };
}

export default function FoxCannon() {
	const [mode, setMode] = useState<Mode>('fox');
	const [sel, setSel] = useState<[number, number]>([1, 2]);
	const pl = usePlayer(mode === 'fox' ? 3 : 4, 1600);
	const { cells, terms, msg } = state(mode, pl.k);
	const t = terms[sel[0]][sel[1]];
	return (
		<div className="pg not-content">
			<h4>Fox vs Cannon con q = 3 (p = 9 procesos)</h4>
			<p className="pg-sub">Cada celda es un proceso P(i,j) con bloques de n/3 × n/3. Haz clic en una celda para ver cómo se arma su bloque de C.</p>
			<div className="pg-row">
				<div className="pg-seg" role="group" aria-label="Algoritmo">
					{(['fox', 'cannon'] as Mode[]).map((m) => <button key={m} className={m === mode ? 'active' : ''} onClick={() => { setMode(m); pl.reset(); }}>{m === 'fox' ? 'Fox (broadcast + shift)' : 'Cannon (solo shifts)'}</button>)}
				</div>
			</div>
			<PlayerControls pl={pl} label="estado" />
			<div style={{ overflowX: 'auto' }}>
				<svg viewBox="0 0 560 250" style={{ width: '100%', minWidth: 480 }} role="img" aria-label="Malla de 3 por 3 procesos con los bloques que tiene cada uno">
					{R.flatMap((i) => R.map((j) => {
						const c = cells[i][j];
						const isSel = sel[0] === i && sel[1] === j;
						return (
							<g key={`${i}${j}`} onClick={() => setSel([i, j])} style={{ cursor: 'pointer' }}>
								<rect x={20 + j * 130} y={10 + i * 78} width="120" height="70" rx="8" fill={c.root ? 'color-mix(in srgb, var(--pg-c2) 30%, var(--pg-surface))' : c.used ? 'color-mix(in srgb, var(--pg-c1) 18%, var(--pg-surface))' : 'var(--pg-surface)'} stroke={isSel ? 'var(--pg-ok)' : 'var(--pg-border)'} strokeWidth={isSel ? 3 : 1} />
								<text x={80 + j * 130} y={30 + i * 78} textAnchor="middle" fontSize="11" fill="var(--pg-muted)">P({i},{j})</text>
								<text x={80 + j * 130} y={50 + i * 78} textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor">A{sb(c.a)} · B{sb(c.b)}</text>
								<text x={80 + j * 130} y={70 + i * 78} textAnchor="middle" fontSize="11" fill="var(--pg-muted)">{terms[i][j].length}/3 términos</text>
							</g>
						);
					}))}
					<text x="430" y="40" fontSize="12" fill="var(--pg-muted)">naranja = raíz</text>
					<text x="430" y="58" fontSize="12" fill="var(--pg-muted)">del broadcast</text>
					<text x="430" y="88" fontSize="12" fill="var(--pg-muted)">verde = celda</text>
					<text x="430" y="106" fontSize="12" fill="var(--pg-muted)">seleccionada</text>
				</svg>
			</div>
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">C{sb(`${sel[0]}${sel[1]}`)} acumulado</span><span className="v" style={{ fontSize: '1rem' }}>{t.length ? t.join(' + ') : '0'}</span></div>
				<div className="pg-stat"><span className="k">¿completo?</span><span className="v">{t.length === q ? 'sí, 3 de 3' : `${t.length} de 3`}</span></div>
			</div>
			<div className="pg-note">{msg}</div>
		</div>
	);
}
