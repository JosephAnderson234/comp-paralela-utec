import { useEffect, useState } from 'react';
import Rich from './ui/Rich';
import { load, save } from './ui/storage';

export type Pregunta = {
	q: string;
	opts: string[];
	ok: number; // índice de la opción correcta
	why?: string;
};

type Props = { id: string; titulo?: string; preguntas: Pregunta[] };

/** Quiz de autoevaluación; guarda las respuestas en localStorage bajo `quiz:<id>`. */
export default function Quiz({ id, titulo = 'Autoevaluación', preguntas }: Props) {
	const key = `quiz:${id}`;
	const [resp, setResp] = useState<(number | null)[]>(() => preguntas.map(() => null));

	useEffect(() => {
		const saved = load<(number | null)[]>(key, []);
		if (saved.length === preguntas.length) setResp(saved);
	}, [key, preguntas.length]);

	const answer = (qi: number, oi: number) => {
		if (resp[qi] !== null) return;
		const next = resp.slice();
		next[qi] = oi;
		setResp(next);
		save(key, next);
	};
	const reset = () => {
		const empty = preguntas.map(() => null);
		setResp(empty);
		save(key, empty);
	};

	const done = resp.filter((r) => r !== null).length;
	const score = resp.filter((r, i) => r === preguntas[i].ok).length;

	return (
		<div className="pg quiz">
			<div className="pg-row" style={{ justifyContent: 'space-between' }}>
				<h4>🧠 {titulo}</h4>
				<span style={{ color: 'var(--pg-muted)' }}>
					{score}/{preguntas.length} correctas · {done} respondidas{' '}
					<button onClick={reset} style={{ marginLeft: 8 }}>
						Reiniciar
					</button>
				</span>
			</div>
			{preguntas.map((p, qi) => {
				const r = resp[qi];
				return (
					<div className="q" key={qi}>
						<div>
							<b>{qi + 1}.</b> <Rich text={p.q} />
						</div>
						<div className="opts">
							{p.opts.map((o, oi) => {
								let cls = '';
								if (r !== null) {
									if (oi === p.ok) cls = 'correct';
									else if (oi === r) cls = 'wrong';
								}
								return (
									<button key={oi} className={cls} onClick={() => answer(qi, oi)} disabled={r !== null && cls === ''}>
										{String.fromCharCode(97 + oi)}) <Rich text={o} />
									</button>
								);
							})}
						</div>
						{r !== null && p.why && (
							<div className={`pg-note ${r === p.ok ? 'ok' : 'bad'}`}>
								{r === p.ok ? '✔ ' : '✘ '}
								<Rich text={p.why} />
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
