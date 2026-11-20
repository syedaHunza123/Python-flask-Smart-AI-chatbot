/**
 * SmartAI – Modern Intelligent Chatbot Frontend
 * Handles real-time API communication, Markdown rendering, syntax highlighting,
 * conversation management, and responsive interactions.
 */

(function () {
  'use strict';

  // ==========================================
  // Application State
  // ==========================================
  const state = {
    currentConversationId: null,
    conversations: [],
    settings: {
      model: 'google/gemini-2.5-flash',
      system_prompt: '',
      theme: 'dark',
      has_api_key: false,
      masked_api_key: ''
    },
    isGenerating: false,
    renameTargetId: null
  };

  // ==========================================
  // DOM Elements
  // ==========================================
  const elements = {
    // Layout & Navigation
    appLayout: document.querySelector('.app-layout'),
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    sidebarToggleBtn: document.getElementById('sidebarToggleBtn'),
    sidebarCloseBtn: document.getElementById('sidebarCloseBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeIcon: document.getElementById('themeIcon'),
    themeText: document.getElementById('themeText'),

    // Chat Management
    newChatBtn: document.getElementById('newChatBtn'),
    mobileNewChatBtn: document.getElementById('mobileNewChatBtn'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    chatList: document.getElementById('chatList'),
    emptyHistory: document.getElementById('emptyHistory'),
    chatCountBadge: document.getElementById('chatCountBadge'),
    clearAllChatsBtn: document.getElementById('clearAllChatsBtn'),
    activeChatTitle: document.getElementById('activeChatTitle'),

    // Top Bar & Badges
    navbarModelBadge: document.getElementById('navbarModelBadge'),
    navbarModelName: document.getElementById('navbarModelName'),
    apiStatusBadge: document.getElementById('apiStatusBadge'),
    statusBadgeText: document.getElementById('statusBadgeText'),

    // Chat Viewport
    messagesViewport: document.getElementById('messagesViewport'),
    welcomeScreen: document.getElementById('welcomeScreen'),
    demoModeAlert: document.getElementById('demoModeAlert'),
    demoAlertSettingsLink: document.getElementById('demoAlertSettingsLink'),
    messagesStream: document.getElementById('messagesStream'),
    thinkingIndicator: document.getElementById('thinkingIndicator'),
    scrollBottomBtn: document.getElementById('scrollBottomBtn'),
    inputDemoPill: document.getElementById('inputDemoPill'),

    // Input Controls
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    clearInputBtn: document.getElementById('clearInputBtn'),

    // Settings Modal
    openSettingsBtn: document.getElementById('openSettingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    settingsApiKey: document.getElementById('settingsApiKey'),
    toggleApiKeyVisBtn: document.getElementById('toggleApiKeyVisBtn'),
    keyStatusText: document.getElementById('keyStatusText'),
    testConnectionBtn: document.getElementById('testConnectionBtn'),
    settingsModelSelect: document.getElementById('settingsModelSelect'),
    customModelWrap: document.getElementById('customModelWrap'),
    settingsCustomModel: document.getElementById('settingsCustomModel'),
    settingsSystemPrompt: document.getElementById('settingsSystemPrompt'),

    // Rename Modal
    renameModal: document.getElementById('renameModal'),
    closeRenameModalBtn: document.getElementById('closeRenameModalBtn'),
    cancelRenameBtn: document.getElementById('cancelRenameBtn'),
    saveRenameBtn: document.getElementById('saveRenameBtn'),
    renameTitleInput: document.getElementById('renameTitleInput'),

    // Clear All Confirm Modal
    clearConfirmModal: document.getElementById('clearConfirmModal'),
    closeClearConfirmBtn: document.getElementById('closeClearConfirmBtn'),
    cancelClearBtn: document.getElementById('cancelClearBtn'),
    confirmClearAllBtn: document.getElementById('confirmClearAllBtn'),

    // Toast Container
    toastContainer: document.getElementById('toastContainer'),
    hljsTheme: document.getElementById('hljs-theme')
  };

  // ==========================================
  // Markdown & Syntax Highlighting Setup
  // ==========================================
  marked.setOptions({
    gfm: true,
    breaks: true,
    highlight: function (code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang }).value;
        } catch (err) {}
      }
      try {
        return hljs.highlightAuto(code).value;
      } catch (err) {
        return code;
      }
    }
  });

  // Custom renderer for code blocks with modern header & copy button
  const renderer = new marked.Renderer();
  renderer.code = function (code, lang) {
    const language = lang || 'code';
    let highlighted = code;
    try {
      if (lang && hljs.getLanguage(lang)) {
        highlighted = hljs.highlight(code, { language: lang }).value;
      } else {
        highlighted = hljs.highlightAuto(code).value;
      }
    } catch (e) {
      highlighted = code;
    }

    const safeEscapedRaw = encodeURIComponent(code);

    return `
      <div class="code-block-container">
        <div class="code-block-header">
          <span class="code-lang">${language}</span>
          <button type="button" class="copy-code-btn" data-code="${safeEscapedRaw}">
            <i class="fa-regular fa-copy"></i>
            <span>Copy</span>
          </button>
        </div>
        <pre><code class="hljs ${language}">${highlighted}</code></pre>
      </div>
    `;
  };
  marked.use({ renderer });

  function renderMarkdown(content) {
    const rawHtml = marked.parse(content || '');
    return DOMPurify.sanitize(rawHtml, {
      ADD_TAGS: ['button', 'i', 'span'],
      ADD_ATTR: ['data-code', 'class', 'target', 'rel']
    });
  }

  // ==========================================
  // Toast Notifications
  // ==========================================
  function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconClass = 'fa-solid fa-circle-info';
    if (type === 'success') iconClass = 'fa-solid fa-circle-check';
    if (type === 'error') iconClass = 'fa-solid fa-circle-exclamation';

    toast.innerHTML = `
      <span class="toast-icon"><i class="${iconClass}"></i></span>
      <span class="toast-msg">${message}</span>
      <button class="toast-close" title="Close"><i class="fa-solid fa-xmark"></i></button>
    `;

    elements.toastContainer.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => toast.remove());

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        toast.style.transition = 'all 0.25s ease';
        setTimeout(() => toast.remove(), 250);
      }
    }, duration);
  }

  // ==========================================
  // Theme Management
  // ==========================================
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    state.settings.theme = theme;

    if (theme === 'light') {
      elements.themeIcon.className = 'fa-solid fa-sun';
      elements.themeText.textContent = 'Light';
      if (elements.hljsTheme) {
        elements.hljsTheme.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
      }
    } else {
      elements.themeIcon.className = 'fa-solid fa-moon';
      elements.themeText.textContent = 'Dark';
      if (elements.hljsTheme) {
        elements.hljsTheme.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';
      }
    }

    // Update settings radio button if modal open
    const themeRadio = document.querySelector(`input[name="themeRadio"][value="${theme}"]`);
    if (themeRadio) themeRadio.checked = true;

    localStorage.setItem('smartai_theme', theme);
  }

  function toggleTheme() {
    const newTheme = state.settings.theme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    // Sync with backend
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: newTheme })
    }).catch(() => {});
  }

  // ==========================================
  // Settings & Health APIs
  // ==========================================
  async function loadSettings() {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        state.settings = { ...state.settings, ...data };

        // Apply theme from server (or fallback to local)
        const savedTheme = localStorage.getItem('smartai_theme') || data.theme || 'dark';
        applyTheme(savedTheme);

        // Update model badge in navbar
        updateModelDisplay(data.model);

        // Populate settings form
        populateSettingsModal(data);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  async function checkApiHealth() {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        updateApiStatusUI(data.has_api_key);
      }
    } catch (err) {
      updateApiStatusUI(false);
    }
  }

  function updateApiStatusUI(hasApiKey) {
    state.settings.has_api_key = hasApiKey;
    if (hasApiKey) {
      elements.apiStatusBadge.className = 'api-status-badge live';
      elements.statusBadgeText.textContent = 'Live AI Active';
      elements.demoModeAlert.classList.add('hidden');
      elements.inputDemoPill.classList.add('hidden');
      elements.keyStatusText.textContent = 'Valid OpenRouter key configured';
      elements.keyStatusText.style.color = 'var(--success-color)';
    } else {
      elements.apiStatusBadge.className = 'api-status-badge demo';
      elements.statusBadgeText.textContent = 'Demo Mode (No Key)';
      elements.demoModeAlert.classList.remove('hidden');
      elements.inputDemoPill.classList.remove('hidden');
      elements.keyStatusText.textContent = 'No key configured (Running in Demo Mode)';
      elements.keyStatusText.style.color = 'var(--warning-color)';
    }
  }

  function updateModelDisplay(modelName) {
    if (!modelName) return;
    let label = modelName;
    if (modelName.includes('gemini-2.5-flash')) label = 'Gemini 2.5 Flash';
    else if (modelName.includes('gemini-2.0-flash')) label = 'Gemini 2.0 Flash';
    else if (modelName.includes('deepseek')) label = 'DeepSeek V3';
    else if (modelName.includes('gpt-4o-mini')) label = 'GPT-4o Mini';
    else if (modelName.includes('claude-3.5-haiku')) label = 'Claude 3.5 Haiku';
    else if (modelName.includes('llama-3.3')) label = 'Llama 3.3 70B';
    else if (modelName.length > 20) label = modelName.split('/').pop() || modelName;

    elements.navbarModelName.textContent = label;
  }

  function populateSettingsModal(data) {
    elements.settingsSystemPrompt.value = data.system_prompt || '';

    // Model select
    let found = false;
    for (let opt of elements.settingsModelSelect.options) {
      if (opt.value === data.model) {
        opt.selected = true;
        found = true;
        break;
      }
    }
    if (!found) {
      elements.settingsModelSelect.value = 'custom';
      elements.customModelWrap.classList.remove('hidden');
      elements.settingsCustomModel.value = data.model || '';
    } else {
      elements.customModelWrap.classList.add('hidden');
    }

    // API Key placeholder
    if (data.has_api_key) {
      elements.settingsApiKey.placeholder = data.masked_api_key || '••••••••••••••••';
    } else {
      elements.settingsApiKey.placeholder = 'Paste your OpenRouter key (sk-or-v1-...)';
    }
  }

  // ==========================================
  // Conversations Management
  // ==========================================
  async function loadConversations(searchQuery = '') {
    try {
      let url = '/api/chats';
      if (searchQuery.trim()) {
        url += `?q=${encodeURIComponent(searchQuery.trim())}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        state.conversations = data.chats || [];
        renderConversationList();
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      elements.chatList.innerHTML = `<li class="loading-chats-state">Error loading conversations</li>`;
    }
  }

  function renderConversationList() {
    elements.chatCountBadge.textContent = state.conversations.length;

    if (state.conversations.length === 0) {
      elements.chatList.innerHTML = '';
      elements.emptyHistory.classList.remove('hidden');
      return;
    }

    elements.emptyHistory.classList.add('hidden');
    elements.chatList.innerHTML = '';

    state.conversations.forEach((chat) => {
      const li = document.createElement('li');
      li.className = `chat-list-item ${chat.id === state.currentConversationId ? 'active' : ''}`;
      li.dataset.id = chat.id;

      li.innerHTML = `
        <i class="fa-regular fa-message chat-item-icon"></i>
        <span class="chat-item-title" title="${escapeHtml(chat.title)}">${escapeHtml(chat.title)}</span>
        <div class="chat-item-actions">
          <button class="chat-action-btn edit-btn" title="Rename"><i class="fa-solid fa-pen"></i></button>
          <button class="chat-action-btn delete-btn" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      `;

      // Select chat
      li.addEventListener('click', (e) => {
        if (e.target.closest('.chat-action-btn')) return;
        selectConversation(chat.id);
        closeMobileSidebar();
      });

      // Edit / Rename button
      const editBtn = li.querySelector('.edit-btn');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openRenameModal(chat.id, chat.title);
      });

      // Delete button
      const delBtn = li.querySelector('.delete-btn');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteConversation(chat.id);
      });

      elements.chatList.appendChild(li);
    });
  }

  async function selectConversation(id) {
    if (state.isGenerating) return;
    state.currentConversationId = id;

    // Highlight active in list
    document.querySelectorAll('.chat-list-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.id === id);
    });

    try {
      const res = await fetch(`/api/chats/${id}`);
      if (res.ok) {
        const data = await res.json();
        elements.activeChatTitle.textContent = data.conversation.title || 'Chat';
        renderMessages(data.messages || []);
      } else {
        showToast('Conversation not found', 'error');
        startNewChat();
      }
    } catch (err) {
      showToast('Error loading conversation messages', 'error');
    }
  }

  function startNewChat() {
    if (state.isGenerating) return;
    state.currentConversationId = null;
    elements.activeChatTitle.textContent = 'New Chat';
    elements.messagesStream.innerHTML = '';
    elements.messagesStream.classList.add('hidden');
    elements.welcomeScreen.classList.remove('hidden');

    document.querySelectorAll('.chat-list-item').forEach((item) => {
      item.classList.remove('active');
    });

    elements.messageInput.value = '';
    elements.messageInput.style.height = 'auto';
    elements.sendBtn.disabled = true;
    elements.clearInputBtn.classList.add('hidden');
    elements.messageInput.focus();
    closeMobileSidebar();
  }

  async function deleteConversation(id) {
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      const res = await fetch(`/api/chats/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Conversation deleted', 'info');
        state.conversations = state.conversations.filter((c) => c.id !== id);
        renderConversationList();

        if (state.currentConversationId === id) {
          startNewChat();
        }
      } else {
        showToast('Failed to delete conversation', 'error');
      }
    } catch (err) {
      showToast('Network error while deleting', 'error');
    }
  }

  async function clearAllConversations() {
    try {
      const res = await fetch('/api/chats', { method: 'DELETE' });
      if (res.ok) {
        showToast('All conversations cleared', 'info');
        state.conversations = [];
        renderConversationList();
        startNewChat();
        closeModal(elements.clearConfirmModal);
      } else {
        showToast('Failed to clear conversations', 'error');
      }
    } catch (err) {
      showToast('Error clearing chat history', 'error');
    }
  }

  // ==========================================
  // Render Messages
  // ==========================================
  function renderMessages(messages) {
    elements.messagesStream.innerHTML = '';

    if (!messages || messages.length === 0) {
      elements.messagesStream.classList.add('hidden');
      elements.welcomeScreen.classList.remove('hidden');
      return;
    }

    elements.welcomeScreen.classList.add('hidden');
    elements.messagesStream.classList.remove('hidden');

    messages.forEach((msg) => {
      appendMessageToDOM(msg, false);
    });

    scrollToBottom();
  }

  function appendMessageToDOM(msg, shouldScroll = true) {
    elements.welcomeScreen.classList.add('hidden');
    elements.messagesStream.classList.remove('hidden');

    const isUser = msg.role === 'user';
    const row = document.createElement('div');
    row.className = `message-row ${isUser ? 'user-row' : 'ai-row'}`;
    row.dataset.id = msg.id;

    const timeFormatted = formatTime(msg.created_at);

    if (isUser) {
      row.innerHTML = `
        <div class="avatar user-avatar"><i class="fa-regular fa-user"></i></div>
        <div class="message-bubble-wrapper">
          <div class="message-bubble">${escapeHtml(msg.content)}</div>
          <div class="message-meta-row">
            <span>${timeFormatted}</span>
            <div class="message-actions">
              <button class="msg-action-btn delete-msg-btn" title="Delete message"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </div>
        </div>
      `;
    } else {
      const parsedMarkdown = renderMarkdown(msg.content);
      row.innerHTML = `
        <div class="avatar ai-avatar"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
        <div class="message-bubble-wrapper">
          <div class="message-bubble">${parsedMarkdown}</div>
          <div class="message-meta-row">
            <span>SmartAI • ${timeFormatted}</span>
            <div class="message-actions">
              <button class="msg-action-btn copy-msg-btn" title="Copy response"><i class="fa-regular fa-copy"></i> Copy</button>
              <button class="msg-action-btn regen-msg-btn" title="Regenerate response"><i class="fa-solid fa-rotate-right"></i> Regenerate</button>
              <button class="msg-action-btn delete-msg-btn" title="Delete message"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </div>
        </div>
      `;
    }

    // Attach event listeners for message actions
    const deleteBtn = row.querySelector('.delete-msg-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => deleteSingleMessage(msg.id, row));
    }

    const copyBtn = row.querySelector('.copy-msg-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(msg.content).then(() => {
          copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
          }, 2000);
        });
      });
    }

    const regenBtn = row.querySelector('.regen-msg-btn');
    if (regenBtn) {
      regenBtn.addEventListener('click', () => regenerateAssistantResponse(msg.id));
    }

    // Setup Copy Code buttons inside code blocks
    row.querySelectorAll('.copy-code-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rawCode = decodeURIComponent(btn.dataset.code || '');
        navigator.clipboard.writeText(rawCode).then(() => {
          btn.innerHTML = '<i class="fa-solid fa-check"></i><span>Copied!</span>';
          setTimeout(() => {
            btn.innerHTML = '<i class="fa-regular fa-copy"></i><span>Copy</span>';
          }, 2000);
        });
      });
    });

    elements.messagesStream.appendChild(row);

    if (shouldScroll) {
      scrollToBottom();
    }
  }

  // ==========================================
  // Chat Actions: Send & Regenerate
  // ==========================================
  async function sendMessage(textToSend) {
    const text = (textToSend || elements.messageInput.value).trim();
    if (!text || state.isGenerating) return;

    state.isGenerating = true;
    updateSendButtonState();

    // Reset input
    elements.messageInput.value = '';
    elements.messageInput.style.height = 'auto';
    elements.clearInputBtn.classList.add('hidden');

    // Display temporary user message in UI immediately
    const tempUserMsg = {
      id: 'temp-' + Date.now(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    };
    appendMessageToDOM(tempUserMsg, true);

    // Show thinking indicator
    showThinking(true);

    try {
      const payload = {
        message: text,
        conversation_id: state.currentConversationId,
        model: state.settings.model
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      showThinking(false);

      if (res.ok && data.success) {
        state.currentConversationId = data.conversation_id;
        elements.activeChatTitle.textContent = data.title;

        // Replace or append AI message
        appendMessageToDOM(data.message, true);

        // Refresh conversation list to show new or updated chat
        await loadConversations();

        // Highlight in sidebar
        document.querySelectorAll('.chat-list-item').forEach((item) => {
          item.classList.toggle('active', item.dataset.id === data.conversation_id);
        });
      } else {
        const errorMsg = data.error || 'Failed to get AI response. Please try again.';
        showToast(errorMsg, 'error', 5000);

        // Append error bubble
        appendErrorBubble(errorMsg);
      }
    } catch (err) {
      showThinking(false);
      showToast('Network error contacting backend server', 'error');
      appendErrorBubble('Could not connect to the SmartAI server.');
    } finally {
      state.isGenerating = false;
      updateSendButtonState();
      elements.messageInput.focus();
    }
  }

  async function regenerateAssistantResponse(messageId) {
    if (state.isGenerating) return;
    state.isGenerating = true;
    updateSendButtonState();

    const targetRow = document.querySelector(`.message-row[data-id="${messageId}"]`);
    if (targetRow) {
      targetRow.style.opacity = '0.5';
    }

    showThinking(true, 'SmartAI is regenerating response...');

    try {
      const res = await fetch(`/api/messages/${messageId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: state.settings.model })
      });

      const data = await res.json();
      showThinking(false);

      if (res.ok && data.success) {
        // Reload full conversation to reflect clean updated state
        await selectConversation(state.currentConversationId);
        showToast('Response regenerated', 'success');
      } else {
        showToast(data.error || 'Failed to regenerate response', 'error');
        if (targetRow) targetRow.style.opacity = '1';
      }
    } catch (err) {
      showThinking(false);
      showToast('Network error during regeneration', 'error');
      if (targetRow) targetRow.style.opacity = '1';
    } finally {
      state.isGenerating = false;
      updateSendButtonState();
    }
  }

  async function deleteSingleMessage(messageId, elementRow) {
    if (!confirm('Delete this message?')) return;

    try {
      const res = await fetch(`/api/messages/${messageId}`, { method: 'DELETE' });
      if (res.ok) {
        elementRow.remove();
        showToast('Message removed', 'info');

        // If no messages left, show welcome screen
        if (elements.messagesStream.children.length === 0) {
          elements.messagesStream.classList.add('hidden');
          elements.welcomeScreen.classList.remove('hidden');
        }
      } else {
        showToast('Failed to delete message', 'error');
      }
    } catch (err) {
      showToast('Error deleting message', 'error');
    }
  }

  function appendErrorBubble(errorText) {
    const row = document.createElement('div');
    row.className = 'message-row ai-row';
    row.innerHTML = `
      <div class="avatar ai-avatar" style="background: var(--danger-color);"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <div class="message-bubble-wrapper">
        <div class="message-bubble" style="border-color: var(--danger-color); background-color: var(--danger-bg); color: var(--danger-color);">
          <strong>Request Failed:</strong> ${escapeHtml(errorText)}
        </div>
      </div>
    `;
    elements.messagesStream.appendChild(row);
    scrollToBottom();
  }

  function showThinking(show, customText) {
    if (show) {
      if (elements.thinkingStatusText) {
        elements.thinkingStatusText.textContent = customText || 'SmartAI is generating a response...';
      }
      if (elements.thinkingIndicator) {
        elements.thinkingIndicator.classList.remove('hidden');
      }
      scrollToBottom();
    } else {
      if (elements.thinkingIndicator) {
        elements.thinkingIndicator.classList.add('hidden');
      }
    }
  }

  // ==========================================
  // Rename Conversation Modal
  // ==========================================
  function openRenameModal(id, currentTitle) {
    state.renameTargetId = id;
    elements.renameTitleInput.value = currentTitle;
    openModal(elements.renameModal);
    setTimeout(() => {
      elements.renameTitleInput.focus();
      elements.renameTitleInput.select();
    }, 100);
  }

  async function saveRenameConversation() {
    const newTitle = elements.renameTitleInput.value.trim();
    if (!newTitle || !state.renameTargetId) return;

    try {
      const res = await fetch(`/api/chats/${state.renameTargetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });

      if (res.ok) {
        showToast('Conversation renamed', 'success');
        closeModal(elements.renameModal);

        // Update active title if current
        if (state.currentConversationId === state.renameTargetId) {
          elements.activeChatTitle.textContent = newTitle;
        }

        // Refresh list
        loadConversations();
      } else {
        showToast('Failed to rename conversation', 'error');
      }
    } catch (err) {
      showToast('Error renaming conversation', 'error');
    }
  }

  // ==========================================
  // Settings Modal Handlers
  // ==========================================
  async function saveSettings() {
    let selectedModel = elements.settingsModelSelect.value;
    if (selectedModel === 'custom') {
      selectedModel = elements.settingsCustomModel.value.trim();
      if (!selectedModel) {
        showToast('Please enter a custom model ID', 'error');
        return;
      }
    }

    const newApiKey = elements.settingsApiKey.value.trim();
    const systemPrompt = elements.settingsSystemPrompt.value.trim();
    const themeChecked = document.querySelector('input[name="themeRadio"]:checked');
    const selectedTheme = themeChecked ? themeChecked.value : state.settings.theme;

    const payload = {
      model: selectedModel,
      system_prompt: systemPrompt,
      theme: selectedTheme
    };

    if (newApiKey) {
      payload.api_key = newApiKey;
    }

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast('Settings saved successfully', 'success');
        closeModal(elements.settingsModal);

        state.settings.model = selectedModel;
        state.settings.system_prompt = systemPrompt;
        updateModelDisplay(selectedModel);
        applyTheme(selectedTheme);

        // Re-check health to update badge
        await checkApiHealth();
      } else {
        showToast('Failed to save settings', 'error');
      }
    } catch (err) {
      showToast('Error saving settings', 'error');
    }
  }

  async function testApiConnection() {
    elements.testConnectionBtn.disabled = true;
    elements.testConnectionBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing...';

    // If an unsaved key was entered, save it first
    const inputKey = elements.settingsApiKey.value.trim();
    if (inputKey) {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: inputKey })
      });
    }

    try {
      const res = await fetch('/api/health?test=true');
      const data = await res.json();

      if (data.connection_test && data.connection_test.success) {
        showToast('Connection Successful! API Key is active.', 'success');
        elements.keyStatusText.textContent = 'API Key is active and verified.';
        elements.keyStatusText.style.color = 'var(--success-color)';
        updateApiStatusUI(true);
      } else {
        const msg = data.connection_test ? data.connection_test.message : 'Connection test failed';
        showToast(msg, 'error');
        elements.keyStatusText.textContent = msg;
        elements.keyStatusText.style.color = 'var(--danger-color)';
      }
    } catch (err) {
      showToast('Connection test request failed', 'error');
    } finally {
      elements.testConnectionBtn.disabled = false;
      elements.testConnectionBtn.innerHTML = '<i class="fa-solid fa-plug"></i> Test Connection';
    }
  }

  // ==========================================
  // Modal Utilities
  // ==========================================
  function openModal(modalEl) {
    modalEl.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modalEl) {
    modalEl.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // ==========================================
  // Helper Functions
  // ==========================================
  function updateSendButtonState() {
    const hasText = elements.messageInput.value.trim().length > 0;
    elements.sendBtn.disabled = !hasText || state.isGenerating;
    elements.clearInputBtn.classList.toggle('hidden', !hasText);
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      elements.messagesViewport.scrollTop = elements.messagesViewport.scrollHeight;
    });
  }

  function formatTime(isoString) {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function closeMobileSidebar() {
    if (window.innerWidth <= 768) {
      elements.sidebar.classList.remove('mobile-open');
      elements.sidebarOverlay.classList.remove('active');
    }
  }

  // ==========================================
  // Event Listeners Initialization
  // ==========================================
  function initEventListeners() {
    // Mobile & Desktop Sidebar Toggles
    elements.sidebarToggleBtn.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        elements.sidebar.classList.toggle('mobile-open');
        elements.sidebarOverlay.classList.toggle('active');
      } else {
        elements.sidebar.classList.toggle('collapsed');
      }
    });

    elements.sidebarCloseBtn.addEventListener('click', closeMobileSidebar);
    elements.sidebarOverlay.addEventListener('click', closeMobileSidebar);

    // New Chat buttons
    elements.newChatBtn.addEventListener('click', startNewChat);
    elements.mobileNewChatBtn.addEventListener('click', startNewChat);

    // Prompt Cards Click
    document.querySelectorAll('.prompt-card').forEach((card) => {
      card.addEventListener('click', () => {
        const prompt = card.dataset.prompt;
        if (prompt) {
          sendMessage(prompt);
        }
      });
    });

    // Textarea input handling (Auto-expand & Send on Enter)
    elements.messageInput.addEventListener('input', () => {
      elements.messageInput.style.height = 'auto';
      elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 180)}px`;
      updateSendButtonState();
    });

    elements.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Send & Clear Buttons
    elements.sendBtn.addEventListener('click', () => sendMessage());
    elements.clearInputBtn.addEventListener('click', () => {
      elements.messageInput.value = '';
      elements.messageInput.style.height = 'auto';
      updateSendButtonState();
      elements.messageInput.focus();
    });

    // Search input
    let searchDebounceTimer = null;
    elements.searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      elements.clearSearchBtn.classList.toggle('hidden', !val);
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        loadConversations(val);
      }, 250);
    });

    elements.clearSearchBtn.addEventListener('click', () => {
      elements.searchInput.value = '';
      elements.clearSearchBtn.classList.add('hidden');
      loadConversations();
    });

    // Theme toggle
    elements.themeToggleBtn.addEventListener('click', toggleTheme);

    // Settings Modal
    elements.openSettingsBtn.addEventListener('click', () => openModal(elements.settingsModal));
    elements.navbarModelBadge.addEventListener('click', () => openModal(elements.settingsModal));
    elements.apiStatusBadge.addEventListener('click', () => openModal(elements.settingsModal));
    elements.demoAlertSettingsLink.addEventListener('click', () => openModal(elements.settingsModal));
    elements.closeSettingsBtn.addEventListener('click', () => closeModal(elements.settingsModal));
    elements.cancelSettingsBtn.addEventListener('click', () => closeModal(elements.settingsModal));
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    elements.testConnectionBtn.addEventListener('click', testApiConnection);

    // Toggle API Key visibility
    elements.toggleApiKeyVisBtn.addEventListener('click', () => {
      const isPass = elements.settingsApiKey.type === 'password';
      elements.settingsApiKey.type = isPass ? 'text' : 'password';
      elements.toggleApiKeyVisBtn.innerHTML = isPass ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
    });

    // Model select change (show custom input if needed)
    elements.settingsModelSelect.addEventListener('change', (e) => {
      elements.customModelWrap.classList.toggle('hidden', e.target.value !== 'custom');
    });

    // Rename Modal
    elements.closeRenameModalBtn.addEventListener('click', () => closeModal(elements.renameModal));
    elements.cancelRenameBtn.addEventListener('click', () => closeModal(elements.renameModal));
    elements.saveRenameBtn.addEventListener('click', saveRenameConversation);
    elements.renameTitleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveRenameConversation();
    });

    // Clear All Chats Confirmation Modal
    elements.clearAllChatsBtn.addEventListener('click', () => {
      if (state.conversations.length === 0) {
        showToast('No conversations to clear', 'info');
        return;
      }
      openModal(elements.clearConfirmModal);
    });
    elements.closeClearConfirmBtn.addEventListener('click', () => closeModal(elements.clearConfirmModal));
    elements.cancelClearBtn.addEventListener('click', () => closeModal(elements.clearConfirmModal));
    elements.confirmClearAllBtn.addEventListener('click', clearAllConversations);

    // Scroll to bottom button visibility & action
    elements.messagesViewport.addEventListener('scroll', () => {
      const fromBottom = elements.messagesViewport.scrollHeight - elements.messagesViewport.scrollTop - elements.messagesViewport.clientHeight;
      elements.scrollBottomBtn.classList.toggle('hidden', fromBottom < 120);
    });
    elements.scrollBottomBtn.addEventListener('click', scrollToBottom);

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl + K or Cmd + K -> New Chat
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        startNewChat();
      }
      // Escape closes open modals
      if (e.key === 'Escape') {
        closeModal(elements.settingsModal);
        closeModal(elements.renameModal);
        closeModal(elements.clearConfirmModal);
      }
    });

    // Close modals on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          closeModal(backdrop);
        }
      });
    });
  }

  // ==========================================
  // Initialization
  // ==========================================
  async function init() {
    initEventListeners();
    await loadSettings();
    await checkApiHealth();
    await loadConversations();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
