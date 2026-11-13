# Probador virtual de lentes

Prototipo de probador de monturas con realidad aumentada para una óptica. Corre en el navegador con la cámara del dispositivo: seguimiento facial con MediaPipe y render 3D con Three.js.

**Funciones:** cambio de montura y color, simulación de Transitions (gris, café, verde G-15), antirreflejo, filtro de luz azul, foto con la montura puesta y carga de modelos propios en formato `.glb`.

## Estructura

- `index.html`: la app completa.
- `monturas/`: modelos 3D de las monturas (`.glb`, Y arriba, frente hacia +Z, lentes en un objeto llamado `lente`).
- `herramientas/preparar-monturas.mjs`: limpia y comprime modelos descargados (requiere Node y `@gltf-transform`).
- `herramientas/empaquetar.py`: genera una versión en un solo archivo HTML con los modelos incluidos.

## Créditos de los modelos 3D de prueba

Licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Los modelos fueron reorientados, comprimidos y, en un caso, se separaron los lentes y se quitó una firma de texto.

- «Anteojos» de [Orking](https://sketchfab.com/Orking): https://sketchfab.com/3d-models/anteojos-837aebe59d3540318b41024dd7d5a76c
- «Glasses» de [AlbertVictory](https://sketchfab.com/albert_victory): https://sketchfab.com/3d-models/glasses-4b8a1e54f3084c63828fe8c324198aec
- «Glasses» de [C.U.V](https://sketchfab.com/C.U.V): https://sketchfab.com/3d-models/glasses-05497943410d4a7388695190a5a68eac
