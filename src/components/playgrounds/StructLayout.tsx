import { useState } from 'react';

type Ty = 'char' | 'int' | 'float' | 'double';
const INFO: Record<Ty, { size: number; mpi: string; color: string }> = {
	char: { size: 1, mpi: 'MPI_CHAR', color: 'var(--pg-c6)' },
	int: { size: 4, mpi: 'MPI_INT', color: 'var(--pg-c1)' },
	float: { size: 4, mpi: 'MPI_FLOAT', color: 'var(--pg-c4)' },
	double: { size: 8, mpi: 'MPI_DOUBLE', color: 'var(--pg-c3)' },
};

type Field = { name: string; ty: Ty };

const PRESETS: { name: string; fields: Field[] }[] = [
	{ name: 'class A2 { int a; double b; char c; }', fields: [{ name: 'a', ty: 'int' }, { name: 'b', ty: 'double' }, { name: 'c', ty: 'char' }] },
	{ name: 'struct buff { int i; float f; } (ejemplo08)', fields: [{ name: 'i', ty: 'int' }, { name: 'f', ty: 'float' }] },
	{ name: 'reordenado { double b; int a; char c; }', fields: [{ name: 'b', ty: 'double' }, { name: 'a', ty: 'int' }, { name: 'c', ty: 'char' }] },
	{ name: '{ char c; double d; char e; }', fields: [{ name: 'c', ty: 'char' }, { name: 'd', ty: 'double' }, { name: 'e', ty: 'char' }] },
];

function layout(fields: Field[]) {
	let off = 0, maxAlign = 1;
	const out = fields.map((f) => {
		const s = INFO[f.ty].size;
		maxAlign = Math.max(maxAlign, s);
		const pad = (s - (off % s)) % s;
		const start = off + pad;
		off = start + s;
		return { ...f, pad, start, size: s };
	});
	const tail = (maxAlign - (off % maxAlign)) % maxAlign;
	return { out, size: off + tail, tail, naive: fields.reduce((a, f) => a + INFO[f.ty].size, 0) };
}

export default function StructLayout() {
	const [fields, setFields] = useState<Field[]>(PRESETS[0].fields);
	const [pi, setPi] = useState(0);
	const L = layout(fields);
	const base = 0x7ffd5a3c1b20;

	const bytes: { owner: number | null }[] = Array.from({ length: L.size }, () => ({ owner: null }));
	L.out.forEach((f, idx) => {
		for (let b = f.start; b < f.start + f.size; b++) bytes[b] = { owner: idx };
	});

	const move = (i: number, d: number) => {
		const j = i + d;
		if (j < 0 || j >= fields.length) return;
		const nf = [...fields];
		[nf[i], nf[j]] = [nf[j], nf[i]];
		setFields(nf);
	};

	return (
		<div className="pg not-content">
			<h4>¿Por qué <code>MPI_Get_address</code>? Padding y alineación en structs</h4>
			<p className="pg-sub">Cada campo se alinea a un múltiplo de su tamaño ⇒ el compilador inserta <b>relleno</b>. Los desplazamientos reales no son la suma de los <code>sizeof</code>.</p>
			<div className="pg-row">
				<select value={pi} onChange={(e) => { setPi(+e.target.value); setFields(PRESETS[+e.target.value].fields); }}>
					{PRESETS.map((p, i) => <option key={i} value={i}>{p.name}</option>)}
				</select>
				<button onClick={() => setFields([...fields, { name: String.fromCharCode(97 + fields.length), ty: 'char' }])} disabled={fields.length >= 5}>+ campo</button>
			</div>
			<div className="pg-row" style={{ gap: 6 }}>
				{fields.map((f, i) => (
					<div key={i} className="pg-stat" style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '6px 8px' }}>
						<button onClick={() => move(i, -1)} disabled={i === 0} aria-label="subir">←</button>
						<select value={f.ty} onChange={(e) => { const nf = [...fields]; nf[i] = { ...f, ty: e.target.value as Ty }; setFields(nf); }}>
							{(Object.keys(INFO) as Ty[]).map((t) => <option key={t}>{t}</option>)}
						</select>
						<b style={{ color: INFO[f.ty].color }}>{f.name}</b>
						<button onClick={() => move(i, 1)} disabled={i === fields.length - 1} aria-label="bajar">→</button>
						{fields.length > 1 && <button onClick={() => setFields(fields.filter((_, k) => k !== i))} aria-label="quitar">✕</button>}
					</div>
				))}
			</div>
			<div className="pg-mem" aria-label="Memoria byte a byte">
				{bytes.map((b, i) => {
					const f = b.owner === null ? null : L.out[b.owner];
					return (
						<span key={`${i}-${f?.name}-${f?.ty}`} className="pg-pulse" title={`byte ${i}`} style={{
							width: 26,
							background: f ? `color-mix(in srgb, ${INFO[f.ty].color} 38%, transparent)` : 'repeating-linear-gradient(45deg, transparent 0 4px, var(--pg-border) 4px 6px)',
							borderColor: f ? INFO[f.ty].color : 'var(--pg-border)',
							animationDelay: `${i * 0.015}s`,
						}}>
							{f && i === f.start ? f.name : i % 4 === 0 && !f ? i : ''}
						</span>
					);
				})}
			</div>
			<div className="pg-scroll"><table>
				<thead>
					<tr><th>campo</th><th>tipo MPI</th><th>relleno antes</th><th>desplazamiento real</th><th>dirección (&amp;obj + d)</th><th>suma de sizeof</th></tr>
				</thead>
				<tbody>
					{L.out.map((f, i) => {
						const naive = L.out.slice(0, i).reduce((a, g) => a + g.size, 0);
						return (
							<tr key={i}>
								<td><b style={{ color: INFO[f.ty].color }}>{f.ty} {f.name}</b></td>
								<td><code>{INFO[f.ty].mpi}</code></td>
								<td>{f.pad} B</td>
								<td><b>{f.start}</b></td>
								<td><code>0x{(base + f.start).toString(16)}</code></td>
								<td style={{ color: naive !== f.start ? 'var(--pg-bad)' : 'var(--pg-ok)' }}>{naive}{naive !== f.start ? ' ✖' : ' ✓'}</td>
							</tr>
						);
					})}
				</tbody>
			</table></div>
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">sizeof(struct)</span><span className="v">{L.size} B</span></div>
				<div className="pg-stat"><span className="k">suma de campos</span><span className="v">{L.naive} B</span></div>
				<div className="pg-stat"><span className="k">relleno total</span><span className="v">{L.size - L.naive} B</span></div>
				<div className="pg-stat"><span className="k">relleno final (cola)</span><span className="v">{L.tail} B</span></div>
			</div>
			<pre className="pg-code" style={{ whiteSpace: 'pre-wrap' }}>
{`int          bl[${L.out.length}] = {${L.out.map(() => 1).join(', ')}};
MPI_Aint     d[${L.out.length}], base;
MPI_Datatype ty[${L.out.length}] = {${L.out.map((f) => INFO[f.ty].mpi).join(', ')}};
MPI_Get_address(&obj, &base);
${L.out.map((f, i) => `MPI_Get_address(&obj.${f.name}, &d[${i}]);  d[${i}] = MPI_Aint_diff(d[${i}], base);   // = ${f.start}`).join('\n')}
MPI_Type_create_struct(${L.out.length}, bl, d, ty, &tipo);
MPI_Type_commit(&tipo);`}
			</pre>
			<div className={`pg-note ${L.size !== L.naive ? 'warn' : 'ok'}`}>
				{L.size !== L.naive
					? <>Hay <b>{L.size - L.naive} B de relleno</b>: si calculas los desplazamientos sumando <code>sizeof</code>, MPI leería bytes equivocados. Por eso se usan <code>MPI_Get_address</code> + <code>MPI_Aint_diff</code>. Ordenar los campos de mayor a menor tamaño reduce el relleno.</>
					: <>Sin relleno: aquí los desplazamientos coinciden con la suma de tamaños (y hasta podría usarse <code>MPI_Type_contiguous</code> si todos los campos son del mismo tipo). Aun así, <code>MPI_Get_address</code> es lo portable.</>}
			</div>
			<p className="pg-sub">Alineación típica en x86-64 (char 1, int/float 4, double 8). Imprimir <code>&amp;obj</code>, <code>&amp;obj.a</code>, <code>&amp;obj.b</code>, <code>&amp;obj.c</code> muestra exactamente estos saltos.</p>
		</div>
	);
}
