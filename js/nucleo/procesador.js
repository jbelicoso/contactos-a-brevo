/**
 * procesador.js
 * -----------------------------------------------------------------------------
 * Motor de transformación: convierte las filas crudas + el mapeo de columnas
 * en contactos limpios, validados y sin duplicados.
 *
 * Está pensado para trabajar POR LOTES, de modo que pueda ejecutarse dentro de
 * un Web Worker (o en el hilo principal troceado con setTimeout) sin bloquear
 * la interfaz con 100.000 contactos.
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

  /**
   * Crea el estado inicial del procesamiento.
   * @param {Object} opciones
   *   {
   *     mapeo: { '0': 'EMAIL', '1': 'NOMBRE', ... },
   *     paisPorDefecto: 'EC',
   *     eliminarDuplicados: true,
   *     criterioDuplicado: 'email' | 'telefono' | 'ambos',
   *     requerirEmail: true,
   *     capitalizarNombres: true,
   *     valoresFijos: { LISTA: 'CLIENTES' }
   *   }
   */
  function crearEstado(opciones) {
    return {
      opciones: opciones,
      contactos: [],
      invalidos: [],           // filas descartadas con su motivo
      vistosEmail: Object.create(null),
      vistosTelefono: Object.create(null),
      estadisticas: {
        filasLeidas: 0,
        validos: 0,
        duplicados: 0,
        sinEmail: 0,
        emailInvalido: 0,
        telefonoInvalido: 0,
        telefonosValidos: 0,
        vacias: 0
      }
    };
  }

  /**
   * Procesa un lote de filas acumulando el resultado en `estado`.
   * @param {Object} estado  Devuelto por crearEstado()
   * @param {Array<Array<string>>} filas
   */
  function procesarLote(estado, filas) {
    var o = estado.opciones;
    var mapeo = o.mapeo || {};
    var fijos = o.valoresFijos || {};
    var est = estado.estadisticas;

    // Índice inverso: campo -> lista de columnas asignadas
    var porCampo = {};
    Object.keys(mapeo).forEach(function (col) {
      var campo = mapeo[col];
      if (!campo || campo === 'IGNORAR') return;
      (porCampo[campo] = porCampo[campo] || []).push(parseInt(col, 10));
    });

    for (var i = 0; i < filas.length; i++) {
      var fila = filas[i];
      est.filasLeidas++;

      // ---- Extracción de valores según el mapeo ----------------------------
      function tomar(campo) {
        var cols = porCampo[campo];
        if (!cols) return '';
        for (var k = 0; k < cols.length; k++) {
          var v = fila[cols[k]];
          if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
        }
        return '';
      }

      var crudoEmail    = tomar('EMAIL');
      var crudoNombre   = tomar('NOMBRE');
      var crudoApellido = tomar('APELLIDO');
      var crudoCompleto = tomar('NOMBRE_COMPLETO');
      var crudoTel      = tomar('TELEFONO');
      var crudoEmpresa  = tomar('EMPRESA');
      var crudoLista    = tomar('LISTA');

      if (!crudoEmail && !crudoTel && !crudoNombre && !crudoApellido && !crudoCompleto) {
        est.vacias++;
        continue;
      }

      // ---- Nombre / Apellido ----------------------------------------------
      var nombre = validacion.limpiarTexto(crudoNombre);
      var apellido = validacion.limpiarTexto(crudoApellido);

      if (crudoCompleto && (!nombre || !apellido)) {
        var partido = validacion.separarNombre(crudoCompleto);
        if (!nombre) nombre = partido.nombre;
        if (!apellido) apellido = partido.apellido;
      }
      // Si solo hay "NOMBRE" pero contiene varias palabras, lo dividimos
      if (nombre && !apellido && o.dividirNombreCompleto !== false && nombre.split(' ').length > 1) {
        var p2 = validacion.separarNombre(nombre);
        nombre = p2.nombre; apellido = p2.apellido;
      }
      if (o.capitalizarNombres !== false) {
        nombre = validacion.capitalizarNombre(nombre);
        apellido = validacion.capitalizarNombre(apellido);
      }

      // ---- Email ------------------------------------------------------------
      var resEmail = validacion.normalizarEmail(crudoEmail);
      var email = resEmail.ok ? resEmail.email : '';

      if (!crudoEmail) est.sinEmail++;
      else if (!resEmail.ok) est.emailInvalido++;

      // ---- Teléfono ---------------------------------------------------------
      var resTel = telefono.normalizar(crudoTel, o.paisPorDefecto);
      var tel = resTel.ok ? (o.formatoTelefono === 'e164' ? resTel.e164 : resTel.formateado) : '';
      var telClave = resTel.ok ? resTel.e164 : '';
      if (crudoTel && !resTel.ok) est.telefonoInvalido++;
      if (resTel.ok) est.telefonosValidos++;

      // ---- Descartes --------------------------------------------------------
      if (o.requerirEmail !== false && !email) {
        estado.invalidos.push({
          fila: est.filasLeidas,
          email: crudoEmail, nombre: nombre, telefono: crudoTel,
          motivo: crudoEmail ? (resEmail.motivo || 'Email inválido') : 'Sin email'
        });
        continue;
      }
      if (o.requerirEmail === false && !email && !tel) {
        estado.invalidos.push({
          fila: est.filasLeidas,
          email: crudoEmail, nombre: nombre, telefono: crudoTel,
          motivo: 'Sin email ni teléfono válidos'
        });
        continue;
      }

      // ---- Duplicados -------------------------------------------------------
      if (o.eliminarDuplicados) {
        var crit = o.criterioDuplicado || 'email';
        var dupEmail = email && estado.vistosEmail[email];
        var dupTel = telClave && estado.vistosTelefono[telClave];
        var esDup =
          (crit === 'email' && dupEmail) ||
          (crit === 'telefono' && dupTel) ||
          (crit === 'ambos' && (dupEmail || dupTel));

        if (esDup) { est.duplicados++; continue; }
      }
      if (email) estado.vistosEmail[email] = true;
      if (telClave) estado.vistosTelefono[telClave] = true;

      // ---- Contacto final ---------------------------------------------------
      estado.contactos.push({
        EMAIL: email,
        NOMBRE: nombre,
        APELLIDO: apellido,
        TELEFONO: tel,
        EMPRESA: validacion.limpiarTexto(crudoEmpresa) || (fijos.EMPRESA || ''),
        LISTA: validacion.limpiarTexto(crudoLista) || (fijos.LISTA || '')
      });
      est.validos++;
    }

    return estado;
  }

  /** Procesa todas las filas de una vez (útil para pruebas y archivos pequeños). */
  function procesarTodo(filas, opciones) {
    var estado = crearEstado(opciones);
    procesarLote(estado, filas);
    return estado;
  }

  var API = {
    crearEstado: crearEstado,
    procesarLote: procesarLote,
    procesarTodo: procesarTodo
  };

  global.CB = global.CB || {};
  global.CB.procesador = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof self !== 'undefined' ? self : this);
