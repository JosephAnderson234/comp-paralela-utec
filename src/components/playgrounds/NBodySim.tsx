import { useEffect, useMemo, useRef, useState } from 'react';
import Chart, { fmt } from '../ui/Chart';
import { TXT, useRaf } from '../ui/Player';
import Tex from '../ui/Tex';

type Body = { x: number; y: number; vx: number; vy: number; m: number };

function makeBodies(n: number, seed: number): Body[] {
	let s = seed;
	const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
	return Array.from({ length: n }, () => {
		const a = r() * Math.PI * 2, d = 0.15 + 0.35 * Math.sqrt(r());
		const v = 0.55 * Math.sqrt(1 / (d + 0.1));
		return { x: 0.5 + d * Math.cos(a), y: 0.5 + d * Math.sin(a), vx: -v * Math.sin(a) * 0.35, vy: v * Math.cos(a) * 0.35, m: 0.5 + r() };
	});
}

export default function NBodySim() {
	const [n, setN] = useState(64);
	const [p, setP] = useState(4);
	const [running, setRunning] = useState(true);
	const [showLinks, setShowLinks] = useState(true);
	const [seed, setSeed] = useState(3);
	const [logTc, setLogTc] = useState(-7); // s por interacción
	const [logAlpha, setLogAlpha] = useState(-5);
	const bodies = useRef<Body[]>(makeBodies(n, seed));
	const canvas = useRef<HTMLCanvasElement>(null);
	const palette = useRef<string[]>(['#4cc3d9', '#f2a541', '#b38cf2', '#6fd08c', '#f27a7a', '#e8d15a']);
	const [steps, setSteps] = useState(0);
	const focus = useRef(0);

	useEffect(() => {
		bodies.current = makeBodies(n, seed);
		frames.current = 0;
		setSteps(0);
	}, [n, seed]);

	useEffect(() => {
		const el = canvas.current;
		if (!el) return;
		const cs = getComputedStyle(el);
		const vals = ['--pg-c1', '--pg-c2', '--pg-c3', '--pg-c4', '--pg-c5', '--pg-c6'].map((v) => cs.getPropertyValue(v).trim()).filter(Boolean);
		if (vals.length) palette.current = vals;
		draw();
	}, []);

	const owner = (i: number) => Math.min(p - 1, Math.floor((i * p) / n));

	function stepPhysics(dt: number) {
		const B = bodies.current;
		const eps = 0.02, G = 0.02;
		const ax = new Float64Array(B.length), ay = new Float64Array(B.length);
		for (let i = 0; i < B.length; i++)
			for (let j = 0; j < B.length; j++) {
				if (i === j) continue;
				const dx = B[j].x - B[i].x, dy = B[j].y - B[i].y;
				const r2 = dx * dx + dy * dy + eps * eps;
				const f = (G * B[j].m) / (r2 * Math.sqrt(r2));
				ax[i] += f * dx;
				ay[i] += f * dy;
			}
		for (let i = 0; i < B.length; i++) {
			B[i].vx += ax[i] * dt;
			B[i].vy += ay[i] * dt;
			B[i].x += B[i].vx * dt;
			B[i].y += B[i].vy * dt;
			// paredes suaves para que no escapen
			if (B[i].x < 0.02 || B[i].x > 0.98) B[i].vx *= -0.9;
			if (B[i].y < 0.02 || B[i].y > 0.98) B[i].vy *= -0.9;
			B[i].x = Math.min(0.98, Math.max(0.02, B[i].x));
			B[i].y = Math.min(0.98, Math.max(0.02, B[i].y));
		}
	}

	function draw() {
		const el = canvas.current;
		if (!el) return;
		const dpr = window.devicePixelRatio || 1;
		const w = el.clientWidth, h = el.clientHeight;
		if (el.width !== Math.round(w * dpr)) {
			el.width = Math.round(w * dpr);
			el.height = Math.round(h * dpr);
		}
		const ctx = el.getContext('2d')!;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);
		const B = bodies.current;
		const S = Math.min(w, h), ox = (w - S) / 2;
		if (showLinks && B.length) {
			const f = Math.floor(focus.current) % B.length;
			ctx.strokeStyle = palette.current[owner(f) % palette.current.length];
			ctx.globalAlpha = 0.18;
			ctx.lineWidth = 1;
			for (let j = 0; j < B.length; j++) {
				if (j === f) continue;
				ctx.beginPath();
				ctx.moveTo(ox + B[f].x * S, B[f].y * S);
				ctx.lineTo(ox + B[j].x * S, B[j].y * S);
				ctx.stroke();
			}
			ctx.globalAlpha = 1;
		}
		for (let i = 0; i < B.length; i++) {
			ctx.fillStyle = palette.current[owner(i) % palette.current.length];
			ctx.beginPath();
			ctx.arc(ox + B[i].x * S, B[i].y * S, 2 + B[i].m * 2.2, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	// solo anima mientras el canvas está en pantalla
	const [onScreen, setOnScreen] = useState(true);
	useEffect(() => {
		const el = canvas.current;
		if (!el) return;
		const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting));
		io.observe(el);
		return () => io.disconnect();
	}, []);
	const frames = useRef(0);
	useRaf(running && onScreen, (dt) => {
		stepPhysics(Math.min(dt, 0.03) * 0.6);
		focus.current += 0.05;
		draw();
		if (++frames.current % 15 === 0) setSteps(frames.current);
	});
	useEffect(() => {
		if (!running) draw();
	}, [p, showLinks, running, n]);

	const tc = 10 ** logTc, alpha = 10 ** logAlpha, beta = 1e-8 * 32; // 32 B por cuerpo
	const model = (pp: number) => {
		const comp = ((n * (n - 1)) / pp) * tc;
		const comm = pp > 1 ? alpha * Math.log2(pp) + beta * n : 0;
		return { comp, comm, tot: comp + comm };
	};
	const series = useMemo(() => {
		const ps = Array.from({ length: 64 }, (_, i) => i + 1);
		return {
			comp: ps.map((x) => [x, model(x).comp] as [number, number]),
			comm: ps.map((x) => [x, model(x).comm] as [number, number]),
			tot: ps.map((x) => [x, model(x).tot] as [number, number]),
		};
	}, [n, logTc, logAlpha]);
	const best = series.tot.reduce((a, b) => (b[1] < a[1] ? b : a));
	const cur = model(p);

	return (
		<div className="pg not-content">
			<h4>N-Body: simulación all-pairs repartida entre procesos</h4>
			<p className="pg-sub">Color = proceso dueño del cuerpo (bloques de n/p). Cada paso: cada proceso calcula la fuerza sobre sus cuerpos usando <b>los n−1 restantes</b> ⇒ necesita las posiciones de todos (Allgather).</p>
			<div className="pg-row">
				<label className="pg-field"><span>cuerpos n = <b>{n}</b></span><input type="range" min={8} max={200} step={8} value={n} onChange={(e) => setN(+e.target.value)} /></label>
				<label className="pg-field"><span>procesos p = <b>{p}</b></span><input type="range" min={1} max={6} value={p} onChange={(e) => setP(+e.target.value)} /></label>
				<button className="primary" onClick={() => setRunning(!running)}>{running ? `⏸${TXT} Pausa` : `▶${TXT} Simular`}</button>
				<button onClick={() => setSeed(seed + 1)}>↻ Reiniciar</button>
				<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={showLinks} onChange={(e) => setShowLinks(e.target.checked)} /> mostrar interacciones de un cuerpo</label>
			</div>
			<div className="pg-grid-2" style={{ alignItems: 'start' }}>
				<canvas ref={canvas} style={{ height: 300 }} aria-label="Simulación N-Body" />
				<div>
					<div className="pg-stats" style={{ gridTemplateColumns: '1fr 1fr' }}>
						<div className="pg-stat"><span className="k">pasos simulados</span><span className="v">{steps}</span></div>
						<div className="pg-stat"><span className="k">cuerpos por proceso</span><span className="v">≈ {Math.ceil(n / p)}</span></div>
						<div className="pg-stat"><span className="k">interacciones / paso (total)</span><span className="v">{n * (n - 1)}</span></div>
						<div className="pg-stat"><span className="k">por proceso</span><span className="v">{fmt((n * (n - 1)) / p)}</span></div>
						<div className="pg-stat"><span className="k">posiciones recibidas / proceso</span><span className="v">{p > 1 ? n - Math.ceil(n / p) : 0}</span></div>
						<div className="pg-stat"><span className="k">p óptimo (modelo)</span><span className="v">{best[0]}</span></div>
					</div>
				</div>
			</div>
			<div className="pg-row">
				<label className="pg-field"><span>t por interacción = <b>1e{logTc} s</b></span><input type="range" min={-10} max={-6} value={logTc} onChange={(e) => setLogTc(+e.target.value)} /></label>
				<label className="pg-field"><span>α latencia = <b>1e{logAlpha} s</b></span><input type="range" min={-7} max={-3} value={logAlpha} onChange={(e) => setLogAlpha(+e.target.value)} /></label>
			</div>
			<Chart
				xLabel="procesos p"
				yLabel="tiempo por paso (s)"
				yLog
				series={[
					{ label: 'T_cómputo = n(n−1)/p · t', color: 'var(--pg-c1)', data: series.comp },
					{ label: 'T_comm = α log p + β n', color: 'var(--pg-c2)', data: series.comm.filter((d) => d[1] > 0) },
					{ label: 'T_total', color: 'var(--pg-c4)', data: series.tot },
				]}
				vlines={[{ x: best[0], label: `óptimo p=${best[0]}`, color: 'var(--pg-c4)' }, { x: p, label: `p=${p}`, color: 'var(--pg-c3)' }]}
			/>
			<div className="pg-note">
				Con p={p}: cómputo {fmt(cur.comp)} s, comunicación {fmt(cur.comm)} s. <Tex>{'O\\!\\left(\\tfrac{n(n-1)}{p}\\right)'}</Tex> baja con p, la comunicación sube ⇒ hay un <b>p óptimo</b>, que se desplaza a la derecha si n crece (sube n y mira la línea verde). Barnes-Hut reduce el cómputo a <Tex>{'O(n\\log n/p)'}</Tex>.
			</div>
		</div>
	);
}
