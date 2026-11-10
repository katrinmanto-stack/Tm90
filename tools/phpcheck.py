#!/usr/bin/env python3
"""چک ساختاری PHP بدون نیاز به php: خطاهای لکسر، تعادل پرانتز/آکولاد/براکت و توابع bazar_* تعریف‌نشده.
نکته: جایگزین `php -l` نیست؛ CI در گیت‌هاب php -l واقعی را اجرا می‌کند."""
import re, sys, pathlib
from pygments.lexers import PhpLexer
from pygments.token import Token

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'theme')
files = sorted(root.rglob('*.php'))
pairs = {')': '(', ']': '[', '}': '{'}
defined, called, problems = set(), {}, []

for f in files:
    src = f.read_text(encoding='utf-8')
    stack, line = [], 1
    for tok, val in PhpLexer(startinline=False).get_tokens(src):
        if tok is Token.Error:
            problems.append(f'{f}:{line}: lexer error near {val!r}')
        if tok in Token.Punctuation or tok in Token.Operator:
            for ch in val:
                if ch in '([{': stack.append((ch, line))
                elif ch in ')]}':
                    if not stack or stack[-1][0] != pairs[ch]:
                        problems.append(f'{f}:{line}: unexpected {ch!r}')
                    else: stack.pop()
        line += val.count('\n')
    for ch, ln in stack: problems.append(f'{f}:{ln}: unclosed {ch!r}')
    # <?php ... ?> must pair up (file may end inside php)
    opens, closes = len(re.findall(r'<\?php|<\?=', src)), src.count('?>')
    if closes > opens: problems.append(f'{f}: more ?> than <?php')
    code = re.sub(r'//[^\n]*|/\*.*?\*/', '', src, flags=re.S)
    for m in re.finditer(r'function\s+&?\s*(bazar_\w+)\s*\(', code): defined.add(m.group(1))
    for m in re.finditer(r'(?<![\w>:$])(bazar_\w+)\s*\(', code):
        called.setdefault(m.group(1), set()).add(f.name)
    # callbacks given as strings:  'bazar_xxx'
    for m in re.finditer(r"add_(?:action|filter)\(\s*'[^']+'\s*,\s*'(bazar_\w+)'", code): called.setdefault(m.group(1), set()).add(f.name)

guarded = set()
for f in files:
    guarded |= set(re.findall(r"function_exists\(\s*'(bazar_\w+)'", f.read_text(encoding='utf-8')))
for name, where in sorted(called.items()):
    if name not in defined and name not in guarded: problems.append(f'undefined function {name}() called in {sorted(where)}')

print(f'checked {len(files)} php files, {len(defined)} bazar_* functions defined')
if problems:
    print('\n'.join(problems)); sys.exit(1)
print('OK: no structural problems found')
