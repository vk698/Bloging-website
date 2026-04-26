from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import requests
import json
import re
import time

app = Flask(__name__)
CORS(app)

OLLAMA_URL = "http://127.0.0.1:11434/api/generate"


MODEL = "gemma2:2b"    
conversation_history = []

def detect_language(text):
    hindi = re.compile(r'[\u0900-\u097F]')
    if hindi.search(text):
        return "Hindi"
    return "English"

def build_system_prompt(user_message):
    lang = detect_language(user_message)
    # Build context from history
    context = ""
    for entry in conversation_history[-6:]:
        context += f"{entry['role']}: {entry['content']}\n"
    
    system = f"""You are Kittu – a smart, friendly AI assistant. 
Always reply in {lang} language. Be helpful, accurate, and concise.
Use the conversation history to provide coherent answers.
Current conversation:
{context}
User: {user_message}
Assistant:"""
    return system

@app.route('/api/ask-ai', methods=['POST'])
def ask_ai():
    global conversation_history
    data = request.get_json()
    user_msg = data.get('message', '').strip()
    if not user_msg:
        return jsonify({"reply": "Please ask something."})

    system_prompt = build_system_prompt(user_msg)
    
    payload = {
        "model": MODEL,
        "prompt": user_msg,
        "system": system_prompt,
        "stream": False,   # you can set True for streaming but simpler for now
        "options": {"temperature": 0.7, "num_thread": 2}
    }
    
    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=120)
        response.raise_for_status()
        reply = response.json().get("response", "Sorry, I couldn't generate a response.")
        
        # Save to memory
        conversation_history.append({"role": "user", "content": user_msg})
        conversation_history.append({"role": "assistant", "content": reply})
        if len(conversation_history) > 10:
            conversation_history = conversation_history[-10:]
        
        return jsonify({"reply": reply})
    except Exception as e:
        return jsonify({"reply": f"❌ Error: {str(e)}"}), 500

@app.route('/api/reset', methods=['POST'])
def reset():
    global conversation_history
    conversation_history = []
    return jsonify({"status": "reset"})

if __name__ == '__main__':
    print(f"🚀 Kittu AI backend running on http://localhost:5000 with model {MODEL}")
    app.run(host='0.0.0.0', port=5000, threaded=True)