from flask import Flask, request, jsonify
import os
import requests
import logging
import json
import re
import time

app = Flask(__name__)

logging.basicConfig(level=logging.DEBUG)

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

# Simple in-memory cache with expiration
cache = {}
CACHE_EXPIRATION_SECONDS = 3600  # 1 hour

def get_cache_key(prompt):
    return hash(prompt)

def is_cache_valid(entry):
    return (time.time() - entry['timestamp']) < CACHE_EXPIRATION_SECONDS

def cache_result(prompt, result):
    key = get_cache_key(prompt)
    cache[key] = {
        'result': result,
        'timestamp': time.time()
    }

def get_cached_result(prompt):
    key = get_cache_key(prompt)
    entry = cache.get(key)
    if entry and is_cache_valid(entry):
        app.logger.debug("Cache hit for prompt")
        return entry['result']
    return None

def call_gemini_api(prompt):
    cached = get_cached_result(prompt)
    if cached:
        return cached

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
    headers = {
        "Content-Type": "application/json"
    }
    data = {
        "prompt": {
            "text": prompt
        },
        "temperature": 0.2,
        "maxOutputTokens": 1024
    }
    response = requests.post(url, json=data, headers=headers)
    response.raise_for_status()
    result = response.json()
    app.logger.debug(f"Gemini API raw response: {json.dumps(result, indent=2)}")
    output = result['candidates'][0]['output']
    cache_result(prompt, output)
    return output

@app.route('/parse_invoice', methods=['POST'])
def parse_invoice():
    data = request.get_json()
    text = data.get('text', '')
    if not text:
        return jsonify({"error": "No text provided"}), 400

    prompt = f\"\"\"Extract the following fields from this invoice text in JSON format:
- fournisseur (supplier name)
- montant (total amount, as a number with decimals)
- numero (invoice number)
- date (date in DD/MM/YYYY format)
Text: {text}
Return only the JSON object.\"\"\"

    try:
        api_response = call_gemini_api(prompt)
        app.logger.debug(f"Gemini API response text: {api_response}")
        # Try to extract JSON object from response
        match = re.search(r'\{.*\}', api_response, re.DOTALL)
        if match:
            json_str = match.group(0)
        else:
            json_str = api_response
        parsed_data = json.loads(json_str)
        return jsonify(parsed_data)
    except Exception as e:
        app.logger.error(f"Error parsing Gemini API response: {e}")
        # Return default empty fields with raw response for debugging
        return jsonify({
            "fournisseur": "",
            "montant": 0,
            "numero": "",
            "date": None,
            "error": str(e),
            "raw_response": api_response if 'api_response' in locals() else None
        }), 500

if __name__ == '__main__':
    app.run(port=5001, debug=True)
