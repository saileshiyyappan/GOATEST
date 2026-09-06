/**
 * GOATEST Real Health News Section Component
 * 
 * External health news feed.
 * Real thumbnails & headlines from accredited health science sources.
 * ZERO fake or fabricated articles.
 * Full universal theme contrast adaptation.
 */

import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { SectionHeader } from '../ui/PageHeader';
import { Newspaper, ExternalLink, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import type { HealthNewsArticle } from '../../types';

export interface HomeHealthNewsProps {
  articles: HealthNewsArticle[];
  isLoading: boolean;
  error?: string | null;
  onRetry: () => void;
}

export const HomeHealthNews: React.FC<HomeHealthNewsProps> = ({
  articles,
  isLoading,
  error,
  onRetry,
}) => {
  return (
    <div className="flex flex-col gap-2.5 text-left">
      <SectionHeader
        title="Health & Science News"
        subtitle="External accredited clinical feeds"
        action={
          <button
            type="button"
            onClick={onRetry}
            disabled={isLoading}
            className="text-[11px] font-bold text-[var(--color-accent)] hover:underline flex items-center gap-1 disabled:opacity-50 cursor-pointer"
            title="Refresh news"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        }
      />

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="flex flex-col gap-2.5">
          {[1, 2, 3].map((i) => (
            <Card key={i} padding="sm" className="flex items-start gap-3 animate-pulse shadow-xs bg-[#90a4ae] border border-[#263238]">
              <div className="w-16 h-16 rounded-xl bg-[#78909c] shrink-0 border border-[#263238]" />
              <div className="flex-1 min-w-0 space-y-2 py-1">
                <div className="h-3 bg-[#78909c] rounded w-3/4" />
                <div className="h-2.5 bg-[#78909c] rounded w-full" />
                <div className="h-2 bg-[#78909c] rounded w-1/3" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && articles.length === 0 && (
        <Card padding="md" className="flex flex-col items-center justify-center py-5 text-center shadow-xs bg-[#90a4ae] text-[#263238] border border-[#263238]">
          <AlertCircle className="w-6 h-6 text-[#263238] mb-1.5" />
          <h4 className="text-xs font-bold text-[#263238]">
            Health news unavailable
          </h4>
          <p className="text-xs text-[#37474f] font-medium mt-0.5 max-w-[240px]">
            Unable to fetch external health news feed. Check your connection.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={onRetry}
            leftIcon={<RefreshCw className="w-3 h-3" />}
            className="mt-3 text-xs bg-[#263238] text-white hover:bg-[#1f292e] border border-[#263238]"
          >
            Retry News Feed
          </Button>
        </Card>
      )}

      {/* Articles List */}
      {!isLoading && articles.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {articles.map((article) => (
            <a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <Card
                padding="sm"
                className="flex items-start gap-3 transition-all shadow-xs bg-[#90a4ae] text-[#263238] border border-[#263238]"
              >
                {article.imageUrl ? (
                  <img
                    src={article.imageUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-xl object-cover bg-[#78909c] shrink-0 border border-[#263238]"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-[#78909c] text-[#263238] border border-[#263238] flex items-center justify-center shrink-0">
                    <Newspaper className="w-6 h-6" />
                  </div>
                )}

                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)] truncate">
                      {article.source}
                    </span>
                    <ExternalLink className="w-3 h-3 text-[#263238] group-hover:text-[var(--color-accent)] shrink-0 transition-colors" />
                  </div>

                  <h4 className="text-xs font-bold text-[#263238] group-hover:text-black transition-colors line-clamp-2 leading-snug">
                    {article.title}
                  </h4>

                  <p className="text-[11px] text-[#37474f] font-medium mt-1 line-clamp-1">
                    {article.summary}
                  </p>

                  <div className="flex items-center gap-1 mt-1 text-[10px] text-[#37474f] font-semibold">
                    <Clock className="w-3 h-3 text-[#263238]" />
                    <span>
                      {new Date(article.publishedAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
