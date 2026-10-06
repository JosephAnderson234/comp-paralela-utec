import { useState } from 'react';
import PlayerControls, { Packet, usePlayer } from '../ui/Player';

type Clause = 'shared' | 'private' | 'firstprivate' | 'lastprivate' | 'reduction' | 'threadprivate';
const COL = ['var(--pg-c1)', 'var(--pg-c2)', 'var(--pg-c3)', 'var(--pg-c4)'];

const INFO: Record<Clause, { code: string; phases: string[]; simple: string }> = {
	shared: {
		code: 'int x = 5;\n#pragma omp parallel shared(x)\n{\n    x += omp_get_thread_num() + 1;   // todos tocan LA MISMA x\n}\nprintf("%d", x);',
		phases: ['Antes: una sola x = 5 en memoria.', 'Al entrar: NO se copia nada; todos los hilos apuntan a la misma caja.', 'Cada hilo suma sobre la misma x… sin protección es una carrera.', 'Después: x tiene lo que haya quedado. Lo esperado sería 5+1+2+…+T, pero puede perderse alguna suma.'],
		simple: 'Una pizarra para todo el salón: todos escriben en la misma.',
	},
	private: {
		code: 'int x = 5;\n#pragma omp parallel private(x)\n{\n    x += omp_get_thread_num() + 1;   // x NO está inicializada aquí\n}\nprintf("%d", x);',
		phases: ['Antes: x = 5.', 'Al entrar: cada hilo recibe una x NUEVA y SIN inicializar (basura, “?”).', 'Cada hilo suma sobre su copia (basura + algo = basura).', 'Después: las copias desaparecen y la x original sigue en 5.'],
		simple: 'Cada uno recibe un cuaderno nuevo en blanco; al salir lo bota.',
	},
	firstprivate: {
		code: 'int x = 5;\n#pragma omp parallel firstprivate(x)\n{\n    x += omp_get_thread_num() + 1;   // cada copia empieza en 5\n}\nprintf("%d", x);',
		phases: ['Antes: x = 5.', 'Al entrar: cada hilo recibe su copia, inicializada con el valor original (5).', 'Cada hilo suma sobre su copia: 5+1, 5+2, …', 'Después: las copias desaparecen; la x original sigue en 5.'],
		simple: 'Cada uno recibe una fotocopia del cuaderno original; al salir la bota.',
	},
	lastprivate: {
		code: 'int x = 5;\n#pragma omp parallel for lastprivate(x)\nfor (int i = 0; i < 8; i++)\n    x = 10 * i;                      // cada hilo, su copia\nprintf("%d", x);   // valor de la ÚLTIMA iteración (i = 7)',
		phases: ['Antes: x = 5.', 'Al entrar: copias privadas (sin inicializar, como private).', 'Cada hilo recorre su bloque de iteraciones y escribe en su copia.', 'Después: x recibe el valor de la iteración que sería la última en secuencial (i = 7 → 70), sin importar qué hilo la hizo.'],
		simple: 'Como private, pero al final se queda con lo que dejó “el último de la fila” secuencial.',
	},
	reduction: {
		code: 'int x = 5;\n#pragma omp parallel reduction(+:x)\n{\n    x += omp_get_thread_num() + 1;   // copia privada que empieza en 0\n}\nprintf("%d", x);   // 5 + suma de las copias',
		phases: ['Antes: x = 5.', 'Al entrar: cada hilo recibe una copia inicializada con el neutro del operador (+ → 0).', 'Cada hilo acumula en su copia sin estorbar a nadie.', 'Después: OpenMP combina las copias con + y las suma a la x original.'],
		simple: 'Cada uno cuenta en su hoja y al final se juntan todos los totales.',
	},
	threadprivate: {
		code: 'float x;                       // variable GLOBAL\n#pragma omp threadprivate(x)\n...\n#pragma omp parallel   // región 1\n    x = 1.1 * tid + 1.0;\n...\n#pragma omp parallel   // región 2: ¡cada hilo aún ve SU x!\n    printf("%f", x);',
		phases: ['Antes: x es global; cada hilo tendrá su propia copia persistente.', 'Región 1: cada hilo escribe en su copia: 1.0, 2.1, 3.2, 4.3.', 'Fuera de la región: solo sigue el maestro (su x = 1.0).', 'Región 2: cada hilo vuelve a encontrar SU valor anterior (si no cambia el número de hilos y dynamic está apagado).'],
		simple: 'Un casillero con candado por persona que se conserva entre clases.',
	},
};

export default function OmpDataScope() {
	const [cl, setCl] = useState<Clause>('firstprivate');
	const T = 4;
	const pl = usePlayer(3, 1300);
	const k = pl.k;
	const info = INFO[cl];

	const copyVal = (t: number): string => {
		if (cl === 'shared') return '→ x';
		if (cl === 'threadprivate') return k >= 1 ? (1.1 * t + 1).toFixed(1) : '—';
		if (k < 1) return '—';
		if (cl === 'private') return '?';
		if (cl === 'firstprivate') return k >= 2 ? String(5 + t + 1) : '5';
		if (cl === 'reduction') return k >= 2 ? String(t + 1) : '0';
		// lastprivate: 2 iteraciones por hilo (static)
		return k >= 2 ? String(10 * (2 * t + 1)) : '?';
	};
	const sumTo = (T * (T + 1)) / 2;
	const original = (): string => {
		if (k < 3) return cl === 'threadprivate' ? (k >= 2 ? '1.0 (maestro)' : '—') : '5';
		switch (cl) {
			case 'shared': return `${5 + sumTo}?`;
			case 'private': case 'firstprivate': return '5';
			case 'lastprivate': return '70';
			case 'reduction': return String(5 + sumTo);
			case 'threadprivate': return 'cada hilo: su x';
		}
	};

	const W = 640, H = 200, tx = (t: number) => 90 + t * 150;
	return (
		<div className="pg not-content">
			<h4>¿Qué <code>x</code> ve cada hilo? Cláusulas de datos</h4>
			<div className="pg-row">
				<div className="pg-seg">
					{(Object.keys(INFO) as Clause[]).map((c) => (
						<button key={c} className={cl === c ? 'active' : ''} onClick={() => { setCl(c); pl.reset(); }}>{c}</button>
					))}
				</div>
			</div>
			<p className="pg-sub" style={{ margin: 0 }}>💡 {info.simple}</p>
			<pre className="pg-code">{info.code}</pre>
			<PlayerControls pl={pl} label="fase" />
			<div className="pg-scroll">
				<svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 480 }}>
					<rect className="pg-anim" x={W / 2 - 80} y={10} width={160} height={40} rx={8} fill="var(--sl-color-bg)" stroke="var(--pg-c6)" strokeWidth={2} />
					<text x={W / 2} y={26} textAnchor="middle" fontSize={10} style={{ fill: 'var(--pg-muted)' }}>{cl === 'threadprivate' ? 'x global (copia del maestro)' : 'x original (memoria compartida)'}</text>
					<text key={`o${k}${cl}`} className="pg-pulse" x={W / 2} y={43} textAnchor="middle" fontSize={14} fontWeight={700}>{original()}</text>
					{Array.from({ length: T }, (_, t) => {
						const show = cl === 'shared' ? k >= 1 : k >= 1 && !(cl === 'threadprivate' && k === 2 && t > 0);
						return (
							<g key={t}>
								<rect className="pg-anim" x={tx(t) - 55} y={120} width={110} height={56} rx={8} fill="var(--sl-color-bg)" stroke={k >= 1 ? COL[t] : 'var(--pg-border)'} strokeWidth={k >= 1 ? 2 : 1} opacity={k >= 1 ? 1 : 0.4} />
								<text x={tx(t)} y={136} textAnchor="middle" fontSize={11} fontWeight={700}>hilo {t}</text>
								{show && <text key={`v${k}${cl}`} className="pg-pulse" x={tx(t)} y={160} textAnchor="middle" fontSize={13} fontWeight={700} style={{ fill: copyVal(t) === '?' ? 'var(--pg-bad)' : COL[t] }}>{cl === 'shared' ? 'usa la x de arriba' : `x = ${copyVal(t)}`}</text>}
								{cl === 'threadprivate' && k === 2 && t > 0 && <text x={tx(t)} y={160} textAnchor="middle" fontSize={10} style={{ fill: 'var(--pg-muted)' }}>(dormido, guarda {(1.1 * t + 1).toFixed(1)})</text>}
								{/* flechas */}
								{cl === 'shared' && k >= 1 && <line x1={tx(t)} y1={120} x2={W / 2} y2={50} stroke={COL[t]} strokeDasharray="4 3" />}
								{k === 1 && (cl === 'firstprivate' || cl === 'reduction') && <Packet key={`p${k}${cl}${t}`} x1={W / 2} y1={50} x2={tx(t)} y2={120} color={COL[t]} label={cl === 'reduction' ? '0' : '5'} vanish />}
								{k === 3 && (cl === 'reduction' || cl === 'lastprivate') && (cl === 'reduction' || t === T - 1) && <Packet key={`q${k}${cl}${t}`} x1={tx(t)} y1={120} x2={W / 2} y2={50} color={COL[t]} label={copyVal(t)} vanish />}
								{k === 2 && cl === 'shared' && <Packet key={`s${k}${t}`} x1={tx(t)} y1={120} x2={W / 2} y2={50} color={COL[t]} label={`+${t + 1}`} vanish />}
							</g>
						);
					})}
				</svg>
			</div>
			<div className={`pg-note ${cl === 'private' && k >= 1 ? 'warn' : cl === 'shared' && k >= 2 ? 'bad' : ''}`}>
				<b>Fase {k}:</b> {info.phases[k]}
			</div>
		</div>
	);
}
