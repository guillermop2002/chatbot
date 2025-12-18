import { CONFIG } from '../config.js';
import { log, withRetries, normalizeEmbeddings } from '../utils/helpers.js';
import { getChunksByIds, performLexicalSearch } from './storage.js';

export async function getBatchEmbeddings(texts, chunksKV, ai) {
    const embeddings = [];
    const textsToEmbed = [];
    const cacheKeys = [];

    for (const text of texts) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const hashStr = hash.toString(36);
        const cacheKey = `embcache:${hashStr}`;
        cacheKeys.push(cacheKey);
    }

    const cacheResults = await Promise.allSettled(
        cacheKeys.map(key => chunksKV.get(key))
    );

    for (let i = 0; i < texts.length; i++) {
        const cacheResult = cacheResults[i];
        const modelName = '@cf/baai/bge-m3';
        if (cacheResult.status === 'fulfilled' && cacheResult.value) {
            const cached = JSON.parse(cacheResult.value);
            if (cached.model === modelName) {
                embeddings[i] = cached.embedding;
                continue;
            }
        }
        textsToEmbed.push({ index: i, text: texts[i], cacheKey: cacheKeys[i] });
    }

    if (textsToEmbed.length > 0) {
        const textsOnly = textsToEmbed.map(item => item.text);

        const aiResponse = await withRetries(async () => {
            return await ai.run('@cf/baai/bge-m3', { text: textsOnly });
        });

        const newEmbeddings = normalizeEmbeddings(aiResponse);

        const cachePromises = [];
        for (let i = 0; i < textsToEmbed.length; i++) {
            const item = textsToEmbed[i];
            const embedding = newEmbeddings[i];

            embeddings[item.index] = embedding;

            cachePromises.push(
                chunksKV.put(item.cacheKey, JSON.stringify({
                    embedding,
                    timestamp: Date.now(),
                    model: '@cf/baai/bge-m3'
                }), { expirationTtl: CONFIG.EMBEDDING_CACHE_TTL })
            );
        }

        await Promise.allSettled(cachePromises);
    }

    return embeddings;
}

export async function performSemanticVectorSearch(query, botId, vectorizeIndex, chunksKV, ai) {
    try {
        const queryResponse = await withRetries(async () => {
            return await ai.run('@cf/baai/bge-m3', { text: [query] });
        });

        const queryEmbedding = normalizeEmbeddings(queryResponse)[0];

        const searchResults = await vectorizeIndex.query(queryEmbedding, {
            topK: 20,
            filter: { botId: botId }
        });

        const results = [];
        for (const match of searchResults.matches) {
            if (match.score > CONFIG.VECTOR_SCORE_THRESHOLD) {
                const chunkKey = `chunk:${botId}:${match.id}`;
                const chunkDataStr = await chunksKV.get(chunkKey);
                if (chunkDataStr) {
                    const chunkData = JSON.parse(chunkDataStr);
                    results.push({
                        ...chunkData,
                        score: match.score
                    });
                }
            }
        }

        return results;
    } catch (error) {
        log('Semantic search error:', error);
        return [];
    }
}

export async function performHybridSearch(query, botId, vectorizeIndex, lexicalKV, chunksKV, ai, totalChunks) {
    const semanticResults = await performSemanticVectorSearch(query, botId, vectorizeIndex, chunksKV, ai);
    const lexicalResults = await performLexicalSearch(query, botId, lexicalKV, totalChunks);

    log(`Semantic search: ${semanticResults.length} results, Lexical search: ${lexicalResults.length} results`);

    const maxSem = Math.max(...semanticResults.map(r => r.score || 0), 0.0001);
    const maxLex = Math.max(...lexicalResults.map(r => r.lexicalScore || 0), 0.0001);

    const merged = {};

    semanticResults.forEach((r, i) => {
        merged[r.chunkIndex] = {
            ...r,
            hybridScore: (r.score || 0) / maxSem + 1 / (1 + i),
            semanticScore: (r.score || 0) / maxSem,
            lexicalScore: 0
        };
    });

    lexicalResults.forEach((r, i) => {
        if (merged[r.chunkIndex]) {
            merged[r.chunkIndex].lexicalScore = (r.lexicalScore || 0) / maxLex;
            merged[r.chunkIndex].hybridScore += (r.lexicalScore || 0) / maxLex + 1 / (1 + i);
        } else {
            merged[r.chunkIndex] = {
                ...r,
                hybridScore: (r.lexicalScore || 0) / maxLex + 1 / (1 + i),
                semanticScore: 0,
                lexicalScore: (r.lexicalScore || 0) / maxLex
            };
        }
    });

    const fusedResults = Object.values(merged).sort((a, b) => b.hybridScore - a.hybridScore);
    const topChunkIndices = fusedResults.slice(0, 15).map(r => r.chunkIndex);

    const chunks = await getChunksByIds(botId, topChunkIndices, chunksKV);
    const chunkMap = new Map(chunks.map(c => [c.chunkIndex, c]));

    return fusedResults.map(r => ({ ...r, ...chunkMap.get(r.chunkIndex) }));
}

export function heuristicReRank(chunks, query) {
    const queryTokens = query.toLowerCase().split(/\s+/);

    return chunks.map(chunk => {
        let score = chunk.score || 0;
        const text = chunk.text.toLowerCase();

        for (const token of queryTokens) {
            const exactMatches = (text.match(new RegExp(token, 'g')) || []).length;
            score += exactMatches * 0.1;
        }

        if (/\d/.test(query) && /\d/.test(text)) {
            score += 0.05;
        }

        return { ...chunk, score };
    }).sort((a, b) => b.score - a.score);
}

export async function reRankChunks(chunks, originalQuery, ai) {
    if (chunks.length === 0) return chunks;

    try {
        const contexts = chunks.map(chunk => ({ text: chunk.text || '' }));

        const response = await withRetries(async () => {
            return await ai.run('@cf/baai/bge-reranker-base', {
                query: originalQuery,
                contexts: contexts
            });
        });

        if (response && response.result && Array.isArray(response.result)) {
            const chunksWithScores = chunks.map((chunk, index) => ({
                ...chunk,
                score: response.result[index]?.score || chunk.score || 0
            }));

            return chunksWithScores.sort((a, b) => b.score - a.score);
        }
    } catch (error) {
        log('BGE reranking error:', error);
    }

    return heuristicReRank(chunks, originalQuery);
}

export async function analyzeUserMessage(message, conversationHistory, ai) {
    const historyContext = conversationHistory.length > 0
        ? conversationHistory.slice(-6).map(msg => `${msg.role}: ${msg.content}`).join('\n')
        : 'No previous conversation';

    const expansionPrompt = `You are a query expansion specialist. Your job is to transform user messages into comprehensive, self-contained search queries that will work well with vector similarity search.

CRITICAL INSTRUCTIONS:
- Always expand the query to include context from conversation history
- Resolve ALL pronouns (it, that, this, they, etc.) with specific nouns
- Convert vague references ("the first one", "others", "more like that") into specific terms
- Add relevant synonyms and related terms to improve retrieval
- Maintain the user's original intent while making it search-friendly

CONVERSATION CONTEXT:
${historyContext}

USER MESSAGE: "${message}"

Examples of good query expansion:
- Input: "what about others?" + History about "Model X cars" → Output: "Other car models similar to Model X, alternative vehicles, competing automotive products"
- Input: "tell me more" + History about "Python programming" → Output: "Detailed Python programming information, advanced Python features, Python development tutorials"
- Input: "is it available?" + History about "premium subscription" → Output: "Premium subscription availability, pricing plans, premium features access"

Generate a JSON response with:
{
  "language": "es" or "en",
  "isGreeting": true or false,
  "expandedQuery": "comprehensive search query with context and synonyms",
  "originalQuery": "original user message"
}`;

    try {
        const response = await withRetries(async () => {
            return await ai.run('@cf/meta/llama-3.1-8b-instruct', {
                messages: [{ role: 'user', content: expansionPrompt }],
                max_tokens: 300,
                temperature: 0.2
            });
        });

        const content = response.response || '';
        const jsonMatch = content.match(/\{[\s\S]*?\}/);

        if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);
            return {
                language: analysis.language || 'en',
                isGreeting: analysis.isGreeting || false,
                searchQuery: analysis.expandedQuery || analysis.originalQuery || message,
                originalQuery: message
            };
        }
    } catch (error) {
        log('Query expansion error:', error);
    }

    const lowerMessage = message.toLowerCase();
    const isSpanish = /[ñáéíóúü]/.test(message) ||
        /\b(hola|que|como|donde|cuando|por|para|con|sin|sobre|entre|hasta|desde|hacia|según|durante|mediante|tras|ante|bajo|contra|quiero|necesito|tengo|estoy|soy|hay|está|son|tienen|puede|debe|hacer|decir|ver|dar|saber|estar|tener|información|disponible|servicio|gracias|bueno|muy|todo|empresa|producto|precio|contacto|apartamento|personas|alquiler)\b/.test(lowerMessage);

    const isGreeting = /^(hola|hello|hi|hey|buenos días|good morning|buenas tardes|good afternoon|buenas noches|good evening|saludos|greetings|qué tal|how are you)[\s\W]*$/i.test(message.trim());

    let expandedQuery = message;
    if (conversationHistory.length > 0 && /\b(it|that|this|they|those|others|more|another|same|similar)\b/i.test(message)) {
        const lastAssistantMessage = conversationHistory.slice(-2).find(msg => msg.role === 'assistant');
        if (lastAssistantMessage) {
            const context = lastAssistantMessage.content.split(' ').slice(0, 10).join(' ');
            expandedQuery = `${message} ${context}`;
        }
    }

    return {
        language: isSpanish ? 'es' : 'en',
        isGreeting: isGreeting && conversationHistory.length === 0,
        searchQuery: expandedQuery,
        originalQuery: message
    };
}

export async function generateContextualGreeting(botData, language, chunksKV, ai) {
    try {
        const sampleChunks = [];
        for (let i = 0; i < 5; i++) {
            const chunkKey = `chunk:${botData.id}:${i}`;
            const chunkDataStr = await chunksKV.get(chunkKey);
            if (chunkDataStr) {
                const chunkData = JSON.parse(chunkDataStr);
                sampleChunks.push(chunkData.text);
            }
        }

        if (sampleChunks.length === 0) {
            return language === 'es'
                ? "¡Hola! Soy tu asistente virtual. ¿En qué puedo ayudarte?"
                : "Hello! I'm your virtual assistant. How can I help you?";
        }

        const websiteContent = sampleChunks.join(' ').substring(0, 2000);

        const greetingPrompt = `Based on this website content, generate a welcoming greeting message for a chatbot assistant.

Website: ${botData.title || botData.url}
Content sample: ${websiteContent}

Requirements:
1. Language: ${language === 'es' ? 'Spanish' : 'English'}
2. Be welcoming and helpful
3. Mention 2-3 specific topics the user can ask about based on the content
4. Keep it concise (max 2 sentences)
5. Sound natural and conversational

Generate the greeting:`;

        const response = await withRetries(async () => {
            return await ai.run('@cf/meta/llama-3.1-8b-instruct', {
                messages: [{ role: 'user', content: greetingPrompt }],
                max_tokens: 150,
                temperature: 0.4
            });
        });

        const greeting = response.response?.trim();
        if (greeting && greeting.length > 20) {
            return greeting;
        }
    } catch (error) {
        log('AI greeting generation error:', error);
    }

    return language === 'es'
        ? `¡Hola! Soy tu asistente virtual para ${botData.title || 'este sitio web'}. ¿En qué puedo ayudarte?`
        : `Hello! I'm your virtual assistant for ${botData.title || 'this website'}. How can I help you?`;
}
