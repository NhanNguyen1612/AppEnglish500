import sys
import asyncio
import os
import urllib.request
import urllib.parse
import edge_tts

SPEECHER_VOICES = {
    "hannah": "3bf4442b798f",   # US Hannah - Warm & Natural (Speecher Default)
    "madison": "390ab1dc80e9",  # US Madison - Calm, Deep Warmth
    "isla": "c54647aa1e7f",     # GB Isla - Soft British
    "natalie": "56ce9e1bef17",  # US Natalie - Friendly
    "megan": "ecf763d41acf"     # US Megan
}

def fetch_speecher(text, outfile, voice_name="hannah"):
    voice_id = SPEECHER_VOICES.get(voice_name.lower(), SPEECHER_VOICES["hannah"])
    url = f"https://speecher.org/index.php?action=std_tts&voice={voice_id}&text={urllib.parse.quote(text)}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://speecher.org/'
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=5) as resp:
        if resp.status == 200:
            data = resp.read()
            if len(data) > 500: # Valid MP3
                with open(outfile, 'wb') as f:
                    f.write(data)
                return True
    return False

async def generate_edge(text, outfile, voice="en-US-AvaNeural", rate="+0%"):
    # Apply warm acoustic pitch if ava or emma
    pitch = "-2Hz" if ("Ava" in voice or "Emma" in voice) else "+0Hz"
    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await communicate.save(outfile)

async def main(text, outfile, voice="speecher:hannah", rate="+0%"):
    os.makedirs(os.path.dirname(os.path.abspath(outfile)), exist_ok=True)
    
    if voice.startswith("speecher:"):
        vname = voice.split(":")[1]
        try:
            success = fetch_speecher(text, outfile, vname)
            if success:
                print(f"OK:speecher:{outfile}")
                return
        except Exception as e:
            print(f"Speecher error ({e}), falling back to Edge AvaNeural...", file=sys.stderr)
            
        # Fallback to AvaNeural (warmest edge voice)
        await generate_edge(text, outfile, "en-US-AvaNeural", rate)
        print(f"OK:fallback:{outfile}")
    else:
        await generate_edge(text, outfile, voice, rate)
        print(f"OK:edge:{outfile}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python tts_worker.py <text> <outfile> [voice] [rate]")
        sys.exit(1)
        
    text = sys.argv[1]
    outfile = sys.argv[2]
    voice = sys.argv[3] if len(sys.argv) > 3 else "speecher:hannah"
    rate = sys.argv[4] if len(sys.argv) > 4 else "+0%"
    
    asyncio.run(main(text, outfile, voice, rate))
