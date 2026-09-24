// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
	markdown: {
		processor: unified({
			remarkPlugins: [remarkMath],
			rehypePlugins: [[rehypeKatex, { strict: false }]],
		}),
	},
	integrations: [
		starlight({
			title: 'CS4052 · Parcial',
			description: 'Web de estudio interactiva: Computación Paralela y Distribuida (UTEC).',
			locales: { root: { label: 'Español', lang: 'es' } },
			customCss: ['katex/dist/katex.min.css', './src/styles/custom.css'],
			pagination: true,
			sidebar: [
				{
					label: 'Inicio',
					items: [
						{ label: 'Cómo usar esta web', slug: 'index' },
						{ label: 'Formulario (cheat sheet)', slug: 'formulario' },
					],
				},
				{
					label: '1 · Fundamentos',
					items: [
						{ label: 'Taxonomía de Flynn', slug: 'fundamentos/flynn' },
						{ label: 'Método de Foster (PCAM)', slug: 'fundamentos/foster' },
						{ label: 'Modelo DAG', slug: 'fundamentos/dag', badge: { text: 'lab', variant: 'tip' } },
					],
				},
				{
					label: '2 · Performance',
					items: [
						{ label: 'Speedup, eficiencia, costo', slug: 'performance/metricas' },
						{ label: 'Amdahl y Gustafson', slug: 'performance/amdahl-gustafson', badge: { text: 'lab', variant: 'tip' } },
						{ label: 'Escalabilidad e isoeficiencia', slug: 'performance/escalabilidad', badge: { text: 'lab', variant: 'tip' } },
						{ label: 'FLOPs y N-Body', slug: 'performance/flops', badge: { text: 'lab', variant: 'tip' } },
					],
				},
				{
					label: '3 · PRAM',
					items: [
						{ label: 'Modelo PRAM y Brent', slug: 'pram/modelo' },
						{ label: 'Casos: OR, máx., suma, prefix', slug: 'pram/casos', badge: { text: 'lab', variant: 'tip' } },
						{ label: 'Extensiones: APRAM… BSP, LogP', slug: 'pram/extensiones' },
					],
				},
				{
					label: '4 · Diseño de algoritmos',
					items: [
						{ label: 'Particionamiento y Mandelbrot', slug: 'diseno/particionamiento', badge: { text: 'lab', variant: 'tip' } },
						{ label: 'Random y Montecarlo', slug: 'diseno/random', badge: { text: 'lab', variant: 'tip' } },
						{ label: 'N-Body, D&V, mergesort', slug: 'diseno/nbody-dyv', badge: { text: 'lab', variant: 'tip' } },
					],
				},
				{
					label: '5 · MPI (U3)',
					items: [
						{ label: 'MPI básico', slug: 'mpi/basicos' },
						{ label: 'Colectivas', slug: 'mpi/colectivas', badge: { text: 'lab', variant: 'tip' } },
						{ label: 'Bloqueante vs no bloqueante', slug: 'mpi/bloqueante', badge: { text: 'lab', variant: 'tip' } },
						{ label: 'Tipos derivados', slug: 'mpi/tipos-derivados', badge: { text: 'lab', variant: 'tip' } },
						{ label: 'Práctica: matriz × vector', slug: 'mpi/practica-matvec', badge: { text: 'lab', variant: 'tip' } },
					],
				},
				{
					label: '6 · Examen',
					items: [
						{ label: 'Solvers por arquetipo (A–F)', slug: 'examen/arquetipos' },
						{ label: 'PD02 previos resueltos', slug: 'examen/previos-pd02' },
						{ label: 'PD01 y P1', slug: 'examen/pd01-p1' },
						{ label: 'Repaso U3.5 y PD03', slug: 'examen/repaso-u3' },
						{ label: 'Flashcards y simulacro', slug: 'examen/flashcards' },
					],
				},
			],
		}),
		react(),
	],
});
