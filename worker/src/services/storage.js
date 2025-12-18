import { CONFIG } from '../config.js';
import { log } from '../utils/helpers.js';

export async function getChunksByIds(botId, chunkIndices, chunksKV) {
    const results = [];
    for (const idx of chunkIndices) {
        const chunkKey = `chunk:${botId}:${idx}`;
        const chunkDataStr = await chunksKV.get(chunkKey);
        if (chunkDataStr) {
            results.push(JSON.parse(chunkDataStr));
        }
    }
    return results;
}

export async function buildLexicalIndex(chunks, botId, lexicalKV) {
    const termIndex = {};

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const words = chunk.text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length >= CONFIG.LEXICAL_INDEX_MIN_TERM_LENGTH);

        const uniqueWords = [...new Set(words)];

        for (const word of uniqueWords) {
            if (!termIndex[word]) {
                termIndex[word] = [];
            }
            termIndex[word].push({
                chunkIndex: i,
                frequency: words.filter(w => w === word).length
            });
        }
    }

    const indexPromises = [];
    for (const [term, postings] of Object.entries(termIndex)) {
        const key = `lexical:${botId}:${term}`;
        indexPromises.push(
            lexicalKV.put(key, JSON.stringify(postings))
        );
    }

    await Promise.allSettled(indexPromises);
    log(`Built lexical index with ${Object.keys(termIndex).length} terms`);
}

export async function performLexicalSearch(query, botId, lexicalKV, chunks) {
    const queryTerms = query
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length >= CONFIG.LEXICAL_INDEX_MIN_TERM_LENGTH);

    if (queryTerms.length === 0) return [];

    const chunkScores = {};

    for (const term of queryTerms) {
        const key = `lexical:${botId}:${term}`;
        try {
            const postingsStr = await lexicalKV.get(key);
            if (postingsStr) {
                const postings = JSON.parse(postingsStr);
                for (const posting of postings) {
                    if (!chunkScores[posting.chunkIndex]) {
                        chunkScores[posting.chunkIndex] = 0;
                    }
                    chunkScores[posting.chunkIndex] += posting.frequency;
                }
            }
        } catch (error) {
            log(`Lexical search error for term ${term}:`, error);
        }
    }

    const results = Object.entries(chunkScores)
        .map(([chunkIndex, score]) => ({
            ...chunks[parseInt(chunkIndex)],
            lexicalScore: score / queryTerms.length
        }))
        .sort((a, b) => b.lexicalScore - a.lexicalScore)
        .slice(0, 15);

    return results;
}
