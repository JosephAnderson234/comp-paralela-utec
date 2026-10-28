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
			title: 'CS4052 · Paralela',
			description: 'Web de estudio interactiva (parcial y final): Computación Paralela y Distribuida (UTEC).',
			locales: { root: { label: 'Español', lang: 'es' } },
			customCss: ['@fontsource-variable/inter', '@fontsource-variable/jetbrains-mono', 'katex/dist/katex.min.css', './src/styles/custom.css'],
			pagination: true,
			tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 2 },
			sidebar: [
				{
					label: 'Inicio',
					items: [
						{ label: 'Cómo usar esta web', slug: 'index' },
						{ label: 'Formulario (cheat sheet)', slug: 'formulario' },
					],
				},
				{
					label: 'Final · U4 en adelante',
					badge: { text: 'nuevo', variant: 'success' },
					items: [
						{ label: 'Ruta del final', slug: 'final' },
						{
							label: '7 · OpenMP (memoria compartida)',
							items: [
								{ label: 'Memoria compartida y fork-join', slug: 'final/openmp/introduccion' },
								{ label: 'Repartir bucles: for y schedule', slug: 'final/openmp/for-schedule' },
								{ label: 'sections, single, master, barreras', slug: 'final/openmp/sections-single-master' },
								{ label: 'Sincronización', slug: 'final/openmp/sincronizacion' },
								{ label: 'Alcance de datos y reduction', slug: 'final/openmp/datos' },
								{ label: 'Tareas e ICVs', slug: 'final/openmp/tareas-icv' },
								{ label: 'Laboratorio de tareas (código de clase)', slug: 'final/openmp/tareas-laboratorio' },
								{ label: 'Repaso OpenMP', slug: 'final/openmp/repaso' },
							],
						},
						{
							label: '8 · OpenMP: memoria y locks',
							badge: { text: 'sem 10', variant: 'note' },
							items: [
								{ label: '¿Puede fallar el assert? Modelo de memoria', slug: 'final/openmp-avanzado/modelo-memoria' },
								{ label: 'critical, locks y filósofos', slug: 'final/openmp-avanzado/locks' },
								{ label: 'Simulacro PC4', slug: 'final/openmp-avanzado/simulacro-pc4' },
								{ label: 'PD04 Ej. 3: inventario', slug: 'final/openmp-avanzado/pd04-inventario' },
							],
						},
						{
							label: '9 · Paralelismo híbrido',
							badge: { text: 'sem 10', variant: 'note' },
							items: [
								{ label: 'MPI + OpenMP', slug: 'final/hibrido/mpi-openmp' },
								{ label: 'Descomposición de dominio y halos', slug: 'final/hibrido/dominio-halos' },
							],
						},
						{
							label: '10 · EDP (U5.1)',
							badge: { text: 'sem 11', variant: 'note' },
							items: [
								{ label: 'EDP y diferencias finitas', slug: 'final/edp/fundamentos' },
								{ label: 'Laplace/Jacobi en paralelo', slug: 'final/edp/jacobi-paralelo' },
								{ label: 'Onda y tsunami (MPI)', slug: 'final/edp/onda-tsunami' },
							],
						},
						{
							label: '11 · Ordenamiento (U5.2)',
							badge: { text: 'sem 11–12', variant: 'note' },
							items: [
								{ label: 'Bases y ranking', slug: 'final/ordenamiento/bases' },
								{ label: 'Quicksort paralelo y Hyksort', slug: 'final/ordenamiento/quicksort' },
								{ label: 'Mergesort odd-even y bitónico', slug: 'final/ordenamiento/merge-bitonico' },
								{ label: 'Escalabilidad de ordenamientos', slug: 'final/ordenamiento/escalabilidad' },
							],
						},
						{
							label: '12 · Examen final',
							badge: { text: 'PD05', variant: 'caution' },
							items: [
								{ label: 'Simulacro PD05 (2026-I resuelta)', slug: 'final/examen/simulacro-pd5' },
							],
						},
					],
				},
				{
					label: 'Parcial · U1–U3',
					collapsed: true,
					items: [
						{
							label: '1 · Fundamentos',
							items: [
								{ label: 'Taxonomía de Flynn', slug: 'fundamentos/flynn' },
								{ label: 'Método de Foster (PCAM)', slug: 'fundamentos/foster' },
								{ label: 'Modelo DAG', slug: 'fundamentos/dag' },
							],
						},
						{
							label: '2 · Performance',
							items: [
								{ label: 'Speedup, eficiencia, costo', slug: 'performance/metricas' },
								{ label: 'Amdahl y Gustafson', slug: 'performance/amdahl-gustafson' },
								{ label: 'Escalabilidad e isoeficiencia', slug: 'performance/escalabilidad' },
								{ label: 'FLOPs y N-Body', slug: 'performance/flops' },
							],
						},
						{
							label: '3 · PRAM',
							items: [
								{ label: 'Modelo PRAM y Brent', slug: 'pram/modelo' },
								{ label: 'Casos: OR, máx., suma, prefix', slug: 'pram/casos' },
								{ label: 'Extensiones: APRAM… BSP, LogP', slug: 'pram/extensiones' },
							],
						},
						{
							label: '4 · Diseño de algoritmos',
							items: [
								{ label: 'Particionamiento y Mandelbrot', slug: 'diseno/particionamiento' },
								{ label: 'Random y Montecarlo', slug: 'diseno/random' },
								{ label: 'N-Body, D&V, mergesort', slug: 'diseno/nbody-dyv' },
							],
						},
						{
							label: '5 · MPI (U3)',
							items: [
								{ label: 'MPI básico', slug: 'mpi/basicos' },
								{ label: 'Colectivas', slug: 'mpi/colectivas' },
								{ label: 'Bloqueante vs no bloqueante', slug: 'mpi/bloqueante' },
								{ label: 'Tipos derivados', slug: 'mpi/tipos-derivados' },
								{ label: 'Práctica: matriz × vector', slug: 'mpi/practica-matvec' },
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
				},
			],
		}),
		react(),
	],
});
