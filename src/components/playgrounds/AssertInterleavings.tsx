import { useMemo, useState } from 'react';
import PlayerControls, { usePlayer } from '../ui/Player';

type Ins = { id: string; hilo: 0 | 1; txt: string; run: (m: Mem) => void };
type Mem = { x: number; y: number; a: number | null; b: number | null };

const F_ORIG: Ins[] = [
	{ id: 'A', hilo: 0, txt: 'x = 1', run: (m) => { m.x = 1; } },
	{ id: 'B', hilo: 0, txt: 'y = 1', run: (m) => { m.y = 1; } },
];
const F_SWAP: Ins[] = [F_ORIG[1], F_ORIG[0]];
const G_ORIG: Ins[] = [
	{ id: 'C', hilo: 1, txt: 'a = y', run: (m) => { m.a = m.y; } },
	{ id: 'D', hilo: 1, txt: 'b = x', run: (m) => { m.b = m.x; } },
];
const G_SWAP: Ins[] = [G_ORIG[1], G_ORIG[0]];

/** Todos los intercalados que respetan el orden interno de cada hilo: C(4,2) = 6. */
function intercalados(f: Ins[], g: Ins[]): Ins[][] {
	const out: Ins[][] = [];
	const rec = (i: number, j: number, acc: Ins[]) => {
		if (i === f.length && j === g.length) { out.push(acc); return; }
		if (i < f.length) rec(i + 1, j, [...acc, f[i]]);
		if (j < g.length) rec(i, j + 1, [...acc, g[j]]);
	};
	rec(0, 0, []);
	return out;
}

function ejecutar(seq: Ins[]) {
	const m: Mem = { x: 0, y: 0, a: null, b: null };
	const estados = seq.map((ins) => { ins.run(m); return { ...m }; });
	return { estados, falla: (m.b ?? 0) < (m.a ?? 0), a: m.a ?? 0, b: m.b ?? 0 };
}

const COL = ['var(--pg-c1)', 'var(--pg-c3)'];

export default function AssertInterleavings() {
	const [swapG, setSwapG] = useState(false);
	const [swapF, setSwapF] = useState(false);
	const lista = useMemo(() => intercalados(swapF ? F_SWAP : F_ORIG, swapG ? G_SWAP : G_ORIG).map((s) => ({ seq: s, ...ejecutar(s) })), [swapF, swapG]);
	const [sel, setSel] = useState(0);
	const cur = lista[Math.min(sel, lista.length - 1)];
	const pl = usePlayer(4, 900);
	const fallan = lista.filter((l) => l.falla).length;
	const m = pl.k ? cur.estados[pl.k - 1] : { x: 0, y: 0, a: null, b: null };
	const fin = pl.k === 4;

	const fCode = (swapF ? F_SWAP : F_ORIG).map((i) => `    ${i.txt};  // ${i.id}`).join('\n');
	const gCode = (swapG ? G_SWAP : G_ORIG).map((i) => `    ${i.id === 'C' ? 'int a = y' : 'int b = x'};  // ${i.id}`).join('\n');

	return (
		<div className="pg not-content">
			<h4>¿Puede fallar <code>assert(b &gt;= a)</code>?</h4>
			<p className="pg-sub">Un hilo ejecuta <code>f()</code> y otro <code>g()</code>. Recorre <b>todos</b> los intercalados posibles. Después activa los reordenamientos que puede hacer el compilador con <code>-O2</code> y mira qué cambia.</p>
			<div className="pg-row">
				<label className="pg-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
					<input type="checkbox" checked={swapG} onChange={(e) => { setSwapG(e.target.checked); setSel(0); pl.reset(); }} />
					<span>compilador: <code>g()</code> lee <b>x antes que y</b> (D antes que C)</span>
				</label>
				<label className="pg-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
					<input type="checkbox" checked={swapF} onChange={(e) => { setSwapF(e.target.checked); setSel(0); pl.reset(); }} />
					<span>compilador/CPU: <code>f()</code> escribe <b>y antes que x</b> (B antes que A)</span>
				</label>
			</div>
			<div className="pg-grid-2">
				<pre className="pg-code" style={{ borderLeft: `4px solid ${COL[0]}` }}>{`void f() {   // hilo 0\n${fCode}\n}`}</pre>
				<pre className="pg-code" style={{ borderLeft: `4px solid ${COL[1]}` }}>{`void g() {   // hilo 1\n${gCode}\n    assert(b >= a);\n}`}</pre>
			</div>
			<div className="pg-row" style={{ flexWrap: 'wrap', gap: 6 }}>
				{lista.map((l, i) => (
					<button key={i} className={i === sel ? 'active' : ''} onClick={() => { setSel(i); pl.reset(); }} style={{ fontFamily: 'var(--sl-font-mono)', borderColor: l.falla ? 'var(--pg-bad)' : undefined, color: l.falla ? 'var(--pg-bad)' : undefined }}>
						{l.seq.map((s) => s.id).join('')}{l.falla ? ' ✖' : ''}
					</button>
				))}
			</div>
			<PlayerControls pl={pl} label="instrucción" />
			<div className="pg-grid-2" style={{ alignItems: 'start' }}>
				<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
					{cur.seq.map((s, i) => (
						<div key={s.id} className={`pg-stat ${i === pl.k - 1 ? 'pg-pulse' : ''}`} style={{ minWidth: 70, opacity: i < pl.k ? 1 : 0.35, borderColor: COL[s.hilo], borderWidth: 2, borderStyle: 'solid' }}>
							<span className="k" style={{ color: COL[s.hilo] }}>{s.id} · hilo {s.hilo}</span>
							<span className="v" style={{ fontSize: '0.9rem' }}>{s.txt}</span>
						</div>
					))}
				</div>
				<div className="pg-stats" style={{ marginTop: 0 }}>
					{(['x', 'y', 'a', 'b'] as const).map((v) => (
						<div key={v} className="pg-stat"><span className="k">{v}</span><span className="v">{m[v] ?? '—'}</span></div>
					))}
				</div>
			</div>
			{fin && (
				<div className={`pg-note ${cur.falla ? 'bad' : 'ok'}`}>
					{cur.falla
						? <>a = {cur.a}, b = {cur.b} ⇒ <b>b &lt; a: el assert falla</b>. Se leyó <code>x</code> antes de que se escribiera y <code>y</code> después.</>
						: <>a = {cur.a}, b = {cur.b} ⇒ b ≥ a: el assert se cumple.</>}
				</div>
			)}
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">intercalados = C(4,2)</span><span className="v">{lista.length}</span></div>
				<div className="pg-stat"><span className="k">fallan</span><span className="v" style={{ color: fallan ? 'var(--pg-bad)' : 'var(--pg-ok)' }}>{fallan}</span></div>
			</div>
			<div className={`pg-note ${swapF || swapG ? 'warn' : 'ok'}`}>
				{!swapF && !swapG && <>Con el orden del código fuente, <b>ninguno</b> de los 6 intercalados falla: es la demostración por contradicción de la lámina.</>}
				{(swapF || swapG) && <>Cada hilo sigue dando el mismo resultado si corriera <b>solo</b> (el cambio es válido en secuencial), pero en paralelo aparecen intercalados que <b>rompen el assert</b>. Al compilar el código de clase con <code>g++ -O2</code>, el assert falló en <b>10 de 10</b> corridas; con <code>-O0</code>, en <b>0 de 10</b>.</>}
			</div>
		</div>
	);
}
