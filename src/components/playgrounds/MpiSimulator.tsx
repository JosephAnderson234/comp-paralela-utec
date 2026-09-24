import { useEffect, useMemo, useRef, useState } from 'react';

// ---------------- Modelo ----------------
type Instr =
	| { op: 'send'; to: number; tag: number; mode: 'std' | 'ssend'; line: number }
	| { op: 'recv'; from: number | 'any'; tag: number | 'any'; line: number }
	| { op: 'isend'; to: number; tag: number; sync: boolean; req: string; line: number }
	| { op: 'irecv'; from: number | 'any'; tag: number | 'any'; req: string; line: number }
	| { op: 'wait'; reqs: string[]; line: number }
	| { op: 'local'; what: string; line: number };

type Msg = { id: number; src: number; dst: number; tag: number; sync: boolean; matched: boolean; t0: number; t1?: number };
type PRecv = { id: number; rank: number; from: number | 'any'; tag: number | 'any'; req: string; msg?: number };
type Cell = { s: 'run' | 'block' | 'done'; line?: number; txt: string };

const RANK_COLORS = ['#4cc3d9', '#f2a541', '#b38cf2', '#6fd08c', '#f27a7a', '#e8d15a', '#7fa7ff', '#ff8fd1'];

function describe(i: Instr): string {
	switch (i.op) {
		case 'send': return `${i.mode === 'ssend' ? 'Ssend' : 'Send'} → P${i.to} (tag ${i.tag})`;
		case 'recv': return `Recv ← ${i.from === 'any' ? 'ANY' : 'P' + i.from} (tag ${i.tag})`;
		case 'isend': return `${i.sync ? 'Issend' : 'Isend'} → P${i.to} [${i.req}]`;
		case 'irecv': return `Irecv ← P${i.from} [${i.req}]`;
		case 'wait': return `Wait(${i.reqs.join(', ')})`;
		case 'local': return i.what;
	}
}

type SimState = {
	pc: number[];
	msgs: Msg[];
	precv: PRecv[];
	posted: (number | null)[]; // msg id del send bloqueante en curso
	recvHit: (number | null)[]; // msg id recibido por el recv bloqueante en curso
	reqs: Record<string, { kind: 'isend' | 'irecv'; msg?: number; precv?: number }>[];
	t: number;
	timeline: Cell[][];
	log: string[];
	deadlock: boolean;
	finished: boolean;
};

function init(p: number): SimState {
	return {
		pc: Array(p).fill(0),
		msgs: [],
		precv: [],
		posted: Array(p).fill(null),
		recvHit: Array(p).fill(null),
		reqs: Array.from({ length: p }, () => ({})),
		t: 0,
		timeline: Array.from({ length: p }, () => []),
		log: [],
		deadlock: false,
		finished: false,
	};
}

function tick(prev: SimState, progs: Instr[][], eager: boolean): SimState {
	if (prev.deadlock || prev.finished) return prev;
	const s: SimState = structuredClone(prev);
	const p = progs.length;
	s.t++;
	let changed = false;
	let nextId = s.msgs.length + s.precv.length + 1;
	const cur = (r: number) => progs[r][s.pc[r]];

	// Fase A: publicar operaciones
	for (let r = 0; r < p; r++) {
		const ins = cur(r);
		if (!ins) continue;
		if (ins.op === 'send' && s.posted[r] === null) {
			const sync = ins.mode === 'ssend' || !eager;
			const id = nextId++;
			s.msgs.push({ id, src: r, dst: ins.to, tag: ins.tag, sync, matched: false, t0: s.t });
			s.posted[r] = id;
			changed = true;
		} else if (ins.op === 'isend') {
			const id = nextId++;
			s.msgs.push({ id, src: r, dst: ins.to, tag: ins.tag, sync: ins.sync || !eager, matched: false, t0: s.t });
			s.reqs[r][ins.req] = { kind: 'isend', msg: id };
		} else if (ins.op === 'irecv') {
			const id = nextId++;
			s.precv.push({ id, rank: r, from: ins.from, tag: ins.tag, req: ins.req });
			s.reqs[r][ins.req] = { kind: 'irecv', precv: id };
		}
	}

	// Fase B: emparejar mensajes (orden FIFO)
	const fits = (m: Msg, from: number | 'any', tag: number | 'any') => (from === 'any' || from === m.src) && (tag === 'any' || tag === m.tag);
	for (const m of s.msgs) {
		if (m.matched) continue;
		const pr = s.precv.find((x) => x.rank === m.dst && x.msg === undefined && fits(m, x.from, x.tag));
		if (pr) {
			pr.msg = m.id;
			m.matched = true;
			m.t1 = s.t;
			changed = true;
			s.log.push(`t=${s.t}: P${m.src} → P${m.dst} (tag ${m.tag}) entregado en Irecv`);
			continue;
		}
		const ins = cur(m.dst);
		if (ins && ins.op === 'recv' && s.recvHit[m.dst] === null && fits(m, ins.from, ins.tag)) {
			s.recvHit[m.dst] = m.id;
			m.matched = true;
			m.t1 = s.t;
			changed = true;
			s.log.push(`t=${s.t}: P${m.src} → P${m.dst} (tag ${m.tag}) recibido`);
		}
	}

	// Fase C: completar
	const reqDone = (r: number, name: string) => {
		const q = s.reqs[r][name];
		if (!q) return false;
		if (q.kind === 'isend') {
			const m = s.msgs.find((x) => x.id === q.msg)!;
			return !m.sync || m.matched;
		}
		return s.precv.find((x) => x.id === q.precv)!.msg !== undefined;
	};
	for (let r = 0; r < p; r++) {
		const ins = cur(r);
		if (!ins) {
			s.timeline[r].push({ s: 'done', txt: 'terminado' });
			continue;
		}
		let ok = false;
		switch (ins.op) {
			case 'send': {
				const m = s.msgs.find((x) => x.id === s.posted[r])!;
				ok = !m.sync || m.matched;
				if (ok) s.posted[r] = null;
				break;
			}
			case 'recv':
				ok = s.recvHit[r] !== null;
				if (ok) s.recvHit[r] = null;
				break;
			case 'wait':
				ok = ins.reqs.every((q) => reqDone(r, q));
				break;
			default:
				ok = true;
		}
		s.timeline[r].push({ s: ok ? 'run' : 'block', line: ins.line, txt: describe(ins) });
		if (ok) {
			s.pc[r]++;
			changed = true;
		}
	}
	s.finished = s.pc.every((pc, r) => pc >= progs[r].length);
	if (!changed && !s.finished) {
		s.deadlock = true;
		s.log.push(`t=${s.t}: ningún proceso puede avanzar → BLOQUEO MUTUO (deadlock)`);
	}
	if (s.finished) s.log.push(`t=${s.t}: todos los procesos terminaron`);
	return s;
}

// ---------------- Escenarios ----------------
type Scenario = {
	name: string;
	file: string;
	code: string;
	pFixed?: number;
	pMin?: number;
	eagerDefault: boolean;
	sizeNote: string;
	build: (r: number, p: number) => Instr[];
	note: string;
};

const ring = (r: number, p: number) => ({ next: (r + 1) % p, prev: (r - 1 + p) % p });

const SCENARIOS: Scenario[] = [
	{
		name: 'Anillo: Send → Recv',
		file: 'session3/ejemplo01a_bloqueada.cpp',
		eagerDefault: false,
		sizeNote: 'N = 1<<17 enteros (512 KB): supera el umbral eager ⇒ MPI_Send se comporta como síncrono.',
		code: `prev = rank - 1;
next = rank + 1;
if (rank == 0) prev = numtasks - 1;
if (rank == (numtasks - 1)) next = 0;

// COMUNICACION CICLICA
// 1. Cada proceso envía el buffer a su vecino derecho
// y recibe de su vecino izquierdo
MPI_Send(sbuf, N, MPI_INT, next, tag1, MPI_COMM_WORLD);
MPI_Recv(rbuf, N, MPI_INT, prev, tag1, MPI_COMM_WORLD, &status);`,
		build: (r, p) => {
			const { next, prev } = ring(r, p);
			return [
				{ op: 'local', what: 'calcula vecinos', line: 4 },
				{ op: 'send', to: next, tag: 1, mode: 'std', line: 9 },
				{ op: 'recv', from: prev, tag: 1, line: 10 },
			];
		},
		note: 'Con mensajes pequeños (eager) MPI_Send copia al buffer del sistema y retorna: no hay bloqueo. Con mensajes grandes todos quedan esperando que el vecino reciba y nadie llega al Recv ⇒ bloqueo mutuo.',
	},
	{
		name: 'Anillo: Ssend → Recv',
		file: 'session3/ejemplo01a_bloqueada.cpp (opción 2)',
		eagerDefault: true,
		sizeNote: 'Ssend nunca usa buffer: siempre espera al receptor.',
		code: `// 2. Utilice send sincrónico, ¿Qué sucede?
MPI_Ssend(sbuf, N, MPI_INT, next, tag1, MPI_COMM_WORLD);
MPI_Recv(rbuf, N, MPI_INT, prev, tag1, MPI_COMM_WORLD, &status);`,
		build: (r, p) => {
			const { next, prev } = ring(r, p);
			return [
				{ op: 'send', to: next, tag: 1, mode: 'ssend', line: 2 },
				{ op: 'recv', from: prev, tag: 1, line: 3 },
			];
		},
		note: 'Siempre hay bloqueo mutuo: cada Ssend espera a un Recv que su vecino nunca alcanza (ciclo de espera P0→P1→…→P0).',
	},
	{
		name: 'Anillo: Recv → Send (orden invertido)',
		file: 'session3/ejemplo01a_bloqueada.cpp (opción 3)',
		eagerDefault: true,
		sizeNote: 'El tamaño no importa: nadie envía primero.',
		code: `// 3. Invierta el orden de Send/Recv, ¿qué sucede?
MPI_Recv(rbuf, N, MPI_INT, prev, tag1, MPI_COMM_WORLD, &status);
MPI_Send(sbuf, N, MPI_INT, next, tag1, MPI_COMM_WORLD);`,
		build: (r, p) => {
			const { next, prev } = ring(r, p);
			return [
				{ op: 'recv', from: prev, tag: 1, line: 2 },
				{ op: 'send', to: next, tag: 1, mode: 'std', line: 3 },
			];
		},
		note: 'Todos esperan recibir y nadie envía ⇒ bloqueo mutuo, incluso con buffer.',
	},
	{
		name: 'Anillo: el maestro rompe el ciclo (Ssend)',
		file: 'session3/ejemplo01b_bloqueada.cpp (casos 1 y 2)',
		eagerDefault: false,
		sizeNote: 'Con Ssend (o mensajes grandes) la comunicación se serializa.',
		code: `if (rank == 0)
{
  MPI_Recv(sbuf, N, MPI_INT, prev, tag1, MPI_COMM_WORLD, &stats[0]);
  MPI_Ssend(sbuf, N, MPI_INT, next, tag1, MPI_COMM_WORLD);
}
else
{
  MPI_Ssend(sbuf, N, MPI_INT, next, tag1, MPI_COMM_WORLD);
  MPI_Recv(sbuf, N, MPI_INT, prev, tag1, MPI_COMM_WORLD, &stats[0]);
}`,
		build: (r, p) => {
			const { next, prev } = ring(r, p);
			return r === 0
				? [{ op: 'recv', from: prev, tag: 1, line: 3 }, { op: 'send', to: next, tag: 1, mode: 'ssend', line: 4 }]
				: [{ op: 'send', to: next, tag: 1, mode: 'ssend', line: 8 }, { op: 'recv', from: prev, tag: 1, line: 9 }];
		},
		note: 'No hay bloqueo, pero la cadena se “desenrolla” de a un mensaje por vez: comunicación SECUENCIAL, T ∝ p (lámina U3.3).',
	},
	{
		name: 'Anillo: procesos pares/impares alternan',
		file: 'session3/ejemplo01b_bloqueada.cpp (caso 3)',
		eagerDefault: false,
		sizeNote: 'Prueba con mensajes grandes y con p par/impar.',
		code: `// 3. Cada segundo proceso invierte el orden
if (rank % 2 == 0)
{
  MPI_Send(sbuf, N, MPI_INT, next, tag1, MPI_COMM_WORLD);
  MPI_Recv(sbuf, N, MPI_INT, prev, tag1, MPI_COMM_WORLD, &stats[0]);
}
else
{
  MPI_Recv(sbuf, N, MPI_INT, prev, tag1, MPI_COMM_WORLD, &stats[0]);
  MPI_Send(sbuf, N, MPI_INT, next, tag1, MPI_COMM_WORLD);
}`,
		build: (r, p) => {
			const { next, prev } = ring(r, p);
			return r % 2 === 0
				? [{ op: 'send', to: next, tag: 1, mode: 'std', line: 4 }, { op: 'recv', from: prev, tag: 1, line: 5 }]
				: [{ op: 'recv', from: prev, tag: 1, line: 8 }, { op: 'send', to: next, tag: 1, mode: 'std', line: 9 }];
		},
		note: 'Los pares envían mientras los impares reciben, y luego al revés: dos “fases” en vez de p pasos secuenciales.',
	},
	{
		name: 'Anillo no bloqueado: Irecv + Isend + Waitall',
		file: 'session3/ejemplo01d_nobloqueada.cpp',
		eagerDefault: true,
		sizeNote: 'N = 1 entero.',
		code: `MPI_Irecv(rbuf, N, MPI_INT, prev, tag1, MPI_COMM_WORLD, &reqs[0]);
MPI_Isend(sbuf, N, MPI_INT, next, tag1, MPI_COMM_WORLD, &reqs[1]);

printf("1.rank %d tiene dato: %d \\n ", rank, rbuf[0]);

MPI_Waitall(2, reqs, stats);
rbuf[0]++;
printf("2.rank %d tiene dato: %d \\n ", rank, rbuf[0]);`,
		build: (r, p) => {
			const { next, prev } = ring(r, p);
			return [
				{ op: 'irecv', from: prev, tag: 1, req: 'reqs[0]', line: 1 },
				{ op: 'isend', to: next, tag: 1, sync: false, req: 'reqs[1]', line: 2 },
				{ op: 'local', what: 'printf (rbuf aún NO es válido)', line: 4 },
				{ op: 'wait', reqs: ['reqs[0]', 'reqs[1]'], line: 6 },
				{ op: 'local', what: 'rbuf[0]++', line: 7 },
				{ op: 'local', what: 'printf', line: 8 },
			];
		},
		note: 'Irecv antes de Isend (recomendación de la lámina) ⇒ sin bloqueo mutuo. El primer printf lee rbuf ANTES del Wait: su valor no está garantizado (imprime 0).',
	},
	{
		name: 'Anillo con tipo struct: Issend + Recv + Wait (p vueltas)',
		file: 'U3.4 …/ejemplo08-struct.cpp',
		eagerDefault: true,
		sizeNote: 'Issend es síncrono, pero no bloquea la llamada.',
		code: `for( i = 0; i < size; i++)
{
  MPI_Issend(&snd_buf, 1, send_recv_type, right, 17, MPI_COMM_WORLD, &request);
  MPI_Recv(&rcv_buf, 1, send_recv_type, left, 17, MPI_COMM_WORLD, &status);
  MPI_Wait(&request, &status);
  snd_buf = rcv_buf;
  sum.i += rcv_buf.i;  sum.f += rcv_buf.f;
}`,
		build: (r, p) => {
			const { next, prev } = ring(r, p);
			const out: Instr[] = [];
			for (let i = 0; i < p; i++) {
				out.push(
					{ op: 'isend', to: next, tag: 17, sync: true, req: `request${i}`, line: 3 },
					{ op: 'recv', from: prev, tag: 17, line: 4 },
					{ op: 'wait', reqs: [`request${i}`], line: 5 },
					{ op: 'local', what: 'snd_buf = rcv_buf; sum += …', line: 7 },
				);
			}
			return out;
		},
		note: 'Tras p vueltas cada proceso acumuló los ranks de todos: sum.i = 0+1+…+(p−1). Es el mismo resultado que MPI_Allreduce (practica_pc3/2026I-Ejercicio01).',
	},
	{
		name: 'Ping-pong (Send/Recv alternados)',
		file: 'practica_pc3/2025II-Ej01pingpong.c',
		pFixed: 2,
		eagerDefault: true,
		sizeNote: '1 float por mensaje; se muestran 3 de las 50 iteraciones.',
		code: `for (i = 1; i <= number_of_messages; i++)
{
  if (my_rank == 0)
  {
    MPI_Send(buffer, 1, MPI_FLOAT, 1, 17, MPI_COMM_WORLD);
    MPI_Recv(buffer, 1, MPI_FLOAT, 1, 23, MPI_COMM_WORLD, &status);
  }
  else if (my_rank == 1)
  {
    MPI_Recv(buffer, 1, MPI_FLOAT, 0, 17, MPI_COMM_WORLD, &status);
    MPI_Send(buffer, 1, MPI_FLOAT, 0, 23, MPI_COMM_WORLD);
  }
}`,
		build: (r) => {
			const out: Instr[] = [];
			for (let i = 0; i < 3; i++) {
				if (r === 0) out.push({ op: 'send', to: 1, tag: 17, mode: 'std', line: 5 }, { op: 'recv', from: 1, tag: 23, line: 6 });
				else out.push({ op: 'recv', from: 0, tag: 17, line: 10 }, { op: 'send', to: 0, tag: 23, mode: 'std', line: 11 });
			}
			return out;
		},
		note: 'Siempre hay un Send emparejado con un Recv ya pendiente: no se necesita comunicación no bloqueada. Tiempo por mensaje = (finish − start) / (2 · 50).',
	},
	{
		name: 'PD03 Ej.3: DAG con Ssend (5 procesos)',
		file: 'practica_3_ofi/ejercicio03.cpp',
		pFixed: 5,
		eagerDefault: true,
		sizeNote: 'Todos los envíos son MPI_Ssend.',
		code: `if (rank == 0) {
    MPI_Ssend(&dato, 1, MPI_INT, 2, 0, MPI_COMM_WORLD);
}
else if (rank == 1) {
    MPI_Ssend(&dato, 1, MPI_INT, 2, 1, MPI_COMM_WORLD);
}
else if (rank == 2) {
    MPI_Recv(&a, 1, MPI_INT, 3, 2, MPI_COMM_WORLD,MPI_STATUS_IGNORE);
    MPI_Recv(&a, 1, MPI_INT,0, 0, MPI_COMM_WORLD,MPI_STATUS_IGNORE);
    MPI_Recv(&b, 1, MPI_INT,1, 1, MPI_COMM_WORLD,MPI_STATUS_IGNORE);
    resultado = a + b;
    MPI_Ssend(&resultado, 1, MPI_INT,3, 3, MPI_COMM_WORLD);
    MPI_Ssend(&resultado, 1, MPI_INT,4, 3, MPI_COMM_WORLD);
}
else if (rank == 3) {
    MPI_Recv(&resultado, 1, MPI_INT, 2, 3, MPI_COMM_WORLD,MPI_STATUS_IGNORE);
    MPI_Ssend(&dato, 1, MPI_INT,2, 2, MPI_COMM_WORLD);
}
else if (rank == 4) {
    MPI_Recv(&resultado, 1, MPI_INT,2, 3, MPI_COMM_WORLD,MPI_STATUS_IGNORE);
}`,
		build: (r) =>
			(
				[
					[{ op: 'send', to: 2, tag: 0, mode: 'ssend', line: 2 }],
					[{ op: 'send', to: 2, tag: 1, mode: 'ssend', line: 5 }],
					[
						{ op: 'recv', from: 3, tag: 2, line: 8 },
						{ op: 'recv', from: 0, tag: 0, line: 9 },
						{ op: 'recv', from: 1, tag: 1, line: 10 },
						{ op: 'local', what: 'resultado = a + b', line: 11 },
						{ op: 'send', to: 3, tag: 3, mode: 'ssend', line: 12 },
						{ op: 'send', to: 4, tag: 3, mode: 'ssend', line: 13 },
					],
					[{ op: 'recv', from: 2, tag: 3, line: 16 }, { op: 'send', to: 2, tag: 2, mode: 'ssend', line: 17 }],
					[{ op: 'recv', from: 2, tag: 3, line: 20 }],
				] as Instr[][]
			)[r],
		note: 'P2 espera primero el dato de P3, pero P3 solo lo envía después de recibir el resultado de P2: ciclo de dependencias P2 ⇄ P3 ⇒ deadlock (y P0, P1, P4 quedan colgados). El código viola el DAG: la arista P3→P2 crea un ciclo.',
	},
	{
		name: 'PD03 Ej.3 corregido (propuesta)',
		file: 'practica_3_ofi/ejercicio03.cpp — orden corregido',
		pFixed: 5,
		eagerDefault: true,
		sizeNote: 'Solo se reordena el proceso 2.',
		code: `else if (rank == 2) {
    MPI_Recv(&a, 1, MPI_INT,0, 0, MPI_COMM_WORLD,MPI_STATUS_IGNORE);
    MPI_Recv(&b, 1, MPI_INT,1, 1, MPI_COMM_WORLD,MPI_STATUS_IGNORE);
    resultado = a + b;
    MPI_Ssend(&resultado, 1, MPI_INT,3, 3, MPI_COMM_WORLD);
    MPI_Ssend(&resultado, 1, MPI_INT,4, 3, MPI_COMM_WORLD);
    MPI_Recv(&c, 1, MPI_INT, 3, 2, MPI_COMM_WORLD,MPI_STATUS_IGNORE); // al final
}
// P0, P1, P3, P4 sin cambios`,
		build: (r) =>
			(
				[
					[{ op: 'send', to: 2, tag: 0, mode: 'ssend', line: 9 }],
					[{ op: 'send', to: 2, tag: 1, mode: 'ssend', line: 9 }],
					[
						{ op: 'recv', from: 0, tag: 0, line: 2 },
						{ op: 'recv', from: 1, tag: 1, line: 3 },
						{ op: 'local', what: 'resultado = a + b', line: 4 },
						{ op: 'send', to: 3, tag: 3, mode: 'ssend', line: 5 },
						{ op: 'send', to: 4, tag: 3, mode: 'ssend', line: 6 },
						{ op: 'recv', from: 3, tag: 2, line: 7 },
					],
					[{ op: 'recv', from: 2, tag: 3, line: 9 }, { op: 'send', to: 2, tag: 2, mode: 'ssend', line: 9 }],
					[{ op: 'recv', from: 2, tag: 3, line: 9 }],
				] as Instr[][]
			)[r],
		note: 'Recibiendo el mensaje de P3 al final, el grafo de comunicación vuelve a ser acíclico y todos terminan. (Además se usa otra variable, c, para no pisar a.)',
	},
	{
		name: 'Reduce “a mano” con Send/Recv al maestro',
		file: 'ejemplo04.cpp',
		eagerDefault: true,
		sizeNote: '1 entero por mensaje.',
		code: `if (my_rank == 0)
{
  int res = 5;
  for (int i = 1; i < size; i++)
  {
    MPI_Recv(&rbuf, 1, MPI_INT, i, 0, MPI_COMM_WORLD, &stat);
    res += rbuf;
  }
}
else
{
  MPI_Send(&buf, 1, MPI_INT, 0, 0, MPI_COMM_WORLD);
}`,
		build: (r, p) =>
			r === 0
				? Array.from({ length: p - 1 }, (_, i) => [
						{ op: 'recv', from: i + 1, tag: 0, line: 6 } as Instr,
						{ op: 'local', what: 'res += rbuf', line: 7 } as Instr,
					]).flat()
				: [{ op: 'send', to: 0, tag: 0, mode: 'std', line: 12 }],
		note: 'El maestro recibe en orden de rank: p−1 recepciones secuenciales ⇒ O(p(α+β)). MPI_Reduce lo hace en árbol: O(log p).',
	},
];

// ---------------- UI ----------------
export default function MpiSimulator({ initial = 0 }: { initial?: number }) {
	const [si, setSi] = useState(initial);
	const sc = SCENARIOS[si];
	const [pSel, setPSel] = useState(4);
	const p = sc.pFixed ?? pSel;
	const [eager, setEager] = useState(sc.eagerDefault);
	const progs = useMemo(() => Array.from({ length: p }, (_, r) => sc.build(r, p)), [sc, p]);
	const [rawSt, setSt] = useState<SimState>(() => init(p));
	// si cambió p, el estado viejo no sirve (evita render con dimensiones distintas)
	const st = rawSt.pc.length === p ? rawSt : init(p);
	const fit = (s: SimState) => (s.pc.length === p ? s : init(p));
	const [playing, setPlaying] = useState(false);
	const timer = useRef<number | null>(null);

	useEffect(() => {
		setSt(init(p));
		setPlaying(false);
	}, [si, p, eager]);
	useEffect(() => setEager(sc.eagerDefault), [si]);

	useEffect(() => {
		if (!playing) return;
		timer.current = window.setInterval(() => {
			setSt((s) => {
				const n = tick(fit(s), progs, eager);
				if (n.deadlock || n.finished) setPlaying(false);
				return n;
			});
		}, 650);
		return () => {
			if (timer.current) window.clearInterval(timer.current);
		};
	}, [playing, progs, eager]);

	const lines = sc.code.split('\n');
	const ranksAt = new Map<number, number[]>();
	progs.forEach((prog, r) => {
		const ins = prog[st.pc[r]];
		if (ins) ranksAt.set(ins.line, [...(ranksAt.get(ins.line) ?? []), r]);
	});

	const blockedDesc = st.deadlock
		? progs
				.map((prog, r) => {
					const ins = prog[st.pc[r]];
					return ins ? `P${r}: ${describe(ins)}` : null;
				})
				.filter(Boolean)
		: [];

	const cellW = 26;
	const T = Math.max(st.t, 8);

	return (
		<div className="pg not-content">
			<h4>Simulador de mensajes MPI</h4>
			<p className="pg-sub">Simulación en JS (no ejecuta MPI real). Cada tic, cada proceso intenta avanzar una instrucción. Las insignias P0…P{p - 1} marcan la línea donde está cada proceso.</p>
			<div className="pg-row">
				<label className="pg-field" style={{ flex: '3 1 20rem' }}>
					<span>Escenario</span>
					<select value={si} onChange={(e) => setSi(+e.target.value)}>
						{SCENARIOS.map((s, i) => (
							<option key={i} value={i}>{s.name}</option>
						))}
					</select>
				</label>
				{!sc.pFixed && (
					<label className="pg-field">
						<span>Procesos p = <b>{p}</b></span>
						<input type="range" min={2} max={8} value={pSel} onChange={(e) => setPSel(+e.target.value)} />
					</label>
				)}
				<label style={{ margin: 0 }} title="Protocolo eager: el Send estándar copia al buffer del sistema y retorna. Rendezvous: espera al receptor.">
					<input type="checkbox" checked={eager} onChange={(e) => setEager(e.target.checked)} /> mensaje pequeño (MPI_Send con buffer / eager)
				</label>
			</div>
			<div className="pg-note" style={{ fontSize: '0.8rem' }}>
				<b>{sc.file}</b> · {sc.sizeNote}
			</div>
			<div className="pg-row">
				<button onClick={() => { setSt(init(p)); setPlaying(false); }}>Reiniciar</button>
				<button className="primary" onClick={() => setSt((s) => tick(fit(s), progs, eager))} disabled={st.deadlock || st.finished}>Siguiente tic →</button>
				<button onClick={() => setPlaying(!playing)} disabled={st.deadlock || st.finished}>{playing ? 'Pausa' : 'Reproducir'}</button>
				<span style={{ color: 'var(--pg-muted)' }}>t = {st.t}</span>
				{st.deadlock && <b style={{ color: 'var(--pg-bad)' }}>Deadlock: nadie puede avanzar</b>}
				{st.finished && <b style={{ color: 'var(--pg-ok)' }}>Terminado en {st.t} tics</b>}
			</div>

			<div style={{ display: 'grid', gap: '1rem', margin: 0 }}>
				<pre className="pg-code" aria-label="código">
					{lines.map((l, i) => {
						const rs = ranksAt.get(i + 1) ?? [];
						return (
							<div key={i} className={`ln${rs.length ? ' hl' : ''}`}>
								<span className="num">{i + 1}</span>
								<span>{l || ' '}</span>
								{rs.length > 0 && (
									<span className="badges">
										{rs.map((r) => (
											<span key={r} className="badge" style={{ background: RANK_COLORS[r] }}>P{r}</span>
										))}
									</span>
								)}
							</div>
						);
					})}
				</pre>
				<div style={{ margin: 0 }}>
					<b>Línea de tiempo</b>
					<div className="pg-scroll">
						<svg viewBox={`0 0 ${40 + T * cellW} ${p * 24 + 22}`} style={{ minWidth: Math.min(40 + T * cellW, 900) }}>
							{Array.from({ length: p }, (_, r) => (
								<g key={r}>
									<text x={4} y={r * 24 + 17} fontSize={11} fontWeight={700} style={{ fill: RANK_COLORS[r] }}>P{r}</text>
									{st.timeline[r].map((c, t) => (
										<g key={t}>
											<title>{`t=${t + 1} · P${r} · ${c.s === 'block' ? 'BLOQUEADO en ' : ''}${c.txt}`}</title>
											<rect
												x={36 + t * cellW}
												y={r * 24 + 4}
												width={cellW - 3}
												height={18}
												rx={3}
												fill={c.s === 'run' ? RANK_COLORS[r] : c.s === 'block' ? 'color-mix(in srgb, var(--pg-bad) 55%, transparent)' : 'var(--pg-border)'}
												opacity={c.s === 'run' ? 0.9 : 1}
											/>
											{c.s !== 'done' && (
												<text x={36 + t * cellW + (cellW - 3) / 2} y={r * 24 + 17} fontSize={9} textAnchor="middle" style={{ fill: '#111' }}>
													{c.s === 'block' ? '…' : c.txt.split(' ')[0].slice(0, 4)}
												</text>
											)}
										</g>
									))}
								</g>
							))}
							{Array.from({ length: T }, (_, t) => (
								<text key={t} x={36 + t * cellW + (cellW - 3) / 2} y={p * 24 + 16} fontSize={9} textAnchor="middle">{t + 1}</text>
							))}
						</svg>
					</div>
					<div className="legend">
						<span><i style={{ background: 'var(--pg-c1)' }} />avanza (color del proceso)</span>
						<span><i style={{ background: 'var(--pg-bad)' }} />bloqueado</span>
						<span><i style={{ background: 'var(--pg-border)' }} />terminado</span>
					</div>
					<div style={{ maxHeight: 150, overflowY: 'auto', fontSize: '0.78rem', marginTop: 8, fontFamily: 'var(--__sl-font-mono, monospace)' }}>
						{st.log.length === 0 ? <span style={{ color: 'var(--pg-muted)' }}>Registro de mensajes…</span> : st.log.map((l, i) => <div key={i} style={{ margin: 0 }}>{l}</div>)}
					</div>
				</div>
			</div>
			{st.deadlock && (
				<div className="pg-note bad">
					<b>Cada proceso espera a otro que también espera:</b>
					<ul style={{ margin: '0.25rem 0 0 1rem' }}>
						{blockedDesc.map((d) => <li key={d}>{d}</li>)}
					</ul>
				</div>
			)}
			<div className="pg-note">{sc.note}</div>
		</div>
	);
}
