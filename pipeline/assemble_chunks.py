"""Reassemble base64 chunks (C<i>|...|END) saved from browser tool output into a file and verify SHA-256."""
import json, glob, re, sys, base64, gzip, hashlib
pattern, out, expected_sha, gz = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] == "gz"
chunks = {}
for f in glob.glob(pattern):
    try:
        d = json.load(open(f))
    except Exception:
        continue
    for item in d:
        t = item.get("text", "")
        m = re.search(r'"(?:([A-Z]+)-)?C(\d+)\|([A-Za-z0-9+/=]*)\|END *"', t)
        if m:
            chunks[(m.group(1), int(m.group(2)))] = m.group(3)
tag = sys.argv[5] if len(sys.argv) > 5 else None
sel = {i: v for (tg, i), v in chunks.items() if tg == tag}
n = max(sel) + 1
missing = [i for i in range(n) if i not in sel]
assert not missing, f"missing chunks {missing}"
raw = base64.b64decode("".join(sel[i] for i in range(n)))
if gz: raw = gzip.decompress(raw)
sha = hashlib.sha256(raw).hexdigest()
print("chunks", n, "bytes", len(raw), "sha256", sha, "OK" if sha == expected_sha else "MISMATCH")
assert sha == expected_sha
open(out, "wb").write(raw)
