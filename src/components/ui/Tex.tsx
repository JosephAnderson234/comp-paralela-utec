import katex from 'katex';

export default function Tex({ children, block = false }: { children: string; block?: boolean }) {
	const html = katex.renderToString(children, { displayMode: block, throwOnError: false });
	return block ? (
		<div className="katex-display-wrap" style={{ overflowX: 'auto' }} dangerouslySetInnerHTML={{ __html: html }} />
	) : (
		<span dangerouslySetInnerHTML={{ __html: html }} />
	);
}
