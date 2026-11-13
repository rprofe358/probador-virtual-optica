# Une la interfaz (src/shell.html + src/ui.js) con el motor (dentro de index.html) en un solo index.html
import pathlib
base = pathlib.Path(__file__).resolve().parent.parent
cur = (base / 'index.html').read_text(encoding='utf-8')
tag = '<script type="module">'
ca = cur.index(tag) + len(tag); cb = cur.index('/* =========================================================\n   INTERFAZ')
eng = cur[ca:cb]
shell = (base / 'src' / 'shell.html').read_text(encoding='utf-8')
ui = (base / 'src' / 'ui.js').read_text(encoding='utf-8')
(base / 'index.html').write_text(shell + '\n' + tag + eng + ui + '</script>\n</body>\n</html>\n', encoding='utf-8')
print('index.html listo')
