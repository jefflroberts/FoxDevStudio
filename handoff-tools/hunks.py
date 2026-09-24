"""Splits a unified diff into numbered hunks, lists them, and writes a patch of chosen hunks.

  python hunks.py list  all.diff               -> index of hunks with a one-line summary
  python hunks.py show  all.diff 12 13         -> the full text of those hunks
  python hunks.py write all.diff topics.json   -> one patch per topic named in the json
                                                 ({"topic": [hunk ids or "file:<path>"]})
"""
import json
import re
import sys


def parse(path):
    text = open(path, encoding='utf-8', newline='').read()
    files = []
    cur = None
    for block in re.split(r'(?m)^(?=diff --git )', text):
        if not block.startswith('diff --git'):
            continue
        head, _, rest = block.partition('\n@@')
        if not _:
            files.append({'head': block, 'hunks': [], 'path': re.search(r' b/(\S+)', block.splitlines()[0]).group(1)})
            continue
        hunks = ['@@' + h for h in ('\n@@' + rest).split('\n@@')[1:]]
        hunks = [h if h.endswith('\n') else h + '\n' for h in hunks]
        files.append({'head': head + '\n', 'hunks': hunks, 'path': re.search(r' b/(\S+)', block.splitlines()[0]).group(1)})
    ids = []
    for f in files:
        for i, h in enumerate(f['hunks']):
            ids.append((f, i, h))
    return files, ids


def summary(h):
    lines = h.splitlines()
    added = [l[1:].strip() for l in lines[1:] if l.startswith('+') and l[1:].strip()]
    removed = [l[1:].strip() for l in lines[1:] if l.startswith('-') and l[1:].strip()]
    first = (added or removed or [''])[0]
    return f"+{len(added)} -{len(removed)} | {lines[0][:60]} | {first[:90]}"


def main():
    cmd, path = sys.argv[1], sys.argv[2]
    files, ids = parse(path)
    if cmd == 'list':
        last = None
        for n, (f, i, h) in enumerate(ids):
            if f['path'] != last:
                print(f"== {f['path']}")
                last = f['path']
            print(f"  {n:4d} {summary(h)}")
    elif cmd == 'show':
        for n in map(int, sys.argv[3:]):
            f, i, h = ids[n]
            print(f"## {n} {f['path']}")
            print(h)
    elif cmd == 'write':
        topics = json.load(open(sys.argv[3], encoding='utf-8'))
        seen = {}
        for topic, picks in topics.items():
            chosen = {}
            for p in picks:
                if isinstance(p, str) and p.startswith('file:'):
                    for n, (f, i, h) in enumerate(ids):
                        if f['path'] == p[5:]:
                            chosen[n] = True
                elif isinstance(p, str) and '-' in p:
                    a, b = map(int, p.split('-'))
                    for n in range(a, b + 1):
                        chosen[n] = True
                else:
                    chosen[int(p)] = True
            for n in chosen:
                if n in seen:
                    print(f'hunk {n} is in both {seen[n]} and {topic}')
                seen[n] = topic
            out = []
            for f in files:
                picked = [h for n, (ff, i, h) in enumerate(ids) if ff is f and n in chosen]
                if picked:
                    out.append(f['head'] + ''.join(picked))
            open(f'{topic}.patch', 'w', encoding='utf-8', newline='').write(''.join(out))
            print(f'{topic}: {len(chosen)} hunks')
        missing = [n for n in range(len(ids)) if n not in seen]
        print('unassigned:', missing)


main()
