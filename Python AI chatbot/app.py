"""
SmartAI - Intelligent AI Chatbot
Flask Backend Application with OpenRouter API Integration & SQLite Database
"""

import os
import sqlite3
import uuid
import datetime
import requests
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'smartai-secret-key-development')

# Path to SQLite database
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATABASE_PATH = os.path.join(BASE_DIR, 'database.db')

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = os.getenv('OPENROUTER_MODEL', 'google/gemini-2.5-flash')
DEFAULT_SYSTEM_PROMPT = (
    "You are SmartAI, a modern, highly capable, and intelligent AI assistant. "
    "Provide clear, accurate, and insightful answers. Use Markdown formatting for headings, "
    "bullet points, bold text, and code blocks. When providing code, always include the language identifier."
)


# ==========================================
# Database Helpers
# ==========================================

def get_db_connection():
    """Create and return a database connection with dict-like row access."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Initialize database tables if they do not exist."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Conversations table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Messages table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
        )
    ''')

    # Settings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    ''')

    # Default settings initialization if empty
    cursor.execute("SELECT value FROM settings WHERE key = 'model'")
    if not cursor.fetchone():
        cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('model', ?)", (DEFAULT_MODEL,))

    cursor.execute("SELECT value FROM settings WHERE key = 'system_prompt'")
    if not cursor.fetchone():
        cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('system_prompt', ?)", (DEFAULT_SYSTEM_PROMPT,))

    cursor.execute("SELECT value FROM settings WHERE key = 'theme'")
    if not cursor.fetchone():
        cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', 'dark')")

    conn.commit()
    conn.close()


def get_setting(key, default=None):
    """Retrieve a setting from database, falling back to environment variable or default."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
        row = cursor.fetchone()
        conn.close()
        if row and row['value']:
            return row['value']
    except Exception:
        pass

    # Check environment variable
    env_map = {
        'api_key': 'OPENROUTER_API_KEY',
        'model': 'OPENROUTER_MODEL'
    }
    env_var = env_map.get(key)
    if env_var and os.getenv(env_var):
        return os.getenv(env_var)

    return default


def set_setting(key, value):
    """Save or update a setting in the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, str(value)))
    conn.commit()
    conn.close()


def get_active_api_key():
    """Retrieve the OpenRouter API key from DB or .env."""
    key = get_setting('api_key')
    if key and key.strip() and key.strip() != 'your_openrouter_api_key_here':
        return key.strip()
    env_key = os.getenv('OPENROUTER_API_KEY', '').strip()
    if env_key and env_key != 'your_openrouter_api_key_here':
        return env_key
    return None


def generate_title_from_text(text):
    """Generate a clean chat title from user's first prompt."""
    lines = text.strip().split('\n')
    first_line = lines[0].strip()
    words = first_line.split()
    if len(words) > 6:
        title = " ".join(words[:6]) + "..."
    else:
        title = first_line
    return title[:45] if title else "New Conversation"


# ==========================================
# OpenRouter API Integration & Demo Fallback
# ==========================================

def get_demo_response(user_message, system_prompt):
    """
    Clearly labeled intelligent demo mode response when OpenRouter API key is not configured.
    Provides helpful, rich responses for common prompts while informing user how to configure API key.
    """
    msg_lower = user_message.lower()

    if "python" in msg_lower or "decorator" in msg_lower:
        content = (
            "### Python Programming: Decorators Explained\n\n"
            "In Python, a **decorator** is a design pattern that allows you to dynamically modify or extend "
            "the behavior of a function or method without modifying its actual source code.\n\n"
            "#### How Decorators Work\n"
            "Under the hood, functions in Python are **first-class citizens**—they can be passed as arguments, "
            "assigned to variables, and returned from other functions.\n\n"
            "```python\n"
            "import time\n\n"
            "def timer_decorator(func):\n"
            "    \"\"\"Decorator that measures function execution time.\"\"\"\n"
            "    def wrapper(*args, **kwargs):\n"
            "        start_time = time.time()\n"
            "        result = func(*args, **kwargs)\n"
            "        duration = time.time() - start_time\n"
            "        print(f\"⏱️ '{func.__name__}' took {duration:.4f} seconds\")\n"
            "        return result\n"
            "    return wrapper\n\n"
            "@timer_decorator\n"
            "def compute_heavy_task(n):\n"
            "    return sum(i * i for i in range(n))\n\n"
            "# Example execution\n"
            "print(compute_heavy_task(1_000_000))\n"
            "```\n\n"
            "#### Key Benefits:\n"
            "- **Code Reusability**: Apply cross-cutting concerns (logging, timing, caching, auth) easily.\n"
            "- **Separation of Concerns**: Keep business logic clean and isolated from auxiliary tasks."
        )
    elif "email" in msg_lower or "interview" in msg_lower:
        content = (
            "### Professional Interview Follow-Up Email\n\n"
            "Here is a polished follow-up email template tailored to make a memorable, professional impression:\n\n"
            "---\n"
            "**Subject:** Thank You – [Your Full Name] – [Job Title] Interview Follow-up\n\n"
            "Dear [Interviewer's Name],\n\n"
            "Thank you very much for taking the time to speak with me today about the **[Job Title]** position at **[Company Name]**.\n\n"
            "I genuinely enjoyed learning more about your team's current focus on [mention a specific topic or project discussed]. Our conversation confirmed my strong excitement about the role and how my background in [mention 1-2 key skills] can directly support your team's goals.\n\n"
            "Please don't hesitate to reach out if you need any additional portfolio samples or references from my end. I look forward to hearing about the next steps.\n\n"
            "Best regards,\n\n"
            "**[Your Full Name]**  \n"
            "[Your Phone Number] | [Your LinkedIn Profile URL]\n"
            "---"
        )
    elif "javascript" in msg_lower or "promise" in msg_lower or "async" in msg_lower:
        content = (
            "### JavaScript: Async/Await vs. Promises Explained\n\n"
            "Both **Promises** and **Async/Await** handle asynchronous operations in JavaScript (like fetching API data or reading files), but `async/await` is modern syntactic sugar built directly on top of Promises to make asynchronous code read like synchronous code.\n\n"
            "#### 1. Traditional Promises (`.then()` / `.catch()`)\n"
            "```javascript\n"
            "function fetchUserData(userId) {\n"
            "  fetch(`https://jsonplaceholder.typicode.com/users/${userId}`)\n"
            "    .then(response => {\n"
            "      if (!response.ok) throw new Error('Network error');\n"
            "      return response.json();\n"
            "    })\n"
            "    .then(data => console.log('User Name:', data.name))\n"
            "    .catch(error => console.error('Fetch Failed:', error));\n"
            "}\n"
            "```\n\n"
            "#### 2. Modern Async / Await Syntax (Recommended)\n"
            "```javascript\n"
            "async function fetchUserDataAsync(userId) {\n"
            "  try {\n"
            "    const response = await fetch(`https://jsonplaceholder.typicode.com/users/${userId}`);\n"
            "    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);\n"
            "    const data = await response.json();\n"
            "    console.log('User Name:', data.name);\n"
            "    return data;\n"
            "  } catch (error) {\n"
            "    console.error('Fetch Failed:', error.message);\n"
            "  }\n"
            "}\n"
            "```\n\n"
            "#### Summary Comparison:\n"
            "| Feature | Promises | Async / Await |\n"
            "|---|---|---|\n"
            "| Readability | Can lead to nested `.then()` chains | Flat, linear, easy to follow |\n"
            "| Error Handling | `.catch()` handler | Standard `try / catch` blocks |\n"
            "| Debugging | Stack traces can be jumpy | Natural step-by-step debugging |"
        )
    elif "startup" in msg_lower or "idea" in msg_lower or "creative" in msg_lower:
        content = (
            "### 5 Innovative Sustainable Tech Startup Ideas\n\n"
            "Here are 5 forward-thinking business ideas at the intersection of AI, sustainability, and technology:\n\n"
            "1. **⚡ EcoGrid AI – Smart Commercial Energy Optimizer**\n"
            "   - *Concept*: IoT sensors combined with predictive machine learning to dynamically route green solar/wind power into commercial HVAC and battery units during peak pricing windows.\n\n"
            "2. **📦 ReWrap – Circular Return Logistics Platform**\n"
            "   - *Concept*: RFID-tagged reusable packaging network for e-commerce retailers that automates doorstep collection and sanitization.\n\n"
            "3. **🌾 AgriDrone Precision Spraying**\n"
            "   - *Concept*: Autonomous drone fleet with hyperspectral imaging that pinpoints crop pests and weeds, reducing herbicide/fertilizer runoff by up to 80%.\n\n"
            "4. **🏢 UpCycle BIM – Construction Material Reclaiming**\n"
            "   - *Concept*: A digital marketplace scanning demolition blueprints using computer vision to catalog reusable steel beams, timber, and glass for green architectural projects.\n\n"
            "5. **💧 AquaSense Micro-Leak Detection**\n"
            "   - *Concept*: Acoustic IoT sensors attached to municipal water mains detecting underground leaks before sinkholes or massive water loss occur."
        )
    else:
        content = (
            f"### SmartAI Response\n\n"
            f"Thank you for your message: **\"{user_message}\"**.\n\n"
            "I have processed your query. As an AI assistant, I can assist you with:\n"
            "- 💻 **Software Engineering**: Writing, reviewing, and debugging Python, JavaScript, SQL, and more.\n"
            "- 📝 **Writing & Communications**: Professional emails, articles, documentation, and storytelling.\n"
            "- 🧠 **Problem Solving**: Technical explanations, brainstorming concepts, and data structuring.\n"
            "- 🌐 **Language & Translation**: Summarizing complex texts and translating across multiple languages.\n\n"
            "Feel free to ask a specific question, share code, or give me a prompt to generate!"
        )

    demo_footer = (
        "\n\n---\n"
        "> ℹ️ **[Demo Mode Active]**: OpenRouter API Key is not set yet. "
        "To enable real-time responses from models like **Gemini 2.0 Flash**, **DeepSeek**, or **GPT-4o**, "
        "click **Settings** in the sidebar and enter your OpenRouter API key!"
    )

    return content + demo_footer, True


def call_openrouter(messages_payload, model=None):
    """
    Send messages to OpenRouter API and return assistant text.
    Returns (response_text, is_demo_mode, error_message).
    """
    api_key = get_active_api_key()

    if not api_key:
        last_user_msg = ""
        for m in reversed(messages_payload):
            if m.get('role') == 'user':
                last_user_msg = m.get('content', '')
                break
        system_prompt = get_setting('system_prompt', DEFAULT_SYSTEM_PROMPT)
        demo_text, is_demo = get_demo_response(last_user_msg, system_prompt)
        return demo_text, True, None

    active_model = model or get_setting('model', DEFAULT_MODEL)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "SmartAI Chatbot"
    }

    body = {
        "model": active_model,
        "messages": messages_payload,
        "temperature": 0.7,
        "max_tokens": 2048
    }

    try:
        res = requests.post(OPENROUTER_API_URL, headers=headers, json=body, timeout=60)

        if res.status_code == 200:
            data = res.json()
            choices = data.get('choices', [])
            if choices and 'message' in choices[0]:
                content = choices[0]['message'].get('content', '')
                return content, False, None
            else:
                return "Received empty response from OpenRouter API.", False, "Empty choices returned"

        elif res.status_code == 401:
            err = "Invalid OpenRouter API Key. Please verify your API key in Settings."
            return None, False, err
        elif res.status_code == 402:
            err = "Insufficient OpenRouter balance or credits. Please check your OpenRouter account."
            return None, False, err
        elif res.status_code == 429:
            err = "OpenRouter rate limit reached. Please wait a moment and try again."
            return None, False, err
        else:
            err_details = res.text
            try:
                err_json = res.json()
                if 'error' in err_json and 'message' in err_json['error']:
                    err_details = err_json['error']['message']
            except Exception:
                pass
            return None, False, f"OpenRouter API Error ({res.status_code}): {err_details}"

    except requests.exceptions.Timeout:
        return None, False, "Connection to OpenRouter timed out. Please try again."
    except requests.exceptions.RequestException as e:
        return None, False, f"Network error contacting OpenRouter: {str(e)}"


# ==========================================
# Flask Routes: UI
# ==========================================

@app.route('/')
def index():
    """Render the main single-page modern chat interface."""
    return render_template('index.html')


# ==========================================
# Flask Routes: API
# ==========================================

@app.route('/api/health', methods=['GET'])
def api_health():
    """Check API status and OpenRouter connection."""
    api_key = get_active_api_key()
    has_key = bool(api_key)
    model = get_setting('model', DEFAULT_MODEL)

    status = {
        "status": "healthy",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "has_api_key": has_key,
        "model": model,
        "mode": "live" if has_key else "demo"
    }

    # If key is configured, optionally test connection if requested
    test = request.args.get('test', 'false').lower() == 'true'
    if test:
        if not has_key:
            status["connection_test"] = {"success": False, "message": "No API key configured."}
        else:
            try:
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
                # Lightweight test request
                res = requests.get("https://openrouter.ai/api/v1/auth/key", headers=headers, timeout=10)
                if res.status_code == 200:
                    status["connection_test"] = {"success": True, "message": "API Key is valid and active!"}
                else:
                    status["connection_test"] = {
                        "success": False,
                        "message": f"OpenRouter responded with HTTP {res.status_code}: {res.text[:100]}"
                    }
            except Exception as e:
                status["connection_test"] = {"success": False, "message": str(e)}

    return jsonify(status)


@app.route('/api/settings', methods=['GET', 'POST'])
def api_settings():
    """Get or update application settings."""
    if request.method == 'GET':
        api_key = get_active_api_key()
        masked_key = ""
        if api_key:
            if len(api_key) > 8:
                masked_key = f"{api_key[:4]}...{api_key[-4:]}"
            else:
                masked_key = "********"

        return jsonify({
            "model": get_setting('model', DEFAULT_MODEL),
            "system_prompt": get_setting('system_prompt', DEFAULT_SYSTEM_PROMPT),
            "theme": get_setting('theme', 'dark'),
            "has_api_key": bool(api_key),
            "masked_api_key": masked_key
        })

    data = request.get_json() or {}

    if 'model' in data and data['model'].strip():
        set_setting('model', data['model'].strip())

    if 'system_prompt' in data:
        set_setting('system_prompt', data['system_prompt'].strip())

    if 'theme' in data and data['theme'] in ['dark', 'light']:
        set_setting('theme', data['theme'])

    if 'api_key' in data:
        new_key = data['api_key'].strip()
        if new_key:
            set_setting('api_key', new_key)
        elif data.get('clear_api_key'):
            set_setting('api_key', '')

    return jsonify({"success": True, "message": "Settings saved successfully."})


@app.route('/api/chats', methods=['GET', 'POST', 'DELETE'])
def api_chats():
    """
    GET: List all conversations (with search support ?q=)
    POST: Create a new conversation
    DELETE: Clear all conversation history
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    if request.method == 'GET':
        search_query = request.args.get('q', '').strip()
        if search_query:
            cursor.execute('''
                SELECT c.id, c.title, c.created_at, c.updated_at,
                       COUNT(m.id) as message_count
                FROM conversations c
                LEFT JOIN messages m ON c.id = m.conversation_id
                WHERE c.title LIKE ? OR m.content LIKE ?
                GROUP BY c.id
                ORDER BY c.updated_at DESC
            ''', (f"%{search_query}%", f"%{search_query}%"))
        else:
            cursor.execute('''
                SELECT c.id, c.title, c.created_at, c.updated_at,
                       COUNT(m.id) as message_count
                FROM conversations c
                LEFT JOIN messages m ON c.id = m.conversation_id
                GROUP BY c.id
                ORDER BY c.updated_at DESC
            ''')

        rows = cursor.fetchall()
        chats = [dict(row) for row in rows]
        conn.close()
        return jsonify({"chats": chats})

    elif request.method == 'POST':
        data = request.get_json() or {}
        new_id = str(uuid.uuid4())
        title = data.get('title', 'New Chat').strip() or 'New Chat'
        now = datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')

        cursor.execute(
            "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (new_id, title, now, now)
        )
        conn.commit()
        conn.close()

        return jsonify({
            "success": True,
            "conversation": {
                "id": new_id,
                "title": title,
                "created_at": now,
                "updated_at": now,
                "message_count": 0
            }
        }), 201

    elif request.method == 'DELETE':
        # Clear all conversations
        cursor.execute("DELETE FROM messages")
        cursor.execute("DELETE FROM conversations")
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "All conversations cleared."})


@app.route('/api/chats/<conversation_id>', methods=['GET', 'PUT', 'DELETE'])
def api_single_chat(conversation_id):
    """
    GET: Retrieve conversation details & all its messages
    PUT: Rename conversation title
    DELETE: Delete conversation & its messages
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,))
    conv = cursor.fetchone()

    if not conv:
        conn.close()
        return jsonify({"error": "Conversation not found"}), 404

    if request.method == 'GET':
        cursor.execute(
            "SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY rowid ASC",
            (conversation_id,)
        )
        messages = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify({
            "conversation": dict(conv),
            "messages": messages
        })

    elif request.method == 'PUT':
        data = request.get_json() or {}
        new_title = data.get('title', '').strip()
        if not new_title:
            conn.close()
            return jsonify({"error": "Title cannot be empty"}), 400

        now = datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute(
            "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
            (new_title, now, conversation_id)
        )
        conn.commit()
        conn.close()
        return jsonify({"success": True, "title": new_title})

    elif request.method == 'DELETE':
        cursor.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
        cursor.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Conversation deleted"})


@app.route('/api/messages/<message_id>', methods=['DELETE'])
def api_delete_message(message_id):
    """Delete a single message."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM messages WHERE id = ?", (message_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Message deleted"})


@app.route('/api/chat', methods=['POST'])
def api_chat():
    """
    Core Chat Endpoint:
    Receives user message, updates conversation or creates new one,
    builds contextual message history, queries OpenRouter (or smart demo),
    stores user & AI responses in SQLite, and returns the response.
    """
    data = request.get_json() or {}
    user_content = data.get('message', '').strip()
    conversation_id = data.get('conversation_id')
    requested_model = data.get('model')

    if not user_content:
        return jsonify({"error": "Message content cannot be empty"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')

    # If conversation_id is missing or invalid, create a new conversation
    is_new_conversation = False
    if not conversation_id:
        conversation_id = str(uuid.uuid4())
        initial_title = generate_title_from_text(user_content)
        cursor.execute(
            "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (conversation_id, initial_title, now_str, now_str)
        )
        is_new_conversation = True
    else:
        cursor.execute("SELECT id, title FROM conversations WHERE id = ?", (conversation_id,))
        existing_conv = cursor.fetchone()
        if not existing_conv:
            initial_title = generate_title_from_text(user_content)
            cursor.execute(
                "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (conversation_id, initial_title, now_str, now_str)
            )
            is_new_conversation = True
        else:
            initial_title = existing_conv['title']

    # Insert user message into database
    user_msg_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
        (user_msg_id, conversation_id, 'user', user_content, now_str)
    )
    conn.commit()

    # Load conversation history for AI context (last 16 messages in strict insertion order)
    cursor.execute(
        "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY rowid ASC",
        (conversation_id,)
    )
    all_rows = cursor.fetchall()
    recent_rows = all_rows[-16:]

    # Build payload with system prompt
    system_prompt = get_setting('system_prompt', DEFAULT_SYSTEM_PROMPT)
    messages_payload = [{"role": "system", "content": system_prompt}]
    for r in recent_rows:
        messages_payload.append({"role": r['role'], "content": r['content']})

    # Call OpenRouter or Demo Fallback
    ai_text, is_demo, error_message = call_openrouter(messages_payload, model=requested_model)

    if error_message:
        # Keep user message in db, return error to client
        conn.close()
        return jsonify({
            "error": error_message,
            "conversation_id": conversation_id,
            "user_message": {
                "id": user_msg_id,
                "role": "user",
                "content": user_content,
                "created_at": now_str
            }
        }), 502

    # Insert assistant message into database
    ai_msg_id = str(uuid.uuid4())
    ai_now_str = datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    cursor.execute(
        "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
        (ai_msg_id, conversation_id, 'assistant', ai_text, ai_now_str)
    )

    # Update conversation updated_at
    cursor.execute(
        "UPDATE conversations SET updated_at = ? WHERE id = ?",
        (ai_now_str, conversation_id)
    )
    conn.commit()

    # Retrieve current title
    cursor.execute("SELECT title FROM conversations WHERE id = ?", (conversation_id,))
    conv_row = cursor.fetchone()
    current_title = conv_row['title'] if conv_row else initial_title
    conn.close()

    return jsonify({
        "success": True,
        "conversation_id": conversation_id,
        "title": current_title,
        "is_new": is_new_conversation,
        "demo_mode": is_demo,
        "user_message": {
            "id": user_msg_id,
            "role": "user",
            "content": user_content,
            "created_at": now_str
        },
        "message": {
            "id": ai_msg_id,
            "role": "assistant",
            "content": ai_text,
            "created_at": ai_now_str
        }
    })


@app.route('/api/messages/<message_id>/regenerate', methods=['POST'])
def api_regenerate_message(message_id):
    """
    Regenerate an assistant message response.
    Deletes the current assistant message and regenerates from conversation history up to that point.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Fetch the assistant message to replace
    cursor.execute("SELECT rowid, id, conversation_id, role, created_at FROM messages WHERE id = ?", (message_id,))
    target_msg = cursor.fetchone()

    if not target_msg or target_msg['role'] != 'assistant':
        conn.close()
        return jsonify({"error": "Target assistant message not found"}), 404

    conversation_id = target_msg['conversation_id']
    target_rowid = target_msg['rowid']

    # Get history prior to this message using rowid
    cursor.execute(
        "SELECT id, role, content FROM messages WHERE conversation_id = ? AND rowid < ? ORDER BY rowid ASC",
        (conversation_id, target_rowid)
    )
    prior_messages = cursor.fetchall()

    if not prior_messages:
        conn.close()
        return jsonify({"error": "No prompt history found prior to this message"}), 400

    # Build payload
    system_prompt = get_setting('system_prompt', DEFAULT_SYSTEM_PROMPT)
    messages_payload = [{"role": "system", "content": system_prompt}]
    for m in prior_messages[-15:]:
        messages_payload.append({"role": m['role'], "content": m['content']})

    data = request.get_json() or {}
    requested_model = data.get('model')

    ai_text, is_demo, error_message = call_openrouter(messages_payload, model=requested_model)

    if error_message:
        conn.close()
        return jsonify({"error": error_message}), 502

    # Update the existing message with new content
    ai_now_str = datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    cursor.execute(
        "UPDATE messages SET content = ?, created_at = ? WHERE id = ?",
        (ai_text, ai_now_str, message_id)
    )
    cursor.execute(
        "UPDATE conversations SET updated_at = ? WHERE id = ?",
        (ai_now_str, conversation_id)
    )
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": {
            "id": message_id,
            "role": "assistant",
            "content": ai_text,
            "created_at": ai_now_str
        },
        "demo_mode": is_demo
    })


# ==========================================
# Application Entry Point
# ==========================================

# Initialize database schema upon module loading
init_db()

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV', 'development') == 'development'
    print(f" * SmartAI Chatbot starting on http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
