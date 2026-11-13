# Probador virtual de lentes

Prototipo de probador de monturas con realidad aumentada para una óptica. Corre en el navegador con la cámara del dispositivo: seguimiento facial con MediaPipe y render 3D con Three.js.

**Funciones:** cambio de montura y color; Transitions GEN S (8 colores), XTRActive New Generation (3 colores y 5 espejados), XTRActive Polarized, Drivewear y Color Touch (degradado o uniforme), cada uno en interior, en el carro y al sol; antirreflejo; filtro de luz azul; foto con la montura puesta y carga de modelos propios en formato `.glb` (modo ajuste).

## Cómo funciona el 3D

- **Pose de la cabeza:** se ajusta la cara canónica de MediaPipe (468 puntos, en cm) a 33 puntos estables de la cara detectada (frente, nariz, comisuras de los ojos, pómulos y sienes). Así se obtienen el giro real de la cabeza y el tamaño real de la cara, y cada montura se dibuja con su ancho real en mm.
- **Oclusión:** la cara detectada en cada cuadro funciona como una superficie invisible que tapa lo que queda detrás (por ejemplo, la patilla del lado lejano). Detrás de la cara hay una cabeza completa invisible (orejas, nuca, cuello) alineada con la cara y ajustada al ancho de la cara de cada persona.
- **Posición:** los lentes se centran en las pupilas de la persona y se apoyan delante del puente de su nariz. El frente de la montura nunca lo corta la cara.
- **Patillas:** se abren desde la bisagra solo lo necesario para pasar por fuera de la cabeza y llegan a la parte de arriba de la oreja. Si la bisagra queda baja, el frente se inclina unos grados (inclinación pantoscópica), como en unos lentes reales.
- **Lentes:** se generan curvos (curva base ~5) a partir del contorno de cada montura y usan un material físico con transmisión: dejan ver la cara con el tinte de cada Transitions y reflejan el entorno (un HDRI más paneles de luz como los de una óptica). El antirreflejo deja un reflejo residual verdoso; el filtro de luz azul, uno azulado.
- **Calibración personal:** durante el primer segundo con la persona de frente se promedia la forma real de su cara y desde ahí la pose se calcula contra su cara y no contra una cara promedio.
- **Suavizado:** filtro One Euro sobre posición, escala y giro: estable con la cabeza quieta y sin retraso al moverse.

## Modo ajuste (personal de la óptica)

Se activa con la tecla **D** o con **5 toques seguidos** sobre el nombre de la óptica. Muestra los datos de seguimiento y el botón para probar un modelo `.glb` propio.

| Tecla | Acción |
|---|---|
| + / − | Tamaño de la montura |
| W / S | Altura (cm) |
| Q / E | Distancia a la cara (cm) |
| O | Mostrar u ocultar los oclusores |
| R | Girar 90° el modelo cargado |
| ← / → | Cambiar de montura |

## Estructura

- `index.html`: la app completa.
- `recursos/cabeza-oclusor.glb`: cabeza invisible para la oclusión, ya alineada a la cara canónica de MediaPipe.
- `herramientas/preparar-cabeza.mjs`: alinea otro modelo de cabeza con la cara canónica.
- `monturas/`: modelos 3D de las monturas (`.glb`, Y arriba, frente hacia +Z, lentes en un objeto llamado `lente`).
- `herramientas/preparar-monturas.mjs`: limpia y comprime modelos descargados (requiere Node y `@gltf-transform`).
- `herramientas/empaquetar.py`: genera una versión en un solo archivo HTML con los modelos incluidos.

## Créditos

Malla canónica de la cara: [MediaPipe](https://github.com/google-ai-edge/mediapipe) (Apache 2.0).

Entorno: «Royal Esplanade» de [Poly Haven](https://polyhaven.com/a/royal_esplanade) (CC0).

Cabeza para la oclusión: «Male Head» de [Alexander Antipov](https://sketchfab.com/Dessen), https://sketchfab.com/3d-models/male-head-0247a25a04ba46b99629130277fe39b7 (CC BY 4.0). Se alineó a la cara canónica, se quitó la zona de la cara y los materiales.

### Modelos 3D de prueba

Licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Los modelos fueron reorientados, comprimidos y, en un caso, se separaron los lentes y se quitó una firma de texto.

- «Anteojos» de [Orking](https://sketchfab.com/Orking): https://sketchfab.com/3d-models/anteojos-837aebe59d3540318b41024dd7d5a76c
- «Glasses» de [AlbertVictory](https://sketchfab.com/albert_victory): https://sketchfab.com/3d-models/glasses-4b8a1e54f3084c63828fe8c324198aec
- «Glasses» de [C.U.V](https://sketchfab.com/C.U.V): https://sketchfab.com/3d-models/glasses-05497943410d4a7388695190a5a68eac
