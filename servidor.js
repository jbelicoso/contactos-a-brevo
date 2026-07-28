#!/usr/bin/env node
/**
 * servidor.js
 * -----------------------------------------------------------------------------
 * Servidor estático mínimo para ejecutar la aplicación en http://localhost:3000
 *
 *   node servidor.js            → puerto 3000
 *   node servidor.js 8080       → puerto 8080
 *   PORT=8080 node servidor.js  → puerto 8080
 *
 * NO usa ninguna dependencia externa y NO recibe ni almacena datos de
 * contactos: solo entrega los archivos estáticos de esta carpeta.
 * -----------------------------------------------------------------------------
 */
'use strict';

var http = require('http');
var fs   = require('fs');
var path = require('path');
var url  = require('url');

var RAIZ = __dirname;
var PUERTO = parseInt(process.argv[2] || process.env.PORT || '3000', 10);

var TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain; charset=utf-8',
  '.csv':  'text/csv; charset=utf-8',
  '.vcf':  'text/vcard; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

var servidor = http.createServer(function (peticion, respuesta) {
  var ruta = decodeURIComponent(url.parse(peticion.url).pathname);
  if (ruta === '/') ruta = '/index.html';

  // Impedimos salir de la carpeta del proyecto
  var destino = path.normalize(path.join(RAIZ, ruta));
  if (destino.indexOf(RAIZ) !== 0) {
    respuesta.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    respuesta.end('Acceso denegado');
    return;
  }

  fs.readFile(destino, function (err, contenido) {
    if (err) {
      respuesta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      respuesta.end('404 · No se encontró ' + ruta);
      return;
    }
    var ext = path.extname(destino).toLowerCase();
    respuesta.writeHead(200, {
      'Content-Type': TIPOS[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    respuesta.end(contenido);
  });
});

servidor.listen(PUERTO, function () {
  console.log('');
  console.log('  Contactos → Brevo');
  console.log('  ─────────────────────────────────────────');
  console.log('  Abre en tu navegador:  http://localhost:' + PUERTO);
  console.log('  Detener el servidor:   Ctrl + C');
  console.log('');
});

servidor.on('error', function (e) {
  if (e.code === 'EADDRINUSE') {
    console.error('El puerto ' + PUERTO + ' ya está en uso. Prueba: node servidor.js 3001');
  } else {
    console.error('Error del servidor:', e.message);
  }
  process.exit(1);
});
