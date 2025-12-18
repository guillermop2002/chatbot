import { log } from '../utils/helpers.js';

export async function deleteChatbot(c) {
    const botId = c.req.param('botId');

    try {
        const chunksKV = c.env.CHUNKS_KV;
        const botsKV = c.env.BOTS_KV;
        const convsKV = c.env.CONVS_KV;
        const index = c.env.VECTORIZE_INDEX;

        log(`🗑️ Starting complete deletion for bot ${botId}`);

        const botDataStr = await botsKV.get(`bot:${botId}`);
        if (!botDataStr) {
            return c.json({ error: 'Bot not found' }, 404);
        }

        const botData = JSON.parse(botDataStr);
        log(`📊 Bot data: ${botData.totalChunks} chunks, ${botData.vectorIds?.length || 0} vectorIds`);

        const deletePromises = [];

        if (botData.vectorIds && botData.vectorIds.length > 0) {
            log(`🎯 Deleting ${botData.vectorIds.length} vectors from Vectorize`);
            try {
                if (botData.vectorIds.length <= 1000) {
                    deletePromises.push(index.deleteByIds(botData.vectorIds));
                } else {
                    for (let i = 0; i < botData.vectorIds.length; i += 1000) {
                        const batch = botData.vectorIds.slice(i, i + 1000);
                        deletePromises.push(index.deleteByIds(batch));
                    }
                }
                log(`✅ Vector deletion scheduled for ${botData.vectorIds.length} vectors`);
            } catch (error) {
                console.error('Vector deletion error:', error);
            }
        } else {
            log(`⚠️ No vectorIds found, attempting fallback namespace cleanup`);
            try {
                const sampleQuery = new Array(768).fill(0.001);
                const allVectors = await index.query(sampleQuery, {
                    topK: 10000,
                    returnMetadata: true
                });

                const botVectorIds = allVectors.matches
                    .filter(match => match.id.startsWith(`ns_${botId}__`))
                    .map(match => match.id);

                if (botVectorIds.length > 0) {
                    log(`🔍 Fallback found ${botVectorIds.length} vectors to delete`);
                    deletePromises.push(index.deleteByIds(botVectorIds));
                }
            } catch (error) {
                log('Fallback vector search failed (non-critical):', error);
            }
        }

        const chunksToDelete = botData.totalChunks || 0;
        log(`📦 Deleting ${chunksToDelete} chunks from CHUNKS_KV`);
        for (let i = 0; i < chunksToDelete; i++) {
            deletePromises.push(chunksKV.delete(`chunk:${botId}:${i}`));
        }

        log(`💬 Deleting ALL conversations for bot ${botId}`);
        try {
            const conversationKeys = await convsKV.list({ prefix: `conv:${botId}:` });
            log(`🔍 Found ${conversationKeys.keys.length} conversation sessions to delete`);

            for (const key of conversationKeys.keys) {
                deletePromises.push(convsKV.delete(key.name));
            }
        } catch (error) {
            console.error('Conversation cleanup error:', error);
        }

        deletePromises.push(botsKV.delete(`bot:${botId}`));

        log(`🚀 Executing ${deletePromises.length} deletion operations...`);
        const results = await Promise.allSettled(deletePromises);

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        log(`📈 Deletion complete: ${successful} successful, ${failed} failed`);

        if (failed > 0) {
            const errors = results.filter(r => r.status === 'rejected').map(r => r.reason);
            console.error('Some deletions failed:', errors);
        }

        log('🕵️‍♂️ Iniciando paso de verificación post-borrado...');
        const verificationResults = {};

        const botCheck = await botsKV.get(`bot:${botId}`);
        verificationResults.botDeleted = botCheck === null;
        log(verificationResults.botDeleted ? `✅ Verificación BOTS_KV: No se encontró el bot (¡Correcto!)` : `❌ Verificación BOTS_KV: El bot todavía existe.`);

        const chunkCheck = await chunksKV.get(`chunk:${botId}:0`);
        verificationResults.chunksDeleted = chunkCheck === null;
        log(verificationResults.chunksDeleted ? `✅ Verificación CHUNKS_KV: No se encontró el chunk de prueba (¡Correcto!)` : `❌ Verificación CHUNKS_KV: El chunk de prueba todavía existe.`);

        const convCheck = await convsKV.list({ prefix: `conv:${botId}:` });
        verificationResults.convsDeleted = convCheck.keys.length === 0;
        log(verificationResults.convsDeleted ? `✅ Verificación CONVS_KV: No se encontraron conversaciones (¡Correcto!)` : `❌ Verificación CONVS_KV: Todavía existen ${convCheck.keys.length} conversaciones.`);

        try {
            const sampleQuery = new Array(768).fill(0.001);
            const vectorCheckResults = await index.query(sampleQuery, { topK: 100, returnMetadata: true });
            const foundVectors = vectorCheckResults.matches.filter(match => match.id.startsWith(`ns_${botId}__`));
            verificationResults.vectorsDeleted = foundVectors.length === 0;
            log(verificationResults.vectorsDeleted ? `✅ Verificación Vectorize: No se encontraron vectores (¡Correcto!)` : `❌ Verificación Vectorize: Se encontraron ${foundVectors.length} vectores restantes.`);
        } catch (e) {
            log('⚠️ Error durante la verificación de Vectorize, puede que el índice esté procesando los borrados.');
            verificationResults.vectorsDeleted = 'VerificationError';
        }

        log('🕵️‍♂️ Verificación completada.');

        return c.json({
            success: true,
            message: 'Bot and all associated data deleted successfully',
            details: {
                vectorsDeleted: botData.vectorIds?.length || 0,
                chunksDeleted: chunksToDelete,
                conversationsDeleted: (await convsKV.list({ prefix: `conv:${botId}:` })).keys.length
            }
        });
    } catch (error) {
        console.error('Delete bot error:', error);
        return c.json({ error: 'Failed to delete bot: ' + error.message }, 500);
    }
}
