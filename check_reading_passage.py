import json
import glob
import sys

sys.stdout.reconfigure(encoding='utf-8')

found = []
for f in glob.glob('data/cache/questions/*.json'):
    data = json.load(open(f, encoding='utf-8'))
    # Check if question mentions paragraph or passage or has reading content
    qtext = data.get('questionText', '')
    titleEng = data.get('titleEnglish', '')
    contentEng = data.get('conetentEnglish', '') or data.get('contentEnglish', '')
    
    if 'paragraph' in qtext.lower() or 'passage' in qtext.lower() or contentEng or titleEng:
        found.append((f, data))

print(f"Total matching questions: {len(found)}")
if found:
    f, sample = found[0]
    print(f"\nFile: {f}")
    print("Keys:", list(sample.keys()))
    print("questionText:", sample.get('questionText'))
    print("titleEnglish:", sample.get('titleEnglish'))
    print("conetentEnglish:", sample.get('conetentEnglish'))
    print("contentEnglish:", sample.get('contentEnglish'))
    print("answer:", sample.get('answer')[:300] if sample.get('answer') else '')
