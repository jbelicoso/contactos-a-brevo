/**
 * detector.js
 * -----------------------------------------------------------------------------
 * Mapeo AUTOMÁTICO de columnas: decide qué columna del archivo corresponde a
 * cada campo de destino (EMAIL, NOMBRE, APELLIDO, TELEFONO, EMPRESA, LISTA).
 *
 * Cada par (columna, campo) recibe una puntuación de 0 a 100 que combina:
 *   - Coincidencia del ENCABEZADO con sinónimos conocidos (peso alto).
 *   - Coincidencia del CONTENIDO con el patrón esperado (peso alto).
 * Después se asignan los pares de mayor puntuación evitando duplicar campos.
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

  /** Campos de destino disponibles. NOMBRE_COMPLETO se divide luego en 2. */
  var CAMPOS = [
    { id: 'EMAIL',           etiqueta: 'Email (obligatorio)' },
    { id: 'NOMBRE',          etiqueta: 'Nombre' },
    { id: 'APELLIDO',        etiqueta: 'Apellido' },
    { id: 'NOMBRE_COMPLETO', etiqueta: 'Nombre completo (se divide automáticamente)' },
    { id: 'TELEFONO',        etiqueta: 'Teléfono' },
    { id: 'EMPRESA',         etiqueta: 'Empresa' },
    { id: 'LISTA',           etiqueta: 'Lista' },
    { id: 'IGNORAR',         etiqueta: '— No importar —' }
  ];

  /** Sinónimos de encabezado por campo (sin acentos, en minúsculas). */
  var SINONIMOS = {
    EMAIL: ['email', 'e-mail', 'e mail', 'correo', 'correo electronico', 'mail', 'emailaddress',
            'email address', 'direccion de correo', 'correo-e', 'e_mail'],
    NOMBRE: ['nombre', 'nombres', 'first name', 'firstname', 'first_name', 'given name',
             'primer nombre', 'name'],
    APELLIDO: ['apellido', 'apellidos', 'last name', 'lastname', 'last_name', 'surname',
               'family name', 'primer apellido'],
    NOMBRE_COMPLETO: ['nombre completo', 'full name', 'fullname', 'nombre y apellido',
                      'nombre y apellidos', 'contacto', 'display name', 'nombre_completo',
                      'razon social', 'cliente'],
    TELEFONO: ['telefono', 'telefonos', 'tel', 'phone', 'phone number', 'celular', 'movil',
               'mobile', 'whatsapp', 'numero', 'número', 'nro', 'contacto telefonico', 'sms',
               'telefono movil', 'cell'],
    EMPRESA: ['empresa', 'compania', 'compañia', 'company', 'organizacion', 'organization',
              'org', 'negocio', 'business'],
    LISTA: ['lista', 'list', 'listas', 'grupo', 'group', 'segmento', 'tag', 'tags', 'etiqueta',
            'categoria']
  };

  /** Normaliza un encabezado: minúsculas, sin acentos, sin signos. */
  function normalizarClave(txt) {
    return String(txt || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s_-]/g, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Puntuación 0-40 por coincidencia del encabezado. */
  function puntuarEncabezado(encabezado, campoId) {
    var lista = SINONIMOS[campoId];
    if (!lista) return 0;
    var clave = normalizarClave(encabezado);
    if (!clave) return 0;

    for (var i = 0; i < lista.length; i++) {
      if (clave === lista[i]) return 40;             // coincidencia exacta
    }
    for (var j = 0; j < lista.length; j++) {
      if (clave.indexOf(lista[j]) !== -1) return 28; // el encabezado contiene el sinónimo
    }
    return 0;
  }

  /** Puntuación 0-60 por análisis del contenido de la columna. */
  function puntuarContenido(valores, campoId) {
    var utiles = valores.filter(function (v) { return String(v || '').trim() !== ''; });
    if (!utiles.length) return 0;

    var aciertos = 0;
    utiles.forEach(function (v) {
      var t = String(v).trim();
      switch (campoId) {
        case 'EMAIL':
          if (validacion.pareceEmail(t)) aciertos++;
          break;
        case 'TELEFONO':
          if (telefono.pareceTelefono(t)) aciertos++;
          break;
        case 'NOMBRE':
        case 'APELLIDO':
          // Una sola palabra alfabética
          if (validacion.pareceNombre(t) && t.split(/\s+/).length === 1) aciertos++;
          break;
        case 'NOMBRE_COMPLETO':
          if (validacion.pareceNombre(t) && t.split(/\s+/).length >= 2) aciertos++;
          break;
        case 'EMPRESA':
        case 'LISTA':
          // No hay patrón fiable: solo descartamos emails y teléfonos
          if (t.indexOf('@') === -1 && !telefono.pareceTelefono(t)) aciertos++;
          break;
        default:
          break;
      }
    });

    var proporcion = aciertos / utiles.length;
    // EMPRESA / LISTA son campos "comodín": su contenido pesa mucho menos
    var tope = (campoId === 'EMPRESA' || campoId === 'LISTA') ? 12 : 60;
    return Math.round(proporcion * tope);
  }

  /**
   * Sugiere un mapeo automático.
   * @param {Array<string>} encabezados
   * @param {Array<Array<string>>} filas
   * @param {number} muestra  Nº de filas a analizar (por defecto 200)
   * @returns {{mapeo: Object, puntuaciones: Object}}
   *          mapeo: { indiceColumna: 'CAMPO' }
   */
  function sugerirMapeo(encabezados, filas, muestra) {
    var limite = muestra || 200;
    var datos = filas.slice(0, limite);
    var candidatos = [];

    encabezados.forEach(function (enc, idx) {
      var valores = datos.map(function (f) { return f[idx]; });
      Object.keys(SINONIMOS).forEach(function (campoId) {
        var p = puntuarEncabezado(enc, campoId) + puntuarContenido(valores, campoId);
        if (p > 0) candidatos.push({ columna: idx, campo: campoId, puntaje: p });
      });
    });

    candidatos.sort(function (a, b) { return b.puntaje - a.puntaje; });

    var mapeo = {};
    var columnasUsadas = {};
    var camposUsados = {};

    candidatos.forEach(function (c) {
      if (columnasUsadas[c.columna] || camposUsados[c.campo]) return;
      if (c.puntaje < 20) return;                       // umbral mínimo de confianza
      // NOMBRE_COMPLETO no puede convivir con NOMBRE o APELLIDO
      if (c.campo === 'NOMBRE_COMPLETO' && (camposUsados.NOMBRE || camposUsados.APELLIDO)) return;
      if ((c.campo === 'NOMBRE' || c.campo === 'APELLIDO') && camposUsados.NOMBRE_COMPLETO) return;

      mapeo[c.columna] = c.campo;
      columnasUsadas[c.columna] = true;
      camposUsados[c.campo] = true;
    });

    // Las columnas sin asignar se ignoran
    encabezados.forEach(function (_, idx) {
      if (!mapeo.hasOwnProperty(idx)) mapeo[idx] = 'IGNORAR';
    });

    return { mapeo: mapeo, candidatos: candidatos };
  }

  var API = {
    CAMPOS: CAMPOS,
    SINONIMOS: SINONIMOS,
    normalizarClave: normalizarClave,
    puntuarEncabezado: puntuarEncabezado,
    puntuarContenido: puntuarContenido,
    sugerirMapeo: sugerirMapeo
  };

  global.CB = global.CB || {};
  global.CB.detector = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof self !== 'undefined' ? self : this);
