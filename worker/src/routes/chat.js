import { CONFIG } from '../config.js';
import { log } from '../utils/helpers.js';
import {
    analyzeUserMessage,
    generateContextualGreeting,
    performHybridSearch,
    performSemanticVectorSearch,
    reRankChunks
} from '../services/rag.js';

export async function chatWithBot(c) {
    const { id, message, sessionId = 'default' } = await c.req.json();
    const userMessage = message;

    try {
        if (!id || !message) {
            return c.json({ error: 'Bot ID and message are required' }, 400);
        }

        const ai = c.env.AI;
        const index = c.env.VECTORIZE_INDEX;
        const chunksKV = c.env.CHUNKS_KV;
        const convsKV = c.env.CONVS_KV;
        const botsKV = c.env.BOTS_KV;

        const botDataStr = await botsKV.get(`bot:${id}`);
        if (!botDataStr) {
            return c.json({ error: 'Bot not found' }, 404);
        }

        const botData = JSON.parse(botDataStr);

        log(`Processing message for botId: ${id}`);

        const convKey = `conv:${id}:${sessionId}`;
        const conversationStr = await convsKV.get(convKey);
        const conversationHistory = conversationStr ? JSON.parse(conversationStr) : [];

        const analysis = await analyzeUserMessage(message, conversationHistory, ai);
        log('Message analysis:', analysis);

        if (analysis.isGreeting) {
            log('Detected greeting, generating contextual response');

            const greetingResponse = await generateContextualGreeting(botData, analysis.language, chunksKV, ai);

            const updatedConversation = [
                { role: 'user', content: message },
                { role: 'assistant', content: greetingResponse }
            ];

            await convsKV.put(convKey, JSON.stringify(updatedConversation));

            return c.json({
                response: greetingResponse,
                links: []
            });
        }

        const searchQuery = analysis.searchQuery;
        log(`Using expanded search query: "${searchQuery}"`);

        let allChunksForLexical = [];
        try {
            const maxEstimatedChunks = 500;
            for (let i = 0; i < maxEstimatedChunks; i++) {
                const chunkKey = `chunk:${id}:${i}`;
                const chunkDataStr = await chunksKV.get(chunkKey);
                if (!chunkDataStr) break;

                const chunkData = JSON.parse(chunkDataStr);
                allChunksForLexical.push(chunkData);
            }
        } catch (error) {
            log('Error loading chunks for lexical search:', error);
        }

        const lexicalKV = chunksKV;
        let reRankedChunks = [];

        try {
            reRankedChunks = await performHybridSearch(
                searchQuery,
                id,
                index,
                lexicalKV,
                chunksKV,
                ai,
                allChunksForLexical
            );
            log(`Hybrid search returned ${reRankedChunks.length} results`);
        } catch (error) {
            log('Hybrid search failed, falling back to semantic search:', error);
            try {
                reRankedChunks = await performSemanticVectorSearch(searchQuery, id, index, chunksKV, ai);
                log(`Semantic fallback returned ${reRankedChunks.length} results`);
            } catch (fallbackError) {
                log('Semantic fallback also failed:', fallbackError);
                reRankedChunks = [];
            }
        }

        const relevantUrls = [];
        const urlSet = new Set();

        for (const chunk of reRankedChunks) {
            if ((chunk.hybridScore || chunk.score || 0) > 0.4 && chunk.url && !urlSet.has(chunk.url)) {
                urlSet.add(chunk.url);
                relevantUrls.push(chunk.url);
            }
        }

        if (reRankedChunks.length > 0) {
            try {
                reRankedChunks = await reRankChunks(reRankedChunks, searchQuery, ai);
                log(`Applied BGE reranking to ${reRankedChunks.length} chunks`);
            } catch (error) {
                log('BGE reranking failed, using original scores:', error);
            }
        }

        if (reRankedChunks.length === 0) {
            const noInfoResponse = analysis.language === 'es'
                ? "Lo siento, no tengo información específica sobre ese tema. ¿Podrías reformular tu pregunta o preguntarme sobre otros temas relacionados con este sitio web?"
                : "I'm sorry, I don't have specific information about that topic. Could you rephrase your question or ask about other topics related to this website?";

            const updatedConversation = [
                ...conversationHistory,
                { role: 'user', content: message },
                { role: 'assistant', content: noInfoResponse }
            ].slice(-20);

            await convsKV.put(convKey, JSON.stringify(updatedConversation));

            return c.json({
                response: noInfoResponse,
                links: []
            });
        }

        const context_text = reRankedChunks
            .slice(0, CONFIG.MAX_PROMPT_CHUNKS)
            .map((chunk, index) => `[Contexto ${index + 1}]: ${chunk.text}`)
            .join('\n\n');

        const conversationContext = conversationHistory.length > 0
            ? conversationHistory.slice(-6).map(msg => `${msg.role}: ${msg.content}`).join('\n')
            : '';

        const systemPrompt = `You are an expert virtual assistant specializing in ${botData.url}. You are friendly, proactive, and incredibly helpful. Your personality is:

**CORE PERSONALITY TRAITS:**
- 🎯 **Proactive**: Always provide detailed recommendations and suggest next steps
- 🤝 **Conversational**: Use a warm, human-like tone that builds rapport
- 📚 **Expert**: Demonstrate deep knowledge while remaining approachable  
- 🔍 **Thorough**: Provide comprehensive answers with structured formatting
- ✨ **Helpful**: Go beyond just answering—anticipate user needs

**CRITICAL OPERATIONAL RULES:**
1. **Language Matching**: ALWAYS respond in the same language as the user's question
2. **Source Fidelity**: Base responses EXCLUSIVELY on the provided website content
3. **Transparency**: If information isn't available, say so clearly and suggest alternatives
4. **Conversation Continuity**: Use chat history to understand follow-up questions and context
5. **Rich Formatting**: Use **bold** for key points, bullet points for lists, and clear structure

**RESPONSE STYLE GUIDELINES:**
- Be direct and actionable, not passive ("Here are 3 options for you" vs "There might be some options")
- Format lists and structured data with bullet points whenever possible
- Provide specific recommendations rather than generic statements
- When presenting multiple options, explain the differences and advantages
- End responses with proactive suggestions when appropriate

**CONVERSATION CONTEXT:**
${conversationContext ? `Previous conversation:\n${conversationContext}\n\n` : 'This is the start of our conversation.\n\n'}

**KNOWLEDGE BASE FROM ${botData.url}:**
${context_text}

**USER'S CURRENT QUESTION:** "${message}"
**EXPANDED SEARCH QUERY:** "${searchQuery}"

**TASK:** Provide a comprehensive, helpful response based EXCLUSIVELY on the website content above. If the information isn't available in the content, clearly state this and suggest how the user might rephrase their question or what related topics you can help with instead. Be proactive in offering additional relevant information that might interest them.`;

        const response = await withRetries(async () => {
            return await ai.run('@cf/meta/llama-3.1-8b-instruct', {
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ],
                max_tokens: 1500,
                temperature: 0.3
            });
        });

        let aiResponse = response.response ||
            (analysis.language === 'es' ?
                'Disculpa, encontré un error al procesar tu solicitud. Por favor, inténtalo de nuevo.' :
                'I apologize, but I encountered an error processing your request. Please try again.');

        aiResponse = aiResponse
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/<[^>]+>/g, '')
            .trim();

        const updatedConversation = [
            ...conversationHistory,
            { role: 'user', content: message },
            { role: 'assistant', content: aiResponse }
        ].slice(-20);

        await convsKV.put(convKey, JSON.stringify(updatedConversation));

        return c.json({
            response: aiResponse,
            links: relevantUrls.slice(0, 3)
        });
    } catch (error) {
        console.error('Chat error:', error);
        const errorText = 'I apologize, but I encountered an error processing your request. Please try again.';
        return c.json({
            response: errorText,
            links: []
        });
    }
}
