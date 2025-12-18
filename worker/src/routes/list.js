export async function listChatbots(c) {
    try {
        const keys = await c.env.BOTS_KV.list({ prefix: 'bot:' });
        const chatbots = [];

        for (const key of keys.keys) {
            const botDataStr = await c.env.BOTS_KV.get(key.name);
            if (botDataStr) {
                const botData = JSON.parse(botDataStr);
                chatbots.push({
                    id: botData.id,
                    title: botData.title,
                    url: botData.url,
                    createdAt: botData.createdAt,
                    totalPages: botData.totalPages || 0
                });
            }
        }

        chatbots.sort((a, b) => b.createdAt - a.createdAt);
        return c.json({ chatbots });
    } catch (error) {
        console.error('List chatbots error:', error);
        return c.json({ error: 'Failed to list chatbots' }, 500);
    }
}
