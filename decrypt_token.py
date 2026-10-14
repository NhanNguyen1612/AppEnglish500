import base64
import json

data = {
    "FlutterSecureStorage": "VqVUlQ1crxbbUrFx2VR16WmoTUDYsmo6YKJHh+QHlew=",
    "access_token": "iKPpe2lm156mLYYN.+7uMTJrRwbqFgVlmAkToJr4D90xJtPQ54euh6Y07mmoLhsYdFEswuEdzEskjjYysAQxO9LSI0gG9X2e0K5gunEMS6qT/8DXKzGanMmneZjdAt7WMWpjFstrHqMgtnAlPG8CihLUQpPsZdf6dKtxriAf0feNMWO1aAWlFjDoTSod92qDaG6sK6bReVKBr++2gSigsbv2ub+pkUrH/XFH0cZpWUXdKfkxTNzT1c7EheWJAC77s0Loat/BbbSTc1dj+gRATAbUamAnW1MMSu3M2CzO4uJ7AW1xEyd2ymeydRZwvi03aLDdUNVQ/K0O2yyv7e7TLMaef5VkZ8EC8tTBnDoE2psShr2y5HARrp6M9I4u1CaX3E3u1GJJNQEHp29aYusjWdk+5lb/JC5LD0ZCluSlhO4g5yVUqPqW4oy1kBTdyW9S3xJwV2bUBE87IUiegkn2ahOjapt77CXFmKi4iBayVFy8IuotXzj+Hj3eVUpFGA8/eQW/bEADpV7JdhuWwR0CjrofKz+dnEiscT3nXap9C0167YTkRqNnCUdBTRukrDC2aSnaVIxyqawPd5ko0FpY5cAkRCi6w79S5N6LGuq1Iq0tw/bRiKvp+RGe1ECHu10BWs42DllCVZHFvIHlW1wmgpXPPg6QT9vjz78bJM7DzM0uQDCEO77ucODA0Toe7bFqv/WfTMccOeCBeOtve9FVVw7pQ19lTDDBhxbX8HgCvDtKkGRZ1SYwnL4pBBuBb8lI3UbBvWPdJdPp3jE5qxKtYjizyc1VVOnBup34bIrKHDiL+cmZ6XugcyHwubqJR07temIsn8vf6jLyD4V0XWr3KJIcId5qcc5cYSoTFgSY2OrieA4vzimhw4DPb2t2d8/w88HhNNsFOqAIRkfglVLK0BYLHJqYBe5RMFbFAAnibpobPWL5ivAXLORyrJ6ApIwKmIXegnsWtBXe9LC9LE8rlAvpMNzKmnaWuA77VgwuWzfBPaNGWFX7mkwMhKsqUustx/swnjOQBM98YXTjMLyhX79kGpkYDjbsc0/Mymkyz5ruKxuo5gLtLMc1Vdii63Pmc0t+Z2lhozMYBiz3ZXKLnt7skkECW/bmiI6p/1nv3Z34L+yRlwIokoyQSgUO0j8rJmoDxGldoGRkeX03VcMMqMXqbI1h5L5bM23dKsWLAIAkkMcVGpj9VVYS8pG+23YBYMUYHfuzDd7V0XCYHGsYSWrES/aza7aNH/mTo+WVp0MOmdwy3BDIXc1lbVPt2h/vLys+IrK9BvEDNpGfIa4Nb/ml2AxzF9YpZExus3T5oaZMQMrFSKWscN1yWzd5mDdPloR4cipqRY2ZUxVQy3c67POgbtZjKxWb/cJIdUHBtCbsLiEMu5vfrtRktL/HA7HlPpfibBY/BcQjnZL8omF5T+/MKtaGI3sM+c4C7I9s6whkkUiGMqS8zv5xiUMZDoEZ8zajVnGC6Xw=="
}

key_b64 = data["FlutterSecureStorage"]
key = base64.b64decode(key_b64)
print(f"Key length: {len(key)} bytes")

iv_b64, cipher_b64 = data["access_token"].split('.')
iv = base64.b64decode(iv_b64)
ciphertext = base64.b64decode(cipher_b64)
print(f"IV length: {len(iv)} bytes")
print(f"Ciphertext length: {len(ciphertext)} bytes")

# Test AES-GCM or AES-CBC
try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    aesgcm = AESGCM(key)
    decrypted = aesgcm.decrypt(iv, ciphertext, None)
    print("SUCCESS AES-GCM! Decrypted token:")
    print(decrypted.decode('utf-8')[:100] + "...")
    with open('decrypted_token.txt', 'w', encoding='utf-8') as f:
        f.write(decrypted.decode('utf-8'))
except Exception as e:
    print(f"AESGCM error: {e}")

