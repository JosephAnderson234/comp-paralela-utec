import { useEffect, useRef, useState } from 'react';

/** Reproductor de pasos: k ∈ [0, total], con autoplay y velocidad. */
export function usePlayer(total: number, baseMs = 1100) {
	const [k, setKRaw] = useState(0);
	const [playing, setPlaying] = useState(false);
	const [speed, setSpeed] = useState(1);
	const totalRef = useRef(total);
	totalRef.current = total;

	useEffect(() => {
		if (!playing) return;
		const id = setInterval(() => {
			setKRaw((prev) => {
				if (prev >= totalRef.current) {
					setPlaying(false);
					return prev;
				}
				return prev + 1;
			});
		}, baseMs / speed);
		return () => clearInterval(id);
	}, [playing, speed, baseMs]);

	useEffect(() => {
		if (k > total) setKRaw(total);
	}, [total, k]);

	const setK = (v: number) => setKRaw(Math.max(0, Math.min(total, v)));
	const reset = () => {
		setPlaying(false);
		setKRaw(0);
	};
	const toggle = () => {
		if (!playing && k >= total) setKRaw(0);
		setPlaying(!playing);
	};
	return { k: Math.min(k, total), setK, playing, setPlaying, toggle, speed, setSpeed, reset, total };
}

export type PlayerState = ReturnType<typeof usePlayer>;

/** Selector de variante de texto: evita que ▶ ⏸ ⏮ se dibujen como emoji a color. */
export const TXT = '︎';

/** Controles ⏮ ◀ ▶/⏸ ▶ ⏭ + velocidad + barra de progreso. */
export default function PlayerControls({ pl, label = 'paso' }: { pl: PlayerState; label?: string }) {
	const { k, total, playing } = pl;
	return (
		<div className="pg-player">
			<div className="pg-row" style={{ alignItems: 'center' }}>
				<button onClick={pl.reset} aria-label="Reiniciar" title="Reiniciar">{'⏮' + TXT}</button>
				<button onClick={() => { pl.setPlaying(false); pl.setK(k - 1); }} disabled={k === 0} aria-label="Paso anterior">{'◀' + TXT}</button>
				<button className="primary" onClick={pl.toggle} aria-label={playing ? 'Pausar' : 'Reproducir'} style={{ minWidth: 96 }}>
					{playing ? `⏸${TXT} Pausa` : k >= total && total > 0 ? '↻ Repetir' : `▶${TXT} Play`}
				</button>
				<button onClick={() => { pl.setPlaying(false); pl.setK(k + 1); }} disabled={k >= total} aria-label="Paso siguiente">{'▶' + TXT}</button>
				<button onClick={() => { pl.setPlaying(false); pl.setK(total); }} aria-label="Ir al final" title="Ir al final">{'⏭' + TXT}</button>
				<div className="pg-seg" role="group" aria-label="Velocidad">
					{[0.5, 1, 2, 4].map((s) => (
						<button key={s} className={pl.speed === s ? 'active' : ''} onClick={() => pl.setSpeed(s)}>
							{s}×
						</button>
					))}
				</div>
				<span style={{ color: 'var(--pg-muted)' }}>
					{label} {k}/{total}
				</span>
			</div>
			<div className="pg-progress" aria-hidden="true">
				<i style={{ width: `${total ? (100 * k) / total : 0}%` }} />
			</div>
		</div>
	);
}

/** Paquete que viaja de (x1,y1) a (x2,y2); se reinicia al cambiar `k` (usar como key). */
export function Packet({ x1, y1, x2, y2, color = 'var(--pg-c2)', dur = 0.7, r = 5, label, vanish = false }: { x1: number; y1: number; x2: number; y2: number; color?: string; dur?: number; r?: number; label?: string; vanish?: boolean }) {
	return (
		<g className="pg-packet">
			{vanish && <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.8;1" dur={`${dur + 0.35}s`} fill="freeze" />}
			<circle r={r} fill={color} cx={x1} cy={y1}>
				<animate attributeName="cx" from={x1} to={x2} dur={`${dur}s`} fill="freeze" calcMode="spline" keySplines="0.3 0 0.2 1" keyTimes="0;1" />
				<animate attributeName="cy" from={y1} to={y2} dur={`${dur}s`} fill="freeze" calcMode="spline" keySplines="0.3 0 0.2 1" keyTimes="0;1" />
			</circle>
			{label && (
				<text fontSize={9} textAnchor="middle" x={x1} y={y1 - 8} style={{ fill: color }}>
					<animate attributeName="x" from={x1} to={x2} dur={`${dur}s`} fill="freeze" calcMode="spline" keySplines="0.3 0 0.2 1" keyTimes="0;1" />
					<animate attributeName="y" from={y1 - 8} to={y2 - 8} dur={`${dur}s`} fill="freeze" calcMode="spline" keySplines="0.3 0 0.2 1" keyTimes="0;1" />
					{label}
				</text>
			)}
		</g>
	);
}

/** Bucle de animación continuo (requestAnimationFrame) mientras `running`. */
export function useRaf(running: boolean, cb: (dt: number) => void) {
	const cbRef = useRef(cb);
	cbRef.current = cb;
	useEffect(() => {
		if (!running) return;
		let id = 0;
		let last = performance.now();
		const loop = (t: number) => {
			const dt = Math.min(0.05, (t - last) / 1000);
			last = t;
			cbRef.current(dt);
			id = requestAnimationFrame(loop);
		};
		id = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(id);
	}, [running]);
}
