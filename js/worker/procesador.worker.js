/**
 * procesador.worker.js
 * -----------------------------------------------------------------------------
 * Web Worker: ejecuta la limpieza, validación, deduplicación y generación del
 * CSV en un hilo aparte para que la interfaz nunca se congele, incluso con
 * 100.000 contactos.
 *
 * Mensajes que RECIBE:
 *   { tipo: 'procesar', filas: [[...]], opciones: {...} }
 *
 * Mensajes que ENVÍA:
 *   { tipo: 'progreso', porcentaje, procesadas, total }
 *   { tipo: 'listo', csv, estadisticas, muestra, invalidos, totalContactos }
 *   { tipo: 'error', mensaje }
 * -----------------------------------------------------------------------------
 */

/* global importScripts, self */

importScripts(
  '../nucleo/paises.js',
  '../nucleo/telefono.js',
  '../nucleo/validacion.js',
  '../nucleo/perfiles.js',
  '../nucleo/procesador.js',
  '../nucleo/exportador.js'
);

var TAMANO_LOTE = 2000; // filas por lote

self.onmessage = function (evento) {
  var datos = evento.data || {};
  if (datos.tipo !== 'procesar') return;

  try {
    var filas = datos.filas || [];
    var opciones = datos.opciones || {};
    var estado = self.CB.procesador.crearEstado(opciones);

    var total = filas.length;
    var i = 0;
    var ultimoAviso = -1;

    while (i < total) {
      var lote = filas.slice(i, i + TAMANO_LOTE);
      self.CB.procesador.procesarLote(estado, lote);
      i += lote.length;

      var pct = Math.floor((i / total) * 100);
      if (pct !== ultimoAviso) {
        ultimoAviso = pct;
        self.postMessage({ tipo: 'progreso', porcentaje: pct, procesadas: i, total: total, fase: 'limpieza' });
      }
    }

    self.postMessage({ tipo: 'progreso', porcentaje: 100, procesadas: total, total: total, fase: 'csv' });

    var csv = self.CB.exportador.generarCSV(estado.contactos, {
      perfil: opciones.perfil,
      delimitador: opciones.delimitador,
      omitirColumnasVacias: opciones.omitirColumnasVacias
    });

    self.postMessage({
      tipo: 'listo',
      csv: csv,
      estadisticas: estado.estadisticas,
      muestra: estado.contactos.slice(0, 200),
      invalidos: estado.invalidos.slice(0, 500),
      totalInvalidos: estado.invalidos.length,
      totalContactos: estado.contactos.length
    });

  } catch (err) {
    self.postMessage({ tipo: 'error', mensaje: (err && err.message) ? err.message : String(err) });
  }
};
