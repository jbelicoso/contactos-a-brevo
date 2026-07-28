/**
 * app.js
 * -----------------------------------------------------------------------------
 * Controlador de la interfaz: une la lectura de archivos, el mapeo de columnas,
 * el procesamiento (en Web Worker) y la descarga del CSV.
 *
 * Ningún dato sale del navegador: no hay peticiones de red salvo la carga
 * inicial de la librería SheetJS desde el CDN (y solo si no hay copia local).
 * -----------------------------------------------------------------------------
 */
(function () {
  'use strict';

  var CB = window.CB;
  var TAM_MAX_MB = 50;                 // tamaño máximo de archivo aceptado
  var LIMITE_BREVO = 100000;           // contactos por archivo que admite Brevo
  var CLAVE_PLANTILLAS = 'cb_plantillas_mapeo';

  // Estado de la aplicación --------------------------------------------------
  var estado = {
    tabla: null,        // { encabezados, filas, origen, aviso }
    libroExcel: null,   // libro SheetJS cuando hay varias hojas
    nombreArchivo: '',
    mapeo: {},          // { indiceColumna: 'CAMPO' }
    resultado: null,    // { csv, estadisticas, muestra, invalidos, totalContactos }
    trabajador: null
  };

  // ===========================================================================
  // Utilidades cortas de DOM
  // ===========================================================================
  function $(sel) { return document.querySelector(sel); }
  function crear(tag, clase, texto) {
    var el = document.createElement(tag);
    if (clase) el.className = clase;
    if (texto !== undefined) el.textContent = texto;
    return el;
  }
  function mostrar(sel) { $(sel).classList.remove('oculto'); }
  function ocultar(sel) { $(sel).classList.add('oculto'); }
  function numero(n) { return (n || 0).toLocaleString('es-ES'); }

  var temporizadorBrindis;
  function brindis(mensaje) {
    var el = $('#brindis');
    el.textContent = mensaje;
    el.classList.add('brindis--visible');
    clearTimeout(temporizadorBrindis);
    temporizadorBrindis = setTimeout(function () {
      el.classList.remove('brindis--visible');
    }, 2800);
  }

  function error(mensaje) {
    var el = $('#alertaEntrada');
    el.textContent = mensaje;
    el.classList.remove('oculto');
  }
  function limpiarError() { ocultar('#alertaEntrada'); }

  // ===========================================================================
  // Arranque
  // ===========================================================================
  function iniciar() {
    $('#maxMB').textContent = TAM_MAX_MB;
    rellenarSelectorPaises();
    rellenarSelectorPerfiles();
    cargarListaPlantillas();
    conectarEventos();
  }

  function rellenarSelectorPaises() {
    var sel = $('#optPais');
    CB.paises.PAISES.slice()
      .sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); })
      .forEach(function (p) {
        var o = crear('option', null, p.nombre + '  (+' + p.codigo + ')');
        o.value = p.iso;
        sel.appendChild(o);
      });
    sel.value = 'EC'; // Ecuador por defecto; cámbialo si trabajas con otro país
  }

  function rellenarSelectorPerfiles() {
    var sel = $('#optPerfil');
    Object.keys(CB.perfiles.PERFILES).forEach(function (id) {
      var o = crear('option', null, CB.perfiles.PERFILES[id].nombre);
      o.value = id;
      sel.appendChild(o);
    });
    sel.value = 'brevo';
    alCambiarPerfil();
  }

  function alCambiarPerfil() {
    var p = CB.perfiles.PERFILES[$('#optPerfil').value];
    $('#notaPerfil').textContent = p.nota;
    $('#optDelimitador').value = p.delimitadorSugerido;
    $('#optNombreArchivo').value = 'contactos-' + p.id;
  }

  // ===========================================================================
  // Eventos
  // ===========================================================================
  function conectarEventos() {
    // --- Pestañas ---
    document.querySelectorAll('.pestana').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.pestana').forEach(function (x) { x.classList.remove('pestana--activa'); });
        document.querySelectorAll('.panel').forEach(function (x) { x.classList.remove('panel--activo'); });
        b.classList.add('pestana--activa');
        $('#' + b.dataset.panel).classList.add('panel--activo');
      });
    });

    // --- Zona de arrastre ---
    var zona = $('#zonaSuelta');
    var entrada = $('#entradaArchivo');

    zona.addEventListener('click', function () { entrada.click(); });
    zona.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); entrada.click(); }
    });
    entrada.addEventListener('change', function () {
      if (entrada.files && entrada.files[0]) recibirArchivo(entrada.files[0]);
    });

    ['dragenter', 'dragover'].forEach(function (ev) {
      zona.addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation();
        zona.classList.add('zona-suelta--activa');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      zona.addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation();
        zona.classList.remove('zona-suelta--activa');
      });
    });
    zona.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) recibirArchivo(f);
    });
    // Evita que el navegador abra el archivo si se suelta fuera de la zona
    ['dragover', 'drop'].forEach(function (ev) {
      window.addEventListener(ev, function (e) { e.preventDefault(); });
    });

    // --- Texto pegado ---
    $('#btnAnalizarTexto').addEventListener('click', analizarTextoPegado);
    $('#btnLimpiarTexto').addEventListener('click', function () { $('#areaPegado').value = ''; });

    // --- Hojas de Excel ---
    $('#selectorHoja').addEventListener('change', function () {
      cargarHojaExcel(this.value);
    });

    // --- Opciones ---
    $('#optPerfil').addEventListener('change', alCambiarPerfil);

    // --- Plantillas ---
    $('#btnGuardarPlantilla').addEventListener('click', guardarPlantilla);
    $('#btnBorrarPlantilla').addEventListener('click', borrarPlantilla);
    $('#selectorPlantilla').addEventListener('change', aplicarPlantilla);

    // --- Acciones principales ---
    $('#btnProcesar').addEventListener('click', procesar);
    $('#btnReiniciar').addEventListener('click', function () { location.reload(); });
    $('#btnDescargar').addEventListener('click', descargarCSV);
    $('#btnCopiar').addEventListener('click', copiarCSV);
    $('#btnVerErrores').addEventListener('click', function () {
      $('#bloqueErrores').classList.toggle('oculto');
    });
    $('#btnDescargarErrores').addEventListener('click', descargarErrores);
  }

  // ===========================================================================
  // Lectura de archivos
  // ===========================================================================
  var EXT_EXCEL = ['xlsx', 'xls', 'xlsm', 'xlsb', 'ods'];
  var EXT_TEXTO = ['csv', 'tsv', 'txt', 'vcf', 'vcard'];

  function recibirArchivo(archivo) {
    limpiarError();

    var ext = archivo.name.toLowerCase().split('.').pop();
    if (EXT_EXCEL.indexOf(ext) === -1 && EXT_TEXTO.indexOf(ext) === -1) {
      error('Formato no admitido: «.' + ext + '». Usa Excel (.xlsx, .xls), CSV, TSV, TXT o vCard (.vcf).');
      return;
    }
    if (archivo.size > TAM_MAX_MB * 1024 * 1024) {
      error('El archivo pesa ' + (archivo.size / 1048576).toFixed(1) + ' MB y el máximo son ' +
            TAM_MAX_MB + ' MB. Divídelo en partes más pequeñas.');
      return;
    }
    if (archivo.size === 0) { error('El archivo está vacío.'); return; }

    estado.nombreArchivo = archivo.name;
    $('#archivoInfo').innerHTML = '📄 <strong>' + escaparHTML(archivo.name) + '</strong> · ' +
      (archivo.size / 1024).toFixed(1) + ' KB · leyendo…';
    mostrar('#archivoInfo');

    var lector = new FileReader();
    lector.onerror = function () { error('No se pudo leer el archivo.'); };

    if (EXT_EXCEL.indexOf(ext) !== -1) {
      lector.onload = function (e) { leerExcel(e.target.result, archivo); };
      lector.readAsArrayBuffer(archivo);
    } else {
      lector.onload = function (e) {
        var texto = decodificarBytes(new Uint8Array(e.target.result));
        var tabla = CB.parsers.parsearTextoDeArchivo(texto, archivo.name);
        aceptarTabla(tabla, archivo);
      };
      lector.readAsArrayBuffer(archivo);
    }
  }

  /**
   * Decodifica bytes de texto probando UTF-8 y, si aparecen caracteres
   * corruptos, reintentando con Windows-1252 (habitual en Excel en español).
   */
  function decodificarBytes(bytes) {
    var texto;
    try {
      texto = new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
      texto = String.fromCharCode.apply(null, bytes);
    }
    var corruptos = (texto.match(/�/g) || []).length;
    if (corruptos > 0 && corruptos / Math.max(texto.length, 1) > 0.0002) {
      try {
        texto = new TextDecoder('windows-1252').decode(bytes);
      } catch (e2) { /* nos quedamos con la versión UTF-8 */ }
    }
    return texto.replace(/^﻿/, '');
  }

  function leerExcel(buffer, archivo) {
    if (typeof XLSX === 'undefined') {
      error('No se pudo cargar la librería de Excel (SheetJS). Conéctate a Internet una vez ' +
            'o descarga xlsx.full.min.js en la carpeta js/lib/. Mientras tanto, guarda tu ' +
            'archivo como CSV desde Excel y vuelve a intentarlo.');
      return;
    }
    try {
      var libro = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: false, raw: false });
      estado.libroExcel = libro;

      var hojas = libro.SheetNames;
      var sel = $('#selectorHoja');
      sel.innerHTML = '';
      hojas.forEach(function (h) {
        var o = crear('option', null, h);
        o.value = h;
        sel.appendChild(o);
      });

      if (hojas.length > 1) mostrar('#bloqueHojas'); else ocultar('#bloqueHojas');

      // Elegimos la primera hoja que contenga datos
      var elegida = hojas.find(function (h) {
        var m = XLSX.utils.sheet_to_json(libro.Sheets[h], { header: 1, blankrows: false, defval: '' });
        return m.length > 0;
      }) || hojas[0];

      sel.value = elegida;
      cargarHojaExcel(elegida, archivo);
    } catch (e) {
      error('No se pudo leer el archivo de Excel: ' + e.message);
    }
  }

  function cargarHojaExcel(nombreHoja, archivo) {
    if (!estado.libroExcel) return;
    var hoja = estado.libroExcel.Sheets[nombreHoja];
    if (!hoja) return;

    var matriz = XLSX.utils.sheet_to_json(hoja, { header: 1, blankrows: false, defval: '', raw: false });
    matriz = matriz.map(function (f) {
      return f.map(function (c) { return c === null || c === undefined ? '' : String(c); });
    }).filter(function (f) {
      return f.some(function (v) { return v.trim() !== ''; });
    });

    if (!matriz.length) {
      error('La hoja «' + nombreHoja + '» está vacía. Elige otra hoja del libro.');
      return;
    }

    var tabla = CB.parsers.matrizATabla(matriz, 'excel', 'Hoja «' + nombreHoja + '» del libro de Excel.');
    aceptarTabla(tabla, archivo);
  }

  function analizarTextoPegado() {
    limpiarError();
    var texto = $('#areaPegado').value;
    if (!texto.trim()) { error('No has pegado ningún texto.'); return; }

    var tabla = CB.parsers.parsearTextoPegado(texto);
    if (!tabla.filas.length) {
      error('No se encontró ningún contacto en el texto pegado.');
      return;
    }
    estado.nombreArchivo = 'texto-pegado';
    estado.libroExcel = null;
    ocultar('#bloqueHojas');
    ocultar('#archivoInfo');
    aceptarTabla(tabla, null);
  }

  // ===========================================================================
  // Paso 2: previsualización y mapeo
  // ===========================================================================
  function aceptarTabla(tabla, archivo) {
    if (!tabla || !tabla.filas.length) {
      error('El archivo no contiene filas de datos reconocibles.');
      return;
    }
    limpiarError();
    estado.tabla = tabla;

    if (archivo) {
      $('#archivoInfo').innerHTML = '📄 <strong>' + escaparHTML(archivo.name) + '</strong> · ' +
        (archivo.size / 1024).toFixed(1) + ' KB · ' + numero(tabla.filas.length) + ' filas leídas';
    }

    var partes = [];
    if (tabla.aviso) partes.push(tabla.aviso);
    partes.push(numero(tabla.filas.length) + ' filas · ' + tabla.encabezados.length + ' columnas.');
    $('#notaOrigen').textContent = partes.join(' ');
    $('#etiquetaFilas').textContent = '(primeras 10 de ' + numero(tabla.filas.length) + ')';

    var sugerencia = CB.detector.sugerirMapeo(tabla.encabezados, tabla.filas);
    estado.mapeo = sugerencia.mapeo;

    pintarMapeo();
    pintarTablaPrevia();

    mostrar('#paso-2');
    mostrar('#paso-3');
    ocultar('#paso-4');
    $('#paso-2').scrollIntoView({ behavior: 'smooth', block: 'start' });

    avisarSiFaltaEmail();
  }

  function pintarMapeo() {
    var cont = $('#contenedorMapeo');
    cont.innerHTML = '';

    estado.tabla.encabezados.forEach(function (enc, idx) {
      var item = crear('div', 'mapeo__item');

      item.appendChild(crear('div', 'mapeo__origen', enc));

      // Muestra de hasta 3 valores reales de esa columna
      var ejemplos = [];
      for (var i = 0; i < estado.tabla.filas.length && ejemplos.length < 3; i++) {
        var v = estado.tabla.filas[i][idx];
        if (v !== undefined && String(v).trim() !== '') ejemplos.push(String(v).trim());
      }
      item.appendChild(crear('div', 'mapeo__muestra', ejemplos.join(' · ') || '(sin datos)'));

      var sel = crear('select');
      sel.dataset.columna = idx;
      CB.detector.CAMPOS.forEach(function (c) {
        var o = crear('option', null, c.etiqueta);
        o.value = c.id;
        sel.appendChild(o);
      });
      sel.value = estado.mapeo[idx] || 'IGNORAR';
      if (sel.value !== 'IGNORAR') item.classList.add('mapeo__item--asignado');

      sel.addEventListener('change', function () {
        var campo = this.value;
        var col = parseInt(this.dataset.columna, 10);

        // Un mismo campo no puede estar en dos columnas: liberamos la anterior
        if (campo !== 'IGNORAR') {
          Object.keys(estado.mapeo).forEach(function (otra) {
            if (parseInt(otra, 10) !== col && estado.mapeo[otra] === campo) {
              estado.mapeo[otra] = 'IGNORAR';
            }
          });
        }
        estado.mapeo[col] = campo;
        pintarMapeo();
        pintarTablaPrevia();
        avisarSiFaltaEmail();
      });

      item.appendChild(sel);
      cont.appendChild(item);
    });
  }

  function avisarSiFaltaEmail() {
    var hayEmail = Object.keys(estado.mapeo).some(function (k) { return estado.mapeo[k] === 'EMAIL'; });
    var requiere = $('#optRequerirEmail').checked;
    if (!hayEmail && requiere) {
      error('No se detectó ninguna columna de email. Asígnala manualmente arriba o desmarca ' +
            '«Descartar contactos sin email válido» si solo vas a importar teléfonos.');
    } else {
      limpiarError();
    }
  }

  function pintarTablaPrevia() {
    var tabla = $('#tablaPrevia');
    tabla.innerHTML = '';

    var thead = crear('thead');
    var trh = crear('tr');
    estado.tabla.encabezados.forEach(function (enc, idx) {
      var th = crear('th');
      th.appendChild(document.createTextNode(enc));
      var campo = estado.mapeo[idx];
      if (campo && campo !== 'IGNORAR') {
        th.appendChild(crear('span', 'tabla__etiqueta', campo));
      }
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    tabla.appendChild(thead);

    var tbody = crear('tbody');
    estado.tabla.filas.slice(0, 10).forEach(function (fila) {
      var tr = crear('tr');
      estado.tabla.encabezados.forEach(function (_, idx) {
        var valor = fila[idx] === undefined ? '' : String(fila[idx]);
        var td = crear('td', null, valor);
        td.title = valor;

        // Marcamos en rojo los valores inválidos del campo asignado
        var campo = estado.mapeo[idx];
        if (valor.trim()) {
          if (campo === 'EMAIL' && !CB.validacion.pareceEmail(valor)) td.className = 'celda--mala';
          if (campo === 'TELEFONO' && !CB.telefono.normalizar(valor, $('#optPais').value).ok) {
            td.className = 'celda--mala';
          }
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    tabla.appendChild(tbody);
  }

  // ===========================================================================
  // Plantillas de mapeo (localStorage)
  // ===========================================================================
  function leerPlantillas() {
    try { return JSON.parse(localStorage.getItem(CLAVE_PLANTILLAS) || '{}'); }
    catch (e) { return {}; }
  }
  function escribirPlantillas(obj) {
    try { localStorage.setItem(CLAVE_PLANTILLAS, JSON.stringify(obj)); }
    catch (e) { brindis('No se pudieron guardar las plantillas en este navegador.'); }
  }
  function cargarListaPlantillas() {
    var sel = $('#selectorPlantilla');
    var guardadas = leerPlantillas();
    sel.innerHTML = '<option value="">— Ninguna —</option>';
    Object.keys(guardadas).sort().forEach(function (n) {
      var o = crear('option', null, n);
      o.value = n;
      sel.appendChild(o);
    });
  }
  function guardarPlantilla() {
    if (!estado.tabla) { brindis('Carga primero un archivo.'); return; }
    var nombre = prompt('Nombre para esta plantilla de mapeo:', estado.nombreArchivo || 'Mi plantilla');
    if (!nombre) return;

    var guardadas = leerPlantillas();
    // Guardamos por NOMBRE de encabezado (no por posición) para que funcione
    // aunque el orden de las columnas cambie en el próximo archivo.
    var porEncabezado = {};
    estado.tabla.encabezados.forEach(function (enc, idx) {
      porEncabezado[CB.detector.normalizarClave(enc)] = estado.mapeo[idx] || 'IGNORAR';
    });
    guardadas[nombre] = { encabezados: porEncabezado, creada: new Date().toISOString() };
    escribirPlantillas(guardadas);
    cargarListaPlantillas();
    $('#selectorPlantilla').value = nombre;
    brindis('Plantilla «' + nombre + '» guardada.');
  }
  function borrarPlantilla() {
    var nombre = $('#selectorPlantilla').value;
    if (!nombre) { brindis('Selecciona primero una plantilla.'); return; }
    var guardadas = leerPlantillas();
    delete guardadas[nombre];
    escribirPlantillas(guardadas);
    cargarListaPlantillas();
    brindis('Plantilla eliminada.');
  }
  function aplicarPlantilla() {
    var nombre = $('#selectorPlantilla').value;
    if (!nombre || !estado.tabla) return;
    var p = leerPlantillas()[nombre];
    if (!p) return;

    var aplicadas = 0;
    estado.tabla.encabezados.forEach(function (enc, idx) {
      var clave = CB.detector.normalizarClave(enc);
      if (p.encabezados[clave]) { estado.mapeo[idx] = p.encabezados[clave]; aplicadas++; }
    });
    pintarMapeo();
    pintarTablaPrevia();
    brindis(aplicadas + ' columna(s) asignadas desde la plantilla.');
  }

  // ===========================================================================
  // Paso 3: procesamiento
  // ===========================================================================
  function opcionesActuales() {
    return {
      mapeo: estado.mapeo,
      paisPorDefecto: $('#optPais').value,
      formatoTelefono: $('#optFormatoTel').value,
      eliminarDuplicados: $('#optDuplicados').checked,
      criterioDuplicado: $('#optCriterioDup').value,
      requerirEmail: $('#optRequerirEmail').checked,
      capitalizarNombres: $('#optCapitalizar').checked,
      dividirNombreCompleto: $('#optDividirNombre').checked,
      omitirColumnasVacias: $('#optOmitirVacias').checked,
      perfil: $('#optPerfil').value,
      delimitador: $('#optDelimitador').value,
      valoresFijos: {
        LISTA: $('#optListaFija').value.trim(),
        EMPRESA: $('#optEmpresaFija').value.trim()
      }
    };
  }

  function procesar() {
    if (!estado.tabla) { error('Carga primero un archivo o pega una lista.'); return; }

    var opciones = opcionesActuales();
    var hayEmail = Object.keys(opciones.mapeo).some(function (k) { return opciones.mapeo[k] === 'EMAIL'; });
    if (!hayEmail && opciones.requerirEmail) {
      error('Necesitas asignar una columna al campo EMAIL (o desmarcar «Descartar contactos sin email válido»).');
      return;
    }

    $('#btnProcesar').disabled = true;
    mostrar('#bloqueProgreso');
    actualizarProgreso(0, 'Preparando…');

    // En la versión "todo en uno" no hay archivo de worker que cargar:
    // se procesa en el hilo principal por lotes (ver procesarEnHiloPrincipal).
    if (typeof Worker !== 'undefined' && !window.__ARCHIVO_UNICO__) {
      try {
        procesarConWorker(opciones);
        return;
      } catch (e) {
        // Abrir la página con doble clic (file://) impide usar Workers:
        // seguimos en el hilo principal, troceando el trabajo.
        console.warn('Web Worker no disponible, se procesa en el hilo principal.', e);
      }
    }
    procesarEnHiloPrincipal(opciones);
  }

  function procesarConWorker(opciones) {
    if (estado.trabajador) estado.trabajador.terminate();
    var w = new Worker('js/worker/procesador.worker.js');
    estado.trabajador = w;

    var falloTemprano = true;
    w.onmessage = function (e) {
      falloTemprano = false;
      var d = e.data;
      if (d.tipo === 'progreso') {
        var texto = d.fase === 'csv'
          ? 'Generando el archivo CSV…'
          : 'Procesando ' + numero(d.procesadas) + ' de ' + numero(d.total) + ' filas…';
        actualizarProgreso(d.porcentaje, texto);
      } else if (d.tipo === 'listo') {
        w.terminate(); estado.trabajador = null;
        mostrarResultado(d);
      } else if (d.tipo === 'error') {
        w.terminate(); estado.trabajador = null;
        finProceso();
        error('Error durante el procesamiento: ' + d.mensaje);
      }
    };
    w.onerror = function (ev) {
      w.terminate(); estado.trabajador = null;
      if (falloTemprano) {
        // Normalmente ocurre al abrir el HTML con file://
        console.warn('Worker no operativo, se usa el hilo principal.', ev.message);
        procesarEnHiloPrincipal(opciones);
      } else {
        finProceso();
        error('Error en el procesador: ' + (ev.message || 'desconocido'));
      }
    };

    w.postMessage({ tipo: 'procesar', filas: estado.tabla.filas, opciones: opciones });
  }

  /** Alternativa sin Worker: se procesa por lotes con pausas para no congelar la UI. */
  function procesarEnHiloPrincipal(opciones) {
    var filas = estado.tabla.filas;
    var est = CB.procesador.crearEstado(opciones);
    var i = 0;
    var LOTE = 1500;

    function siguiente() {
      var fin = Math.min(i + LOTE, filas.length);
      CB.procesador.procesarLote(est, filas.slice(i, fin));
      i = fin;

      actualizarProgreso(
        Math.floor((i / filas.length) * 100),
        'Procesando ' + numero(i) + ' de ' + numero(filas.length) + ' filas…'
      );

      if (i < filas.length) {
        setTimeout(siguiente, 0);
      } else {
        actualizarProgreso(100, 'Generando el archivo CSV…');
        setTimeout(function () {
          var csv = CB.exportador.generarCSV(est.contactos, {
            perfil: opciones.perfil,
            delimitador: opciones.delimitador,
            omitirColumnasVacias: opciones.omitirColumnasVacias
          });
          mostrarResultado({
            csv: csv,
            estadisticas: est.estadisticas,
            muestra: est.contactos.slice(0, 200),
            invalidos: est.invalidos.slice(0, 500),
            totalInvalidos: est.invalidos.length,
            totalContactos: est.contactos.length
          });
        }, 20);
      }
    }
    setTimeout(siguiente, 20);
  }

  function actualizarProgreso(pct, texto) {
    $('#progresoRelleno').style.width = pct + '%';
    $('#progresoTexto').textContent = texto + ' (' + pct + ' %)';
  }

  function finProceso() {
    $('#btnProcesar').disabled = false;
    ocultar('#bloqueProgreso');
  }

  // ===========================================================================
  // Paso 4: resultado
  // ===========================================================================
  function mostrarResultado(datos) {
    estado.resultado = datos;
    finProceso();
    limpiarError();

    var e = datos.estadisticas;
    var tarjetas = [
      { valor: datos.totalContactos, etiqueta: 'Contactos listos', clase: 'estadistica--bien' },
      { valor: e.filasLeidas,        etiqueta: 'Filas leídas',     clase: '' },
      { valor: e.duplicados,         etiqueta: 'Duplicados eliminados', clase: e.duplicados ? 'estadistica--aviso' : '' },
      { valor: datos.totalInvalidos, etiqueta: 'Descartados',      clase: datos.totalInvalidos ? 'estadistica--mal' : '' },
      { valor: e.emailInvalido,      etiqueta: 'Emails inválidos', clase: e.emailInvalido ? 'estadistica--mal' : '' },
      { valor: e.telefonosValidos,   etiqueta: 'Teléfonos válidos', clase: '' }
    ];

    var cont = $('#estadisticas');
    cont.innerHTML = '';
    tarjetas.forEach(function (t) {
      var d = crear('div', 'estadistica ' + t.clase);
      d.appendChild(crear('div', 'estadistica__valor', numero(t.valor)));
      d.appendChild(crear('div', 'estadistica__etiqueta', t.etiqueta));
      cont.appendChild(d);
    });

    // Aviso por límite de Brevo
    var perfil = CB.perfiles.PERFILES[$('#optPerfil').value];
    if (datos.totalContactos > LIMITE_BREVO) {
      var al = $('#alertaLimite');
      al.textContent = 'Tienes ' + numero(datos.totalContactos) + ' contactos y ' + perfil.nombre +
        ' admite ' + numero(LIMITE_BREVO) + ' por archivo. Divide el CSV antes de importarlo.';
      al.classList.remove('oculto');
    } else {
      ocultar('#alertaLimite');
    }

    pintarTablaResultado(datos.muestra);
    pintarTablaErrores(datos.invalidos, datos.totalInvalidos);

    mostrar('#paso-4');
    $('#paso-4').scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (datos.totalContactos === 0) {
      error('No se generó ningún contacto válido. Revisa el mapeo de columnas del paso 2.');
    }
  }

  function pintarTablaResultado(muestra) {
    var perfil = CB.perfiles.PERFILES[$('#optPerfil').value];
    var tabla = $('#tablaResultado');
    tabla.innerHTML = '';

    var thead = crear('thead');
    var trh = crear('tr');
    perfil.columnas.forEach(function (c) { trh.appendChild(crear('th', null, c[1])); });
    thead.appendChild(trh);
    tabla.appendChild(thead);

    var tbody = crear('tbody');
    muestra.slice(0, 20).forEach(function (ct) {
      var tr = crear('tr');
      perfil.columnas.forEach(function (c) {
        var td = crear('td', null, ct[c[0]] || '');
        td.title = ct[c[0]] || '';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    tabla.appendChild(tbody);
  }

  function pintarTablaErrores(invalidos, total) {
    $('#etiquetaErrores').textContent = '(' + numero(invalidos.length) +
      (total > invalidos.length ? ' de ' + numero(total) : '') + ')';

    var tabla = $('#tablaErrores');
    tabla.innerHTML = '';
    var thead = crear('thead');
    var trh = crear('tr');
    ['Fila', 'Nombre', 'Email', 'Teléfono', 'Motivo'].forEach(function (h) {
      trh.appendChild(crear('th', null, h));
    });
    thead.appendChild(trh);
    tabla.appendChild(thead);

    var tbody = crear('tbody');
    invalidos.slice(0, 200).forEach(function (x) {
      var tr = crear('tr');
      [x.fila, x.nombre, x.email, x.telefono, x.motivo].forEach(function (v) {
        tr.appendChild(crear('td', null, v === undefined || v === null ? '' : String(v)));
      });
      tbody.appendChild(tr);
    });
    tabla.appendChild(tbody);
  }

  // ===========================================================================
  // Descarga / portapapeles
  // ===========================================================================
  function descargar(bytes, nombre, mime) {
    var blob = new Blob([bytes], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function descargarCSV() {
    if (!estado.resultado) return;
    var cod = $('#optCodificacion').value;
    var bytes = CB.exportador.codificar(estado.resultado.csv, cod);
    var base = ($('#optNombreArchivo').value || 'contactos').replace(/[^\w.\- ]+/g, '').trim() || 'contactos';
    descargar(bytes, base + '.csv', CB.exportador.tipoMime(cod));
    brindis('CSV descargado (' + numero(estado.resultado.totalContactos) + ' contactos).');
  }

  function copiarCSV() {
    if (!estado.resultado) return;
    var texto = estado.resultado.csv;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(
        function () { brindis('CSV copiado al portapapeles.'); },
        function () { copiaAlternativa(texto); }
      );
    } else {
      copiaAlternativa(texto);
    }
  }

  function copiaAlternativa(texto) {
    var ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      brindis('CSV copiado al portapapeles.');
    } catch (e) {
      brindis('No se pudo copiar. Usa el botón de descarga.');
    }
    document.body.removeChild(ta);
  }

  function descargarErrores() {
    if (!estado.resultado) return;
    var d = $('#optDelimitador').value;
    var esc = CB.exportador.escapar;
    var lineas = [['Fila', 'Nombre', 'Email', 'Telefono', 'Motivo'].map(function (h) { return esc(h, d); }).join(d)];
    estado.resultado.invalidos.forEach(function (x) {
      lineas.push([x.fila, x.nombre, x.email, x.telefono, x.motivo]
        .map(function (v) { return esc(v === undefined ? '' : v, d); }).join(d));
    });
    var cod = $('#optCodificacion').value;
    descargar(CB.exportador.codificar(lineas.join('\r\n') + '\r\n', cod),
              'contactos-descartados.csv', CB.exportador.tipoMime(cod));
  }

  // ===========================================================================
  function escaparHTML(txt) {
    return String(txt).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
