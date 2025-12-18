// API client for interacting with the Cloudflare Worker backend

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export interface Chatbot {
    id: string;
    title: string;
    url: string;
    createdAt: number;
    totalPages: number;
}

export interface CreateChatbotResponse {
    success: boolean;
    botId: string;
    title: string;
    embedCode: string;
    pagesProcessed: number;
    chunksProcessed: number;
}

export const api = {
    async createChatbot(url: string): Promise<CreateChatbotResponse> {
        const response = await fetch(`${API_BASE_URL}/api/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to create chatbot');
        }

        return response.json();
    },

    async getAllChatbots(): Promise<Chatbot[]> {
        const response = await fetch(`${API_BASE_URL}/api/list`);

        if (!response.ok) {
            throw new Error('Failed to fetch chatbots');
        }

        const data = await response.json();
        return data.chatbots;
    },

    async deleteChatbot(botId: string): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/api/delete/${botId}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to delete chatbot');
        }
    }
};
