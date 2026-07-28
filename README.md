# Contactos → Brevo

Conversor local de **Excel, CSV, TXT, vCard y exportaciones de WhatsApp** a un **CSV listo para importar en Brevo** (antes Sendinblue), Mailchimp o HubSpot.

Todo el procesamiento ocurre **dentro de tu navegador**. Los contactos nunca se suben a ningún servidor, no se guardan en disco y no salen de tu equipo.

---

## Tabla de contenidos

- [Puesta en marcha](#puesta-en-marcha)
- [Cómo se usa](#cómo-se-usa)
- [Formatos de entrada admitidos](#formatos-de-entrada-admitidos)
- [Formato de salida](#formato-de-salida)
- [Opciones disponibles](#opciones-disponibles)
- [Importar en Brevo](#importar-en-brevo)
- [Cómo compartirlo](#cómo-compartirlo)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Cómo funciona por dentro](#cómo-funciona-por-dentro)
- [Pruebas](#pruebas)
- [Privacidad](#privacidad)
- [Preguntas frecuentes](#preguntas-frecuentes)

---

## Puesta en marcha

### Opción 0 — la más fácil: un solo archivo

En la carpeta hay un archivo llamado **`Conversor-Contactos-Brevo.html`** (109 KB).

- **Para abrirlo:** doble clic. Se abre en tu navegador y ya funciona.
- **Para compartirlo:** envíalo por correo, WhatsApp o Google Drive. Es un único archivo, no necesita instalación ni Internet (salvo para leer `.xlsx`, ver más abajo).

Contiene la aplicación entera —HTML, estilos y código— dentro de ese archivo. Si más adelante cambias algo del código fuente, regenéralo con:

```bash
node construir-archivo-unico.js
```

### Opción A — con Node.js (recomendada para desarrollo)

Requisito: Node.js 14 o superior. **No hace falta `npm install`**: el servidor incluido no usa dependencias.

```bash
cd contactos-a-brevo
npm start
```

Luego abre <http://localhost:3000> en tu navegador.

Para usar otro puerto:

```bash
node servidor.js 8080
```

### Opción B — con Python (sin Node)

```bash
cd contactos-a-brevo
python3 -m http.server 3000
```

Y abre <http://localhost:3000>.

### Opción C — sin nada instalado

Haz **doble clic en `index.html`**. Funciona igual, con una salvedad: los navegadores bloquean los Web Workers en direcciones `file://`, así que la aplicación detecta la situación y procesa en el hilo principal por lotes. Es algo más lento con archivos muy grandes, pero no se congela.

### Funcionar 100 % sin Internet

La única librería externa es **SheetJS**, y solo se necesita para leer archivos `.xlsx` / `.xls`. Si quieres una copia local:

```bash
npm install                 # instala xlsx como dependencia opcional
npm run descargar-xlsx      # copia la librería a js/lib/
```

o directamente:

```bash
curl -L -o js/lib/xlsx.full.min.js \
  https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
```

A partir de ahí la aplicación no hace **ninguna** petición de red.

---

## Cómo se usa

1. **Carga tus contactos** — arrastra el archivo a la zona punteada, o pulsa la pestaña *Pegar texto* y pega la lista directamente.
2. **Revisa el mapeo** — la aplicación adivina qué columna es el email, el nombre, el teléfono… Si algo no cuadra, cámbialo con los desplegables. Los valores inválidos se resaltan en rojo en la vista previa.
3. **Ajusta las opciones** — plataforma de destino, delimitador, codificación, país por defecto para los teléfonos, duplicados, valores fijos como `LISTA = CLIENTES`.
4. **Pulsa «Generar CSV»** — verás las estadísticas del resultado y una vista previa.
5. **Descarga el CSV** (o cópialo al portapapeles) y súbelo a Brevo.

Hay archivos de prueba en la carpeta `ejemplos/` para experimentar sin usar datos reales.

---

## Formatos de entrada admitidos

| Formato | Extensiones | Notas |
|---|---|---|
| Excel | `.xlsx`, `.xls`, `.xlsm` | Libros con varias hojas: aparece un selector de hoja. |
| CSV / TSV | `.csv`, `.tsv` | Delimitador detectado automáticamente (`,` `;` tabulación `|`). Soporta comillas y saltos de línea dentro de celdas. |
| Texto plano | `.txt` | Listas de nombres, emails o teléfonos, una por línea. |
| vCard | `.vcf`, `.vcard` | Exportaciones de Android/iPhone. Lee `FN`, `N`, `TEL`, `EMAIL`, `ORG` y descodifica *quoted-printable*. |
| Chat de WhatsApp | `.txt` | Se detecta solo. Extrae los participantes únicos del chat. |
| Pegado manual | — | Nombres, emails y teléfonos separados por comas, tabulaciones, punto y coma o simplemente espacios. |

**Tamaño máximo:** 50 MB (constante `TAM_MAX_MB` en `js/app.js`).
**Volumen probado:** 100.000 contactos procesados en menos de 1 segundo.

### Sobre las exportaciones de WhatsApp

WhatsApp incluye el número de teléfono solo de los participantes que **no** tienes guardados en tu agenda. De los que sí tienes guardados exporta el nombre, no el número. La aplicación te lo indica y coloca cada dato en su columna: los que traen número van a `TELEFONO`, los que traen nombre van a `NOMBRE`.

---

## Formato de salida

Perfil **Brevo** (por defecto):

```
EMAIL;NOMBRE;APELLIDO;TELEFONO;EMPRESA;LISTA
ana@ejemplo.com;Ana;Torres;+593991234567;Acme S.A.;CLIENTES
luis@ejemplo.com;Luis;Pérez García;+34612345678;Beta Ltda;CLIENTES
```

También disponibles: **Mailchimp** (`Email Address`, `First Name`, …), **HubSpot** (`Email`, `First Name`, …) y **Genérico**. Los perfiles se definen en `js/nucleo/perfiles.js` y añadir uno nuevo son cinco líneas.

Detalles del archivo generado:

- Codificación **UTF-8 con BOM** por defecto, para que Excel no destroce los acentos.
- Fin de línea `CRLF` (RFC 4180).
- Valores con delimitador, comillas o saltos de línea se entrecomillan; las comillas internas se duplican (`""`).
- Protección contra *CSV injection*: un valor que empiece por `=`, `+`, `-` o `@` se prefija con un apóstrofo… salvo que sea un teléfono internacional (`+593…`), que se respeta tal cual.

---

## Opciones disponibles

| Opción | Qué hace |
|---|---|
| **Plataforma de destino** | Cambia los encabezados del CSV (Brevo / Mailchimp / HubSpot / genérico). |
| **Delimitador** | `;` (recomendado para Brevo), `,` o tabulación. |
| **Codificación** | UTF-8 con BOM, UTF-8 sin BOM o ISO-8859-1. En Latin-1 los caracteres que no existen se translitera (`á`→`a`) o se sustituyen por `?`. |
| **País por defecto** | Prefijo que se aplica a los teléfonos que llegan sin código internacional. Por defecto Ecuador (+593). |
| **Formato del teléfono** | `+593991234567` (E.164, el más seguro) o `+593 99 123 4567`. |
| **Detección de duplicados** | Por email, por teléfono o por cualquiera de los dos. |
| **Valor fijo LISTA / EMPRESA** | Rellena esa columna en todos los contactos que no la traigan. |
| **Descartar sin email válido** | Desmárcalo si vas a importar solo teléfonos (campañas de SMS/WhatsApp). |
| **Corregir mayúsculas** | `JUAN DE LA CRUZ` → `Juan de la Cruz`. |
| **Dividir nombre completo** | `María José Pérez` → nombre `María`, apellido `José Pérez`. |
| **Omitir columnas vacías** | No escribe las columnas que están vacías en todos los contactos. |
| **Plantillas de mapeo** | Guarda la asignación de columnas y reutilízala. Se guardan por *nombre de encabezado*, así que funcionan aunque cambie el orden de las columnas. Se almacenan solo en `localStorage` de tu navegador. |

---

## Importar en Brevo

1. Brevo → **Contactos** → **Importar contactos**.
2. Sube el `.csv` generado aquí.
3. En **Separador de columna** elige el mismo que usaste (por defecto `;`).
4. Empareja `EMAIL` con el atributo de email y el resto de columnas con sus atributos. Si `NOMBRE`, `APELLIDO`, `TELEFONO`, `EMPRESA` o `LISTA` no existen, créalos en **Contactos → Configuración → Atributos**.
5. Elige la lista de destino y confirma que tienes consentimiento de esos contactos.

**Límite:** Brevo admite 100.000 contactos por archivo. Si superas esa cifra, la aplicación te avisa para que dividas el CSV.

**Para SMS o WhatsApp en Brevo:** el atributo se llama `SMS` y necesita el número en formato internacional. Duplica la columna `TELEFONO` como `SMS` en el paso de emparejamiento, o añade el perfil correspondiente en `js/nucleo/perfiles.js`.

---

## Estructura del proyecto

```
contactos-a-brevo/
├── index.html                     Interfaz (una sola página)
├── servidor.js                    Servidor estático local, sin dependencias
├── package.json                   Scripts npm (start / test)
├── README.md
├── css/
│   └── estilos.css                Hoja de estilos única
├── js/
│   ├── app.js                     Controlador de la interfaz
│   ├── lib/
│   │   └── LEEME.txt              Dónde poner SheetJS para uso sin Internet
│   ├── nucleo/                    Lógica pura, reutilizable y testeable
│   │   ├── paises.js              Prefijos telefónicos internacionales
│   │   ├── telefono.js            Normalización a E.164 y validación
│   │   ├── validacion.js          Emails, nombres, limpieza de texto
│   │   ├── parsers.js             CSV, vCard, WhatsApp, texto libre
│   │   ├── detector.js            Mapeo automático de columnas
│   │   ├── perfiles.js            Brevo / Mailchimp / HubSpot / genérico
│   │   ├── procesador.js          Limpieza, deduplicación, estadísticas
│   │   └── exportador.js          Generación del CSV y codificación de bytes
│   └── worker/
│       └── procesador.worker.js   Ejecuta el núcleo en un hilo aparte
├── ejemplos/                      Datos de prueba (ficticios)
│   ├── contactos-ejemplo.xlsx     Libro con 3 hojas
│   ├── contactos-desordenados.csv Con duplicados y errores a propósito
│   ├── agenda.vcf
│   ├── chat-whatsapp.txt
│   └── lista-para-pegar.txt
└── pruebas/
    └── pruebas.js                 70 pruebas, sin dependencias
```

---

## Cómo funciona por dentro

**Sin build, sin framework, sin bundler.** Son scripts clásicos que registran su API en un espacio de nombres global `CB`. El mismo código se ejecuta en tres entornos:

- en el navegador (`window.CB`),
- dentro del Web Worker (`self.CB`, cargado con `importScripts`),
- en Node.js para las pruebas (`module.exports`).

### Detección automática de columnas

Cada par *(columna, campo)* recibe una puntuación de 0 a 100:

- hasta **40 puntos** por coincidencia del encabezado con una lista de sinónimos (`correo`, `e-mail`, `celular`, `móvil`, `first name`…), normalizando acentos y signos;
- hasta **60 puntos** por análisis del contenido real: qué proporción de valores de la columna son emails válidos, teléfonos plausibles, palabras sueltas alfabéticas, etc.

Después se asignan los pares de mayor puntuación evitando repetir campo o columna, con un umbral mínimo de confianza de 20 puntos. Por eso funciona igual con encabezados en español, en inglés o sin encabezados.

### Normalización de teléfonos

1. Se detecta si el número venía internacional (`+` o `00`).
2. Si venía internacional, se busca el país por el prefijo más largo que encaje.
3. Si no, se elimina el prefijo troncal (ceros iniciales) y se antepone el país por defecto.
4. Se valida la longitud del número nacional contra el rango conocido de ese país.
5. Se formatea con la agrupación propia del país (`+593 99 123 4567`, `+34 612 345 678`, `+1 415 555 0132`).

Hay 50 países definidos en `js/nucleo/paises.js`; añadir más es agregar una línea.

### Procesamiento sin bloquear la interfaz

Las filas se envían al Web Worker, que las procesa en lotes de 2.000 e informa del progreso. La interfaz sigue respondiendo. Si el Worker no está disponible (por ejemplo al abrir el HTML con `file://`), la aplicación lo detecta y procesa en el hilo principal en lotes de 1.500 con pausas de `setTimeout`, de modo que el navegador sigue repintando.

---

## Pruebas

```bash
npm test
```

o directamente:

```bash
node pruebas/pruebas.js
```

Cubre normalización de teléfonos de 8 países, validación y limpieza de emails, división de nombres, lectura de CSV con comillas, vCard, chats de WhatsApp, texto pegado, detección automática de columnas, deduplicación, generación de los tres perfiles de CSV, codificación (BOM, UTF-8, Latin-1) y un caso de carga con 100.000 contactos.

Salida esperada: `70 correctas, 0 fallidas`.

---

## Privacidad

- **Nada se sube a Internet.** No hay backend, no hay API, no hay analítica, no hay cookies.
- **Nada se guarda en disco.** Los archivos se leen a memoria con `FileReader` y se descartan al recargar la página.
- La única excepción es voluntaria: las **plantillas de mapeo** que guardes se almacenan en `localStorage` de tu navegador, y solo contienen nombres de columna, nunca contactos.
- La única petición de red posible es la descarga de SheetJS desde el CDN, y solo si no tienes la copia local (ver arriba cómo evitarla).

Puedes comprobarlo tú mismo: abre las herramientas de desarrollo del navegador, pestaña **Red**, y procesa un archivo. No verás ninguna petición saliente.

---

## Cómo compartirlo

### 1. Enviar el archivo único (lo más rápido)

Manda `Conversor-Contactos-Brevo.html` por correo, WhatsApp o Drive. Quien lo reciba hace doble clic y ya está. No instala nada.

> Gmail bloquea algunos adjuntos `.html`. Si te lo rechaza, comprímelo en `.zip` o compártelo por Drive/Dropbox.

### 2. Publicarlo en una web gratuita

**Netlify Drop** — la vía sin cuenta ni comandos:

1. Entra en <https://app.netlify.com/drop>.
2. Arrastra la carpeta `contactos-a-brevo` entera a la página.
3. En unos segundos te da una URL pública tipo `https://algo-random.netlify.app` que puedes pasar a quien quieras.

**Cloudflare Pages / Vercel** funcionan igual: arrastrar la carpeta, sin comando de build, directorio de publicación la raíz.

### 3. Subirlo a GitHub y activar GitHub Pages

Necesitas una cuenta en <https://github.com> (gratis).

**Sin usar la terminal:**

1. GitHub → botón **+** arriba a la derecha → **New repository**.
2. Ponle un nombre (`contactos-a-brevo`), déjalo **Public** y pulsa **Create repository**.
3. En la página que aparece, pulsa **uploading an existing file**.
4. Arrastra ahí todo el contenido de la carpeta y pulsa **Commit changes**.
5. Ve a **Settings → Pages**, en *Source* elige la rama `main` y carpeta `/ (root)`, y pulsa **Save**.
6. Al cabo de un minuto tu app estará en `https://TU-USUARIO.github.io/contactos-a-brevo/`.

**Con terminal**, desde dentro de la carpeta del proyecto:

```bash
git init
git add .
git commit -m "Conversor de contactos a CSV para Brevo"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/contactos-a-brevo.git
git push -u origin main
```

Y después activa Pages con el paso 5 de arriba.

En todos los casos el procesamiento sigue ocurriendo en el navegador de quien la use: el servidor solo entrega los archivos, nunca ve los contactos.

---

## Preguntas frecuentes

**El CSV se ve mal al abrirlo en Excel.**
Usa la codificación *UTF-8 con BOM* (la opción por defecto) y el delimitador `;` si tu Excel está configurado en español.

**Brevo me dice que faltan atributos.**
Créalos primero en *Contactos → Configuración → Atributos* con los mismos nombres que las columnas del CSV, o empareja las columnas manualmente durante la importación.

**Mis teléfonos salen mal.**
Revisa el «País por defecto» en el paso 3. Se aplica solo a los números que llegan sin prefijo internacional; los que ya traen `+` conservan el suyo.

**Tengo más de 100.000 contactos.**
La aplicación te avisa. Divide el archivo de origen y genera varios CSV, o abre el CSV resultante y córtalo por bloques de 100.000 filas.

**¿Puedo añadir campos personalizados de Brevo?**
Sí. Abre `js/nucleo/perfiles.js` y añade el par `['CAMPO_INTERNO', 'NOMBRE_EN_EL_CSV']` al perfil, y el campo correspondiente en `CAMPOS` dentro de `js/nucleo/detector.js`.

**¿Funciona en móvil?**
Sí, la interfaz es responsiva, aunque cargar archivos grandes desde un móvil es más lento.

---

## Licencia

MIT. Úsalo, modifícalo y distribúyelo libremente.

Los datos de la carpeta `ejemplos/` son ficticios.
