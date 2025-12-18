import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { log } from './utils/helpers.js';
import { createChatbot } from './routes/create.js';
import { chatWithBot } from './routes/chat.js';
import { listChatbots } from './routes/list.js';
import { deleteChatbot } from './routes/delete.js';
import { serveWidget } from './routes/widget.js';

const app = new Hono();

app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
}));

app.post('/api/create', createChatbot);
app.post('/api/chat', chatWithBot);
app.get('/api/list', listChatbots);
app.delete('/api/delete/:botId', deleteChatbot);
app.get('/widget.js', serveWidget);

app.get('/api/debug-vectors', async (c) => {
    log("Debug endpoint /api/debug-vectors hit");
    try {
        const index = c.env.VECTORIZE_INDEX;
        const queryVector = new Array(768).fill(0);
        const queryResults = await index.query(queryVector, {
            topK: 10,
            returnMetadata: true
        });

        const vectorInfo = queryResults.matches.map(match => ({
            vectorId: match.id,
            namespace: match.id.startsWith('ns_') ? match.id.split('__')[0] : 'NO_NAMESPACE',
            textSample: match.metadata?.text?.substring(0, 70) + '...' || 'N/A'
        }));

        return c.json({
            message: "Sample of 10 vectors from the 'chatbot-index' with namespace info",
            sample: vectorInfo
        });
    } catch (error) {
        console.error('Error in /api/debug-vectors:', error);
        return c.json({ error: 'Failed to query Vectorize index: ' + error.message }, 500);
    }
});

app.get('/health', (c) => {
    return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

export default app;
