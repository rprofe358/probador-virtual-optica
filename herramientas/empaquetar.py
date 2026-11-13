# Mete las monturas y la cabeza (.glb) dentro del HTML para que funcione con doble clic, sin servidor.
import base64, json, pathlib, sys
base = pathlib.Path(__file__).resolve().parent.parent
html = (base / 'index.html').read_text(encoding='utf-8')
modelos = {f'{d}/{p.name}': base64.b64encode(p.read_bytes()).decode() for d in ('monturas', 'recursos') for p in sorted((base / d).glob('*.glb'))}
tag = '<script>window.MODELOS_EMBEBIDOS = ' + json.dumps(modelos) + ';</script>'
out = base / 'dist' / 'probador-virtual.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html.replace('<!--MODELOS_EMBEBIDOS-->', tag), encoding='utf-8')
print(out, round(out.stat().st_size / 1e6, 2), 'MB', list(modelos))
