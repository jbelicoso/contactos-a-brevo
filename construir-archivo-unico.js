#!/usr/bin/env node
/**
 * construir-archivo-unico.js
 * -----------------------------------------------------------------------------
 * Empaqueta toda la aplicación (HTML + CSS + JavaScript) en UN SOLO archivo
 * .html que se puede abrir con doble clic y enviar por correo o WhatsApp.
 *
 *   node construir-archivo-unico.js
 *   → crea  Conversor-Contactos-Brevo.html
 *
 * En esta versión no se usa el Web Worker (no hay archivos sueltos que cargar):
 * el procesamiento se hace en el hilo principal por lotes, con barra de
 * progreso, así que la página sigue respondiendo igual.
 * -----------------------------------------------------------------------------
 */
'use strict';

var fs = require('fs');
var path = require('path');

var RAIZ = __dirname;
var SALIDA = path.join(RAIZ, 'Conversor-Contactos-Brevo.html');

var ORDEN_JS = [
  'js/nucleo/paises.js',
  'js/nucleo/telefono.js',
  'js/nucleo/validacion.js',
  'js/nucleo/parsers.js',
  'js/nucleo/detector.js',
  'js/nucleo/perfiles.js',
  'js/nucleo/procesador.js',
  'js/nucleo/exportador.js',
  'js/app.js'
];

function leer(rel) { return fs.readFileSync(path.join(RAIZ, rel), 'utf8'); }

var html = leer('index.html');
var css = leer('css/estilos.css');

// 1) CSS en línea
html = html.replace(
  /<link rel="stylesheet" href="css\/estilos\.css">/,
  '<style>\n' + css + '\n</style>'
);

// 2) Quitamos las etiquetas <script src="js/..."> del núcleo
ORDEN_JS.forEach(function (rel) {
  html = html.replace(new RegExp('\\s*<script src="' + rel.replace(/\//g, '\\/') + '"><\\/script>', 'g'), '');
});

// 3) Insertamos todo el JavaScript en línea, en el orden correcto
var js = ORDEN_JS.map(function (rel) {
  return '/* ======== ' + rel + ' ======== */\n' + leer(rel);
}).join('\n\n');

// Marca que desactiva el intento de cargar el Web Worker externo
var bloque =
  '<script>window.__ARCHIVO_UNICO__ = true;</script>\n' +
  '<script>\n' + js + '\n</script>';

html = html.replace('</body>', bloque + '\n</body>');

// 4) Aviso visible de que es la versión portátil
html = html.replace(
  '🔒 100&nbsp;% local · sin servidores',
  '🔒 100&nbsp;% local · archivo portátil'
);

fs.writeFileSync(SALIDA, html, 'utf8');

var kb = (fs.statSync(SALIDA).size / 1024).toFixed(0);
console.log('');
console.log('  Archivo creado: Conversor-Contactos-Brevo.html  (' + kb + ' KB)');
console.log('  Ábrelo con doble clic o envíalo por correo/WhatsApp/Drive.');
console.log('');
