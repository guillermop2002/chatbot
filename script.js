// Configuration - Update this with your Worker deployment URL
const WORKER_URL = 'https://bot-engine.lacamacatu.workers.dev';

// DOM elements
const form = document.getElementById('chatbot-form');
const loading = document.getElementById('loading');
const result = document.getElementById('result');
const error = document.getElementById('error');
const createBtn = document.getElementById('create-btn');
const chatbotsSection = document.getElementById('chatbots-section');
const chatbotsList = document.getElementById('chatbots-list');

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    loadAllChatbots();
});

// Form submission handler
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const url = document.getElementById('url').value.trim();
    if (!url) return;
    
    // Reset UI
    loading.classList.add('show');
    result.classList.remove('show');
    error.classList.remove('show');
    createBtn.disabled = true;
    
    try {
        const response = await fetch(`${WORKER_URL}/api/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: url })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to create chatbot');
        }
        
        // Show success result
        document.getElementById('bot-title').textContent = data.title;
        document.getElementById('embed-text').textContent = data.embedCode;
        result.classList.add('show');
        
        // Clear form
        document.getElementById('url').value = '';
        
        // Reload chatbots list
        setTimeout(() => {
            loadAllChatbots();
        }, 1000);
        
    } catch (err) {
        console.error('Error:', err);
        document.getElementById('error-message').textContent = err.message;
        error.classList.add('show');
    } finally {
        loading.classList.remove('show');
        createBtn.disabled = false;
    }
});

// Generate embed code
function generateEmbedCode(chatbotId) {
    return `<script src="${WORKER_URL}/widget.js" data-bot-id="${chatbotId}"></script>`;
}

// Copy embed code to clipboard
function copyEmbedCode() {
    const embedText = document.getElementById('embed-text').textContent;
    navigator.clipboard.writeText(embedText).then(() => {
        const copyBtn = document.querySelector('.copy-btn');
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 2000);
    });
}

// Copy chatbot embed code
function copyChatbotEmbed(chatbotId) {
    const embedCode = generateEmbedCode(chatbotId);
    navigator.clipboard.writeText(embedCode).then(() => {
        const copyBtn = document.querySelector(`[onclick="copyChatbotEmbed('${chatbotId}')"]`);
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 2000);
    });
}

// Load all chatbots
async function loadAllChatbots() {
    try {
        const response = await fetch(`${WORKER_URL}/api/list`, {
            method: 'GET'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load chatbots');
        }
        
        const data = await response.json();
        const chatbots = data.chatbots || [];
        
        if (chatbots.length > 0) {
            displayChatbots(chatbots);
            chatbotsSection.classList.add('show');
        } else {
            chatbotsSection.classList.remove('show');
        }
        
    } catch (err) {
        console.error('Error loading chatbots:', err);
        // Don't show error for loading chatbots, just hide the section
        chatbotsSection.classList.remove('show');
    }
}

// Display chatbots list
function displayChatbots(chatbots) {
    chatbotsList.innerHTML = '';
    
    chatbots.forEach(chatbot => {
        const chatbotDiv = document.createElement('div');
        chatbotDiv.className = 'chatbot-item';
        
        const createdDate = new Date(chatbot.createdAt).toLocaleDateString();
        const embedCode = generateEmbedCode(chatbot.id);
        
        chatbotDiv.innerHTML = `
            <h4>${chatbot.title}</h4>
            <div class="url">${chatbot.url}</div>
            <div class="date">Created ${createdDate}</div>
            <div class="embed-section">
                <label>Embed Code:</label>
                <div class="embed-code">
                    <button class="copy-btn" onclick="copyChatbotEmbed('${chatbot.id}')">Copy</button>
                    <span>${embedCode}</span>
                </div>
            </div>
        `;
        
        chatbotsList.appendChild(chatbotDiv);
    });
}

// Make functions globally available
window.copyEmbedCode = copyEmbedCode;
window.copyChatbotEmbed = copyChatbotEmbed;
