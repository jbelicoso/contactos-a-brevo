# Guía rápida — Contactos → Brevo

Convierte tu Excel, tu lista de contactos, tu agenda del teléfono o una exportación de WhatsApp en un archivo CSV listo para importar en Brevo, Mailchimp o HubSpot.

**Todo ocurre en tu propio equipo.** Tus contactos no se suben a ningún servidor, no se guardan en ningún sitio y nadie más los ve.

---

## Parte 1 · Cómo abrirla

Elige **una** de estas tres formas. La primera sirve para casi todo el mundo.

### Forma A · Usarla en línea (sin instalar nada)

Abre este enlace en tu navegador:

**https://jbelicoso.github.io/contactos-a-brevo/**

Ya está. No hay que descargar, ni registrarse, ni crear cuenta. Funciona en computadora y en móvil.

> Consejo: guárdala en favoritos, o en el móvil usa «Añadir a pantalla de inicio» para tenerla como si fuera una app.

### Forma B · Guardarla en tu computadora (funciona sin internet)

Útil si quieres tenerla siempre a mano o trabajar sin conexión.

1. Entra en https://github.com/jbelicoso/contactos-a-brevo
2. Haz clic en el archivo **`Conversor-Contactos-Brevo.html`**.
3. Arriba a la derecha, pulsa el botón de descarga (icono ⬇, «Download raw file»).
4. Guarda el archivo donde quieras, por ejemplo en el Escritorio.
5. **Haz doble clic en el archivo.** Se abre en tu navegador y funciona igual.

Es un único archivo de unos 110 KB. Puedes copiarlo a un USB, mandarlo por correo o guardarlo en Drive.

> Nota: sin internet funciona todo menos la lectura de archivos `.xlsx`. Si vas a trabajar sin conexión, guarda tu Excel como `.csv` antes (en Excel: *Archivo → Guardar como → CSV*).

### Forma C · Instalar el proyecto completo (para programadores)

Necesitas Node.js 14 o superior. **No hace falta `npm install`**: el servidor incluido no usa dependencias.

```bash
git clone https://github.com/jbelicoso/contactos-a-brevo.git
cd contactos-a-brevo
npm start
```

Abre http://localhost:3000

Otras opciones:

```bash
node servidor.js 8080      # usar otro puerto
npm test                   # ejecutar las 70 pruebas
python3 -m http.server 3000   # si prefieres Python en vez de Node
```

Si no tienes git, descarga el ZIP desde **Code → Download ZIP** en la página del repositorio y descomprímelo.

---

## Parte 2 · Cómo usarla (5 pasos)

### 1. Carga tus contactos

Dos maneras:

- **Pestaña «Archivo»** — arrastra el archivo a la zona punteada, o pulsa para buscarlo. Acepta `.xlsx`, `.xls`, `.csv`, `.tsv`, `.txt` y `.vcf`. Hasta 50 MB.
- **Pestaña «Pegar texto»** — copia la lista desde donde la tengas, pégala en el recuadro y pulsa *Analizar texto pegado*.

Si tu Excel tiene varias hojas, aparece un menú para elegir cuál usar.

### 2. Revisa las columnas

La herramienta adivina sola qué columna es el email, cuál el nombre y cuál el teléfono. Verás una vista previa con las primeras 10 filas.

- Si acertó, sigue adelante.
- Si algo está mal, cámbialo en el desplegable de cada columna.
- Los datos con errores (emails sin `@`, teléfonos imposibles) se resaltan **en rojo**.

Si vas a repetir esta conversión a menudo, pulsa *Guardar actual* en «Plantillas de mapeo» y la próxima vez la reutilizas.

### 3. Ajusta las opciones

Las importantes:

| Opción | Qué poner |
|---|---|
| **Plataforma de destino** | Brevo (o Mailchimp / HubSpot). |
| **Delimitador** | `;` para Brevo. |
| **Codificación** | UTF-8 con BOM (así Excel no rompe los acentos). |
| **País por defecto** | El de tus contactos. Solo se aplica a los teléfonos que llegan **sin** el `+`. |
| **Valor fijo para LISTA** | Escribe algo como `CLIENTES` si quieres etiquetarlos a todos igual. |
| **Descartar sin email válido** | Déjalo marcado, salvo que vayas a importar solo teléfonos para SMS. |

### 4. Genera el CSV

Pulsa **⚙️ Generar CSV**. Verás las estadísticas: cuántos contactos quedaron listos, cuántos duplicados se eliminaron, cuántos se descartaron y por qué.

Puedes pulsar *Ver contactos descartados* para revisar qué se quedó fuera y por qué motivo, y descargar esa lista aparte para corregirla.

### 5. Descarga e importa

Pulsa **⬇️ Descargar CSV**. Después, en Brevo:

1. Entra en **Contactos → Importar contactos**.
2. Sube el archivo `.csv`.
3. En «Separador de columna» elige **`;`** (el mismo que usaste).
4. Empareja `EMAIL` con el atributo de email, y el resto de columnas con sus atributos. Si `NOMBRE`, `APELLIDO`, `TELEFONO`, `EMPRESA` o `LISTA` no existen todavía, créalos en **Contactos → Configuración → Atributos**.
5. Elige la lista de destino y confirma la importación.

Brevo admite 100.000 contactos por archivo. Si tienes más, la herramienta te avisa para que lo dividas.

---

## Problemas frecuentes

**Los acentos salen raros al abrir el CSV en Excel.**
Vuelve a generarlo con la codificación *UTF-8 con BOM* (es la opción por defecto).

**Todo aparece en una sola columna en Excel.**
El delimitador del archivo no coincide con el que espera tu Excel. Genera el CSV con el otro delimitador (`,` en vez de `;`, o al revés).

**Los teléfonos salen mal.**
Revisa el «País por defecto» en el paso 3. Solo afecta a los números que llegan sin prefijo internacional; los que ya traen `+` conservan el suyo.

**De WhatsApp salieron nombres pero sin números.**
Es normal y no es un fallo de la herramienta: WhatsApp solo incluye el número de las personas que **no** tienes guardadas en tu agenda. De las que sí tienes guardadas exporta el nombre.

**Brevo rechaza el archivo.**
Casi siempre es porque falta la columna `EMAIL` o porque los atributos no existen todavía en tu cuenta. Créalos primero.

---

## Preguntas sobre privacidad

**¿Mis contactos se suben a algún sitio?**
No. No hay servidor, ni base de datos, ni analítica. El archivo se lee en la memoria de tu navegador y desaparece al recargar la página.

**¿Cómo puedo comprobarlo?**
Abre las herramientas de desarrollo del navegador (F12), pestaña *Red*, y procesa un archivo. No verás ninguna petición saliente.

**¿Y las plantillas de mapeo que guardo?**
Se quedan en tu navegador (`localStorage`) y solo contienen nombres de columna, nunca contactos.

---

Código y documentación completa: https://github.com/jbelicoso/contactos-a-brevo
Licencia MIT — puedes usarlo, modificarlo y compartirlo libremente.
