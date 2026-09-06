/**
 * GOATEST Medic View
 * 
 * Dedicated medical science & health education section.
 * Displays real accredited health articles and legitimate medical video channels.
 * Zero fake health data or artificial conclusions.
 * Direct launcher to original source websites and verified channels.
 */

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { PageHeader, SectionHeader } from '../ui/PageHeader';
import { healthNewsService } from '../../services/healthNewsService';
import {
  Brain,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Video,
  BookOpen,
  Globe,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import type { HealthNewsArticle } from '../../types';

interface MedicalResource {
  id: string;
  title: string;
  category: 'video' | 'channel' | 'portal';
  institution: string;
  description: string;
  url: string;
  tags: string[];
}

const ACCREDITED_MEDICAL_RESOURCES: MedicalResource[] = [
  {
    id: 'nih-videocast',
    title: 'NIH VideoCast & Seminars',
    category: 'video',
    institution: 'National Institutes of Health (NIH)',
    description: 'Official clinical lectures, grand rounds, and biomedical research broadcasts.',
    url: 'https://videocast.nih.gov/',
    tags: ['Biomedical', 'Clinical Seminars'],
  },
  {
    id: 'stanford-med',
    title: 'Stanford Medicine Clinical Updates',
    category: 'video',
    institution: 'Stanford Medicine',
    description: 'Physician insights, health education series, and medical discoveries.',
    url: 'https://www.youtube.com/@StanfordHealthCare',
    tags: ['Patient Health', 'Medical Education'],
  },
  {
    id: 'who-briefings',
    title: 'WHO Global Health Briefings',
    category: 'video',
    institution: 'World Health Organization',
    description: 'International clinical guidance, global updates, and preventive health.',
    url: 'https://www.youtube.com/@who',
    tags: ['Public Health', 'Epidemiology'],
  },
  {
    id: 'cdc-updates',
    title: 'CDC Health & Disease Guidance',
    category: 'video',
    institution: 'Centers for Disease Control',
    description: 'Authoritative disease control guidance and preventive health videos.',
    url: 'https://www.youtube.com/@CDCstreaming',
    tags: ['Prevention', 'Clinical Guidelines'],
  },
  {
    id: 'pubmed-portal',
    title: 'PubMed Biomedical Database',
    category: 'portal',
    institution: 'National Library of Medicine',
    description: 'Search millions of peer-reviewed biomedical and life science citations.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/',
    tags: ['Peer-Reviewed', 'Medical Index'],
  },
];

export const MedicView: React.FC = () => {
  const [articles, setArticles] = useState<HealthNewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'articles' | 'videos'>('all');

  const loadArticles = async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await healthNewsService.fetchHealthNews(forceRefresh);
      setArticles(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to fetch medical articles.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadArticles();
  }, []);

  const filteredArticles = activeFilter === 'videos' ? [] : articles;
  const filteredResources =
    activeFilter === 'articles'
      ? []
      : ACCREDITED_MEDICAL_RESOURCES;

  return (
    <div className="flex flex-col gap-5 pb-8 text-left">
      {/* Header */}
      <PageHeader
        title="Medic"
        subtitle="Accredited medical science & health education"
        badge={
          <div className="w-8 h-8 rounded-xl bg-zinc-800 text-[var(--color-accent)] border border-zinc-700 flex items-center justify-center">
            <Brain className="w-4 h-4" />
          </div>
        }
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadArticles(true)}
            disabled={isLoading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            className="!bg-white hover:!bg-white/90"
          >
            Refresh
          </Button>
        }
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeFilter === 'all'
              ? 'bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-fg)] shadow-xs'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          All Resources
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('articles')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeFilter === 'articles'
              ? 'bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-fg)] shadow-xs'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          <BookOpen className="w-3 h-3" />
          <span>Articles</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('videos')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeFilter === 'videos'
              ? 'bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-fg)] shadow-xs'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          <Video className="w-3 h-3" />
          <span>Medical Video Guides</span>
        </button>
      </div>

      {/* 1. Verified Medical Video Channels / Portals */}
      {filteredResources.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionHeader
            title="Institutional Video Guides & Seminars"
            action={
              <span className="text-[10px] text-zinc-400 font-medium">
                Verified Sources
              </span>
            }
          />

          <div className="flex flex-col gap-2.5">
            {filteredResources.map((res) => (
              <a
                key={res.id}
                href={res.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <Card
                  padding="md"
                  className="transition-all hover:border-[var(--color-accent)] hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-zinc-200 text-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                        {res.category === 'portal' ? (
                          <Globe className="w-5 h-5" />
                        ) : (
                          <Video className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] uppercase font-bold text-zinc-600 tracking-wider">
                            {res.institution}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-200 text-zinc-700 font-semibold">
                            {res.category === 'portal' ? 'Database' : 'Official Channel'}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-zinc-900 group-hover:text-[var(--color-accent)] transition-colors mt-0.5">
                          {res.title}
                        </h4>
                        <p className="text-xs text-zinc-600 mt-1 leading-relaxed line-clamp-2">
                          {res.description}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                          {res.tags.map((t) => (
                            <span
                              key={t}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-700 font-medium"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-1.5 rounded-lg bg-zinc-200 text-zinc-600 group-hover:text-zinc-900 group-hover:bg-zinc-300 transition-colors shrink-0">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                  </div>
                </Card>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 2. Medical Science Articles */}
      {activeFilter !== 'videos' && (
        <div className="flex flex-col gap-3 mt-1">
          <SectionHeader
            title="Clinical Research & Science Updates"
            action={
              <span className="text-[10px] text-zinc-400 font-medium">
                Live Accredited Feeds
              </span>
            }
          />

          {/* Loading Skeletons */}
          {isLoading && (
            <div className="flex flex-col gap-2.5">
              {[1, 2, 3].map((i) => (
                <Card key={i} padding="sm" className="flex items-start gap-3 animate-pulse">
                  <div className="w-16 h-16 rounded-xl bg-zinc-300 shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2 py-1">
                    <div className="h-3 bg-zinc-300 rounded w-3/4" />
                    <div className="h-2.5 bg-zinc-200 rounded w-full" />
                    <div className="h-2 bg-zinc-200 rounded w-1/3" />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Error / Empty State */}
          {!isLoading && error && filteredArticles.length === 0 && (
            <Card padding="md" className="flex flex-col items-center justify-center py-6 text-center">
              <AlertCircle className="w-6 h-6 text-zinc-500 mb-2" />
              <h4 className="text-xs font-bold text-zinc-900">
                Medical articles unavailable
              </h4>
              <p className="text-xs text-zinc-600 mt-1 max-w-[240px]">
                Unable to fetch external health science feed. Please check your connection.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadArticles(true)}
                leftIcon={<RefreshCw className="w-3 h-3" />}
                className="mt-3 text-xs"
              >
                Retry
              </Button>
            </Card>
          )}

          {/* Articles list */}
          {!isLoading && filteredArticles.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {filteredArticles.map((article) => (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <Card
                    padding="sm"
                    className="flex items-start gap-3 transition-all hover:border-[var(--color-accent)] hover:shadow-xs"
                  >
                    {/* Thumbnail if available */}
                    {article.imageUrl ? (
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-200 shrink-0 border border-zinc-300">
                        <img
                          src={article.imageUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-zinc-200 text-zinc-600 flex items-center justify-center shrink-0 border border-zinc-300">
                        <BookOpen className="w-5 h-5" />
                      </div>
                    )}

                    {/* Article Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-600 mb-0.5">
                        <span className="font-semibold uppercase truncate max-w-[140px]">
                          {article.source}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(article.publishedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-zinc-900 group-hover:text-[var(--color-accent)] transition-colors line-clamp-2 leading-snug">
                        {article.title}
                      </h4>

                      <p className="text-[11px] text-zinc-600 mt-1 line-clamp-2 leading-relaxed">
                        {article.summary}
                      </p>
                    </div>

                    <div className="p-1 text-zinc-500 group-hover:text-zinc-900 transition-colors shrink-0 self-center">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                  </Card>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
