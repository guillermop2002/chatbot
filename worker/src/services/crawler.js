import { CONFIG } from '../config.js';
import { log, withRetries, validateUrl } from '../utils/helpers.js';
import { intelligentSemanticChunking, inferContentCategory } from '../utils/text.js';

export async function fetchSitemap(originUrl) {
    try {
        validateUrl(originUrl);
        const res = await withRetries(async () => {
            return await fetch(new URL('/sitemap.xml', originUrl).href, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChatbotScraper/1.0)' }
            });
        });

        if (!res.ok) throw new Error();
        const xml = await res.text();
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        return Array.from(doc.querySelectorAll('loc'))
            .map(el => el.textContent.trim())
            .filter(u => u.startsWith(originUrl))
            .slice(0, 30);
    } catch {
        return null;
    }
}

export async function fetchAndParse(pageUrl, origin) {
    const textCollector = { text: '', title: '', headings: [], breadcrumbs: [], rawHtml: '' };
    const links = new Set();

    try {
        validateUrl(pageUrl);

        const res = await withRetries(async () => {
            return await fetch(pageUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChatbotScraper/1.0)' },
            });
        });

        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

        // Security Check: Verify the final URL is still on the same origin
        // This prevents indexing external content if an internal link redirects (301/302) to another domain
        const finalUrl = new URL(res.url);
        const originalUrl = new URL(origin);
        if (finalUrl.hostname !== originalUrl.hostname) {
            throw new Error(`Redirected to external domain: ${finalUrl.hostname}`);
        }

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) {
            return { text: '', links: [], title: '', headings: [], breadcrumbs: [], rawHtml: '', semanticChunks: [] };
        }

        const htmlContent = await res.text();
        textCollector.rawHtml = htmlContent;

        await new HTMLRewriter()
            .on('title', {
                text(text) {
                    textCollector.title += text.text;
                }
            })
            .on('h1, h2, h3, h4, h5, h6', {
                text(text) {
                    if (text.text.trim().length > 3) {
                        textCollector.headings.push(text.text.trim());
                    }
                }
            })
            .on('.breadcrumb, .breadcrumbs, nav[aria-label="breadcrumb"], .nav-breadcrumb', {
                text(text) {
                    if (text.text.trim().length > 3) {
                        textCollector.breadcrumbs.push(text.text.trim());
                    }
                }
            })
            .on('a[href]', {
                element(el) {
                    const href = el.getAttribute('href');

                    if (!href || href.includes('/cdn-cgi/l/email-protection') || href.startsWith('#')) {
                        return;
                    }

                    try {
                        const u = new URL(href, pageUrl);
                        if (u.origin === origin && u.hostname === new URL(origin).hostname) {
                            const pathname = u.pathname.toLowerCase();
                            if (!pathname.match(/\/(contact|about|privacy|terms|sitemap|robots|admin|login|wp-admin|wp-login|register|sign)/) &&
                                !pathname.endsWith('.pdf') && !pathname.endsWith('.jpg') && !pathname.endsWith('.png') &&
                                !pathname.endsWith('.gif') && !pathname.endsWith('.svg')) {

                                const cleanUrl = u.href.split('#')[0];
                                if (cleanUrl !== pageUrl) {
                                    links.add(cleanUrl);
                                }
                            }
                        }
                    } catch { }
                }
            })
            .on('p, li, td, th, div[class*="content"], div[class*="text"], article, section, main, .description, .summary', {
                text(t) {
                    if (t.text.trim().length > 5) {
                        textCollector.text += ' ' + t.text.trim();
                    }
                }
            })
            .on('script, style, noscript, nav, footer, header[class*="nav"], .menu, .navigation', {
                element(el) {
                    el.remove();
                }
            })
            .transform(new Response(htmlContent))
            .arrayBuffer();

        const semanticChunks = intelligentSemanticChunking(
            textCollector.rawHtml,
            textCollector.title.trim(),
            pageUrl,
            textCollector.headings
        );

        const category = inferContentCategory(
            pageUrl,
            textCollector.title.trim(),
            textCollector.headings,
            textCollector.breadcrumbs
        );

        return {
            text: textCollector.text.replace(/\s+/g, ' ').trim(),
            links: Array.from(links),
            title: textCollector.title.trim(),
            headings: textCollector.headings,
            breadcrumbs: textCollector.breadcrumbs,
            rawHtml: textCollector.rawHtml,
            semanticChunks: semanticChunks,
            category: category
        };
    } catch (error) {
        log(`Error fetching ${pageUrl}:`, error.message);
        return { text: '', links: [], title: '', headings: [], breadcrumbs: [], rawHtml: '', semanticChunks: [], category: 'general' };
    }
}

export async function crawlSeeds(seeds, maxPages = CONFIG.DEFAULT_MAX_PAGES, maxDepth = 2) {
    const origin = new URL(seeds[0]).origin;
    const visited = new Set();
    const queue = seeds.map(u => ({ url: u, depth: 1, priority: 1 }));
    const pages = [];

    queue.sort((a, b) => {
        const aScore = a.url.split('/').length + (a.url.includes('index') ? -1 : 0);
        const bScore = b.url.split('/').length + (b.url.includes('index') ? -1 : 0);
        return aScore - bScore;
    });

    while (queue.length && pages.length < maxPages) {
        const { url, depth } = queue.shift();
        if (visited.has(url) || depth > maxDepth) continue;
        visited.add(url);

        try {
            const { text, links, title, headings, semanticChunks, category } = await fetchAndParse(url, origin);
            if (text.length > 100) {
                pages.push({
                    url,
                    text: `${title} ${headings.join(' ')} ${text}`,
                    title: title || new URL(url).pathname.split('/').pop() || 'Page',
                    headings: headings,
                    semanticChunks,
                    category
                });
            }

            if (depth < maxDepth) {
                const prioritizedLinks = links
                    .filter(href => !visited.has(href))
                    .sort((a, b) => {
                        const aPath = new URL(a).pathname.toLowerCase();
                        const bPath = new URL(b).pathname.toLowerCase();

                        const aPriority = aPath.match(/(product|service|about|feature|solution|offer|blog|news|article)/) ? 1 : 2;
                        const bPriority = bPath.match(/(product|service|about|feature|solution|offer|blog|news|article)/) ? 1 : 2;

                        return aPriority - bPriority;
                    })
                    .slice(0, 8);

                for (const href of prioritizedLinks) {
                    queue.push({ url: href, depth: depth + 1, priority: 2 });
                }
            }
        } catch (error) {
            log(`Error processing ${url}:`, error);
        }
    }

    return pages;
}
