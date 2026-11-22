# Viaje de las sondas por el Sistema Solar (versión web)

Versión web, más sencilla, del visor de escritorio `viaje_sondas.py` (estudio «Medio interplanetario»):
las trayectorias reales de siete sondas a escala (Voyager 1 y 2, Pioneer 10 y 11, Galileo, Cassini y
New Horizons), lo que midieron del viento solar y del campo magnético, y una vista ampliada de cada
sobrevuelo con las fotos que tomaron. Todo funciona en el navegador, sin servidor propio.

Diferencias con la versión de escritorio: no tiene la nube de Oort, ni las sondas Ulysses, Helios 1 y
Helios 2, ni las gráficas según la distancia al Sol. Primero se elige la sonda, luego qué ver
(animación del viaje o solo los sobrevuelos), si se amplía la vista y qué cuerpos.

## Ficheros

| Fichero | Qué es |
|---|---|
| `index.html`, `estilo.css`, `app.js` | la página (escrita a mano; no se regenera) |
| `datos/indice.json` | lista de sondas y de sus pasos |
| `datos/<sonda>.json` | trayectoria diaria, medidas diarias, hitos, pasos y momentos especiales |
| `datos/<sonda>_<paso>.json` | un sobrevuelo: posiciones alrededor del cuerpo, magnetómetro y fotos |
| `img/` | fotos reducidas (NASA/JPL, dominio público; las de las Pioneer, de Wikimedia Commons) |

Unos 30 MB en total.

## Actualizar los datos

1. `descarga_medio_interplanetario` (si hay datos nuevos).
2. `exportar_web` (en el menú de programas: «Medio interplanetario: preparar la versión web»).
   Rehace `datos/` y añade a `img/` las fotos nuevas.

## Probarla en el ordenador

El navegador no deja leer los datos si se abre `index.html` directamente desde el disco. En esta carpeta:

```
python -m http.server 8000
```

y abrir <http://localhost:8000>.

## Publicarla en GitHub Pages

1. Crear un repositorio en GitHub (por ejemplo, `viaje-sondas`) y subir el contenido de esta carpeta
   (no la carpeta en sí: `index.html` tiene que quedar en la raíz del repositorio).
2. En el repositorio: *Settings → Pages → Build and deployment → Source: Deploy from a branch*,
   rama `main`, carpeta `/ (root)`.
3. Al cabo de un minuto la página está en `https://<usuario>.github.io/viaje-sondas/`.

El fichero vacío `.nojekyll` evita que GitHub procese la carpeta con Jekyll.
