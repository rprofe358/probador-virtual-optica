# Probador virtual de lentes

Prototipo de probador de monturas con realidad aumentada para una óptica. Corre en el navegador con la cámara del dispositivo: seguimiento facial con MediaPipe y render 3D con Three.js.

**Funciones:** cambio de montura y color; Transitions GEN S (8 colores), XTRActive New Generation (3 colores y 5 espejados), XTRActive Polarized, Drivewear y Color Touch (degradado o uniforme), cada uno en interior, en el carro y al sol; antirreflejo; filtro de luz azul; foto con cuenta regresiva y carga de modelos propios en formato `.glb` (modo ajuste).

## Interfaz

- **Entrada:** solo los lentes flotando en un estudio claro, el botón «Probármelos» y los créditos de los modelos abajo en letra pequeña. Las monturas van pasando solas cada 7 s; se puede deslizar para cambiarlas o arrastrar para girarlas.
- **Probador:** la cámara ocupa toda la pantalla. Abajo hay una barra tipo app de cámara (Monturas · Color · obturador · Transitions · Lentes). Cada pestaña abre un panel compacto encima de la barra que se esconde solo al tocar la cámara o tras 10 s sin usarlo. El nombre de la montura aparece unos segundos cuando cambia.
- **Foto:** el obturador (o hacer ✌️ con la mano medio segundo) arranca una cuenta regresiva 3-2-1 con toda la interfaz escondida; luego se ve la foto con Cerrar, Repetir y Guardar (se cierra sola a los 20 s).
- **Dial con la mano:** juntar pulgar e índice toma la perilla y girar la mano cambia el valor. Levantar solo el índice (☝️) muestra de inmediato el selector de controles (oscuridad del lente, color de la montura, montura y color del lente): mover el dedo a la izquierda o a la derecha elige por posición y bajarlo lo deja elegido. Los diales de color de montura y de color del lente muestran las muestras de color reales; el de montura y el de oscuridad mantienen sus marcas. El dial aparece siempre en el mismo sitio, lejos de la cara: abajo al centro en pantallas verticales y a la derecha en horizontales.
- Si nadie usa el probador por 75 s, vuelve solo a la entrada.

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

- `index.html`: la app completa (se genera con `herramientas/ensamblar.py` a partir de `src/shell.html`, la interfaz, y `src/ui.js`, su lógica).
- `recursos/cabeza-oclusor.glb`: cabeza invisible para la oclusión, ya alineada a la cara canónica de MediaPipe.
- `herramientas/preparar-cabeza.mjs`: alinea otro modelo de cabeza con la cara canónica.
- `monturas/`: modelos 3D de las monturas (`.glb`, Y arriba, frente hacia +Z, lentes en un objeto llamado `lente`).
- `herramientas/preparar-monturas.mjs`: limpia y comprime un modelo descargado (requiere Node y `@gltf-transform`).
- `herramientas/preparar-lote.mjs`: prepara un lote de monturas descargadas de una vez: nombra o genera los lentes, unifica materiales, simplifica la geometría y pasa las texturas a WebP. La configuración de cada montura está al inicio del archivo.
- `herramientas/empaquetar.py`: genera una versión en un solo archivo HTML con los modelos incluidos.

## Créditos

Malla canónica de la cara: [MediaPipe](https://github.com/google-ai-edge/mediapipe) (Apache 2.0).

Entorno: «Royal Esplanade» de [Poly Haven](https://polyhaven.com/a/royal_esplanade) (CC0).

Cabeza para la oclusión: «Male Head» de [Alexander Antipov](https://sketchfab.com/Dessen), https://sketchfab.com/3d-models/male-head-0247a25a04ba46b99629130277fe39b7 (CC BY 4.0). Se alineó a la cara canónica, se quitó la zona de la cara y los materiales.

### Monturas 3D

Todas de Sketchfab con licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Se reorientaron, simplificaron y comprimieron; en algunas se unificaron materiales, se separaron o generaron los lentes y se quitó una firma de texto. Los nombres de modelo y marca solo describen el estilo del modelo 3D.

- Redonda clásica: «Anteojos» de [Orking](https://sketchfab.com/Orking), https://sketchfab.com/3d-models/837aebe59d3540318b41024dd7d5a76c
- Rectangular: «Glasses» de [AlbertVictory](https://sketchfab.com/AlbertVictory), https://sketchfab.com/3d-models/4b8a1e54f3084c63828fe8c324198aec
- Semi al aire: «Glasses» de [C.U.V](https://sketchfab.com/C.U.V), https://sketchfab.com/3d-models/05497943410d4a7388695190a5a68eac
- Urbana: «Glasses» de [yanix](https://sketchfab.com/yanix), https://sketchfab.com/3d-models/2a39a445c6b84ce89974ec2d0ae67061
- Wayfarer óptico: «Black Wayfarer Glasses» de [islem-rd](https://sketchfab.com/islem-rd), https://sketchfab.com/3d-models/9a20e0cc78534323a3357ac632bf7ee2
- Clubmaster: «Gold and Black Browline Glasses» de [islem-rd](https://sketchfab.com/islem-rd), https://sketchfab.com/3d-models/e72b5ba610e248f289a209558f3c9301
- Aviador óptico: «EyeGlass» de [raldlegaspigerald](https://sketchfab.com/raldlegaspigerald), https://sketchfab.com/3d-models/154e3f7fdd8544fd88d560b9cb73063f
- Aviador clásico: «Aviator sunglasses» de [Kimppo](https://sketchfab.com/Kimppo), https://sketchfab.com/3d-models/00d1cb5aa82745228a3b764c97f867de
- Aviador titanio: «Aviator titanium sunglasses» de [mrdicktwink](https://sketchfab.com/mrdicktwink), https://sketchfab.com/3d-models/727fcd6989e7473a9df1f23af9d21cbd
- Aviador geométrico: «Eyeglasses (Specs)» de [Pratham.Bhatnagar](https://sketchfab.com/Pratham.Bhatnagar), https://sketchfab.com/3d-models/a9e23529a9a5417a8db9df961a7d42af
- Navegador: «Glasses» de [culerdamage](https://sketchfab.com/culerdamage), https://sketchfab.com/3d-models/a00f60192d1740f49902009c3d0aac05
- MOSCOT Zev: «GLASSES - MOSCOT ZEV-TT SE» de [VikyStefiniv](https://sketchfab.com/VikyStefiniv), https://sketchfab.com/3d-models/20e76258ad1542bcae86d2daa6c27c57
- Mustang MU 1683: «Mustang Sunglasses - MU 1683» de [berkgedik](https://sketchfab.com/berkgedik), https://sketchfab.com/3d-models/eeec9fbb427246959acee4e4266b0f0a
- Ejecutiva: «Glasses 10k Polygons» de [Sbell_Reality3D](https://sketchfab.com/Sbell_Reality3D), https://sketchfab.com/3d-models/e4f348e98ceb45e3abc77da5b738f1b2
- Clásica: «Black Glasses» de [cianurito](https://sketchfab.com/cianurito), https://sketchfab.com/3d-models/c3603763da7c41359f58f7943bf06ab6
- Cuadrada fina: «Square glasses» de [strakacher21](https://sketchfab.com/strakacher21), https://sketchfab.com/3d-models/b4546d8e0b7845eeafd88feb48057610
- Semi al aire fina: «Glasses 3D model» de [nattsol](https://sketchfab.com/nattsol), https://sketchfab.com/3d-models/74c1d202ac0249e39823e379e2b065e9
- Geométrica: «transparent_glasses (1)» de [kevinivancic](https://sketchfab.com/kevinivancic), https://sketchfab.com/3d-models/648789df777e4d498bf14b9d4dc86d9b
- Redonda cobre: «Ray Ban Glasses» de [Agha.Najam](https://sketchfab.com/Agha.Najam), https://sketchfab.com/3d-models/bb3a3736110a41bdacc9f92e11831a41
- Wayfarer: «Wayfarer» de [pedroni.mau](https://sketchfab.com/pedroni.mau), https://sketchfab.com/3d-models/8a5b21b25141419983908e0518f96233
