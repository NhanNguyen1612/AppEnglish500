import asyncio
import edge_tts

async def main():
    communicate = edge_tts.Communicate("Included is a summary of the latest feedback from our customers.", "en-US-JennyNeural")
    await communicate.save("test_jenny.mp3")
    print("Success generated test_jenny.mp3!")

asyncio.run(main())
