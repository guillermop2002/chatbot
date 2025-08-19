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

const setButtonLoading = (loading) => {
  isCreating = loading;
  if (loading) {
    elements.createBtn.classList.add('loading');
    elements.createBtn.disabled = true;
  } else {
    elements.createBtn.classList.remove('loading');
    elements.createBtn.disabled = false;
  }
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
        <i class="fas fa-comments"></i>
        Test Chat
      </button>
      <button class="action-btn copy-embed-btn" data-embed="${encodeURIComponent(chatbot.embedCode || '')}">
        <i class="fas fa-code"></i>
        Copy Embed
      </button>
      <button class="action-btn delete-btn" data-bot-id="${chatbot.id}" data-bot-title="${chatbot.title}">
        <i class="fas fa-trash"></i>
        Delete
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

// Test Chat Functions
const openTestChat = (botId, botTitle) => {
  currentTestBotId = botId;
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
};

const addChatMessage = (content, isUser = false) => {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${isUser ? 'user' : 'bot'}`;
  
  messageDiv.innerHTML = `
    <div class="message-avatar">
      <i class="fas fa-${isUser ? 'user' : 'robot'}"></i>
    </div>
    <div class="message-content">${content}</div>
  `;
  
  elements.testChatMessages.appendChild(messageDiv);
  elements.testChatMessages.scrollTop = elements.testChatMessages.scrollHeight;
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
        sessionId: 'test_session_' + currentTestBotId
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

const setDeleteButtonLoading = (button, loading) => {
  if (loading) {
    button.classList.add('loading');
    button.disabled = true;
  } else {
    button.classList.remove('loading');
    button.disabled = false;
  }
};

// Event Listeners
elements.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (isCreating) return;
  
  const url = elements.urlInput.value.trim();
  
  if (!url) {
    showToast('error', 'Please enter a website URL');
    return;
  }
  
  if (!validateURL(url)) {
    showToast('error', 'Please enter a valid URL');
    return;
  }
  
  setButtonLoading(true);
  
  try {
    const result = await createChatbot(url);
    
    // Store bot ID for test chat
    currentTestBotId = result.botId;
    showModal(result.title || 'Your AI Chatbot', result.embedCode);
    
    // Reset form
    elements.form.reset();
    elements.urlValidation.textContent = '';
    elements.urlValidation.className = 'url-validation';
    
    // Refresh chatbots list
    loadChatbots();
    
  } catch (error) {
    const errorMsg = error.message.includes('fetch') 
      ? 'Network error. Please check your connection and try again.'
      : error.message;
    showToast('error', errorMsg);
  } finally {
    setButtonLoading(false);
  }
});

elements.urlInput.addEventListener('input', (e) => {
  updateURLValidation(e.target.value);
});

elements.closeModal.addEventListener('click', hideModal);

elements.successModal.addEventListener('click', (e) => {
  if (e.target === elements.successModal) {
    hideModal();
  }
});

elements.copyEmbedBtn.addEventListener('click', async () => {
  const embedCode = elements.embedCode.textContent;
  const success = await copyToClipboard(embedCode);
  
  if (success) {
    showToast('success', 'Embed code copied to clipboard!');
    hideModal();
  } else {
    showToast('error', 'Failed to copy embed code');
  }
});

// Test Chat Modal Event Listeners
elements.testChatBtn.addEventListener('click', () => {
  if (currentTestBotId) {
    const botTitle = elements.chatbotTitle.textContent || 'Your AI Chatbot';
    openTestChat(currentTestBotId, botTitle);
  }
});

elements.closeChatModal.addEventListener('click', closeTestChat);

elements.testChatModal.addEventListener('click', (e) => {
  if (e.target === elements.testChatModal) {
    closeTestChat();
  }
});

elements.sendTestMessage.addEventListener('click', sendTestChatMessage);

elements.testChatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendTestChatMessage();
  }
});

// Handle chatbot card buttons (test chat, copy and delete)
elements.chatbotsGrid.addEventListener('click', async (e) => {
  // Handle test chat button
  if (e.target.closest('.test-chat-card-btn')) {
    e.preventDefault();
    const btn = e.target.closest('.test-chat-card-btn');
    const botId = btn.dataset.botId;
    const botTitle = btn.dataset.botTitle;
    
    openTestChat(botId, botTitle);
    return;
  }
  
  // Handle copy embed button
  if (e.target.closest('.copy-embed-btn')) {
    e.preventDefault();
    const btn = e.target.closest('.copy-embed-btn');
    const embedCode = decodeURIComponent(btn.dataset.embed);
    
    if (embedCode && embedCode !== 'undefined') {
      const success = await copyToClipboard(embedCode);
      
      if (success) {
        showToast('success', 'Embed code copied to clipboard!');
        
        // Visual feedback on button
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        btn.style.background = 'var(--success)';
        
        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.style.background = '';
        }, 2000);
      } else {
        showToast('error', 'Failed to copy embed code');
      }
    } else {
      showToast('error', 'No embed code available');
    }
  }
  
  // Handle delete button
  if (e.target.closest('.delete-btn')) {
    e.preventDefault();
    const btn = e.target.closest('.delete-btn');
    const botId = btn.dataset.botId;
    const botTitle = btn.dataset.botTitle;
    
    // Confirm deletion
    const confirmed = confirm(`¿Estás seguro de que quieres eliminar el chatbot "${botTitle}"?\n\nEsta acción no se puede deshacer y eliminará todos los datos asociados.`);
    
    if (confirmed) {
      // Show loading state on button
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
      btn.disabled = true;
      
      try {
        await deleteChatbot(botId);
        showToast('success', `Chatbot "${botTitle}" deleted successfully`);
        
        // Remove card from UI with animation
        const card = btn.closest('.chatbot-card');
        card.style.transform = 'translateX(100%)';
        card.style.opacity = '0';
        
        setTimeout(() => {
          card.remove();
          
          // Show empty state if no cards left
          const remainingCards = elements.chatbotsGrid.querySelectorAll('.chatbot-card');
          if (remainingCards.length === 0) {
            elements.emptyState.style.display = 'flex';
          }
        }, 300);
        
      } catch (error) {
        // Restore button state on error
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        
        const errorMsg = error.message.includes('fetch') 
          ? 'Network error. Please check your connection and try again.'
          : error.message;
        showToast('error', `Failed to delete chatbot: ${errorMsg}`);
      }
    }
  }
});

// Handle toast close buttons
document.querySelectorAll('.toast-close').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.target.closest('.toast').classList.remove('show');
  });
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideModal();
    document.querySelectorAll('.toast').forEach(toast => {
      toast.classList.remove('show');
    });
  }
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  // Load existing chatbots
  loadChatbots();
  
  // Focus URL input
  elements.urlInput.focus();
  
  // Add some initial animation delays
  const animatedElements = document.querySelectorAll('.hero-text, .chatbot-creator');
  animatedElements.forEach((el, index) => {
    el.style.animationDelay = `${index * 0.2}s`;
  });
});

// Handle connection errors and retry logic
window.addEventListener('online', () => {
  showToast('success', 'Connection restored');
  if (currentChatbots.length === 0) {
    loadChatbots();
  }
});

window.addEventListener('offline', () => {
  showToast('error', 'Connection lost. Please check your internet connection.');
});

// Performance optimization: Intersection Observer for animations
const observeIntersection = () => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animationPlayState = 'running';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  
  document.querySelectorAll('.feature-card, .chatbot-card').forEach(el => {
    el.style.animationPlayState = 'paused';
    observer.observe(el);
  });
};

// Initialize intersection observer after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(observeIntersection, 100);
});
