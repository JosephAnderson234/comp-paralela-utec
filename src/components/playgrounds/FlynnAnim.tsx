import { useState } from 'react';

type Kind = 'SISD' | 'SIMD' | 'MISD' | 'MIMD';

const INFO: Record<Kind, { is: number; ds: number; pus: number; desc: string; ej: string }> = {
	SISD: { is: 1, ds: 1, pus: 1, desc: 'Un flujo de instrucciones opera sobre un flujo de datos: la máquina de von Neumann clásica.', ej: 'microcontroladores' },
	SIMD: { is: 1, ds: 4, pus: 4, desc: 'La MISMA instrucción se aplica en lockstep a muchos datos distintos (paralelismo de datos).', ej: 'GPUs, arquitecturas vectoriales; suma de vectores, filtros de imagen' },
	MISD: { is: 4, ds: 1, pus: 4, desc: 'Varias instrucciones distintas sobre el MISMO dato. Poco común.', ej: 'sistemas tolerantes a fallos en tiempo real (navegación aérea)' },
	MIMD: { is: 4, ds: 4, pus: 4, desc: 'Cada procesador ejecuta su propio programa sobre sus propios datos (asíncrono).', ej: 'memoria compartida/distribuida, GPGPU; matmul con hilos, N-Body paralelo' },
};
const INSTR = ['ADD', 'MUL', 'LOAD', 'CMP'];

export default function FlynnAnim() {
	const [k, setK] = useState<Kind>('SIMD');
	const f = INFO[k];
	const W = 560, H = 230;
	const puX = (i: number) => (f.pus === 1 ? W / 2 : 110 + i * ((W - 220) / (f.pus - 1)));
	const iX = (i: number) => (f.is === 1 ? W / 2 : 110 + i * ((W - 220) / (f.is - 1)));
	const dX = (i: number) => (f.ds === 1 ? W / 2 : 110 + i * ((W - 220) / (f.ds - 1)));
	const pal = ['var(--pg-c1)', 'var(--pg-c2)', 'var(--pg-c3)', 'var(--pg-c4)'];

	return (
		<div className="pg not-content">
			<h4>Taxonomía de Flynn en movimiento</h4>
			<div className="pg-row">
				<div className="pg-seg">
					{(Object.keys(INFO) as Kind[]).map((x) => (
						<button key={x} className={k === x ? 'active' : ''} onClick={() => setK(x)}>{x}</button>
					))}
				</div>
			</div>
			<div className="pg-scroll">
				<svg key={k} viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 420 }}>
					<text x={10} y={30} fontSize={11} style={{ fill: 'var(--pg-muted)' }}>instrucciones</text>
					<text x={10} y={124} fontSize={11} style={{ fill: 'var(--pg-muted)' }}>procesadores</text>
					<text x={10} y={214} fontSize={11} style={{ fill: 'var(--pg-muted)' }}>datos</text>
					{Array.from({ length: f.is }, (_, i) => (
						<g key={`i${i}`} className="pg-pulse" style={{ animationDelay: `${i * 0.08}s` }}>
							<rect x={iX(i) - 34} y={12} width={68} height={28} rx={7} fill="var(--sl-color-bg)" stroke={f.is > 1 ? pal[i] : 'var(--pg-c2)'} strokeWidth={1.8} />
							<text x={iX(i)} y={31} textAnchor="middle" fontSize={11} fontWeight={700}>{f.is > 1 ? INSTR[i] : 'ADD'}</text>
						</g>
					))}
					{Array.from({ length: f.ds }, (_, i) => (
						<g key={`d${i}`} className="pg-pulse" style={{ animationDelay: `${0.2 + i * 0.08}s` }}>
							<rect x={dX(i) - 34} y={192} width={68} height={28} rx={7} fill="var(--sl-color-bg)" stroke="var(--pg-c4)" strokeWidth={1.8} />
							<text x={dX(i)} y={211} textAnchor="middle" fontSize={11}>{f.ds > 1 ? `x[${i}]` : 'x'}</text>
						</g>
					))}
					{Array.from({ length: f.pus }, (_, i) => {
						const ii = f.is === 1 ? 0 : i, di = f.ds === 1 ? 0 : i;
						const col = f.is > 1 ? pal[i] : 'var(--pg-c2)';
						const dur = k === 'MIMD' ? 1.1 + i * 0.37 : 1.4;
						const begin = k === 'MIMD' ? `${i * 0.23}s` : '0s';
						return (
							<g key={`p${i}`}>
								<line x1={iX(ii)} y1={40} x2={puX(i)} y2={102} stroke={col} strokeOpacity={0.4} />
								<line x1={dX(di)} y1={192} x2={puX(i)} y2={138} stroke="var(--pg-c4)" strokeOpacity={0.4} />
								<circle r={4.5} fill={col}>
									<animate attributeName="cx" values={`${iX(ii)};${puX(i)}`} dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
									<animate attributeName="cy" values={`40;102`} dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
								</circle>
								<circle r={4.5} fill="var(--pg-c4)">
									<animate attributeName="cx" values={`${dX(di)};${puX(i)}`} dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
									<animate attributeName="cy" values={`192;138`} dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
								</circle>
								<rect x={puX(i) - 30} y={102} width={60} height={36} rx={8} fill="var(--sl-color-bg)" stroke="var(--sl-color-gray-3)" strokeWidth={1.4}>
									<animate attributeName="stroke-width" values="1.4;3;1.4" dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
								</rect>
								<text x={puX(i)} y={125} textAnchor="middle" fontSize={11} fontWeight={700}>PU{i}</text>
							</g>
						);
					})}
				</svg>
			</div>
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">flujos de instrucción</span><span className="v">{f.is === 1 ? 'único (S)' : 'múltiple (M)'}</span></div>
				<div className="pg-stat"><span className="k">flujos de datos</span><span className="v">{f.ds === 1 ? 'único (S)' : 'múltiple (M)'}</span></div>
				<div className="pg-stat"><span className="k">sincronía</span><span className="v">{k === 'MIMD' ? 'asíncrona' : 'lockstep'}</span></div>
			</div>
			<div className="pg-note">
				<b>{k}:</b> {f.desc} <i>Ej.: {f.ej}.</i>
			</div>
		</div>
	);
}
