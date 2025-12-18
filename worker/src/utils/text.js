import { CONFIG } from '../config.js';

export function inferContentCategory(pageUrl, pageTitle, headings, breadcrumbs) {
    const url = pageUrl.toLowerCase();
    const title = pageTitle.toLowerCase();
    const allHeadings = headings.join(' ').toLowerCase();
    const allBreadcrumbs = breadcrumbs.join(' ').toLowerCase();

    const content = `${url} ${title} ${allHeadings} ${allBreadcrumbs}`;

    // Define category patterns with priorities
    const categories = [
        { name: 'products', patterns: ['product', 'shop', 'store', 'catalog', 'item', 'buy', 'price', 'cart'] },
        { name: 'services', patterns: ['service', 'solution', 'offering', 'consulting', 'support'] },
        { name: 'documentation', patterns: ['doc', 'guide', 'tutorial', 'manual', 'help', 'api', 'reference'] },
        { name: 'about', patterns: ['about', 'company', 'team', 'mission', 'history', 'who we are'] },
        { name: 'blog', patterns: ['blog', 'article', 'post', 'news', 'update', 'insight'] },
        { name: 'contact', patterns: ['contact', 'reach', 'location', 'phone', 'email', 'address'] },
        { name: 'pricing', patterns: ['pric', 'cost', 'plan', 'subscription', 'fee', 'rate'] },
        { name: 'faq', patterns: ['faq', 'question', 'answer', 'help', 'support'] }
    ];

    let bestCategory = 'general';
    let maxScore = 0;

    for (const category of categories) {
        let score = 0;
        for (const pattern of category.patterns) {
            const matches = (content.match(new RegExp(pattern, 'g')) || []).length;
            score += matches;
        }
        if (score > maxScore) {
            maxScore = score;
            bestCategory = category.name;
        }
    }

    return bestCategory;
}

export function intelligentSemanticChunking(htmlContent, pageTitle, pageUrl, headings) {
    const chunks = [];

    // Remove boilerplate elements first
    const cleanedHtml = htmlContent
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
        .replace(/<div[^>]*class="[^"]*sidebar[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
        .replace(/<div[^>]*class="[^"]*advertisement[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

    // Extract structured content sections
    const sectionPattern = /<(h[1-6])[^>]*>(.*?)<\/\1>([\s\S]*?)(?=<h[1-6][^>]*>|$)/gi;
    let match;

    while ((match = sectionPattern.exec(cleanedHtml)) !== null) {
        const [, headingTag, headingText, content] = match;
        const headingLevel = parseInt(headingTag.slice(1));

        // Clean and extract meaningful text from this section
        const sectionText = content
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (sectionText.length >= CONFIG.SEMANTIC_CHUNK_MIN_SIZE) {
            const contextualHeading = headingText.replace(/<[^>]+>/g, '').trim();

            // Split large sections into smaller chunks while preserving context
            if (sectionText.length > CONFIG.SEMANTIC_CHUNK_MAX_SIZE) {
                const sentences = sectionText.match(/[^\.!?]+[\.!?]+/g) || [sectionText];
                let currentChunk = `**${contextualHeading}**\n\n`;

                for (const sentence of sentences) {
                    if ((currentChunk + sentence).length > CONFIG.SEMANTIC_CHUNK_MAX_SIZE) {
                        if (currentChunk.length > CONFIG.SEMANTIC_CHUNK_MIN_SIZE) {
                            chunks.push({
                                text: currentChunk.trim(),
                                title: pageTitle,
                                heading: contextualHeading,
                                url: pageUrl,
                                level: headingLevel
                            });
                        }
                        currentChunk = `**${contextualHeading}** (continued)\n\n${sentence}`;
                    } else {
                        currentChunk += sentence;
                    }
                }

                if (currentChunk.length > CONFIG.SEMANTIC_CHUNK_MIN_SIZE) {
                    chunks.push({
                        text: currentChunk.trim(),
                        title: pageTitle,
                        heading: contextualHeading,
                        url: pageUrl,
                        level: headingLevel
                    });
                }
            } else {
                chunks.push({
                    text: `**${contextualHeading}**\n\n${sectionText}`,
                    title: pageTitle,
                    heading: contextualHeading,
                    url: pageUrl,
                    level: headingLevel
                });
            }
        }
    }

    // If no structured sections found, fall back to paragraph-based chunking
    if (chunks.length === 0) {
        const paragraphs = cleanedHtml
            .replace(/<p[^>]*>/gi, '\n\n')
            .replace(/<\/p>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .split('\n\n')
            .filter(p => p.trim().length > 50);

        let currentChunk = '';
        for (const paragraph of paragraphs) {
            if ((currentChunk + paragraph).length > CONFIG.SEMANTIC_CHUNK_MAX_SIZE && currentChunk.length > 0) {
                chunks.push({
                    text: currentChunk.trim(),
                    title: pageTitle,
                    heading: '',
                    url: pageUrl,
                    level: 0
                });
                currentChunk = paragraph;
            } else {
                currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
            }
        }

        if (currentChunk.length > CONFIG.SEMANTIC_CHUNK_MIN_SIZE) {
            chunks.push({
                text: currentChunk.trim(),
                title: pageTitle,
                heading: '',
                url: pageUrl,
                level: 0
            });
        }
    }

    return chunks;
}

export function preserveContentStructure(text) {
    return text
        .replace(/<li[^>]*>/gi, '\n• ')
        .replace(/<\/li>/gi, '')
        .replace(/<ul[^>]*>/gi, '\n')
        .replace(/<\/ul>/gi, '\n')
        .replace(/<ol[^>]*>/gi, '\n')
        .replace(/<\/ol>/gi, '\n')
        .replace(/<h[1-6][^>]*>/gi, '\n\n**')
        .replace(/<\/h[1-6]>/gi, '**\n')
        .replace(/<p[^>]*>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<br[^>]*>/gi, '\n')
        .replace(/<strong[^>]*>/gi, '**')
        .replace(/<\/strong>/gi, '**')
        .replace(/<b[^>]*>/gi, '**')
        .replace(/<\/b>/gi, '**')
        .replace(/<em[^>]*>/gi, '*')
        .replace(/<\/em>/gi, '*')
        .replace(/<i[^>]*>/gi, '*')
        .replace(/<\/i>/gi, '*');
}

export function chunkText(text, pageTitle = '', sectionHeading = '', maxChunkSize = 1200) {
    // Clean text more aggressively but preserve structure
    text = preserveContentStructure(text);

    text = text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/{[^}]+}/g, ' ')
        .replace(/\$\w+[^;]*;/g, ' ')
        .replace(/window\.\w+[^;]*;/g, ' ')
        .replace(/document\.\w+[^;]*;/g, ' ')
        .replace(/\w+:\s*[^;]*;/g, ' ')
        .replace(/\b(important|px|rem|rgba|deg|var|media|function|return|const|let|getElementById|addEventListener|onclick|onload|margin|padding|border|width|height)\b/gi, ' ')
        .replace(/[{}();]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Split into sentences with better semantic boundaries
    const sentences = text.split(/[.!?]+/).filter(s => {
        const trimmed = s.trim();
        return trimmed.length > 20 &&
            !trimmed.match(/^(class|id|style|href|src|alt|title|width|height|border|margin|padding)$/i) &&
            !trimmed.match(/^\d+$/) &&
            !trimmed.match(/^(click|here|more|info|read|see|view|go|back|next|prev|home|menu|nav|footer|header|login|register|sign|up|in)$/i);
    });

    const chunks = [];
    let currentChunk = '';

    const contextPrefix = pageTitle ? `[${pageTitle}${sectionHeading ? ` - ${sectionHeading}` : ''}] ` : '';

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim();
        const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + sentence;

        if (potentialChunk.length > maxChunkSize && currentChunk.length > 0) {
            if (currentChunk.length > 50) {
                chunks.push(contextPrefix + currentChunk.trim());
            }

            const overlapSentences = sentences.slice(Math.max(0, i - 2), i);
            currentChunk = overlapSentences.join('. ') + (overlapSentences.length > 0 ? '. ' : '') + sentence;
        } else {
            currentChunk = potentialChunk;
        }
    }

    if (currentChunk.trim() && currentChunk.length > 50) {
        chunks.push(contextPrefix + currentChunk.trim());
    }

    return chunks.filter(chunk => chunk.length > 30);
}
