import json
from pathlib import Path

HERE = Path(__file__).parent
DATA_JSON = HERE / "data.json"
DATA_JS = HERE / "data.js"

with open(DATA_JSON, "r", encoding="utf-8") as f:
    data = json.load(f)

js_content = f"window.GLOSSARY_DATA = {json.dumps(data, indent=2, ensure_ascii=False)};\n"

with open(DATA_JS, "w", encoding="utf-8") as f:
    f.write(js_content)

print("Generated site/data.js successfully!")
