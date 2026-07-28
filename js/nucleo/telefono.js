/**
 * telefono.js
 * -----------------------------------------------------------------------------
 * Normalización y validación de números de teléfono a formato internacional.
 *
 * Estrategia:
 *   1. Se limpian todos los caracteres que no sean dígitos (se recuerda si
 *      el número empezaba por "+" o por "00", que indican formato internacional).
 *   2. Si el número YA es internacional, se detecta el país por prefijo.
 *   3. Si NO lo es, se elimina el prefijo troncal nacional (ceros iniciales)
 *      y se antepone el código del país por defecto elegido por el usuario.
 *   4. Se valida la longitud y se formatea con espacios según el país.
 *
 * Salida:
 *   { ok, e164, formateado, pais, motivo }
 *     - e164:       "+593991234567"  (lo que acepta Brevo sin problemas)
 *     - formateado: "+593 99 123 4567" (legible para humanos)
 * -----------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var paises = (global.CB && global.CB.paises)
    ? global.CB.paises
    : (typeof require !== 'undefined' ? require('./paises.js') : null);

  /** Quita todo lo que no sea dígito. */
  function soloDigitos(txt) {
    return String(txt).replace(/[^\d]/g, '');
  }

  /** Agrupa una cadena de dígitos según un patrón [2,3,4] -> "99 123 4567". */
  function agrupar(digitos, patron) {
    var partes = [];
    var pos = 0;
    for (var i = 0; i < patron.length; i++) {
      partes.push(digitos.substr(pos, patron[i]));
      pos += patron[i];
    }
    if (pos < digitos.length) partes.push(digitos.slice(pos)); // sobrante
    return partes.filter(Boolean).join(' ');
  }

  /** Patrón de agrupación genérico cuando el país no define uno propio. */
  function patronGenerico(largo) {
    switch (largo) {
      case 6:  return [3, 3];
      case 7:  return [3, 4];
      case 8:  return [4, 4];
      case 9:  return [2, 3, 4];
      case 10: return [3, 3, 4];
      case 11: return [2, 3, 3, 3];
      case 12: return [3, 3, 3, 3];
      default: return [largo];
    }
  }

  /**
   * Normaliza un teléfono.
   * @param {string} valor        Texto tal cual viene del archivo.
   * @param {string} isoPorDefecto Código ISO del país por defecto (ej. "EC").
   * @returns {{ok:boolean, e164:string, formateado:string, pais:object|null, motivo:string}}
   */
  function normalizar(valor, isoPorDefecto) {
    var vacio = { ok: false, e164: '', formateado: '', pais: null, motivo: '' };
    if (valor === null || valor === undefined) return vacio;

    var texto = String(valor).trim();
    if (!texto) return vacio;

    // Algunas exportaciones traen varios números separados por "/" o ";" -> tomamos el primero
    texto = texto.split(/[;\/]|(?:\s{2,})/)[0].trim();

    // ¿Venía ya en formato internacional?
    var esInternacional = /^\s*\+/.test(texto) || /^\s*00\d/.test(texto);

    var digitos = soloDigitos(texto);
    if (!digitos) {
      return { ok: false, e164: '', formateado: '', pais: null, motivo: 'Sin dígitos' };
    }

    // "00" al inicio equivale a "+"
    if (!/^\s*\+/.test(texto) && digitos.indexOf('00') === 0) {
      digitos = digitos.replace(/^00+/, '');
      esInternacional = true;
    }

    var pais = null;
    var nacional = '';

    if (esInternacional) {
      pais = paises.buscarPorPrefijo(digitos);
      if (pais) {
        nacional = digitos.slice(pais.codigo.length);
      } else {
        // Prefijo desconocido: lo aceptamos si la longitud es plausible
        if (digitos.length >= 8 && digitos.length <= 15) {
          return {
            ok: true,
            e164: '+' + digitos,
            formateado: '+' + agrupar(digitos, patronGenerico(digitos.length)),
            pais: null,
            motivo: 'Prefijo de país no reconocido (se conserva tal cual)'
          };
        }
        return { ok: false, e164: '', formateado: '', pais: null, motivo: 'Longitud inválida' };
      }
    } else {
      pais = paises.buscarPorIso(isoPorDefecto || 'EC');
      if (!pais) pais = paises.buscarPorIso('EC');
      nacional = digitos;

      // Caso frecuente: el número nacional ya trae el código de país delante
      // pero sin "+" (ej. "593991234567"). Lo detectamos por longitud.
      if (nacional.indexOf(pais.codigo) === 0 &&
          nacional.length - pais.codigo.length >= pais.min &&
          nacional.length - pais.codigo.length <= pais.max) {
        nacional = nacional.slice(pais.codigo.length);
      }

      // Prefijo troncal nacional: en casi toda Latinoamérica y Europa es "0"
      nacional = nacional.replace(/^0+/, '');
    }

    // Validación de longitud del número nacional
    var min = pais && pais.min ? pais.min : 6;
    var max = pais && pais.max ? pais.max : 14;
    if (nacional.length < min || nacional.length > max) {
      return {
        ok: false,
        e164: '',
        formateado: '',
        pais: pais,
        motivo: 'Longitud inválida para ' + (pais ? pais.nombre : 'el país') +
                ' (' + nacional.length + ' dígitos, se esperaban entre ' + min + ' y ' + max + ')'
      };
    }

    var patron = (pais.grupos && pais.grupos[nacional.length])
      ? pais.grupos[nacional.length]
      : patronGenerico(nacional.length);

    return {
      ok: true,
      e164: '+' + pais.codigo + nacional,
      formateado: '+' + pais.codigo + ' ' + agrupar(nacional, patron),
      pais: pais,
      motivo: ''
    };
  }

  /** Comprobación rápida: ¿este texto "parece" un teléfono? (usado por el detector) */
  function pareceTelefono(texto) {
    if (texto === null || texto === undefined) return false;
    var t = String(texto).trim();
    if (!t) return false;
    if (t.indexOf('@') !== -1) return false;              // es un email
    if (!/^[\d\s()+.\-]+$/.test(t)) return false;          // caracteres no telefónicos
    var d = soloDigitos(t);
    return d.length >= 7 && d.length <= 15;
  }

  var API = {
    normalizar: normalizar,
    pareceTelefono: pareceTelefono,
    soloDigitos: soloDigitos
  };

  global.CB = global.CB || {};
  global.CB.telefono = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof self !== 'undefined' ? self : this);
