# SmartAI – Modern Intelligent AI Chatbot

A modern, responsive, and full-featured AI Chatbot Web Application inspired by ChatGPT. Built with a Python Flask backend, SQLite database, and OpenRouter API integration.

![SmartAI Interface](https://img.shields.io/badge/Status-Fully%20Functional-brightgreen)
![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)
![Flask](https://img.shields.io/badge/Flask-3.x-black.svg)
![Database](https://img.shields.io/badge/SQLite-Database-lightgrey)

---

## ✨ Features

- **ChatGPT-Inspired UI/UX**:
  - Clean and minimal interface with light and dark mode toggles.
  - Responsive design optimized for desktop, tablet, and mobile devices.
  - Smooth animations, rounded message bubbles, and professional icons.
  - Full Markdown rendering (tables, blockquotes, lists, headings) with syntax-highlighted code blocks and 1-click **Copy Code** buttons.

- **Intelligent Multi-Turn Conversations**:
  - Context retention across messages in the same conversation.
  - Auto-generated chat titles based on prompt content.
  - Message actions: **Copy response**, **Regenerate response**, and **Delete message**.

- **OpenRouter AI Integration & Fallback Demo Mode**:
  - Connects to any OpenRouter AI model (e.g. `google/gemini-2.0-flash-001`, `deepseek/deepseek-chat`, `meta-llama/llama-3.3-70b-instruct`, `openai/gpt-4o-mini`, etc.).
  - Configurable directly via `.env` or in-app **Settings** modal.
  - **Graceful Demo Mode**: If no API key is provided, clearly indicates Demo Mode and provides intelligent, structured responses without pretending to be a live API.

- **Full Chat History & Persistence**:
  - SQLite database storing conversations, messages, and settings.
  - Real-time conversation search.
  - Rename conversations and delete individual chats or clear entire history.

---

## 📁 Project Structure

```text
smart-ai-chatbot/
│
├── app.py                  # Flask backend & OpenRouter API routes
├── database.db             # SQLite database (auto-created on startup)
├── requirements.txt        # Python dependencies
├── .env                    # Environment variables (API Key, Model, Port)
├── .env.example            # Environment variables template
├── .gitignore              # Git ignore rules
├── README.md               # Documentation & setup guide
│
├── templates/
│   └── index.html          # Chat interface template
│
└── static/
    ├── css/
    │   └── style.css       # Full styling (dark/light themes, animations)
    ├── js/
    │   └── script.js       # Client logic, Markdown parsing, and API calls
    └── images/             # Static images directory
```

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have Python 3.9+ installed on your system. Check with:
```bash
python --version
```

### 2. Install Dependencies
Install all required Python packages using pip:
```bash
pip install -r requirements.txt
```

### 3. Configure OpenRouter API Key

#### Option A: In the `.env` file
1. Copy `.env.example` to `.env` (already created for you).
2. Open `.env` and add your OpenRouter API key:
   ```env
   OPENROUTER_API_KEY=sk-or-v1-your-key-here
   OPENROUTER_MODEL=google/gemini-2.0-flash-001
   ```
   *(Get your free or paid key at [https://openrouter.ai/keys](https://openrouter.ai/keys))*

#### Option B: In the Web Interface
1. Launch the application.
2. Click **Settings** in the bottom-left sidebar.
3. Paste your OpenRouter API key into the key field.
4. Click **Test Connection** and then **Save Settings**.

> **Note:** If no key is configured, SmartAI automatically runs in **Demo Mode**, allowing you to test the UI, search, conversation history, and sample prompts immediately.

---

## 🏃 Running the Application

Run the Flask server:
```bash
python app.py
```

Then open your browser and navigate to:
```
http://127.0.0.1:5000
```

---

## 🔌 API Endpoints Reference

| Endpoint | Method | Description |
|---|---|---|
| `GET /` | GET | Main web application UI |
| `POST /api/chat` | POST | Send user message, get AI response, save to DB |
| `GET /api/chats` | GET | List all conversations (supports `?q=search`) |
| `POST /api/chats` | POST | Create a new conversation |
| `GET /api/chats/<id>` | GET | Retrieve conversation messages |
| `PUT /api/chats/<id>` | PUT | Rename conversation title |
| `DELETE /api/chats/<id>` | DELETE | Delete single conversation |
| `DELETE /api/chats` | DELETE | Clear all conversations |
| `DELETE /api/messages/<id>` | DELETE | Delete a specific message |
| `POST /api/messages/<id>/regenerate` | POST | Regenerate AI response |
| `GET /api/settings` | GET | Get current model, theme, & key status |
| `POST /api/settings` | POST | Save updated settings |
| `GET /api/health` | GET | Health status & optional connection test |

---

## ⌨️ Keyboard Shortcuts

- `Enter`: Send message
- `Shift + Enter`: Insert new line in input
- `Ctrl + K`: Open a new chat
- `Esc`: Close open modal windows
