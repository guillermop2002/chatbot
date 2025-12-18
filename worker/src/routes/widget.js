export async function serveWidget(c) {
    const widgetScript = `(function() {
'use strict';

const currentScript = document.currentScript || document.querySelector('script[data-bot-id]');
const botId = currentScript?.getAttribute('data-bot-id');
const apiUrl = '${new URL(c.req.url).origin}';

if (!botId) {
    console.error('Chatbot: No bot ID found');
    return;
}

let sessionId = localStorage.getItem('chatbot_session_' + botId);
if (!sessionId) {
    sessionId = 'session_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('chatbot_session_' + botId, sessionId);
}

const styles = \`
    .chatbot-widget {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .chatbot-toggle {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    
    .chatbot-toggle:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
    }
    
    .chatbot-toggle svg {
        width: 24px;
        height: 24px;
        fill: white;
    }
    
    .chatbot-window {
        position: absolute;
        bottom: 80px;
        right: 0;
        width: 380px;
        height: 550px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        display: none;
        flex-direction: column;
        overflow: hidden;
    }
    
    .chatbot-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    
    .chatbot-title {
        font-weight: 600;
        font-size: 16px;
    }
    
    .chatbot-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: background 0.2s ease;
    }
    
    .chatbot-close:hover {
        background: rgba(255, 255, 255, 0.2);
    }
    
    .chatbot-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    
    .chatbot-message {
        max-width: 85%;
        padding: 12px 16px;
        border-radius: 18px;
        font-size: 14px;
        line-height: 1.5;
        animation: fadeIn 0.3s ease;
    }
    
    .chatbot-message.user {
        background: #667eea;
        color: white;
        align-self: flex-end;
        border-bottom-right-radius: 4px;
    }
    
    .chatbot-message.bot {
        background: #f8f9fa;
        color: #333;
        align-self: flex-start;
        border-bottom-left-radius: 4px;
        border-left: 3px solid #667eea;
    }
    
    .chatbot-message.bot strong {
        font-weight: 600;
        color: #2c3e50;
    }
    
    .chatbot-message.bot ul {
        margin: 8px 0;
        padding-left: 16px;
    }
    
    .chatbot-message.bot li {
        margin: 4px 0;
    }
    
    .chatbot-sources {
        margin-top: 8px;
        padding: 12px 16px;
        background: #e8f4fd;
        border-radius: 12px;
        border-left: 3px solid #2196f3;
        align-self: flex-start;
        max-width: 85%;
    }
    
    .chatbot-sources-title {
        font-weight: 600;
        color: #1976d2;
        margin-bottom: 8px;
        font-size: 13px;
    }
    
    .chatbot-source {
        display: block;
        background: #2196f3;
        color: white;
        text-decoration: none;
        padding: 8px 12px;
        border-radius: 16px;
        font-size: 12px;
        margin: 3px 0;
        transition: background 0.2s ease;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    
    .chatbot-source:hover {
        background: #1976d2;
        text-decoration: none;
    }
    
    .chatbot-source::before {
        content: "🔗 ";
        margin-right: 4px;
    }
    
    .chatbot-retry {
        background: #ff9800;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 16px;
        font-size: 12px;
        cursor: pointer;
        margin-top: 8px;
        transition: background 0.2s ease;
    }
    
    .chatbot-retry:hover {
        background: #f57c00;
    }
    
    .chatbot-input-area {
        padding: 16px;
        border-top: 1px solid #e1e5e9;
        display: flex;
        gap: 8px;
    }
    
    .chatbot-input {
        flex: 1;
        padding: 12px 16px;
        border: 1px solid #e1e5e9;
        border-radius: 24px;
        outline: none;
        font-size: 14px;
        transition: border-color 0.2s ease;
    }
    
    .chatbot-input:focus {
        border-color: #667eea;
    }
    
    .chatbot-send {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #667eea;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s ease;
    }
    
    .chatbot-send:hover {
        background: #5a67d8;
    }
    
    .chatbot-send:disabled {
        background: #cbd5e0;
        cursor: not-allowed;
    }
    
    .chatbot-send svg {
        width: 16px;
        height: 16px;
        fill: white;
    }
    
    .chatbot-typing {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 12px 16px;
        background: #f8f9fa;
        border-radius: 18px;
        border-bottom-left-radius: 4px;
        align-self: flex-start;
        max-width: 80%;
        border-left: 3px solid #667eea;
    }
    
    .chatbot-typing-dot {
        width: 6px;
        height: 6px;
        background: #999;
        border-radius: 50%;
        animation: typing 1.4s infinite ease-in-out;
    }
    
    .chatbot-typing-dot:nth-child(2) {
        animation-delay: 0.2s;
    }
    
    .chatbot-typing-dot:nth-child(3) {
        animation-delay: 0.4s;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes typing {
        0%, 60%, 100% { transform: scale(0.8); opacity: 0.5; }
        30% { transform: scale(1); opacity: 1; }
    }
    
    @media (max-width: 480px) {
        .chatbot-window {
            width: calc(100vw - 40px);
            height: calc(100vh - 100px);
            bottom: 80px;
            right: 20px;
        }
    }
\`;

const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

const widgetHTML = \`
    <div class="chatbot-widget">
        <button class="chatbot-toggle" id="chatbot-toggle">
            <svg viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
            </svg>
        </button>
        <div class="chatbot-window" id="chatbot-window">
            <div class="chatbot-header">
                <div class="chatbot-title">💬 Chat Support</div>
                <button class="chatbot-close" id="chatbot-close">✕</button>
            </div>
            <div class="chatbot-messages" id="chatbot-messages">
                <div class="chatbot-message bot">
                    👋 Hi! I'm here to help you with any questions about this website. How can I assist you today?
                </div>
            </div>
            <div class="chatbot-input-area">
                <input type="text" class="chatbot-input" id="chatbot-input" placeholder="Type your message...">
                <button class="chatbot-send" id="chatbot-send">
                    <svg viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                </button>
            </div>
        </div>
    </div>
\`;

const widgetContainer = document.createElement('div');
widgetContainer.innerHTML = widgetHTML;
document.body.appendChild(widgetContainer);

const toggle = document.getElementById('chatbot-toggle');
const chatWindow = document.getElementById('chatbot-window');
const close = document.getElementById('chatbot-close');
const messages = document.getElementById('chatbot-messages');
const input = document.getElementById('chatbot-input');
const send = document.getElementById('chatbot-send');

let isOpen = false;
let lastMessage = '';

function toggleChat() {
    isOpen = !isOpen;
    chatWindow.style.display = isOpen ? 'flex' : 'none';
    if (isOpen) {
        input.focus();
    }
}

function formatMessage(content) {
    content = content.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
    content = content.replace(/\\n/g, '<br>');
    content = content.replace(/^- (.*$)/gim, '• $1');
    content = content.replace(/^\\* (.*$)/gim, '• $1');
    content = content.replace(/^(\\d+)\\. (.*$)/gim, '$1. $2');
    return content;
}

function getPageTitle(url) {
    try {
        const urlObj = new URL(url);
        const path = urlObj.pathname;
        const segments = path.split('/').filter(s => s);
        
        if (segments.length > 0) {
            const lastSegment = segments[segments.length - 1];
            return lastSegment
                .replace(/-/g, ' ')
                .replace(/_/g, ' ')
                .replace(/\\b\\w/g, l => l.toUpperCase())
                .replace(/\\.(html|php|aspx?)$/i, '')
                .substring(0, 25) + (lastSegment.length > 25 ? '...' : '');
        }
        
        return urlObj.hostname.replace('www.', '').substring(0, 20);
    } catch {
        return 'More info';
    }
}

function addMessage(content, isUser = false, showRetry = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = \`chatbot-message \${isUser ? 'user' : 'bot'}\`;
    
    if (isUser) {
        messageDiv.textContent = content;
    } else {
        messageDiv.innerHTML = formatMessage(content);
        
        if (showRetry) {
            const retryBtn = document.createElement('button');
            retryBtn.className = 'chatbot-retry';
            retryBtn.textContent = '🔄 Retry';
            retryBtn.onclick = () => sendMessage(lastMessage);
            messageDiv.appendChild(retryBtn);
        }
    }
    
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

function addSources(links) {
    if (!links || links.length === 0) return;
    
    const sourcesDiv = document.createElement('div');
    sourcesDiv.className = 'chatbot-sources';
    
    const titleDiv = document.createElement('div');
    titleDiv.className = 'chatbot-sources-title';
    titleDiv.textContent = 'Sources:';
    sourcesDiv.appendChild(titleDiv);
    
    links.forEach(url => {
        const linkElement = document.createElement('a');
        linkElement.href = url;
        linkElement.target = '_blank';
        linkElement.rel = 'noopener noreferrer';
        linkElement.className = 'chatbot-source';
        linkElement.textContent = getPageTitle(url);
        sourcesDiv.appendChild(linkElement);
    });
    
    messages.appendChild(sourcesDiv);
    messages.scrollTop = messages.scrollHeight;
}

function showTyping() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chatbot-typing';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = '<div class="chatbot-typing-dot"></div><div class="chatbot-typing-dot"></div><div class="chatbot-typing-dot"></div>';
    messages.appendChild(typingDiv);
    messages.scrollTop = messages.scrollHeight;
}

function hideTyping() {
    const typing = document.getElementById('typing-indicator');
    if (typing) {
        typing.remove();
    }
}

async function sendMessage(messageText = null) {
    const message = messageText || input.value.trim();
    if (!message) return;

    lastMessage = message;
    addMessage(message, true);
    if (!messageText) input.value = '';
    send.disabled = true;
    showTyping();

    try {
        const response = await fetch(apiUrl + '/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: botId,
                message: message,
                sessionId: sessionId
            })
        });

        if (!response.ok) {
            throw new Error('Failed to get response');
        }

        const data = await response.json();
        hideTyping();
        
        addMessage(data.response);
        
        if (data.links && data.links.length > 0) {
            addSources(data.links);
        }

    } catch (error) {
        console.error('Chat error:', error);
        hideTyping();
        addMessage('Sorry, I encountered an error. Please try again.', false, true);
    } finally {
        send.disabled = false;
    }
}

toggle.addEventListener('click', toggleChat);
close.addEventListener('click', toggleChat);
send.addEventListener('click', () => sendMessage());
input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

document.addEventListener('click', (e) => {
    if (isOpen && !widgetContainer.contains(e.target)) {
        toggleChat();
    }
});

})();`;

    return new Response(widgetScript, {
        headers: {
            'Content-Type': 'application/javascript',
            'Cache-Control': 'public, max-age=3600'
        }
    });
}
