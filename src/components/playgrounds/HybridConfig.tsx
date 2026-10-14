import { useMemo, useState } from 'react';

const PCOL = ['var(--pg-c1)', 'var(--pg-c2)', 'var(--pg-c3)', 'var(--pg-c4)', 'var(--pg-c5)', 'var(--pg-c6)'];

function divisores(n: number) {
	return [...Array(n).keys()].map((i) => i + 1).filter((d) => n % d === 0);
}

function rng(seed: number) {
	let s = seed >>> 0;
	return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

export default function HybridConfig() {
	const [nodos, setNodos] = useState(2);
	const [cores, setCores] = useState(8);
	const [ppn, setPpn] = useState(1);
	const [fase, setFase] = useState<'comp' | 'comm'>('comp');
	const [seed, setSeed] = useState(1);
	const divs = divisores(cores);
	const p = divs.includes(ppn) ? ppn : 1;
	const hilos = cores / p;
	const np = nodos * p;
	const modo = hilos === 1 ? 'MPI puro' : p === 1 ? 'un proceso MPI por nodo (máximo OpenMP)' : 'híbrido';

	const salida = useMemo(() => {
		const lineas: string[] = [];
		for (let r = 0; r < np; r++) for (let t = 0; t < hilos; t++) lineas.push(`Peekaboo desde el hilo ${t} de un total de ${hilos} y desde el proceso ${r} de un total de ${np} en nodo-${String(Math.floor(r / p) + 1).padStart(2, '0')}`);
		const rr = rng(seed);
		for (let i = lineas.length - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); [lineas[i], lineas[j]] = [lineas[j], lineas[i]]; }
		return lineas;
	}, [np, hilos, p, seed]);

	const script = `#!/bin/bash
#SBATCH --job-name=hibrido_mpi_openmp
#SBATCH --output=hibrido_mpi_openmp.out
#SBATCH --nodes=${nodos}
#SBATCH --ntasks=${np}
#SBATCH --ntasks-per-node=${p}
#SBATCH --cpus-per-task=${hilos}

module load mpich/4.0
export OMP_NUM_THREADS=$SLURM_CPUS_PER_TASK   # = ${hilos}
mpirun ./hibrido`;

	const activos = fase === 'comp' ? nodos * cores : np;

	return (
		<div className="pg not-content">
			<h4>Repartir un nodo: procesos MPI × hilos OpenMP</h4>
			<p className="pg-sub">Cada nodo tiene <b>{cores}</b> núcleos. Elige cuántos procesos MPI van en cada nodo; el resto de núcleos se llena con hilos OpenMP dentro de cada proceso.</p>
			<div className="pg-row">
				<label className="pg-field"><span>nodos = <b>{nodos}</b></span><input type="range" min={1} max={4} value={nodos} onChange={(e) => setNodos(+e.target.value)} /></label>
				<div className="pg-seg" role="group" aria-label="núcleos por nodo">
					{[8, 16, 32].map((c) => <button key={c} className={cores === c ? 'active' : ''} onClick={() => { setCores(c); setPpn(1); }}>{c} núcleos/nodo</button>)}
				</div>
			</div>
			<div className="pg-row">
				<span style={{ color: 'var(--pg-muted)' }}>procesos MPI por nodo:</span>
				<div className="pg-seg" role="group" aria-label="procesos por nodo">
					{divs.map((d) => <button key={d} className={p === d ? 'active' : ''} onClick={() => setPpn(d)}>{d} × {cores / d} hilos</button>)}
				</div>
				<div className="pg-seg" role="group" aria-label="fase">
					<button className={fase === 'comp' ? 'active' : ''} onClick={() => setFase('comp')}>fase de cómputo</button>
					<button className={fase === 'comm' ? 'active' : ''} onClick={() => setFase('comm')}>fase de comunicación MPI</button>
				</div>
			</div>
			<div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))`, gap: 10 }}>
				{Array.from({ length: nodos }, (_, n) => (
					<div key={n} style={{ border: '2px solid var(--pg-border)', borderRadius: 10, padding: 8, background: 'var(--pg-surface-2)' }}>
						<div style={{ fontSize: 12, color: 'var(--pg-muted)', marginBottom: 6 }}>nodo-{String(n + 1).padStart(2, '0')} · memoria compartida</div>
						<div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(p, 4)}, 1fr)`, gap: 6 }}>
							{Array.from({ length: p }, (_, k) => {
								const r = n * p + k;
								return (
									<div key={k} style={{ border: `2px solid ${PCOL[r % PCOL.length]}`, borderRadius: 8, padding: 4 }}>
										<div style={{ fontSize: 11, fontWeight: 700, color: PCOL[r % PCOL.length] }}>rank {r}</div>
										<div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
											{Array.from({ length: hilos }, (_, t) => {
												const on = fase === 'comp' || t === 0;
												return <span key={t} title={`hilo ${t}`} className={fase === 'comm' && t === 0 ? 'pg-blink' : ''} style={{ width: 12, height: 12, borderRadius: 3, background: on ? PCOL[r % PCOL.length] : 'transparent', border: `1px solid ${PCOL[r % PCOL.length]}`, opacity: on ? 1 : 0.4 }} />;
											})}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				))}
			</div>
			<div className="pg-stats">
				<div className="pg-stat"><span className="k">modo</span><span className="v" style={{ fontSize: '0.95rem' }}>{modo}</span></div>
				<div className="pg-stat"><span className="k">procesos MPI (-np)</span><span className="v">{np}</span></div>
				<div className="pg-stat"><span className="k">hilos por proceso</span><span className="v">{hilos}</span></div>
				<div className="pg-stat"><span className="k">núcleos trabajando</span><span className="v" style={{ color: fase === 'comm' && hilos > 1 ? 'var(--pg-bad)' : undefined }}>{activos}/{nodos * cores}</span></div>
			</div>
			<div className={`pg-note ${fase === 'comm' && hilos > 1 ? 'warn' : ''}`}>
				{fase === 'comp'
					? <>En el cómputo trabajan todos los núcleos: {np} procesos × {hilos} hilos = {nodos * cores}. Dentro de un nodo los hilos comparten memoria (no envían mensajes); entre procesos se comunican con MPI.</>
					: hilos > 1
						? <>Si la comunicación MPI se hace fuera de la región paralela, <b>solo el hilo maestro</b> de cada proceso trabaja y los otros {hilos - 1} esperan sin hacer nada. Es una de las razones por las que el híbrido <b>no siempre</b> es más eficiente.</>
						: <>Con MPI puro cada núcleo es un proceso y todos participan en la comunicación; a cambio hay más procesos, más mensajes y más copias de halo.</>}
			</div>
			<div className="pg-grid-2" style={{ alignItems: 'start' }}>
				<div style={{ minWidth: 0 }}>
					<div style={{ fontSize: 12, color: 'var(--pg-muted)' }}>script Slurm (estilo Khipu)</div>
					<pre className="pg-code" style={{ overflow: 'auto' }}>{script}</pre>
				</div>
				<div style={{ minWidth: 0 }}>
					<div style={{ fontSize: 12, color: 'var(--pg-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
						<span>salida de <code>peekaboo</code> ({salida.length} líneas, orden no determinista)</span>
						<button onClick={() => setSeed(seed + 1)}>🎲 Ejecutar otra vez</button>
					</div>
					<pre className="pg-code" style={{ maxHeight: 240, overflow: 'auto', fontSize: 11 }}>{salida.slice(0, 64).join('\n')}{salida.length > 64 ? `\n… (${salida.length - 64} líneas más)` : ''}</pre>
				</div>
			</div>
		</div>
	);
}
