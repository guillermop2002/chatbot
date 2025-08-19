// API Configuration - Using local development server
const API_BASE_URL = 'https://bot-engine.lacamacatu.workers.dev';
const API_ENDPOINTS = {
  CREATE: '/api/create',
  LIST: '/api/list',
  DELETE: '/api/delete',
  CHAT: '/api/chat'
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
let testSessionId = null;

// Generate persistent session ID like the widget
const generateSessionId = (botId) => {
  let sessionId = localStorage.getItem('chatbot_session_' + botId);
  if (!sessionId) {
    sessionId = 'session_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('chatbot_session_' + botId, sessionId);
  }
  return sessionId;
};

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
    console.log(`🗑️ Starting deletion process for bot ID: ${botId}`);
    
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.DELETE}/${botId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log(`📡 Delete API response status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`❌ Delete API error:`, errorData);
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Delete API response:`, data);
    
    if (data.success) {
      console.log(`🎉 Bot ${botId} successfully deleted from backend`);
      console.log(`📝 Note: Vectorize cleanup requires background processing`);
    }
    
    return data;
  } catch (error) {
    console.error('❌ Delete chatbot error:', error);
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
  
  // Generate embed code if not present
  const embedCode = chatbot.embedCode || `<script src="${API_BASE_URL}/widget.js" data-bot-id="${chatbot.id}"></script>`;
  
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
      <div class="chatbot-stats">
        <span><i class="fas fa-file-alt"></i> ${chatbot.totalPages || 0} pages</span>
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
      <button class="action-btn copy-embed-btn" data-embed="${encodeURIComponent(embedCode)}">
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

// Enhanced message formatting - exactly like the widget
const formatMessage = (content) => {
  // Convert markdown-style formatting
  content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  content = content.replace(/\n/g, '<br>');
  
  // Convert bullet points
  content = content.replace(/^- (.*$)/gim, '• $1');
  content = content.replace(/^\* (.*$)/gim, '• $1');
  
  // Convert numbered lists
  content = content.replace(/^(\d+)\. (.*$)/gim, '$1. $2');
  
  return content;
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

// Test Chat Functions - Enhanced like the widget
const openTestChat = (botId, botTitle) => {
  currentTestBotId = botId;
  testChatHistory = [];
  testSessionId = generateSessionId(botId);
  
  console.log(`🤖 Opening test chat for bot: ${botId} with session: ${testSessionId}`);
  
  elements.testChatModal.classList.add('show');
  document.body.style.overflow = 'hidden';
  
  // Reset chat messages with initial greeting
  elements.testChatMessages.innerHTML = `
    <div class="chat-message bot">
      <div class="message-avatar">
        <i class="fas fa-robot"></i>
      </div>
      <div class="message-content">
        👋 Hi! I'm here to help you with any questions about ${botTitle}. How can I assist you today?
      </div>
    </div>
  `;
  
  elements.testChatInput.focus();
  
  // Send initial greeting to get AI-generated contextual greeting
  setTimeout(() => {
    sendInitialGreeting(botTitle);
  }, 500);
};

// Send initial greeting to get AI-generated contextual response
const sendInitialGreeting = async (botTitle) => {
  try {
    console.log(`📝 Sending initial greeting for contextual response...`);
    
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.CHAT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: currentTestBotId,
        message: 'Hello',
        sessionId: testSessionId
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.response && data.response !== 'Hello') {
        // Replace the default greeting with AI-generated one
        const greeting = elements.testChatMessages.querySelector('.chat-message.bot .message-content');
        if (greeting) {
          greeting.innerHTML = formatMessage(data.response);
        }
      }
    }
  } catch (error) {
    console.log('Initial greeting failed, using default');
  }
};

const closeTestChat = () => {
  elements.testChatModal.classList.remove('show');
  document.body.style.overflow = 'auto';
  currentTestBotId = null;
  testChatHistory = [];
};

// Enhanced message rendering with HTML support - exactly like widget
const addChatMessage = (content, isUser = false, sources = null) => {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${isUser ? 'user' : 'bot'}`;
  
  // Format content exactly like the widget
  const processedContent = isUser ? content : formatMessage(content);
  
  messageDiv.innerHTML = `
    <div class="message-avatar">
      <i class="fas fa-${isUser ? 'user' : 'robot'}"></i>
    </div>
    <div class="message-content">${processedContent}</div>
  `;
  
  elements.testChatMessages.appendChild(messageDiv);
  
  // Add sources if provided (like the widget)
  if (sources && sources.length > 0) {
    addSources(sources);
  }
  
  elements.testChatMessages.scrollTop = elements.testChatMessages.scrollHeight;
  
  // Add to history
  testChatHistory.push({
    role: isUser ? 'user' : 'assistant',
    content: content
  });
};

// Add sources section like the widget
const addSources = (links) => {
  if (!links || links.length === 0) return;
  
  const sourcesDiv = document.createElement('div');
  sourcesDiv.className = 'chat-sources';
  
  sourcesDiv.innerHTML = `
    <div class="sources-title">📚 Sources:</div>
    ${links.map(url => {
      const title = getPageTitle(url);
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="source-link">🔗 ${title}</a>`;
    }).join('')}
  `;
  
  elements.testChatMessages.appendChild(sourcesDiv);
  elements.testChatMessages.scrollTop = elements.testChatMessages.scrollHeight;
};

// Enhanced page title extraction like the widget
const getPageTitle = (url) => {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    const segments = path.split('/').filter(s => s);
    
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      return lastSegment
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .replace(/\.(html|php|aspx?)$/i, '')
        .substring(0, 25) + (lastSegment.length > 25 ? '...' : '');
    }
    
    return urlObj.hostname.replace('www.', '').substring(0, 20);
  } catch {
    return 'More info';
  }
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

  console.log(`💬 Sending message: "${message}" to bot ${currentTestBotId} with session ${testSessionId}`);

  // Add user message
  addChatMessage(message, true);
  elements.testChatInput.value = '';
  
  // Show typing indicator
  showTypingIndicator();
  elements.sendTestMessage.disabled = true;

  try {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.CHAT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: currentTestBotId,
        message: message,
        sessionId: testSessionId
      })
    });

    hideTypingIndicator();

    console.log(`📡 Chat API response status: ${response.status}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to get response`);
    }

    const data = await response.json();
    console.log(`🤖 Bot response:`, data);
    
    const botResponse = data.response || 'I apologize, but I encountered an error processing your request.';
    addChatMessage(botResponse, false, data.links);
    
  } catch (error) {
    console.error('❌ Test chat error:', error);
    hideTypingIndicator();
    addChatMessage('Sorry, I encountered an error. Please try again.', false);
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

// Test chat button - Updated to use real bot ID from success modal context
elements.testChatBtn.addEventListener('click', () => {
  const botTitle = elements.chatbotTitle.textContent;
  const embedCode = elements.embedCode.textContent;
  
  // Extract bot ID from embed code
  const botIdMatch = embedCode.match(/data-bot-id="([^"]+)"/);
  const botId = botIdMatch ? botIdMatch[1] : 'demo_bot';
  
  console.log(`🎯 Opening test chat from success modal for bot: ${botId}`);
  openTestChat(botId, botTitle);
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
    if (confirm(`⚠️ Are you sure you want to delete "${botTitle}"?\n\nThis will permanently remove:\n• All chatbot data from KV storage\n• Vector embeddings from Vectorize\n• Chat conversation history\n\nThis action cannot be undone.`)) {
      setButtonLoading(button, true, 'Deleting...');
      console.log(`🗑️ User confirmed deletion of bot: ${botId}`);
      
      try {
        const result = await deleteChatbot(botId);
        
        if (result.success) {
          showToast('success', '🎉 Chatbot deleted successfully!');
          console.log(`✅ Deletion completed successfully for bot: ${botId}`);
          
          // Clear session storage for this bot
          localStorage.removeItem('chatbot_session_' + botId);
          console.log(`🧹 Cleared session data for bot: ${botId}`);
          
          // Reload chatbots list
          loadChatbots();
        } else {
          throw new Error(result.message || 'Delete operation failed');
        }
      } catch (error) {
        console.error('❌ Delete error:', error);
        showToast('error', `Failed to delete chatbot: ${error.message}`);
      } finally {
        setButtonLoading(button, false);
      }
    } else {
      console.log(`❌ User cancelled deletion of bot: ${botId}`);
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
