from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import re

app = Flask(__name__)
CORS(app)

OLLAMA_URL = "http://127.0.0.1:11434/api/generate"

MODEL = "phi3"

conversation_history = []

def detect_language(text):
    hindi = re.compile(r'[\u0900-\u097F]')
    if hindi.search(text):
        return "Hindi"
    return "English"

def build_prompt(user_message):
    lang = detect_language(user_message)

    context = ""
    for entry in conversation_history[-6:]:
        role = "User" if entry["role"] == "user" else "Assistant"
        context += f"{role}: {entry['content']}\n"

    prompt = f"""
You are Kittu – a smart AI assistant for blogging and coding help.

Always reply in {lang}. Be helpful, clear and concise.
Help with blogging, SEO, writing and coding.

Conversation history:
{context}

User: {user_message}
Assistant:
"""
    return prompt

@app.route('/api/ask-ai', methods=['POST'])
def ask_ai():
    global conversation_history

    data = request.get_json()
    user_msg = data.get('message', '').strip()

    if not user_msg:
        return jsonify({"reply": "Please ask something."})

    prompt = build_prompt(user_msg)

    payload = {
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.7,
            "num_thread": 4
        }
    }

    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=300)
        response.raise_for_status()

        reply = response.json().get("response", "").strip()

        if not reply:
            reply = "Sorry, I couldn't generate a response."

        conversation_history.append({"role": "user", "content": user_msg})
        conversation_history.append({"role": "assistant", "content": reply})

        conversation_history = conversation_history[-10:]

        return jsonify({"reply": reply})

    except Exception as e:
        return jsonify({"reply": f"Error: {str(e)}"}), 500

@app.route('/api/reset', methods=['POST'])
def reset():
    global conversation_history
    conversation_history = []
    return jsonify({"status": "reset successful"})

if __name__ == '__main__':
    print(f"Kittu AI running on http://localhost:5000 using {MODEL}")
    app.run(host='0.0.0.0', port=5000, threaded=True)