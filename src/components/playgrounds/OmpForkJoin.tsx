import { useMemo, useState } from 'react';
import PlayerControls, { Packet, usePlayer } from '../ui/Player';

const COL = ['var(--pg-c1)', 'var(--pg-c2)', 'var(--pg-c3)', 'var(--pg-c4)', 'var(--pg-c5)', 'var(--pg-c6)', 'var(--pg-c1)', 'var(--pg-c2)'];

function rng(seed: number) {
	let s = seed >>> 0;
	return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** Fork-Join: el hilo maestro abre regiones paralelas y espera a todos al cerrar. */
function ForkJoinTab() {
	const [T, setT] = useState(4);
	const [regions, setRegions] = useState(2);
	const [seed, setSeed] = useState(3);
	// fases: por región → fork, trabajo, join;  más un tramo serial entre regiones
	const pl = usePlayer(regions * 3 + 1, 900);
	const work = useMemo(() => {
		const r = rng(seed);
		return Array.from({ length: regions }, () => Array.from({ length: T }, () => 0.45 + 0.55 * r()));
	}, [seed, regions, T]);

	const W = 660, H = 70 + T * 26, serial = 50, regW = (W - 30 - serial * (regions + 1)) / regions;
	const y = (t: number) => 40 + t * 26;
	const yM = 40 + ((T - 1) * 26) / 2;
	const k = pl.k;

	return (
		<>
			<div className="pg-row">
				<label className="pg-field"><span>hilos = <b>{T}</b></span><input type="range" min={2} max={8} value={T} onChange={(e) => { setT(+e.target.value); pl.reset(); }} /></label>
				<label className="pg-field"><span>regiones paralelas = <b>{regions}</b></span><input type="range" min={1} max={3} value={regions} onChange={(e) => { setRegions(+e.target.value); pl.reset(); }} /></label>
				<button onClick={() => { setSeed(seed + 1); pl.reset(); }}>🎲 Otra carga</button>
			</div>
			<PlayerControls pl={pl} label="fase" />
			<div className="pg-scroll">
				<svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 520 }}>
					<text x={4} y={yM + 4} fontSize={10} style={{ fill: 'var(--pg-muted)' }}>maestro</text>
					{Array.from({ length: regions + 1 }, (_, r) => {
						const x0 = 50 + r * (serial + regW);
						const shown = k >= r * 3 + (r === 0 ? 0 : 0);
						return shown ? <line key={`s${r}`} className="pg-anim" x1={x0 - 6} x2={x0 + serial - 14} y1={yM} y2={yM} stroke="var(--pg-c1)" strokeWidth={4} strokeLinecap="round" /> : null;
					})}
					{work.map((wr, r) => {
						const xs = 50 + r * (serial + regW) + serial - 10;
						const forkOn = k >= r * 3 + 1, workOn = k >= r * 3 + 2, joinOn = k >= r * 3 + 3;
						const maxW = Math.max(...wr);
						return (
							<g key={r}>
								<text x={xs + regW / 2} y={18} textAnchor="middle" fontSize={11} fontWeight={700}>#pragma omp parallel ({r + 1})</text>
								{forkOn && wr.map((_, t) => <line key={`f${t}`} className="pg-anim" x1={xs} y1={yM} x2={xs + 16} y2={y(t)} stroke={COL[t]} strokeWidth={1.5} />)}
								{workOn && wr.map((w, t) => (
									<g key={`w${t}`}>
										<rect className="pg-anim" x={xs + 16} y={y(t) - 7} width={(regW - 40) * w} height={14} rx={4} fill={COL[t]} />
										<rect x={xs + 16 + (regW - 40) * w} y={y(t) - 7} width={(regW - 40) * (maxW - w)} height={14} fill="var(--pg-bad)" opacity={0.13} />
										<text x={xs + 20} y={y(t) + 4} fontSize={9} style={{ fill: 'var(--pg-surface)' }}>hilo {t}</text>
									</g>
								))}
								{joinOn && (
									<>
										{wr.map((_, t) => <line key={`j${t}`} x1={xs + 16 + (regW - 40) * maxW} y1={y(t)} x2={xs + regW - 8} y2={yM} stroke={COL[t]} strokeWidth={1.5} />)}
										<line className="pg-blink" x1={xs + 16 + (regW - 40) * maxW} x2={xs + 16 + (regW - 40) * maxW} y1={y(0) - 10} y2={y(T - 1) + 10} stroke="var(--pg-c3)" strokeWidth={2} />
									</>
								)}
							</g>
						);
					})}
				</svg>
			</div>
			<div className="pg-note">
				{k === 0 && <>Solo existe el <b>hilo maestro</b> (hilo 0) ejecutando código serial.</>}
				{k > 0 && k % 3 === 1 && <><b>FORK:</b> al llegar a <code>#pragma omp parallel</code> el maestro crea un equipo de {T} hilos (él es el hilo 0).</>}
				{k > 0 && k % 3 === 2 && <>Cada hilo ejecuta el bloque. Unos terminan antes que otros (zona roja = espera).</>}
				{k > 0 && k % 3 === 0 && <><b>JOIN:</b> barrera implícita al cerrar la llave <code>{'}'}</code>; los hilos esperan al más lento, desaparecen y solo sigue el maestro.</>}
			</div>
		</>
	);
}

/** Ejemp01_hello_omp: id compartido vs privado. */
function RaceTab() {
	const [T, setT] = useState(4);
	const [mode, setMode] = useState<'shared' | 'private'>('shared');
	const [seed, setSeed] = useState(1);
	const order = useMemo(() => {
		const r = rng(seed);
		const a = Array.from({ length: T }, (_, i) => i);
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(r() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	}, [T, seed]);
	// eventos: T escrituras (en orden aleatorio) → sleep(1) → T impresiones
	const pl = usePlayer(2 * T + 1, 800);
	const k = pl.k;
	const writesDone = Math.min(k, T);
	const sharedVal = writesDone ? order[writesDone - 1] : -1;
	const printsDone = Math.max(0, k - T - 1);
	const printed = order.slice(0, printsDone).map((t) => ({ t, v: mode === 'shared' ? order[T - 1] : t }));

	const W = 640, H = 170 + T * 14, tx = (t: number) => 60 + (t * (W - 120)) / Math.max(1, T - 1);
	return (
		<>
			<div className="pg-row">
				<div className="pg-seg">
					<button className={mode === 'shared' ? 'active' : ''} onClick={() => { setMode('shared'); pl.reset(); }}>id compartido (shared)</button>
					<button className={mode === 'private' ? 'active' : ''} onClick={() => { setMode('private'); pl.reset(); }}>private(id)</button>
				</div>
				<label className="pg-field"><span>hilos = <b>{T}</b></span><input type="range" min={2} max={6} value={T} onChange={(e) => { setT(+e.target.value); pl.reset(); }} /></label>
				<button onClick={() => { setSeed(seed + 1); pl.reset(); }}>🎲 Otro orden de llegada</button>
			</div>
			<pre className="pg-code">{`#pragma omp parallel ${mode === 'shared' ? 'shared(id)' : 'private(id)'}
{
    id = omp_get_thread_num();   // (1) escribe
    sleep(1);                    // (2) fuerza la carrera
    printf("Peekaboo desde el hilo = %d\\n", id);   // (3) lee
}`}</pre>
			<PlayerControls pl={pl} label="evento" />
			<div className="pg-scroll">
				<svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 480 }}>
					{Array.from({ length: T }, (_, t) => {
						const wrote = order.indexOf(t) < writesDone;
						const myVal = mode === 'shared' ? sharedVal : wrote ? t : -1;
						return (
							<g key={t}>
								<rect className="pg-anim" x={tx(t) - 32} y={14} width={64} height={36} rx={8} fill="var(--sl-color-bg)" stroke={wrote ? COL[t] : 'var(--pg-border)'} strokeWidth={wrote ? 2 : 1} />
								<text x={tx(t)} y={30} textAnchor="middle" fontSize={11} fontWeight={700}>hilo {t}</text>
								{mode === 'private' && <text x={tx(t)} y={44} textAnchor="middle" fontSize={10} style={{ fill: COL[t] }}>id = {myVal < 0 ? '?' : myVal}</text>}
								{k <= T && order[k - 1] === t && (
									<Packet key={`w${k}`} x1={tx(t)} y1={50} x2={mode === 'shared' ? W / 2 : tx(t)} y2={mode === 'shared' ? 100 : 60} color={COL[t]} label={String(t)} vanish />
								)}
							</g>
						);
					})}
					{mode === 'shared' && (
						<g>
							<rect className="pg-anim" x={W / 2 - 70} y={92} width={140} height={34} rx={8} fill="var(--sl-color-bg)" stroke="var(--pg-c2)" strokeWidth={1.8} />
							<text x={W / 2} y={113} textAnchor="middle" fontSize={12} fontWeight={700}>id (única copia) = {sharedVal < 0 ? '?' : sharedVal}</text>
						</g>
					)}
					{k === T + 1 && <text x={W / 2} y={146} textAnchor="middle" fontSize={12} style={{ fill: 'var(--pg-muted)' }}>sleep(1)… todos ya escribieron</text>}
					{printed.map((p, i) => (
						<text key={i} className="pg-pulse" x={20} y={164 + i * 14} fontSize={11} style={{ fill: mode === 'shared' && p.v !== p.t ? 'var(--pg-bad)' : 'var(--pg-ok)', fontFamily: 'var(--sl-font-mono)' }}>
							[hilo {p.t}] Peekaboo desde el hilo = {p.v}
						</text>
					))}
				</svg>
			</div>
			{k === pl.total && (
				<div className={`pg-note ${mode === 'shared' ? 'bad' : 'ok'}`}>
					{mode === 'shared'
						? <>Todos imprimen <b>{order[T - 1]}</b>: el último hilo en escribir pisó el valor de los demás. Eso es una <b>condición de carrera</b>: el resultado depende de quién llega último.</>
						: <>Con <code>private(id)</code> cada hilo tiene su propia caja <code>id</code>: imprime su número, aunque el orden de las líneas cambie en cada corrida.</>}
				</div>
			)}
		</>
	);
}

export default function OmpForkJoin() {
	const [tab, setTab] = useState<'fj' | 'race'>('fj');
	return (
		<div className="pg not-content">
			<h4>OpenMP: modelo fork-join y la primera condición de carrera</h4>
			<div className="pg-row">
				<div className="pg-seg">
					<button className={tab === 'fj' ? 'active' : ''} onClick={() => setTab('fj')}>Fork → trabajo → Join</button>
					<button className={tab === 'race' ? 'active' : ''} onClick={() => setTab('race')}>Ejemp01: ¿shared o private?</button>
				</div>
			</div>
			{tab === 'fj' ? <ForkJoinTab /> : <RaceTab />}
		</div>
	);
}
