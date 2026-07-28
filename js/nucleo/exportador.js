/**
 * exportador.js
 * -----------------------------------------------------------------------------
 * Generación del CSV final y codificación de bytes.
 *
 * Puntos importantes para Brevo:
 *   - UTF-8 con BOM evita que Excel destroce los acentos al abrir el archivo.
 *   - Delimitador ";" es el habitual en configuraciones en español.
 *   - Los valores que contienen el delimitador, comillas o saltos de línea se
 *     entrecomillan y las comillas internas se duplican ("" según RFC 4180).
 *   - Se antepone un apóstrofo... NO. Brevo prefiere el teléfono tal cual en
 *     formato internacional, así que lo dejamos con el "+" delante.
 * -----------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var perfiles = (global.CB && global.CB.perfiles)
    ? global.CB.perfiles
    : (typeof require !== 'undefined' ? require('./perfiles.js') : null);

  /** Escapa un valor para CSV según RFC 4180. */
  function escapar(valor, delimitador) {
    var v = (valor === null || valor === undefined) ? '' : String(valor);
    // Protección anti "CSV injection" en Excel/Sheets
    if (/^[=+\-@\t\r]/.test(v) && !/^\+\d/.test(v)) {
      v = "'" + v;  // el "+" de un teléfono internacional se respeta
    }
    if (v.indexOf(delimitador) !== -1 || v.indexOf('"') !== -1 ||
        v.indexOf('\n') !== -1 || v.indexOf('\r') !== -1) {
      return '"' + v.replace(/"/g, '""') + '"';
    }
    return v;
  }

  /**
   * Construye el texto CSV.
   * @param {Array<Object>} contactos  Objetos con claves EMAIL, NOMBRE, ...
   * @param {Object} opciones { perfil:'brevo', delimitador:';', finLinea:'\r\n',
   *                            columnasVacias:false }
   * @returns {string}
   */
  function generarCSV(contactos, opciones) {
    var o = opciones || {};
    var perfil = perfiles.PERFILES[o.perfil || 'brevo'] || perfiles.PERFILES.brevo;
    var d = o.delimitador || perfil.delimitadorSugerido;
    var eol = o.finLinea || '\r\n';

    var columnas = perfil.columnas.slice();

    // Opcionalmente omitimos columnas que están vacías en TODOS los contactos
    if (o.omitirColumnasVacias) {
      columnas = columnas.filter(function (c) {
        if (c[0] === 'EMAIL') return true; // siempre
        return contactos.some(function (ct) { return ct[c[0]]; });
      });
    }

    var lineas = [];
    lineas.push(columnas.map(function (c) { return escapar(c[1], d); }).join(d));

    for (var i = 0; i < contactos.length; i++) {
      var ct = contactos[i];
      var celdas = new Array(columnas.length);
      for (var j = 0; j < columnas.length; j++) {
        celdas[j] = escapar(ct[columnas[j][0]] || '', d);
      }
      lineas.push(celdas.join(d));
    }

    return lineas.join(eol) + eol;
  }

  // ===========================================================================
  // Codificación de bytes
  // ===========================================================================

  /** Convierte texto a Uint8Array en UTF-8 (con o sin BOM). */
  function aUTF8(texto, conBOM) {
    var cuerpo;
    if (typeof TextEncoder !== 'undefined') {
      cuerpo = new TextEncoder().encode(texto);
    } else if (typeof Buffer !== 'undefined') {
      cuerpo = new Uint8Array(Buffer.from(texto, 'utf8'));
    } else {
      cuerpo = new Uint8Array(unescape(encodeURIComponent(texto)).split('').map(function (c) {
        return c.charCodeAt(0);
      }));
    }
    if (!conBOM) return cuerpo;

    var salida = new Uint8Array(cuerpo.length + 3);
    salida[0] = 0xEF; salida[1] = 0xBB; salida[2] = 0xBF;
    salida.set(cuerpo, 3);
    return salida;
  }

  /** Quita acentos de un carácter que no cabe en ISO-8859-1. */
  function transliterar(car) {
    var base = car.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return base.length ? base : '?';
  }

  /** Convierte texto a Uint8Array en ISO-8859-1 (Latin-1). */
  function aLatin1(texto) {
    var bytes = [];
    for (var i = 0; i < texto.length; i++) {
      var cp = texto.charCodeAt(i);
      if (cp <= 0xFF) { bytes.push(cp); continue; }
      var alt = transliterar(texto[i]);
      for (var k = 0; k < alt.length; k++) {
        var c2 = alt.charCodeAt(k);
        bytes.push(c2 <= 0xFF ? c2 : 0x3F); // '?'
      }
    }
    return new Uint8Array(bytes);
  }

  /**
   * Codifica el texto CSV según la opción elegida.
   * @param {string} texto
   * @param {'utf8bom'|'utf8'|'latin1'} codificacion
   * @returns {Uint8Array}
   */
  function codificar(texto, codificacion) {
    switch (codificacion) {
      case 'utf8':    return aUTF8(texto, false);
      case 'latin1':  return aLatin1(texto);
      case 'utf8bom':
      default:        return aUTF8(texto, true);
    }
  }

  /** MIME adecuado para la descarga. */
  function tipoMime(codificacion) {
    return codificacion === 'latin1'
      ? 'text/csv;charset=iso-8859-1'
      : 'text/csv;charset=utf-8';
  }

  var API = {
    escapar: escapar,
    generarCSV: generarCSV,
    codificar: codificar,
    aUTF8: aUTF8,
    aLatin1: aLatin1,
    tipoMime: tipoMime
  };

  global.CB = global.CB || {};
  global.CB.exportador = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof self !== 'undefined' ? self : this);
