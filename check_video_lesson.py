import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

token = open('auth_token.txt').read().strip()
lesson_id = 13230195

url = f"https://courseapi.moon.vn/api/Course/LessonDetail/{lesson_id}"
req = urllib.request.Request(url, headers={
    'Accept': 'application/json',
    'Authorization': f'Bearer {token}',
    'User-Agent': 'Mozilla/5.0'
})

try:
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read().decode('utf-8'))
        print("Status 200")
        for k in ['id', 'name', 'videoId', 'isVideo', 'pageName', 'linkLiveStream', 'openUrl', 'iconUrl', 'fileDownloadFullUrl', 'node']:
            print(f"{k}: {data.get(k)}")
        print("\nFull keys with value:")
        for k, v in data.items():
            if v and v != 0 and v != "":
                print(f"  {k}: {str(v)[:100]}")
except Exception as e:
    print("Error:", e)
