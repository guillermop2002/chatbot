import { CONFIG } from '../config.js';

export function generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function log(message, ...args) {
    if (CONFIG.DEBUG_LOGGING) {
        console.log(message, ...args);
    }
}

export async function withRetries(fn, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries - 1) throw error;
            log(`Retry ${i + 1}/${retries} failed:`, error.message);
            await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
    }
}

export function validateUrl(url) {
    try {
        const urlObj = new URL(url);

        // Block non-HTTP protocols
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            throw new Error('Only HTTP/HTTPS protocols allowed');
        }

        // Block local/private IPs and domains
        const hostname = urlObj.hostname.toLowerCase();
        if (
            hostname === 'localhost' ||
            hostname.endsWith('.local') ||
            /^(\d+\.){3}\d+$/.test(hostname) || // IPv4
            hostname.startsWith('[') // IPv6
        ) {
            throw new Error('Local/private addresses not allowed');
        }

        return true;
    } catch (error) {
        throw new Error(`Invalid URL: ${error.message}`);
    }
}

export function generateContentHash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
}

export function normalizeEmbeddings(aiResponse) {
    try {
        // Handle different possible response formats
        if (aiResponse.data && Array.isArray(aiResponse.data)) {
            return aiResponse.data;
        }
        if (Array.isArray(aiResponse)) {
            return aiResponse;
        }
        if (aiResponse.embeddings && Array.isArray(aiResponse.embeddings)) {
            return aiResponse.embeddings;
        }
        if (aiResponse.result && Array.isArray(aiResponse.result)) {
            return aiResponse.result;
        }

        throw new Error('Unexpected embedding response format');
    } catch (error) {
        console.error('Failed to normalize embeddings:', error);
        throw new Error('Invalid embedding response format');
    }
}
