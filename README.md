# Web de estudio — Parcial CS4052 (UTEC)

Astro 7 + Starlight 0.42, MDX, islas React, KaTeX (remark-math + rehype-katex), Expressive Code, búsqueda Pagefind.

```bash
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # genera dist/ (estático)
pnpm preview    # sirve dist/
```

## Estructura

- `src/content/docs/` — páginas por unidad (fundamentos, performance, pram, diseno, mpi, examen) + `index.mdx` y `formulario.mdx`.
- `src/components/playgrounds/` — 12 islas React: Amdahl/Gustafson, DAG, prefix sum, Brent/escalabilidad, simulador MPI, colectivas, tipos derivados, matriz-vector, Montecarlo π, Mandelbrot, teorema maestro, FLOPs N-Body.
- `src/components/Quiz.tsx`, `Flashcards.tsx` — progreso en `localStorage` (`quiz:<id>`, `flashcards:v1`).
- `src/data/practica3.ts` — datos medidos de `practica_3_ofi` (generados desde los CSV).
- Sidebar: `astro.config.mjs`.
