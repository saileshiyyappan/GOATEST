/**
 * GOATEST Real Health News Service
 * 
 * External accredited health news pipeline.
 * Fetches real, public, accredited health science & clinical feeds.
 * Uses server-side /api/news with multi-source fallback.
 * Daily cache boundary, deduplication, sorting by freshness.
 * ZERO hard-coded fake headlines or dummy content.
 */

import type { HealthNewsArticle } from '../types';

const NEWS_CACHE_PREFIX = 'goatest_health_news_cache_';

function getTodayCacheKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${NEWS_CACHE_PREFIX}${year}-${month}-${day}`;
}

interface CachedNewsData {
  date: string;
  timestamp: number;
  articles: HealthNewsArticle[];
}

export const healthNewsService = {
  /**
   * Fetch real health news articles with a daily date-based cache.
   * - First visit of the day: fetch current content.
   * - Subsequent visits same day: use today's cached content.
   * - Next day: fetches fresh content.
   * - forceRefresh = true: explicitly re-fetches.
   */
  async fetchHealthNews(forceRefresh = false): Promise<HealthNewsArticle[]> {
    const todayKey = getTodayCacheKey();

    // 1. Check local date-based cache
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(todayKey);
        if (cached) {
          const parsed: CachedNewsData = JSON.parse(cached);
          if (parsed.articles && parsed.articles.length > 0) {
            return parsed.articles;
          }
        }
      } catch {
        // Cache miss or parse error, proceed to fetch
      }
    }

    // 2. Try fetching from server-side endpoint first
    try {
      const response = await fetch(`/api/news?force=${forceRefresh ? 'true' : 'false'}`, {
        signal: AbortSignal.timeout(6000),
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.articles) && data.articles.length > 0) {
          const articles: HealthNewsArticle[] = data.articles;

          // Save in today's local cache
          try {
            const cachePayload: CachedNewsData = {
              date: todayKey,
              timestamp: Date.now(),
              articles,
            };
            localStorage.setItem(todayKey, JSON.stringify(cachePayload));
          } catch {
            // Ignore cache storage error
          }

          return articles;
        }
      }
    } catch {
      // Server endpoint not reachable (e.g. during client-only fallback), continue to client fetch
    }

    // 3. Client-side fallback to direct accredited feeds
    const feedUrls = [
      {
        source: 'National Institutes of Health (NIH)',
        url: 'https://www.nih.gov/news-events/feed.xml',
      },
      {
        source: 'Medical News Today',
        url: 'https://www.medicalnewstoday.com/feed',
      },
      {
        source: 'NY Times Health Science',
        url: 'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml',
      },
    ];

    let lastError: Error | null = null;
    const aggregatedArticles: HealthNewsArticle[] = [];
    const seenUrls = new Set<string>();

    for (const feed of feedUrls) {
      try {
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
        const response = await fetch(apiUrl, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status === 'ok' && Array.isArray(data.items)) {
            for (const item of data.items.slice(0, 4)) {
              const articleUrl = item.link || item.guid || '';
              if (articleUrl && !seenUrls.has(articleUrl)) {
                seenUrls.add(articleUrl);
                const cleanSummary = item.description
                  ? item.description.replace(/<[^>]*>?/gm, '').trim().substring(0, 150) + '...'
                  : 'Read full clinical update on verified medical publication.';

                const thumbnail =
                  item.thumbnail ||
                  item.enclosure?.link ||
                  (item.description && item.description.match(/<img[^>]+src="([^">]+)"/)?.[1]) ||
                  undefined;

                aggregatedArticles.push({
                  id: item.guid || `news_${aggregatedArticles.length}_${Date.now()}`,
                  title: item.title?.trim() || 'Health Update',
                  summary: cleanSummary,
                  source: feed.source,
                  url: articleUrl,
                  publishedAt: item.pubDate || new Date().toISOString(),
                  imageUrl: thumbnail,
                });
              }
            }
          }
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Failed to fetch external health news');
      }
    }

    if (aggregatedArticles.length > 0) {
      // Sort newest first
      aggregatedArticles.sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );

      // Cache today's valid result
      try {
        const cachePayload: CachedNewsData = {
          date: todayKey,
          timestamp: Date.now(),
          articles: aggregatedArticles,
        };
        localStorage.setItem(todayKey, JSON.stringify(cachePayload));
      } catch {
        // Ignore
      }

      return aggregatedArticles;
    }

    // 4. If all live fetch attempts failed, check if previous day's cached news exists as graceful fallback
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(NEWS_CACHE_PREFIX)) {
          const saved = localStorage.getItem(key);
          if (saved) {
            const parsed = JSON.parse(saved) as CachedNewsData;
            if (parsed.articles?.length) {
              return parsed.articles;
            }
          }
        }
      }
    } catch {
      // Ignore
    }

    throw lastError || new Error('Health news service currently unavailable.');
  },
};
