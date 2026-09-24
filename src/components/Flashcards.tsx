import { useEffect, useMemo, useState } from 'react';
import Rich from './ui/Rich';
import { load, save } from './ui/storage';

export type Card = { t: string; f: string; b: string }; // tema, frente, reverso
type Status = Record<string, 'ok' | 'rep'>;

const KEY = 'flashcards:v1';

export default function Flashcards({ cards }: { cards: Card[] }) {
	const temas = useMemo(() => ['Todos', ...new Set(cards.map((c) => c.t))], [cards]);
	const [tema, setTema] = useState('Todos');
	const [soloPend, setSoloPend] = useState(false);
	const [status, setStatus] = useState<Status>({});
	const [i, setI] = useState(0);
	const [flip, setFlip] = useState(false);
	const [order, setOrder] = useState<number[]>(() => cards.map((_, k) => k));

	useEffect(() => setStatus(load<Status>(KEY, {})), []);

	const deck = order.filter((k) => (tema === 'Todos' || cards[k].t === tema) && (!soloPend || status[cards[k].f] !== 'ok'));
	const cur = deck.length ? cards[deck[i % deck.length]] : null;
	const known = cards.filter((c) => status[c.f] === 'ok').length;

	const mark = (s: 'ok' | 'rep') => {
		if (!cur) return;
		const next = { ...status, [cur.f]: s };
		setStatus(next);
		save(KEY, next);
		setFlip(false);
		setI((x) => (soloPend && s === 'ok' ? x : x + 1));
	};
	const shuffle = () => {
		const o = [...order];
		for (let k = o.length - 1; k > 0; k--) {
			const r = Math.floor(Math.random() * (k + 1));
			[o[k], o[r]] = [o[r], o[k]];
		}
		setOrder(o);
		setI(0);
		setFlip(false);
	};

	return (
		<div className="pg not-content">
			<div className="pg-row" style={{ justifyContent: 'space-between' }}>
				<h4>Flashcards</h4>
				<span style={{ color: 'var(--pg-muted)' }}>
					dominadas {known}/{cards.length}
				</span>
			</div>
			<div style={{ height: 4, background: 'var(--pg-tile)', borderRadius: 999, overflow: 'hidden' }}>
				<div style={{ width: `${(100 * known) / cards.length}%`, height: '100%', background: 'var(--sl-color-accent)', borderRadius: 999, transition: 'width .5s cubic-bezier(.22,1,.36,1)' }} />
			</div>
			<div className="pg-row">
				<select value={tema} onChange={(e) => { setTema(e.target.value); setI(0); setFlip(false); }}>
					{temas.map((t) => <option key={t}>{t}</option>)}
				</select>
				<label style={{ margin: 0 }}>
					<input type="checkbox" checked={soloPend} onChange={(e) => { setSoloPend(e.target.checked); setI(0); }} /> solo pendientes
				</label>
				<button onClick={shuffle}>Barajar</button>
				<button onClick={() => { setStatus({}); save(KEY, {}); }}>Reiniciar progreso</button>
			</div>
			{cur ? (
				<>
					<button className="flash-card" onClick={() => setFlip(!flip)} aria-label="voltear tarjeta">
						<span className="side">{cur.t} · {flip ? 'respuesta' : 'pregunta'} · {(i % deck.length) + 1}/{deck.length}</span>
						<span className="face" key={`${cur.f}-${flip}`}>
							<Rich text={flip ? cur.b : cur.f} />
						</span>
						{!flip && <span className="side" style={{ marginTop: '0.75rem' }}>clic para voltear</span>}
					</button>
					<div className="pg-row" style={{ justifyContent: 'center' }}>
						<button onClick={() => { setI((x) => (x - 1 + deck.length) % deck.length); setFlip(false); }}>← Anterior</button>
						<button onClick={() => mark('rep')} style={{ borderColor: 'var(--pg-warn)' }}>Repasar</button>
						<button onClick={() => mark('ok')} style={{ borderColor: 'var(--pg-ok)' }}>La sé</button>
						<button onClick={() => { setI((x) => x + 1); setFlip(false); }}>Siguiente →</button>
					</div>
				</>
			) : (
				<div className="pg-note ok">No quedan tarjetas pendientes en este tema.</div>
			)}
		</div>
	);
}
