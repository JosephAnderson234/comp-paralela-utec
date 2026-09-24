import Tex from './Tex';

/** Texto plano con $...$ (KaTeX), **negritas** y `código`. */
export default function Rich({ text }: { text: string }) {
	const parts = text.split(/(\$[^$]+\$|`[^`]+`|\*\*[^*]+\*\*)/g);
	return (
		<>
			{parts.map((p, i) => {
				if (p.length > 2 && p.startsWith('$') && p.endsWith('$')) return <Tex key={i}>{p.slice(1, -1)}</Tex>;
				if (p.length > 2 && p.startsWith('`') && p.endsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>;
				if (p.length > 4 && p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
				return <span key={i}>{p}</span>;
			})}
		</>
	);
}
