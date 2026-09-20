'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Repository {
  id: string;
  namespace: string;
  name: string;
  summary: string;
  category: 'Full-Stack' | 'Systems & CLIs' | 'Client Builds';
  techTags: string[];
  commitsCount: string;
  stars: string;
  updatedAt: string;
  monogram: string;
  faviconUrl?: string;
  codeUrl: string;
  launchUrl: string;
}

const REPOSITORIES: Repository[] = [
  {
    id: 'ecommerce-mono',
    namespace: 'miidaystudio /',
    name: 'ecommerce-mono',
    summary: 'Multi-tenant headless ecommerce monorepo featuring Next.js 15, NestJS backend, and PostgreSQL billing pipelines.',
    category: 'Full-Stack',
    techTags: ['Next.js 15', 'NestJS', 'PostgreSQL', 'TailwindCSS', 'Turborepo'],
    commitsCount: '1,284',
    stars: '342',
    updatedAt: '2h ago',
    monogram: 'EM',
    faviconUrl: 'https://nextjs.org/favicon.ico',
    codeUrl: 'https://github.com/miidaystudio/ecommerce',
    launchUrl: 'https://ecommerce.miiday.dev',
  },
  {
    id: 'antigravity-cli',
    namespace: 'miidaystudio /',
    name: 'antigravity-cli',
    summary: 'High-throughput agentic automation harness and workflow launcher built for local system pairing and sidecar execution.',
    category: 'Systems & CLIs',
    techTags: ['Go', 'Rust', 'gRPC', 'Cobra', 'WebSockets'],
    commitsCount: '856',
    stars: '1,120',
    updatedAt: '5h ago',
    monogram: 'AC',
    codeUrl: 'https://github.com/miidaystudio/antigravity-cli',
    launchUrl: 'https://cli.antigravity.dev',
  },
  {
    id: 'purem-storefront',
    namespace: 'miidaystudio /',
    name: 'purem-storefront',
    summary: 'Editorial fashion showcase storefront featuring tactile bento grid layout and glassmorphism interactive controls.',
    category: 'Client Builds',
    techTags: ['React 19', 'Next.js', 'Framer Motion', 'TailwindCSS'],
    commitsCount: '412',
    stars: '189',
    updatedAt: '1d ago',
    monogram: 'PS',
    faviconUrl: 'https://react.dev/favicon.ico',
    codeUrl: 'https://github.com/miidaystudio/purem-storefront',
    launchUrl: 'https://purem.miiday.dev',
  },
  {
    id: 'stitch-mcp-server',
    namespace: 'miidaystudio /',
    name: 'stitch-mcp-server',
    summary: 'Model Context Protocol server for automated UI generation, variant synthesis, and design system token binding.',
    category: 'Systems & CLIs',
    techTags: ['TypeScript', 'MCP Protocol', 'Node.js', 'Zod'],
    commitsCount: '630',
    stars: '524',
    updatedAt: '3d ago',
    monogram: 'SM',
    codeUrl: 'https://github.com/miidaystudio/stitch-mcp-server',
    launchUrl: 'https://mcp.miiday.dev',
  },
  {
    id: 'miiday-admin-portal',
    namespace: 'miidaystudio /',
    name: 'miiday-admin-portal',
    summary: 'Real-time analytics dashboard, inventory management, and multi-currency payout ledger for store managers.',
    category: 'Full-Stack',
    techTags: ['Next.js', 'Recharts', 'Prisma', 'TRPC', 'TailwindCSS'],
    commitsCount: '945',
    stars: '276',
    updatedAt: '4d ago',
    monogram: 'MA',
    codeUrl: 'https://github.com/miidaystudio/miiday-admin-portal',
    launchUrl: 'https://admin.miiday.dev',
  },
  {
    id: 'tactile-ui-design-system',
    namespace: 'miidaystudio /',
    name: 'tactile-ui-design-system',
    summary: 'Parchment-neutral design token system, editorial micro-interactions, and accessible UI component library.',
    category: 'Client Builds',
    techTags: ['Radix UI', 'CSS Modules', 'Storybook', 'TailwindCSS'],
    commitsCount: '318',
    stars: '445',
    updatedAt: '1w ago',
    monogram: 'TU',
    codeUrl: 'https://github.com/miidaystudio/tactile-ui-design-system',
    launchUrl: 'https://ui.miiday.dev',
  },
];

const CATEGORIES = ['All Fleet', 'Full-Stack', 'Systems & CLIs', 'Client Builds'] as const;

export default function RepositoriesPage() {
  const [activeCategory, setActiveCategory] = useState<string>('All Fleet');
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const filteredRepos = REPOSITORIES.filter((repo) => {
    if (activeCategory === 'All Fleet') return true;
    return repo.category === activeCategory;
  });

  const handleImageError = (repoId: string) => {
    setImageErrors((prev) => ({ ...prev, [repoId]: true }));
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-neutral-900 font-sans pb-24">
      {/* Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14">
        
        {/* SECTION HEADER */}
        <div className="max-w-3xl">
          <span className="font-mono text-xs uppercase tracking-widest text-neutral-500 mb-2 block">
            miidaystudio / repository fleet ~
          </span>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-neutral-950 uppercase leading-none">
            ENGINEERING REGISTRY<span className="text-neutral-400">.</span>
          </h1>
          <p className="text-neutral-600 text-sm leading-relaxed max-w-lg mt-3">
            Production systems, open tooling, and experimental web architecture shipped in the open.
          </p>
        </div>

        {/* FILTER & TOP NAVIGATION DOCK */}
        <div className="flex items-center gap-2 mt-8 mb-10 overflow-x-auto pb-2 scrollbar-none">
          {CATEGORIES.map((category) => {
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={
                  isActive
                    ? 'bg-neutral-950 text-white text-xs font-mono px-4 py-1.5 rounded-full shadow-xs shrink-0 transition-all'
                    : 'bg-neutral-200/60 hover:bg-neutral-200 text-neutral-700 text-xs font-mono px-3.5 py-1.5 rounded-full shrink-0 transition-colors'
                }
              >
                {category}
              </button>
            );
          })}
        </div>

        {/* COMPACT 3-COLUMN EDITORIAL CARD GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRepos.map((repo) => {
            const hasValidImage = repo.faviconUrl && !imageErrors[repo.id];

            return (
              <div
                key={repo.id}
                className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  {/* VISUAL ANCHOR (Enlarged Favicon / Hero Badge) */}
                  <div className="w-full h-44 rounded-2xl bg-[#F4F1EA] border border-neutral-200/60 flex items-center justify-center relative overflow-hidden group-hover:bg-[#EFECE4] transition-colors">
                    
                    {/* Top Floating Category Badge */}
                    <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs text-neutral-700 text-[10px] font-mono px-2.5 py-1 rounded-md border border-neutral-200/80 shadow-2xs z-10">
                      {repo.category}
                    </span>

                    {/* Top Live Telemetry Pill */}
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-xs text-[10px] font-mono text-neutral-600 px-2 py-1 rounded-md border border-neutral-200/80 flex items-center gap-1.5 shadow-2xs z-10">
                      <span>⎇ {repo.commitsCount}</span>
                      <span className="text-neutral-300">|</span>
                      <span>★ {repo.stars}</span>
                    </div>

                    {/* Centered Image / Monogram Fallback */}
                    {hasValidImage ? (
                      <img
                        src={repo.faviconUrl}
                        alt={repo.name}
                        onError={() => handleImageError(repo.id)}
                        className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-xl drop-shadow-md group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-neutral-950 text-emerald-400 font-mono font-black text-xl sm:text-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300 border border-emerald-500/20">
                        {repo.monogram}
                      </div>
                    )}
                  </div>

                  {/* METADATA & TYPOGRAPHY */}
                  <div className="mt-4">
                    <span className="text-[11px] font-mono text-neutral-400 block">
                      {repo.namespace}
                    </span>
                    <h2 className="text-xl font-bold tracking-tight text-neutral-900 group-hover:text-neutral-950 mt-0.5">
                      {repo.name}
                    </h2>
                    
                    {/* 2-line clamped summary */}
                    <p className="text-neutral-500 text-xs sm:text-sm leading-relaxed line-clamp-2 mt-2 min-h-[2.5rem]">
                      {repo.summary}
                    </p>

                    {/* Tech Pills */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {repo.techTags.map((tag) => (
                        <span
                          key={tag}
                          className="bg-[#F4F1EA] text-neutral-700 text-[10px] font-mono px-2 py-0.5 rounded-md border border-neutral-200/60"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* CARD FOOTER */}
                <div className="mt-4 pt-3.5 border-t border-neutral-100 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-neutral-400">
                    Updated {repo.updatedAt}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <a
                      href={repo.codeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs font-semibold text-neutral-700 hover:text-neutral-950 underline-offset-4 hover:underline px-1 py-0.5"
                    >
                      Code ↗
                    </a>
                    <a
                      href={repo.launchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-neutral-950 hover:bg-neutral-800 text-white font-mono text-xs px-3 py-1.5 rounded-xl transition-all shadow-2xs"
                    >
                      Launch ↗
                    </a>
                  </div>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
