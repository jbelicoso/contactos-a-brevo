/**
 * parsers.js
 * -----------------------------------------------------------------------------
 * Lectores de los distintos formatos de entrada. TODOS devuelven la misma
 * estructura ("tabla") para que el resto de la aplicación no tenga que saber
 * de dónde vienen los datos:
 *
 *   {
 *     encabezados: ['Nombre', 'Correo', ...],   // nombres de columna
 *     filas:       [['Ana', 'ana@x.com'], ...], // matriz de valores
 *     origen:      'csv' | 'excel' | 'vcf' | 'whatsapp' | 'texto',
 *     aviso:       'texto informativo opcional'
 *   }
 * -----------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var validacion = (global.CB && global.CB.validacion)
    ? global.CB.validacion
    : (typeof require !== 'undefined' ? require('./validacion.js') : null);
  var telefono = (global.CB && global.CB.telefono)
    ? global.CB.telefono
    : (typeof require !== 'undefined' ? require('./telefono.js') : null);

  // ===========================================================================
  // 1. CSV / TSV  (analizador propio, soporta comillas dobles y saltos de línea)
  // ===========================================================================

  /** Detecta el delimitador más probable analizando las primeras líneas. */
  function detectarDelimitador(texto) {
    var muestra = texto.split(/\r?\n/).slice(0, 20).join('\n');
    var candidatos = ['\t', ';', ',', '|'];
    var mejor = ',';
    var mejorPuntaje = -1;

    candidatos.forEach(function (d) {
      // Contamos ocurrencias FUERA de comillas
      var dentro = false, cuenta = 0;
      for (var i = 0; i < muestra.length; i++) {
        var c = muestra[i];
        if (c === '"') dentro = !dentro;
        else if (c === d && !dentro) cuenta++;
      }
      if (cuenta > mejorPuntaje) { mejorPuntaje = cuenta; mejor = d; }
    });
    return mejorPuntaje > 0 ? mejor : ',';
  }

  /**
   * Analiza un texto CSV completo respetando comillas.
   * @returns {Array<Array<string>>} matriz de celdas
   */
  function analizarCSV(texto, delimitador) {
    var filas = [];
    var fila = [];
    var celda = '';
    var dentroComillas = false;
    var i = 0;
    var n = texto.length;

    // Quitar BOM si existe
    if (texto.charCodeAt(0) === 0xFEFF) { i = 1; }

    while (i < n) {
      var c = texto[i];

      if (dentroComillas) {
        if (c === '"') {
          if (texto[i + 1] === '"') { celda += '"'; i += 2; continue; } // comilla escapada
          dentroComillas = false; i++; continue;
        }
        celda += c; i++; continue;
      }

      if (c === '"') { dentroComillas = true; i++; continue; }

      if (c === delimitador) { fila.push(celda); celda = ''; i++; continue; }

      if (c === '\r') { i++; continue; }

      if (c === '\n') {
        fila.push(celda); filas.push(fila);
        fila = []; celda = ''; i++; continue;
      }

      celda += c; i++;
    }

    // Última celda / fila pendiente
    if (celda !== '' || fila.length > 0) { fila.push(celda); filas.push(fila); }

    // Eliminar filas totalmente vacías
    return filas.filter(function (f) {
      return f.some(function (v) { return String(v).trim() !== ''; });
    });
  }

  /**
   * Decide si la primera fila es un encabezado.
   * Heurística: si NINGUNA celda de la primera fila es un email/teléfono válido
   * pero SÍ las hay en las siguientes filas, es un encabezado.
   */
  function pareceEncabezado(filas) {
    if (!filas.length) return false;
    var primera = filas[0];

    var datosEnPrimera = primera.some(function (v) {
      return validacion.pareceEmail(v) || telefono.pareceTelefono(v);
    });
    if (datosEnPrimera) return false;

    // Palabras típicas de encabezado
    var claves = /(email|correo|e-?mail|mail|nombre|name|apellido|surname|tel|phone|celular|movil|móvil|empresa|company|lista|list|contacto)/i;
    if (primera.some(function (v) { return claves.test(String(v)); })) return true;

    // Si hay más filas y en ellas sí hay datos reconocibles -> la 1ª es encabezado
    var siguientes = filas.slice(1, 15);
    var datosDespues = siguientes.some(function (f) {
      return f.some(function (v) {
        return validacion.pareceEmail(v) || telefono.pareceTelefono(v);
      });
    });
    return datosDespues;
  }

  /** Convierte una matriz en la estructura "tabla". */
  function matrizATabla(matriz, origen, aviso) {
    if (!matriz.length) return { encabezados: [], filas: [], origen: origen, aviso: 'El archivo no contiene datos.' };

    var conEncabezado = pareceEncabezado(matriz);
    var encabezados, filas;

    if (conEncabezado) {
      encabezados = matriz[0].map(function (h, i) {
        var t = validacion.limpiarTexto(h);
        return t || ('Columna ' + (i + 1));
      });
      filas = matriz.slice(1);
    } else {
      var ancho = matriz.reduce(function (m, f) { return Math.max(m, f.length); }, 0);
      encabezados = [];
      for (var i = 0; i < ancho; i++) encabezados.push('Columna ' + (i + 1));
      filas = matriz;
    }

    // Normalizar el ancho de todas las filas
    filas = filas.map(function (f) {
      var copia = f.slice(0, encabezados.length);
      while (copia.length < encabezados.length) copia.push('');
      return copia;
    });

    return { encabezados: encabezados, filas: filas, origen: origen, aviso: aviso || '' };
  }

  function parsearCSV(texto, delimitador) {
    var d = delimitador || detectarDelimitador(texto);
    var matriz = analizarCSV(texto, d);
    var nombre = d === '\t' ? 'tabulaciones' : ('"' + d + '"');
    return matrizATabla(matriz, 'csv', 'Delimitador detectado: ' + nombre + '.');
  }

  // ===========================================================================
  // 2. vCard (.vcf)  — exportaciones de contactos de Android / iPhone / WhatsApp
  // ===========================================================================

  /** Decodifica texto Quoted-Printable (habitual en .vcf de Android). */
  function decodificarQP(txt) {
    var limpio = txt.replace(/=\r?\n/g, '');
    var bytes = [];
    for (var i = 0; i < limpio.length; i++) {
      if (limpio[i] === '=' && /[0-9A-F]{2}/i.test(limpio.substr(i + 1, 2))) {
        bytes.push(parseInt(limpio.substr(i + 1, 2), 16));
        i += 2;
      } else {
        bytes.push(limpio.charCodeAt(i));
      }
    }
    try {
      if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
      }
      if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('utf8');
    } catch (e) { /* si falla, devolvemos el texto plano */ }
    return limpio;
  }

  function parsearVCF(texto) {
    // "Desdoblar" líneas continuadas (empiezan con espacio o tabulación)
    var plano = texto.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
    var bloques = plano.split(/BEGIN:VCARD/i).slice(1);

    var filas = [];
    bloques.forEach(function (bloque) {
      var lineas = bloque.split('\n');
      var c = { nombre: '', apellido: '', completo: '', tels: [], emails: [], empresa: '' };

      lineas.forEach(function (linea) {
        var sep = linea.indexOf(':');
        if (sep === -1) return;
        var clave = linea.slice(0, sep);
        var valor = linea.slice(sep + 1).trim();
        if (!valor) return;

        var partesClave = clave.toUpperCase().split(';');
        var prop = partesClave[0].replace(/^ITEM\d+\./, '');

        if (/ENCODING=QUOTED-PRINTABLE/i.test(clave)) valor = decodificarQP(valor);

        if (prop === 'FN') {
          c.completo = validacion.limpiarTexto(valor.replace(/\\,/g, ','));
        } else if (prop === 'N') {
          // Formato: Apellido;Nombre;SegundoNombre;Prefijo;Sufijo
          var p = valor.split(';');
          c.apellido = validacion.limpiarTexto((p[0] || '').replace(/\\,/g, ','));
          c.nombre = validacion.limpiarTexto([p[1], p[2]].filter(Boolean).join(' ').replace(/\\,/g, ','));
        } else if (prop === 'TEL') {
          c.tels.push(valor);
        } else if (prop === 'EMAIL') {
          c.emails.push(valor);
        } else if (prop === 'ORG') {
          c.empresa = validacion.limpiarTexto(valor.split(';')[0].replace(/\\,/g, ','));
        }
      });

      // Si no hay N pero sí FN, dividimos el nombre completo
      if (!c.nombre && !c.apellido && c.completo) {
        var sepa = validacion.separarNombre(c.completo);
        c.nombre = sepa.nombre; c.apellido = sepa.apellido;
      }

      if (!c.emails.length && !c.tels.length && !c.completo) return; // vCard vacía

      // Una fila por cada combinación relevante: priorizamos email, si no, teléfono
      var maxFilas = Math.max(c.emails.length, c.tels.length, 1);
      for (var k = 0; k < maxFilas; k++) {
        filas.push([
          c.nombre || '',
          c.apellido || '',
          c.emails[k] || (k === 0 ? '' : ''),
          c.tels[k] || (k === 0 ? (c.tels[0] || '') : ''),
          c.empresa || ''
        ]);
      }
    });

    return {
      encabezados: ['Nombre', 'Apellido', 'Email', 'Teléfono', 'Empresa'],
      filas: filas,
      origen: 'vcf',
      aviso: 'Se leyeron ' + bloques.length + ' tarjetas vCard.'
    };
  }

  // ===========================================================================
  // 3. Exportación de chat de WhatsApp (.txt)
  // ===========================================================================

  // [12/03/24, 10:33:11] Juan Pérez: hola     |     12/3/24, 10:33 - +593 99 123 4567: hola
  var RE_LINEA_WA = /^\[?\s*\d{1,4}[\/.\-]\d{1,2}[\/.\-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?\s?m\.?)?\s*\]?\s*[-–—]?\s*([^:]{1,80}?):\s/i;

  /** ¿El texto parece una exportación de chat de WhatsApp? */
  function pareceWhatsApp(texto) {
    var lineas = texto.split(/\r?\n/).slice(0, 60);
    var coincidencias = lineas.filter(function (l) { return RE_LINEA_WA.test(l); }).length;
    return coincidencias >= 3;
  }

  function parsearWhatsApp(texto) {
    var lineas = texto.split(/\r?\n/);
    var vistos = Object.create(null);
    var filas = [];
    var mensajes = 0;

    lineas.forEach(function (linea) {
      var m = linea.match(RE_LINEA_WA);
      if (!m) return;
      mensajes++;

      var remitente = validacion.limpiarTexto(m[1]).replace(/^~\s*/, ''); // "~ Alias"
      if (!remitente) return;
      // Mensajes de sistema ("Juan añadió a Pedro", cifrado, etc.)
      if (/^(mensajes y llamadas|messages and calls|los mensajes)/i.test(remitente)) return;

      var clave = remitente.toLowerCase();
      if (vistos[clave]) return;
      vistos[clave] = true;

      if (telefono.pareceTelefono(remitente)) {
        filas.push(['', remitente]);          // solo número
      } else {
        filas.push([remitente, '']);          // nombre guardado en la agenda
      }
    });

    // También rescatamos números sueltos que aparezcan en el cuerpo del chat
    // (por ejemplo, cuando alguien comparte un contacto).
    return {
      encabezados: ['Nombre', 'Teléfono'],
      filas: filas,
      origen: 'whatsapp',
      aviso: 'Se analizaron ' + mensajes + ' mensajes y se encontraron ' +
             filas.length + ' participantes únicos. Los contactos guardados en tu ' +
             'agenda aparecen con nombre pero sin número: WhatsApp no lo incluye en la exportación.'
    };
  }

  // ===========================================================================
  // 4. Texto libre pegado por el usuario
  // ===========================================================================

  /**
   * Analiza texto pegado. Primero intenta interpretarlo como tabla delimitada;
   * si no lo consigue, extrae email / teléfono / nombre de cada línea.
   */
  function parsearTextoPegado(texto) {
    var t = String(texto).replace(/\r\n/g, '\n').trim();
    if (!t) return { encabezados: [], filas: [], origen: 'texto', aviso: 'No se pegó ningún contenido.' };

    if (pareceWhatsApp(t)) return parsearWhatsApp(t);
    if (/BEGIN:VCARD/i.test(t)) return parsearVCF(t);

    var delim = detectarDelimitador(t);
    var lineas = t.split('\n').filter(function (l) { return l.trim() !== ''; });

    // ¿La mayoría de líneas tienen el delimitador? -> tratamos como CSV
    var conDelim = lineas.filter(function (l) { return l.indexOf(delim) !== -1; }).length;
    if (lineas.length > 0 && conDelim / lineas.length > 0.6) {
      return parsearCSV(t, delim);
    }

    // Modo "texto suelto": una línea = un contacto
    var filas = lineas.map(function (linea) {
      var resto = linea;
      var email = '';
      var tel = '';

      var emails = validacion.extraerEmails(resto);
      if (emails.length) {
        email = emails[0];
        resto = resto.replace(new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), ' ');
      }

      // Teléfono: secuencia larga de dígitos con separadores típicos
      var mTel = resto.match(/(\+?\d[\d\s().\-]{6,20}\d)/);
      if (mTel) {
        tel = mTel[1].trim();
        resto = resto.replace(mTel[1], ' ');
      }

      var nombre = validacion.limpiarTexto(resto.replace(/[<>,;|\t]+/g, ' '));
      return [nombre, email, tel];
    }).filter(function (f) { return f[0] || f[1] || f[2]; });

    return {
      encabezados: ['Nombre', 'Email', 'Teléfono'],
      filas: filas,
      origen: 'texto',
      aviso: 'Texto interpretado línea a línea (no se detectó una tabla con delimitadores).'
    };
  }

  /** Elige el analizador adecuado según el nombre del archivo y su contenido. */
  function parsearTextoDeArchivo(texto, nombreArchivo) {
    var ext = (nombreArchivo || '').toLowerCase().split('.').pop();

    if (ext === 'vcf' || /BEGIN:VCARD/i.test(texto.slice(0, 2000))) return parsearVCF(texto);
    if (pareceWhatsApp(texto)) return parsearWhatsApp(texto);
    if (ext === 'csv' || ext === 'tsv') return parsearCSV(texto);
    return parsearTextoPegado(texto);
  }

  var API = {
    detectarDelimitador: detectarDelimitador,
    analizarCSV: analizarCSV,
    matrizATabla: matrizATabla,
    pareceEncabezado: pareceEncabezado,
    parsearCSV: parsearCSV,
    parsearVCF: parsearVCF,
    parsearWhatsApp: parsearWhatsApp,
    pareceWhatsApp: pareceWhatsApp,
    parsearTextoPegado: parsearTextoPegado,
    parsearTextoDeArchivo: parsearTextoDeArchivo
  };

  global.CB = global.CB || {};
  global.CB.parsers = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof self !== 'undefined' ? self : this);
