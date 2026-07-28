/**
 * paises.js
 * -----------------------------------------------------------------------------
 * Catálogo de prefijos telefónicos internacionales.
 *
 * Cada país define:
 *   - codigo:  prefijo internacional SIN el signo "+" (ej. "593")
 *   - iso:     código ISO-3166 alfa-2 (ej. "EC")
 *   - nombre:  nombre en español
 *   - min/max: longitud mínima y máxima del número NACIONAL (sin prefijo país)
 *   - grupos:  cómo agrupar visualmente el número nacional según su longitud
 *              (ej. { 9: [2, 3, 4] } => "99 123 4567")
 *
 * NOTA: este archivo se carga tanto en el navegador (window) como dentro del
 * Web Worker (self) y en Node.js (module.exports) para las pruebas.
 * -----------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var PAISES = [
    // --- América Latina -------------------------------------------------------
    { codigo: '54',  iso: 'AR', nombre: 'Argentina',        min: 10, max: 11, grupos: { 10: [2, 4, 4], 11: [3, 4, 4] } },
    { codigo: '591', iso: 'BO', nombre: 'Bolivia',          min: 8,  max: 8,  grupos: { 8: [4, 4] } },
    { codigo: '55',  iso: 'BR', nombre: 'Brasil',           min: 10, max: 11, grupos: { 10: [2, 4, 4], 11: [2, 5, 4] } },
    { codigo: '56',  iso: 'CL', nombre: 'Chile',            min: 9,  max: 9,  grupos: { 9: [1, 4, 4] } },
    { codigo: '57',  iso: 'CO', nombre: 'Colombia',         min: 10, max: 10, grupos: { 10: [3, 3, 4] } },
    { codigo: '506', iso: 'CR', nombre: 'Costa Rica',       min: 8,  max: 8,  grupos: { 8: [4, 4] } },
    { codigo: '53',  iso: 'CU', nombre: 'Cuba',             min: 8,  max: 8,  grupos: { 8: [4, 4] } },
    { codigo: '593', iso: 'EC', nombre: 'Ecuador',          min: 8,  max: 9,  grupos: { 9: [2, 3, 4], 8: [1, 3, 4] } },
    { codigo: '503', iso: 'SV', nombre: 'El Salvador',      min: 8,  max: 8,  grupos: { 8: [4, 4] } },
    { codigo: '502', iso: 'GT', nombre: 'Guatemala',        min: 8,  max: 8,  grupos: { 8: [4, 4] } },
    { codigo: '504', iso: 'HN', nombre: 'Honduras',         min: 8,  max: 8,  grupos: { 8: [4, 4] } },
    { codigo: '52',  iso: 'MX', nombre: 'México',           min: 10, max: 10, grupos: { 10: [2, 4, 4] } },
    { codigo: '505', iso: 'NI', nombre: 'Nicaragua',        min: 8,  max: 8,  grupos: { 8: [4, 4] } },
    { codigo: '507', iso: 'PA', nombre: 'Panamá',           min: 7,  max: 8,  grupos: { 8: [4, 4], 7: [3, 4] } },
    { codigo: '595', iso: 'PY', nombre: 'Paraguay',         min: 9,  max: 9,  grupos: { 9: [3, 3, 3] } },
    { codigo: '51',  iso: 'PE', nombre: 'Perú',             min: 8,  max: 9,  grupos: { 9: [3, 3, 3], 8: [4, 4] } },
    { codigo: '1',   iso: 'DO', nombre: 'República Dominicana', min: 10, max: 10, grupos: { 10: [3, 3, 4] } },
    { codigo: '598', iso: 'UY', nombre: 'Uruguay',          min: 8,  max: 9,  grupos: { 9: [2, 3, 4], 8: [4, 4] } },
    { codigo: '58',  iso: 'VE', nombre: 'Venezuela',        min: 10, max: 10, grupos: { 10: [3, 3, 4] } },

    // --- Norteamérica ---------------------------------------------------------
    { codigo: '1',   iso: 'US', nombre: 'Estados Unidos / Canadá', min: 10, max: 10, grupos: { 10: [3, 3, 4] } },

    // --- Europa ---------------------------------------------------------------
    { codigo: '34',  iso: 'ES', nombre: 'España',           min: 9,  max: 9,  grupos: { 9: [3, 3, 3] } },
    { codigo: '351', iso: 'PT', nombre: 'Portugal',         min: 9,  max: 9,  grupos: { 9: [3, 3, 3] } },
    { codigo: '33',  iso: 'FR', nombre: 'Francia',          min: 9,  max: 9,  grupos: { 9: [1, 2, 2, 2, 2] } },
    { codigo: '39',  iso: 'IT', nombre: 'Italia',           min: 9,  max: 10, grupos: { 10: [3, 3, 4], 9: [3, 3, 3] } },
    { codigo: '49',  iso: 'DE', nombre: 'Alemania',         min: 9,  max: 11, grupos: {} },
    { codigo: '44',  iso: 'GB', nombre: 'Reino Unido',      min: 9,  max: 10, grupos: { 10: [4, 6] } },
    { codigo: '41',  iso: 'CH', nombre: 'Suiza',            min: 9,  max: 9,  grupos: { 9: [2, 3, 2, 2] } },
    { codigo: '31',  iso: 'NL', nombre: 'Países Bajos',     min: 9,  max: 9,  grupos: { 9: [1, 4, 4] } },
    { codigo: '32',  iso: 'BE', nombre: 'Bélgica',          min: 8,  max: 9,  grupos: {} },
    { codigo: '43',  iso: 'AT', nombre: 'Austria',          min: 9,  max: 11, grupos: {} },
    { codigo: '46',  iso: 'SE', nombre: 'Suecia',           min: 8,  max: 9,  grupos: {} },
    { codigo: '47',  iso: 'NO', nombre: 'Noruega',          min: 8,  max: 8,  grupos: { 8: [4, 4] } },
    { codigo: '45',  iso: 'DK', nombre: 'Dinamarca',        min: 8,  max: 8,  grupos: { 8: [4, 4] } },
    { codigo: '353', iso: 'IE', nombre: 'Irlanda',          min: 9,  max: 9,  grupos: { 9: [2, 3, 4] } },
    { codigo: '48',  iso: 'PL', nombre: 'Polonia',          min: 9,  max: 9,  grupos: { 9: [3, 3, 3] } },
    { codigo: '30',  iso: 'GR', nombre: 'Grecia',           min: 10, max: 10, grupos: { 10: [3, 3, 4] } },
    { codigo: '380', iso: 'UA', nombre: 'Ucrania',          min: 9,  max: 9,  grupos: { 9: [2, 3, 4] } },
    { codigo: '7',   iso: 'RU', nombre: 'Rusia / Kazajistán', min: 10, max: 10, grupos: { 10: [3, 3, 4] } },

    // --- Resto del mundo ------------------------------------------------------
    { codigo: '212', iso: 'MA', nombre: 'Marruecos',        min: 9,  max: 9,  grupos: { 9: [3, 3, 3] } },
    { codigo: '27',  iso: 'ZA', nombre: 'Sudáfrica',        min: 9,  max: 9,  grupos: { 9: [2, 3, 4] } },
    { codigo: '20',  iso: 'EG', nombre: 'Egipto',           min: 9,  max: 10, grupos: {} },
    { codigo: '972', iso: 'IL', nombre: 'Israel',           min: 9,  max: 9,  grupos: { 9: [2, 3, 4] } },
    { codigo: '971', iso: 'AE', nombre: 'Emiratos Árabes Unidos', min: 9, max: 9, grupos: { 9: [2, 3, 4] } },
    { codigo: '91',  iso: 'IN', nombre: 'India',            min: 10, max: 10, grupos: { 10: [5, 5] } },
    { codigo: '86',  iso: 'CN', nombre: 'China',            min: 11, max: 11, grupos: { 11: [3, 4, 4] } },
    { codigo: '81',  iso: 'JP', nombre: 'Japón',            min: 9,  max: 10, grupos: {} },
    { codigo: '82',  iso: 'KR', nombre: 'Corea del Sur',    min: 9,  max: 10, grupos: {} },
    { codigo: '61',  iso: 'AU', nombre: 'Australia',        min: 9,  max: 9,  grupos: { 9: [3, 3, 3] } },
    { codigo: '64',  iso: 'NZ', nombre: 'Nueva Zelanda',    min: 8,  max: 9,  grupos: {} },
    { codigo: '63',  iso: 'PH', nombre: 'Filipinas',        min: 10, max: 10, grupos: { 10: [3, 3, 4] } }
  ];

  /**
   * Índice de prefijos ordenado de MÁS largo a MÁS corto.
   * Es imprescindible para que "593" gane frente a "59" o "5".
   */
  var PREFIJOS_ORDENADOS = PAISES
    .slice()
    .sort(function (a, b) { return b.codigo.length - a.codigo.length; });

  /** Devuelve el país cuyo prefijo coincide con el inicio de los dígitos dados. */
  function buscarPorPrefijo(digitos) {
    for (var i = 0; i < PREFIJOS_ORDENADOS.length; i++) {
      var p = PREFIJOS_ORDENADOS[i];
      if (digitos.indexOf(p.codigo) === 0) {
        // Validamos que la longitud restante sea plausible para ese país
        var nacional = digitos.slice(p.codigo.length);
        if (nacional.length >= p.min - 1 && nacional.length <= p.max + 1) return p;
      }
    }
    // Segunda pasada: sin validar longitud (mejor un prefijo que ninguno)
    for (var j = 0; j < PREFIJOS_ORDENADOS.length; j++) {
      if (digitos.indexOf(PREFIJOS_ORDENADOS[j].codigo) === 0) return PREFIJOS_ORDENADOS[j];
    }
    return null;
  }

  /** Busca un país por su código ISO alfa-2. */
  function buscarPorIso(iso) {
    for (var i = 0; i < PAISES.length; i++) {
      if (PAISES[i].iso === iso) return PAISES[i];
    }
    return null;
  }

  var API = {
    PAISES: PAISES,
    buscarPorPrefijo: buscarPorPrefijo,
    buscarPorIso: buscarPorIso
  };

  // Exportación universal (navegador / worker / Node)
  global.CB = global.CB || {};
  global.CB.paises = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof self !== 'undefined' ? self : this);
