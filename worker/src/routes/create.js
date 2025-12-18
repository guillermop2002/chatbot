import { CONFIG } from '../config.js';
import { log, generateId, generateContentHash, validateUrl, withRetries } from '../utils/helpers.js';
import { fetchSitemap, crawlSeeds, fetchAndParse } from '../services/crawler.js';
import { chunkText } from '../utils/text.js';
import { buildLexicalIndex } from '../services/storage.js';
import { getBatchEmbeddings } from '../services/rag.js';

export async function createChatbot(c) {
    const { url, maxPages = CONFIG.DEFAULT_MAX_PAGES, maxDepth = 2 } = await c.req.json();
    if (!url) return c.json({ error: 'URL is required' }, 400);

    try {
        validateUrl(url);

        const ai = c.env.AI;
        const index = c.env.VECTORIZE_INDEX;
        const chunksKV = c.env.CHUNKS_KV;
        const botsKV = c.env.BOTS_KV;

        const urlHashKey = `urlhash:${generateContentHash(url)}`;
        // Note: In a real incremental update system we might use this hash to skip work, 
        // but here we proceed to ensure fresh data or you can uncomment the check if desired.

        let seeds = await fetchSitemap(url);
        if (!seeds || seeds.length === 0) seeds = [url];

        let pageTitle;
        try {
            const mainRes = await withRetries(async () => {
                return await fetch(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChatbotScraper/1.0)' },
                });
            });
            const mainHtml = await mainRes.text();
            const m = mainHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
            pageTitle = m ? m[1].trim() : new URL(url).hostname;
        } catch {
            pageTitle = new URL(url).hostname;
        }

        const pages = await crawlSeeds(seeds, maxPages, maxDepth);
        if (pages.length === 0) {
            return c.json({ error: 'No content could be extracted from the website' }, 400);
        }

        const botId = generateId();
        let totalChunks = 0;
        const vectorIds = [];

        log(`Creating bot ${botId} with ${pages.length} pages`);

        const allSemanticChunks = [];
        for (const page of pages) {
            let pageChunks = page.semanticChunks && page.semanticChunks.length > 0
                ? page.semanticChunks.map(chunk => chunk.text)
                : chunkText(page.text, page.title, page.headings[0] || '', CONFIG.SEMANTIC_CHUNK_MAX_SIZE);

            if (pageChunks.length === 0) continue;

            for (let i = 0; i < pageChunks.length; i++) {
                allSemanticChunks.push({
                    text: pageChunks[i],
                    url: page.url,
                    title: page.title,
                    category: page.category || 'general',
                    headings: page.headings || [],
                    chunkIndex: totalChunks + i
                });
            }

            log(`Processing ${pageChunks.length} semantic chunks for page: ${page.url}`);
            totalChunks += pageChunks.length;
        }

        const lexicalKV = chunksKV;
        await buildLexicalIndex(allSemanticChunks, botId, lexicalKV);

        for (let i = 0; i < allSemanticChunks.length; i += CONFIG.BATCH_EMBED_SIZE) {
            const batch = allSemanticChunks.slice(i, i + CONFIG.BATCH_EMBED_SIZE);
            const batchTexts = batch.map(chunk => chunk.text);

            try {
                const embeddings = await getBatchEmbeddings(batchTexts, chunksKV, ai);

                const vectors = [];
                const chunkPromises = [];

                for (let j = 0; j < embeddings.length; j++) {
                    const chunk = batch[j];
                    const chunkKey = `chunk:${botId}:${chunk.chunkIndex}`;

                    chunkPromises.push(
                        chunksKV.put(chunkKey, JSON.stringify({
                            text: chunk.text,
                            url: chunk.url,
                            pageTitle: chunk.title,
                            category: chunk.category,
                            headings: chunk.headings,
                            chunkIndex: chunk.chunkIndex,
                            botId: botId,
                            timestamp: Date.now()
                        }))
                    );

                    const vectorId = `${chunk.chunkIndex}`;
                    vectors.push({
                        id: vectorId,
                        values: embeddings[j],
                        metadata: {
                            botId: botId,
                            url: chunk.url,
                            pageTitle: chunk.title,
                            category: chunk.category,
                            chunkIndex: chunk.chunkIndex
                        }
                    });
                    vectorIds.push(vectorId);
                }

                await Promise.allSettled(chunkPromises);

                log(`Inserting ${vectors.length} vectors with namespace: ns_${botId}`);

                await withRetries(async () => {
                    return await index.upsert(vectors);
                });

            } catch (error) {
                console.error('Error processing batch:', error);
            }
        }

        const contentHash = generateContentHash(pages.map(p => p.text).join(''));
        await chunksKV.put(urlHashKey, contentHash, { expirationTtl: 86400 * 7 });

        log(`Bot ${botId} created with ${totalChunks} total chunks`);

        const botData = {
            id: botId,
            url,
            title: pageTitle,
            createdAt: Date.now(),
            totalPages: pages.length,
            totalChunks: totalChunks,
            contentHash: contentHash,
            vectorIds: vectorIds
        };

        await botsKV.put(`bot:${botId}`, JSON.stringify(botData));

        const origin = new URL(c.req.url).origin;
        const embedCode = `<script src="${origin}/widget.js" data-bot-id="${botId}"></script>`;

        return c.json({
            success: true,
            botId: botId,
            title: pageTitle,
            embedCode,
            pagesProcessed: pages.length,
            chunksProcessed: totalChunks
        });
    } catch (error) {
        console.error('Create chatbot error:', error);
        return c.json({ error: 'Failed to create chatbot: ' + error.message }, 500);
    }
}
