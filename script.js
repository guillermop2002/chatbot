// API Configuration - Replace with your deployed Cloudflare Worker URL
const API_BASE_URL = 'https://bot-engine.lacamacatu.workers.dev';
const API_ENDPOINTS = {
  CREATE: '/api/create',
  LIST: '/api/list',
  DELETE: '/api/delete'
};

// DOM Elements
const elements = {
  form: document.getElementById('chatbotForm'),
  urlInput: document.getElementById('websiteUrl'),
  urlValidation: document.getElementById('urlValidation'),
  createBtn: document.getElementById('createBtn'),
  successModal: document.getElementById('successModal'),
  closeModal: document.getElementById('closeModal'),
  chatbotTitle: document.getElementById('chatbotTitle'),
  embedCode: document.getElementById('embedCode'),
  copyEmbedBtn: document.getElementById('copyEmbedBtn'),
  testChatBtn: document.getElementById('testChatBtn'),
  testChatModal: document.getElementById('testChatModal'),
  closeChatModal: document.getElementById('closeChatModal'),
  testChatMessages: document.getElementById('testChatMessages'),
  testChatInput: document.getElementById('testChatInput'),
  sendTestMessage: document.getElementById('sendTestMessage'),
  errorToast: document.getElementById('errorToast'),
  successToast: document.getElementById('successToast'),
  errorMessage: document.getElementById('errorMessage'),
  successMessage: document.getElementById('successMessage'),
  chatbotsGrid: document.getElementById('chatbotsGrid'),
  loadingState: document.getElementById('loadingState'),
  emptyState: document.getElementById('emptyState')
};

// State Management
let currentChatbots = [];
let isCreating = false;
let currentTestBotId = null;
let testChatHistory = [];

// Utility Functions
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const formatDate = (timestamp) => {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const validateURL = (url) => {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
};

const showToast = (type, message, duration = 4000) => {
  const toast = type === 'error' ? elements.errorToast : elements.successToast;
  const messageElement = type === 'error' ? elements.errorMessage : elements.successMessage;
  
  messageElement.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
};

const showModal = (title, embedCode) => {
  elements.chatbotTitle.textContent = title;
  elements.embedCode.textContent = embedCode;
  elements.successModal.classList.add('show');
  document.body.style.overflow = 'hidden';
};

const hideModal = () => {
  elements.successModal.classList.remove('show');
  document.body.style.overflow = 'auto';
};

// Improved button loading state management
const setButtonLoading = (button, loading, loadingText = 'Processing...') => {
  if (loading) {
    button.classList.add('loading');
    button.disabled = true;
    // Update loading text if provided
    const loaderSpan = button.querySelector('.btn-loader span');
    if (loaderSpan) {
      loaderSpan.textContent = loadingText;
    }
  } else {
    button.classList.remove('loading');
    button.disabled = false;
  }
};

// Enhanced create button loading state
const setCreateButtonLoading = (loading) => {
  isCreating = loading;
  setButtonLoading(elements.createBtn, loading, 'Processing...');
};

// API Functions
const createChatbot = async (url) => {
  try {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.CREATE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to create chatbot');
    }

    return data;
  } catch (error) {
    console.error('Create chatbot error:', error);
    throw error;
  }
};

const listChatbots = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.LIST}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.chatbots || [];
  } catch (error) {
    console.error('List chatbots error:', error);
    return [];
  }
};

const deleteChatbot = async (botId) => {
  try {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.DELETE}/${botId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Delete chatbot error:', error);
    throw error;
  }
};

// UI Functions
const updateURLValidation = debounce((url) => {
  if (!url.trim()) {
    elements.urlValidation.textContent = '';
    elements.urlValidation.className = 'url-validation';
    return;
  }

  if (validateURL(url)) {
    elements.urlValidation.textContent = '✓ Valid URL';
    elements.urlValidation.className = 'url-validation valid';
  } else {
    elements.urlValidation.textContent = '✗ Please enter a valid URL (http:// or https://)';
    elements.urlValidation.className = 'url-validation invalid';
  }
}, 300);

const renderChatbotCard = (chatbot, index) => {
  const card = document.createElement('div');
  card.className = 'chatbot-card';
  card.style.animationDelay = `${index * 0.1}s`;
  
  card.innerHTML = `
    <div class="chatbot-header">
      <div class="chatbot-icon">
        <i class="fas fa-robot"></i>
      </div>
      <div class="chatbot-info">
        <h3>${chatbot.title || 'AI Chatbot'}</h3>
        <p class="chatbot-url">${chatbot.url}</p>
      </div>
    </div>
    <div class="chatbot-meta">
      <div class="chatbot-date">
        <i class="fas fa-calendar"></i>
        ${formatDate(chatbot.createdAt)}
      </div>
    </div>
    <div class="chatbot-actions">
      <button class="action-btn test-chat-card-btn" data-bot-id="${chatbot.id}" data-bot-title="${chatbot.title}">
        <span class="btn-content">
          <span class="btn-text">
            <i class="fas fa-comments"></i>
            Test Chat
          </span>
          <div class="btn-loader">
            <div class="spinner"></div>
            <span>Loading...</span>
          </div>
        </span>
      </button>
      <button class="action-btn copy-embed-btn" data-embed="${encodeURIComponent(chatbot.embedCode || '')}">
        <span class="btn-content">
          <span class="btn-text">
            <i class="fas fa-code"></i>
            Copy Embed
          </span>
          <div class="btn-loader">
            <div class="spinner"></div>
            <span>Copying...</span>
          </div>
        </span>
      </button>
      <button class="action-btn delete-btn" data-bot-id="${chatbot.id}" data-bot-title="${chatbot.title}">
        <span class="btn-content">
          <span class="btn-text">
            <i class="fas fa-trash"></i>
            Delete
          </span>
          <div class="btn-loader">
            <div class="spinner"></div>
            <span>Deleting...</span>
          </div>
        </span>
      </button>
    </div>
  `;
  
  return card;
};

const renderChatbots = (chatbots) => {
  // Hide loading state
  elements.loadingState.style.display = 'none';
  
  if (chatbots.length === 0) {
    elements.emptyState.style.display = 'flex';
    return;
  }
  
  elements.emptyState.style.display = 'none';
  
  // Clear existing chatbots (keep loading and empty states)
  const existingCards = elements.chatbotsGrid.querySelectorAll('.chatbot-card');
  existingCards.forEach(card => card.remove());
  
  // Render new chatbots
  chatbots.forEach((chatbot, index) => {
    const card = renderChatbotCard(chatbot, index);
    elements.chatbotsGrid.appendChild(card);
  });
};

const loadChatbots = async () => {
  try {
    elements.loadingState.style.display = 'flex';
    elements.emptyState.style.display = 'none';
    
    const chatbots = await listChatbots();
    currentChatbots = chatbots;
    renderChatbots(chatbots);
  } catch (error) {
    console.error('Failed to load chatbots:', error);
    elements.loadingState.style.display = 'none';
    elements.emptyState.style.display = 'flex';
    elements.emptyState.querySelector('h3').textContent = 'Failed to Load Chatbots';
    elements.emptyState.querySelector('p').textContent = 'Please try refreshing the page';
  }
};

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      textArea.remove();
      return true;
    } catch (err) {
      textArea.remove();
      return false;
    }
  }
};

// Enhanced HTML sanitization for safe rendering
const sanitizeHtml = (html) => {
  const div = document.createElement('div');
  div.textContent = html;
  const text = div.innerHTML;
  
  // Allow basic formatting tags
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n/g, '<br>');
};

// Test Chat Functions
const openTestChat = (botId, botTitle) => {
  currentTestBotId = botId;
  testChatHistory = [];
  elements.testChatModal.classList.add('show');
  document.body.style.overflow = 'hidden';
  
  // Reset chat messages
  elements.testChatMessages.innerHTML = `
    <div class="chat-message bot">
      <div class="message-avatar">
        <i class="fas fa-robot"></i>
      </div>
      <div class="message-content">
        ¡Hola! Soy el asistente de IA para ${botTitle}. ¿En qué puedo ayudarte?
      </div>
    </div>
  `;
  
  elements.testChatInput.focus();
};

const closeTestChat = () => {
  elements.testChatModal.classList.remove('show');
  document.body.style.overflow = 'auto';
  currentTestBotId = null;
  testChatHistory = [];
};

// Enhanced message rendering with HTML support
const addChatMessage = (content, isUser = false) => {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${isUser ? 'user' : 'bot'}`;
  
  // Sanitize and render HTML content for bot messages
  const processedContent = isUser ? content : sanitizeHtml(content);
  
  messageDiv.innerHTML = `
    <div class="message-avatar">
      <i class="fas fa-${isUser ? 'user' : 'robot'}"></i>
    </div>
    <div class="message-content">${processedContent}</div>
  `;
  
  elements.testChatMessages.appendChild(messageDiv);
  elements.testChatMessages.scrollTop = elements.testChatMessages.scrollHeight;
  
  // Add to history
  testChatHistory.push({
    role: isUser ? 'user' : 'assistant',
    content: content
  });
};

const showTypingIndicator = () => {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'chat-message bot typing-message';
  typingDiv.id = 'typing-indicator';
  
  typingDiv.innerHTML = `
    <div class="message-avatar">
      <i class="fas fa-robot"></i>
    </div>
    <div class="message-content">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  
  elements.testChatMessages.appendChild(typingDiv);
  elements.testChatMessages.scrollTop = elements.testChatMessages.scrollHeight;
};

const hideTypingIndicator = () => {
  const typing = document.getElementById('typing-indicator');
  if (typing) {
    typing.remove();
  }
};

const sendTestChatMessage = async () => {
  const message = elements.testChatInput.value.trim();
  if (!message || !currentTestBotId) return;

  // Add user message
  addChatMessage(message, true);
  elements.testChatInput.value = '';
  
  // Show typing indicator
  showTypingIndicator();
  elements.sendTestMessage.disabled = true;

  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: currentTestBotId,
        message: message,
        sessionId: 'test_session_' + currentTestBotId,
        history: testChatHistory.slice(-10) // Send last 10 messages for context
      })
    });

    hideTypingIndicator();

    if (!response.ok) {
      throw new Error('Failed to get response');
    }

    const data = await response.json();
    addChatMessage(data.response || 'Lo siento, no pude procesar tu mensaje.');
    
  } catch (error) {
    console.error('Test chat error:', error);
    hideTypingIndicator();
    addChatMessage('Error: No se pudo conectar con el chatbot. Verifica que el worker esté desplegado correctamente.');
  } finally {
    elements.sendTestMessage.disabled = false;
  }
};

// Event Listeners
elements.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (isCreating) return;
  
  const url = elements.urlInput.value.trim();
  
  if (!validateURL(url)) {
    showToast('error', 'Please enter a valid URL');
    return;
  }
  
  setCreateButtonLoading(true);
  
  try {
    const result = await createChatbot(url);
    
    if (result.success) {
      showModal(result.title || 'AI Chatbot', result.embedCode);
      showToast('success', 'Chatbot created successfully!');
      
      // Reset form
      elements.urlInput.value = '';
      elements.urlValidation.textContent = '';
      elements.urlValidation.className = 'url-validation';
      
      // Reload chatbots list
      setTimeout(() => {
        loadChatbots();
      }, 1000);
    } else {
      throw new Error(result.error || 'Failed to create chatbot');
    }
  } catch (error) {
    console.error('Creation error:', error);
    showToast('error', error.message || 'Failed to create chatbot. Please try again.');
  } finally {
    setCreateButtonLoading(false);
  }
});

// URL input validation
elements.urlInput.addEventListener('input', (e) => {
  updateURLValidation(e.target.value);
});

// Modal close handlers
elements.closeModal.addEventListener('click', hideModal);
elements.closeChatModal.addEventListener('click', closeTestChat);

// Test chat button
elements.testChatBtn.addEventListener('click', () => {
  const botTitle = elements.chatbotTitle.textContent;
  // Extract bot ID from current context or use a default
  openTestChat('current_bot', botTitle);
});

// Chat input handlers
elements.testChatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendTestChatMessage();
  }
});

elements.sendTestMessage.addEventListener('click', sendTestChatMessage);

// Copy embed code
elements.copyEmbedBtn.addEventListener('click', async () => {
  const embedCode = elements.embedCode.textContent;
  if (await copyToClipboard(embedCode)) {
    showToast('success', 'Embed code copied to clipboard!');
  } else {
    showToast('error', 'Failed to copy embed code');
  }
});

// Toast close handlers
document.querySelectorAll('.toast-close').forEach(button => {
  button.addEventListener('click', (e) => {
    e.target.closest('.toast').classList.remove('show');
  });
});

// Chatbot card event delegation
elements.chatbotsGrid.addEventListener('click', async (e) => {
  const button = e.target.closest('button');
  if (!button) return;

  const botId = button.dataset.botId;
  const botTitle = button.dataset.botTitle;
  const embedCode = button.dataset.embed;

  if (button.classList.contains('test-chat-card-btn')) {
    openTestChat(botId, botTitle);
  } else if (button.classList.contains('copy-embed-btn')) {
    setButtonLoading(button, true, 'Copying...');
    try {
      const decodedEmbedCode = decodeURIComponent(embedCode);
      if (await copyToClipboard(decodedEmbedCode)) {
        showToast('success', 'Embed code copied to clipboard!');
      } else {
        showToast('error', 'Failed to copy embed code');
      }
    } finally {
      setTimeout(() => setButtonLoading(button, false), 500);
    }
  } else if (button.classList.contains('delete-btn')) {
    if (confirm(`Are you sure you want to delete "${botTitle}"?`)) {
      setButtonLoading(button, true, 'Deleting...');
      try {
        await deleteChatbot(botId);
        showToast('success', 'Chatbot deleted successfully');
        loadChatbots();
      } catch (error) {
        console.error('Delete error:', error);
        showToast('error', 'Failed to delete chatbot');
      } finally {
        setButtonLoading(button, false);
      }
    }
  }
});

// Modal overlay click to close
elements.successModal.addEventListener('click', (e) => {
  if (e.target === elements.successModal) {
    hideModal();
  }
});

elements.testChatModal.addEventListener('click', (e) => {
  if (e.target === elements.testChatModal) {
    closeTestChat();
  }
});

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  loadChatbots();
});

// Handle escape key to close modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (elements.successModal.classList.contains('show')) {
      hideModal();
    }
    if (elements.testChatModal.classList.contains('show')) {
      closeTestChat();
    }
  }
});
