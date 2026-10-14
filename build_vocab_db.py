import urllib.request
import json
import re
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

token = open('auth_token.txt').read().strip()
course_file = 'course_2769_all_lessons.json'

with open(course_file, 'r', encoding='utf-8') as f:
    d = json.load(f)

lessons = d['lessons']

# Find all quiz lessons
quiz_lessons = [l for l in lessons if l.get('pageName') in ['keys', 'readingkeys', 'stest-key']]
print(f"Total quiz lessons found: {len(quiz_lessons)}")

CACHE_DIR = os.path.join('data', 'cache')
QUESTIONS_CACHE_DIR = os.path.join(CACHE_DIR, 'questions')
os.makedirs(QUESTIONS_CACHE_DIR, exist_ok=True)

vocab_list = []
seen_words = set()

def extract_vocab(html, question_text, lesson_name):
    # Match patterns like: specialist (n): chuyên gia
    # or (A) summarize (v): tổng kết
    regex = r'(?:(?:\([A-D]\)\s*)?([a-zA-Z\s-]+)\s*\((n|v|adj|adv|prep|conj|phr|a)\s*v?\)\s*:\s*([^<\n\r]+))'
    matches = re.findall(regex, html, re.IGNORECASE)
    items = []
    for m in matches:
        word = m[0].strip()
        pos = m[1].strip().lower()
        if pos == 'a': pos = 'adj'
        meaning = m[2].strip()
        if len(word) > 2 and not word.startswith('ta c') and not word.startswith('xet'):
            items.append({
                'word': word,
                'pos': pos,
                'meaning': meaning,
                'example': question_text,
                'lesson': lesson_name
            })
    return items

# Process first 20 quiz lessons to populate rich database
print("Scanning top quizzes for rich vocabulary...")
count_quizzes = 0

for ql in quiz_lessons[:25]:
    lid = ql['id']
    lname = ql['name']
    
    # Fetch lesson detail
    detail_cache = os.path.join(CACHE_DIR, 'lessons', f"{lid}.json")
    lesson_detail = None
    if os.path.exists(detail_cache):
        try:
            lesson_detail = json.load(open(detail_cache, encoding='utf-8'))
        except: pass

    if not lesson_detail:
        try:
            req = urllib.request.Request(f"https://courseapi.moon.vn/api/Course/LessonDetail/{lid}", headers={
                'Accept': 'application/json',
                'Authorization': f'Bearer {token}',
                'User-Agent': 'Mozilla/5.0'
            })
            with urllib.request.urlopen(req, timeout=5) as res:
                lesson_detail = json.loads(res.read().decode('utf-8'))
                os.makedirs(os.path.join(CACHE_DIR, 'lessons'), exist_ok=True)
                json.dump(lesson_detail, open(detail_cache, 'w', encoding='utf-8'), ensure_ascii=False)
        except Exception as e:
            continue

    keys = lesson_detail.get('keyAllEnglish', [])
    if not keys: continue

    count_quizzes += 1
    print(f"[{count_quizzes}] Processing '{lname}' ({len(keys)} questions)...")

    for k in keys:
        qid = k.get('questionId')
        if not qid: continue
        q_cache = os.path.join(QUESTIONS_CACHE_DIR, f"{qid}.json")
        q_data = None
        if os.path.exists(q_cache):
            try:
                q_data = json.load(open(q_cache, encoding='utf-8'))
            except: pass

        if not q_data:
            try:
                qreq = urllib.request.Request(f"https://courseapi.moon.vn/api/Course/ItemQuestion/{qid}", headers={
                    'Accept': 'application/json',
                    'Authorization': f'Bearer {token}',
                    'User-Agent': 'Mozilla/5.0'
                })
                with urllib.request.urlopen(qreq, timeout=5) as qres:
                    q_data = json.loads(qres.read().decode('utf-8'))
                    json.dump(q_data, open(q_cache, 'w', encoding='utf-8'), ensure_ascii=False)
            except Exception as e:
                continue

        extracted = extract_vocab(q_data.get('answer', ''), q_data.get('questionText', ''), lname)
        for it in extracted:
            w_key = it['word'].lower()
            if w_key not in seen_words and len(w_key) > 2:
                seen_words.add(w_key)
                vocab_list.append(it)

print(f"\nDone! Extracted {len(vocab_list)} unique TOEIC vocabulary items.")
with open(os.path.join('data', 'vocab_database.json'), 'w', encoding='utf-8') as f:
    json.dump(vocab_list, f, ensure_ascii=False, indent=2)

print("Saved to data/vocab_database.json!")
