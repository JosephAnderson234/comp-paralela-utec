import { useMemo, useState } from 'react';

type TypeDef =
	| { kind: 'basic'; count: number }
	| { kind: 'contiguous'; count: number }
	| { kind: 'vector'; count: number; blocklen: number; stride: number }
	| { kind: 'indexed'; blocklens: number[]; displs: number[] };

type Preset = {
	name: string;
	file: string;
	rows: number;
	cols: number;
	value: 'i' | 'j' | 'k' | 'half';
	send: { i: number; j: number; type: TypeDef; count: number };
	recv: { rows: number; cols: number; i: number; j: number; type: TypeDef | 'same'; count: number; init: string };
	code: string;
	note: string;
};

const PRESETS: Preset[] = [
	{
		name: 'ejemplo01 — subvector (count)',
		file: 'U3.4/ejemplo01_count.cpp',
		rows: 1, cols: 10, value: 'half',
		send: { i: 0, j: 5, type: { kind: 'basic', count: 5 }, count: 1 },
		recv: { rows: 1, cols: 10, i: 0, j: 0, type: { kind: 'basic', count: 5 }, count: 1, init: '·' },
		code: 'MPI_Send(&vector[5], 5, MPI_FLOAT, 1, 0, MPI_COMM_WORLD);\nMPI_Recv(vector, 5, MPI_FLOAT, 0, 0, MPI_COMM_WORLD, &status);',
		note: 'Sin tipo derivado: basta un puntero al inicio y un count, porque los 5 floats son contiguos.',
	},
	{
		name: 'ejemplo02 — enviar una fila',
		file: 'U3.4/ejemplo02_send_row.cpp',
		rows: 6, cols: 6, value: 'i',
		send: { i: 2, j: 0, type: { kind: 'basic', count: 6 }, count: 1 },
		recv: { rows: 6, cols: 6, i: 2, j: 0, type: { kind: 'basic', count: 6 }, count: 1, init: '0' },
		code: 'MPI_Send(&A[f][0], M, MPI_FLOAT, 1, 0, MPI_COMM_WORLD);   // f = 2\nMPI_Recv(&A[f][0], M, MPI_FLOAT, 0, 0, MPI_COMM_WORLD, &status);',
		note: 'En C las matrices se guardan por filas (row-major): una fila es contigua en memoria.',
	},
	{
		name: 'Lámina — MPI_Type_contiguous (rowtype)',
		file: 'U3.4 Paralelismo Distribuido-tiposMPI.pdf',
		rows: 4, cols: 4, value: 'k',
		send: { i: 2, j: 0, type: { kind: 'contiguous', count: 4 }, count: 1 },
		recv: { rows: 4, cols: 4, i: 2, j: 0, type: 'same', count: 1, init: '·' },
		code: 'MPI_Type_contiguous(4, MPI_FLOAT, &rowtype);\nMPI_Type_commit(&rowtype);\nMPI_Send(&a[2][0], 1, rowtype, dest, tag, comm);',
		note: 'Un elemento de tipo rowtype = una fila. La ventaja aparece al enviar varias filas con un nombre lógico.',
	},
	{
		name: 'ejemplo05 — columna con MPI_Type_vector',
		file: 'U3.4/ejemplo05_vector.cpp',
		rows: 10, cols: 10, value: 'j',
		send: { i: 0, j: 6, type: { kind: 'vector', count: 10, blocklen: 1, stride: 10 }, count: 1 },
		recv: { rows: 10, cols: 10, i: 0, j: 6, type: 'same', count: 1, init: '0' },
		code: 'MPI_Type_vector(10, 1, 10, MPI_FLOAT, &coltype);\nMPI_Type_commit(&coltype);\nMPI_Send(&A[0][col], 1, coltype, 1, 0, MPI_COMM_WORLD);   // col = 6\nMPI_Recv(&A[0][col], 1, coltype, 0, 0, MPI_COMM_WORLD, &status);',
		note: 'count = 10 bloques (uno por fila), blocklength = 1 elemento, stride = 10 (= M, largo de una fila).',
	},
	{
		name: 'ejemplo06 — columna en rank 0 → fila en rank 1',
		file: 'U3.4/ejemplo06_vector.cpp',
		rows: 10, cols: 10, value: 'i',
		send: { i: 0, j: 5, type: { kind: 'vector', count: 10, blocklen: 1, stride: 10 }, count: 1 },
		recv: { rows: 10, cols: 10, i: 0, j: 0, type: { kind: 'basic', count: 10 }, count: 1, init: '0' },
		code: 'MPI_Type_vector(10, 1, 10, MPI_FLOAT, &coltype);\nMPI_Send(&A[0][col], 1, coltype, 1, 0, MPI_COMM_WORLD);   // col = 5\nMPI_Recv(A, 10, MPI_FLOAT, 0, 0, MPI_COMM_WORLD, &status);   // 10 floats contiguos',
		note: 'Emisor y receptor no necesitan el mismo tipo: solo la misma firma (10 MPI_FLOAT). La columna llega como la fila 0 (¡transposición gratis!).',
	},
	{
		name: 'ejemplo07 — bloque 2×3 con vector',
		file: 'U3.4/ejemplo07_vector.cpp',
		rows: 3, cols: 6, value: 'j',
		send: { i: 0, j: 0, type: { kind: 'vector', count: 2, blocklen: 3, stride: 6 }, count: 1 },
		recv: { rows: 3, cols: 6, i: 0, j: 0, type: 'same', count: 1, init: '-0.9' },
		code: 'MPI_Type_vector(2, 3, stride, MPI_DOUBLE, &mini_matrix);   // stride = 6\nMPI_Send(A, 1, mini_matrix, 1, 0, MPI_COMM_WORLD);\nMPI_Recv(subdominio, 1, mini_matrix, 0, 0, MPI_COMM_WORLD, &status);',
		note: 'Submatriz = 2 bloques de 3 elementos, separados 6 posiciones de inicio a inicio. Lo no recibido conserva −0.9.',
	},
	{
		name: 'Práctica 3 — bloque de columnas (N=6, p=3)',
		file: 'practica_3_ofi/ejercicio02_col.cpp',
		rows: 6, cols: 6, value: 'k',
		send: { i: 0, j: 2, type: { kind: 'vector', count: 6, blocklen: 2, stride: 6 }, count: 1 },
		recv: { rows: 6, cols: 2, i: 0, j: 0, type: { kind: 'basic', count: 12 }, count: 1, init: '·' },
		code: 'MPI_Type_vector(N, col_proc, N, MPI_LONG_LONG, &coltype);   // col_proc = N/p = 2\nMPI_Send(&A[dest * col_proc], 1, coltype, dest, 0, MPI_COMM_WORLD);   // dest = 1\nMPI_Recv(local_A, N * col_proc, MPI_LONG_LONG, 0, 0, MPI_COMM_WORLD, &status);',
		note: 'P1 recibe sus 2 columnas como una matriz local N×col_proc contigua. El emisor hace p−1 Send secuenciales (no hay colectiva) ⇒ cuello de botella en P0.',
	},
	{
		name: 'MPI_Type_indexed (ejemplo ilustrativo)',
		file: 'U3.4 Paralelismo Distribuido-tiposMPI.pdf',
		rows: 4, cols: 4, value: 'k',
		send: { i: 0, j: 0, type: { kind: 'indexed', blocklens: [4, 3, 2, 1], displs: [0, 5, 10, 15] }, count: 1 },
		recv: { rows: 4, cols: 4, i: 0, j: 0, type: 'same', count: 1, init: '·' },
		code: 'int bl[4] = {4, 3, 2, 1}, dp[4] = {0, 5, 10, 15};\nMPI_Type_indexed(4, bl, dp, MPI_FLOAT, &triang);   // triángulo superior\nMPI_Type_commit(&triang);\nMPI_Send(A, 1, triang, 1, 0, MPI_COMM_WORLD);',
		note: 'indexed = bloques de longitud variable en desplazamientos arbitrarios (aquí el triángulo superior). Editable abajo.',
	},
];

function offsets(t: TypeDef, count: number): number[] {
	const one: number[] = [];
	let extent = 0;
	switch (t.kind) {
		case 'basic':
		case 'contiguous':
			for (let k = 0; k < t.count; k++) one.push(k);
			extent = t.count;
			break;
		case 'vector':
			for (let b = 0; b < t.count; b++) for (let k = 0; k < t.blocklen; k++) one.push(b * t.stride + k);
			extent = (t.count - 1) * t.stride + t.blocklen;
			break;
		case 'indexed':
			t.blocklens.forEach((bl, b) => {
				for (let k = 0; k < bl; k++) one.push(t.displs[b] + k);
			});
			extent = Math.max(...t.displs.map((d, b) => d + t.blocklens[b]));
			break;
	}
	const out: number[] = [];
	for (let c = 0; c < count; c++) one.forEach((o) => out.push(c * extent + o));
	return out;
}

function sig(t: TypeDef) {
	switch (t.kind) {
		case 'basic': return `${t.count} × MPI_FLOAT`;
		case 'contiguous': return `MPI_Type_contiguous(${t.count}, …)`;
		case 'vector': return `MPI_Type_vector(${t.count}, ${t.blocklen}, ${t.stride}, …)`;
		case 'indexed': return `MPI_Type_indexed(${t.blocklens.length}, {${t.blocklens}}, {${t.displs}}, …)`;
	}
}

export default function DerivedTypesViz() {
	const [pi, setPi] = useState(3);
	const pr = PRESETS[pi];
	const [custom, setCustom] = useState<TypeDef | null>(null);
	const [idxTxt, setIdxTxt] = useState({ bl: '4,3,2,1', dp: '0,5,10,15' });
	const sendType = custom ?? pr.send.type;
	const recvType = pr.recv.type === 'same' ? sendType : pr.recv.type;

	const sendOff = useMemo(() => offsets(sendType, pr.send.count).map((o) => o + pr.send.i * pr.cols + pr.send.j), [sendType, pr]);
	const recvOff = useMemo(() => offsets(recvType, pr.recv.count).map((o) => o + pr.recv.i * pr.recv.cols + pr.recv.j), [recvType, pr]);

	const val = (idx: number) => {
		const i = Math.floor(idx / pr.cols), j = idx % pr.cols;
		return pr.value === 'i' ? i : pr.value === 'j' ? j : pr.value === 'half' ? (j < 5 ? 0 : 5) : idx;
	};
	const total = pr.rows * pr.cols;
	const overflow = sendOff.some((o) => o >= total) || recvOff.some((o) => o >= pr.recv.rows * pr.recv.cols);
	const recvMap = new Map<number, { v: number; order: number }>();
	sendOff.forEach((so, k) => {
		if (k < recvOff.length) recvMap.set(recvOff[k], { v: val(so), order: k });
	});
	const sendOrder = new Map(sendOff.map((o, k) => [o, k]));

	const setVector = (patch: Partial<{ count: number; blocklen: number; stride: number }>) => {
		const base = sendType.kind === 'vector' ? sendType : { kind: 'vector' as const, count: 2, blocklen: 1, stride: pr.cols };
		setCustom({ ...base, ...patch, kind: 'vector' });
	};

	const cell = 30;
	const grid = (rows: number, cols: number, render: (idx: number) => { fill: string; txt: string; ord?: number }) => (
		<svg viewBox={`0 0 ${cols * cell + 24} ${rows * cell + 20}`} style={{ maxWidth: cols * cell + 24 }}>
			{Array.from({ length: cols }, (_, j) => (
				<text key={'c' + j} x={24 + j * cell + cell / 2} y={11} fontSize={9} textAnchor="middle">{j}</text>
			))}
			{Array.from({ length: rows }, (_, i) => (
				<text key={'r' + i} x={10} y={16 + i * cell + cell / 2 + 3} fontSize={9} textAnchor="middle">{i}</text>
			))}
			{Array.from({ length: rows * cols }, (_, idx) => {
				const i = Math.floor(idx / cols), j = idx % cols;
				const r = render(idx);
				return (
					<g key={idx}>
						<rect x={24 + j * cell} y={16 + i * cell} width={cell - 2} height={cell - 2} rx={4} fill={r.fill} stroke="var(--pg-border)" />
						<text x={24 + j * cell + cell / 2 - 1} y={16 + i * cell + cell / 2 + 3} fontSize={10} textAnchor="middle" style={{ fill: 'var(--sl-color-white)' }}>{r.txt}</text>
						{r.ord !== undefined && (
							<text x={24 + j * cell + 3} y={16 + i * cell + 9} fontSize={7} style={{ fill: 'var(--pg-c2)' }}>{r.ord + 1}</text>
						)}
					</g>
				);
			})}
		</svg>
	);

	const HL = 'color-mix(in srgb, var(--pg-c2) 45%, var(--sl-color-bg))';
	const RC = 'color-mix(in srgb, var(--pg-c4) 40%, var(--sl-color-bg))';

	return (
		<div className="pg">
			<h4>Tipos derivados MPI: ¿qué celdas se envían?</h4>
			<p className="pg-sub">Matriz en memoria row-major. Naranja = elementos del mensaje (el número pequeño es su orden en el mensaje); verde = dónde aterrizan en el receptor.</p>
			<div className="pg-row">
				<label className="pg-field" style={{ flex: '3 1 20rem' }}>
					<span>Ejemplo</span>
					<select value={pi} onChange={(e) => { setPi(+e.target.value); setCustom(null); }}>
						{PRESETS.map((p, i) => <option key={i} value={i}>{p.name}</option>)}
					</select>
				</label>
			</div>
			<pre className="pg-code">{pr.code.split('\n').map((l, i) => <div className="ln" key={i}><span>{l}</span></div>)}</pre>

			{sendType.kind === 'vector' && (
				<div className="pg-row">
					<label className="pg-field"><span>count (bloques) = <b>{sendType.count}</b></span><input type="range" min={1} max={pr.rows * 2} value={sendType.count} onChange={(e) => setVector({ count: +e.target.value })} /></label>
					<label className="pg-field"><span>blocklength = <b>{sendType.blocklen}</b></span><input type="range" min={1} max={pr.cols} value={sendType.blocklen} onChange={(e) => setVector({ blocklen: +e.target.value })} /></label>
					<label className="pg-field"><span>stride = <b>{sendType.stride}</b></span><input type="range" min={1} max={pr.cols * 2} value={sendType.stride} onChange={(e) => setVector({ stride: +e.target.value })} /></label>
				</div>
			)}
			{sendType.kind === 'indexed' && (
				<div className="pg-row">
					<label className="pg-field"><span>blocklengths[]</span><input type="text" value={idxTxt.bl} onChange={(e) => { setIdxTxt({ ...idxTxt, bl: e.target.value }); const bl = e.target.value.split(',').map(Number); const dp = idxTxt.dp.split(',').map(Number); if (bl.length === dp.length && bl.every((x) => x >= 0) && dp.every((x) => x >= 0)) setCustom({ kind: 'indexed', blocklens: bl, displs: dp }); }} /></label>
					<label className="pg-field"><span>displacements[]</span><input type="text" value={idxTxt.dp} onChange={(e) => { setIdxTxt({ ...idxTxt, dp: e.target.value }); const dp = e.target.value.split(',').map(Number); const bl = idxTxt.bl.split(',').map(Number); if (bl.length === dp.length && bl.every((x) => x >= 0) && dp.every((x) => x >= 0)) setCustom({ kind: 'indexed', blocklens: bl, displs: dp }); }} /></label>
				</div>
			)}
			{overflow && <div className="pg-note bad">⚠ El tipo se sale de la matriz: MPI leería/escribiría memoria fuera del arreglo.</div>}

			<div className="pg-grid-2">
				<div>
					<b>Rank 0 (emisor)</b> · {sig(sendType)}
					<div className="pg-scroll">{grid(pr.rows, pr.cols, (idx) => ({ fill: sendOrder.has(idx) ? HL : 'var(--sl-color-bg)', txt: String(val(idx)), ord: sendOrder.get(idx) }))}</div>
				</div>
				<div>
					<b>Rank 1 (receptor)</b> · {pr.recv.type === 'same' ? 'mismo tipo' : sig(recvType)}
					<div className="pg-scroll">{grid(pr.recv.rows, pr.recv.cols, (idx) => ({ fill: recvMap.has(idx) ? RC : 'var(--sl-color-bg)', txt: recvMap.has(idx) ? String(recvMap.get(idx)!.v) : pr.recv.init, ord: recvMap.get(idx)?.order }))}</div>
				</div>
			</div>
			<div style={{ margin: '0.75rem 0 0 0' }}>
				<b>Memoria lineal del emisor</b> (índice = i·{pr.cols} + j)
				<div className="pg-scroll">
					<svg viewBox={`0 0 ${total * 16 + 4} 34`} style={{ minWidth: Math.min(total * 16, 900) }}>
						{Array.from({ length: total }, (_, k) => (
							<g key={k}>
								<rect x={2 + k * 16} y={4} width={14} height={16} rx={2} fill={sendOrder.has(k) ? 'var(--pg-c2)' : 'var(--pg-border)'} opacity={sendOrder.has(k) ? 1 : 0.5} />
								{k % pr.cols === 0 && <text x={2 + k * 16} y={31} fontSize={8}>{k}</text>}
							</g>
						))}
					</svg>
				</div>
			</div>
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">Elementos enviados</span><span className="v">{sendOff.length}</span></div>
				<div className="pg-stat"><span className="k">Llamadas MPI necesarias</span><span className="v">1</span></div>
				<div className="pg-stat"><span className="k">Sin tipo derivado</span><span className="v" style={{ fontSize: '0.9rem' }}>{sendType.kind === 'vector' ? `${sendType.count} Send (o copiar a buffer)` : sendType.kind === 'indexed' ? `${sendType.blocklens.length} Send` : '1 Send'}</span></div>
			</div>
			<div className="pg-note">{pr.note}</div>
			<StructPanel />
		</div>
	);
}

function StructPanel() {
	const [which, setWhich] = useState<0 | 1>(0);
	const S = [
		{
			title: 'ejemplo08-struct.cpp: struct { int i; float f; }',
			fields: [{ n: 'i', t: 'MPI_INT', off: 0, sz: 4 }, { n: 'f', t: 'MPI_FLOAT', off: 4, sz: 4 }],
			typemap: '{(MPI_INT,0), (MPI_FLOAT,4)}',
			size: 8,
		},
		{
			title: 'Lámina: a (dir 24), b (dir 40), n (dir 48)',
			fields: [{ n: 'a', t: 'MPI_DOUBLE', off: 0, sz: 8 }, { n: 'b', t: 'MPI_DOUBLE', off: 16, sz: 8 }, { n: 'n', t: 'MPI_INT', off: 24, sz: 4 }],
			typemap: '{(MPI_DOUBLE,0), (MPI_DOUBLE,16), (MPI_INT,24)}',
			size: 28,
		},
	][which];
	const colors = ['var(--pg-c1)', 'var(--pg-c3)', 'var(--pg-c4)'];
	return (
		<div style={{ marginTop: '1rem' }}>
			<div className="pg-row">
				<b>MPI_Type_create_struct</b>
				<div className="pg-seg">
					<button className={which === 0 ? 'active' : ''} onClick={() => setWhich(0)}>int + float (ejemplo08)</button>
					<button className={which === 1 ? 'active' : ''} onClick={() => setWhich(1)}>double, double, int (lámina)</button>
				</div>
			</div>
			<div style={{ color: 'var(--pg-muted)' }}>{S.title}</div>
			<div className="pg-scroll">
				<svg viewBox={`0 0 ${S.size * 18 + 10} ${40 + S.fields.length * 14}`} style={{ width: '100%', maxWidth: Math.max(360, S.size * 18 + 10) }}>
					{Array.from({ length: S.size }, (_, b) => {
						const f = S.fields.findIndex((x) => b >= x.off && b < x.off + x.sz);
						return (
							<g key={b}>
								<rect x={4 + b * 18} y={6} width={16} height={22} rx={2} fill={f >= 0 ? colors[f] : 'var(--pg-border)'} opacity={f >= 0 ? 0.85 : 0.35} />
								{b % 4 === 0 && <text x={4 + b * 18} y={38} fontSize={8}>{b}</text>}
							</g>
						);
					})}
					{S.fields.map((f, k) => (
						<text key={f.n} x={4} y={52 + k * 14} fontSize={10} style={{ fill: colors[k] }}>
							■ {f.n}: {f.t}, desplazamiento {f.off} B, {f.sz} B
						</text>
					))}
				</svg>
			</div>
			<div className="pg-note">
				Typemap = <span className="kbd">{S.typemap}</span>. Desplazamientos con <span className="kbd">MPI_Get_address</span> relativos al primer campo; los huecos (gris) son padding/datos que no viajan. Pasos: construir → <span className="kbd">MPI_Type_commit</span> → usar → <span className="kbd">MPI_Type_free</span>.
			</div>
		</div>
	);
}
