import glob
import json
import os
import sys

want = sys.argv[1].lower() if len(sys.argv) > 1 else ''
method = sys.argv[2] if len(sys.argv) > 2 else ''
files = glob.glob('C:/CODEMINE/common50/*.fxc') + glob.glob('C:/CODEMINE/custom/*.fxc') + glob.glob('C:/avbcodev/Source/*.fxc')
for f in files:
    d = json.loads(open(f, encoding='latin1').read())
    for c in d['classes']:
        n = c['name'].lower()
        if (want and n == want) or (not want and n.endswith('application')):
            print(os.path.basename(f), c['name'], '<-', c.get('parentClass'), c.get('parentLibrary'))
            if method:
                for k, v in c['methods'].items():
                    if k.lower() == method.lower():
                        for i, line in enumerate(v.split('\n'), 1):
                            if i <= int(os.environ.get("FIND_APP_LINES", "400")):
                                print(i, line)
