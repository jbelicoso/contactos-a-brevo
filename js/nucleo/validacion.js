/**
 * validacion.js
 * -----------------------------------------------------------------------------
 * Validación y limpieza de emails y nombres.
 * -----------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  // Expresión razonable para uso real (no pretende cubrir el RFC 5322 completo)
  var RE_EMAIL = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

  // Email dentro de un texto libre (para listas pegadas o exportaciones sucias)
  var RE_EMAIL_EN_TEXTO = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/ig;

  // Caracteres invisibles que ensucian los pegados desde Word/Excel/web
  var RE_INVISIBLES = /[​-‍﻿ ]/g;

  // Dominios mal escritos frecuentes -> corrección sugerida
  var CORRECCIONES_DOMINIO = {
    'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail.co': 'gmail.com',
    'gmail.con': 'gmail.com', 'gmail.cm': 'gmail.com', 'gnail.com': 'gmail.com',
    'hotmial.com': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'hotmail.co': 'hotmail.com',
    'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com',
    'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.con': 'yahoo.com'
  };

  /**
   * Limpia y valida un email.
   * @returns {{ok:boolean, email:string, motivo:string, sugerencia:string}}
   */
  function normalizarEmail(valor) {
    if (valor === null || valor === undefined) {
      return { ok: false, email: '', motivo: 'Vacío', sugerencia: '' };
    }
    var e = String(valor).trim().toLowerCase();

    // Quitar formatos tipo "Juan Pérez <juan@dominio.com>" o mailto:
    e = e.replace(/^mailto:/, '');
    var m = e.match(/<([^>]+)>/);
    if (m) e = m[1].trim();

    // Quitar comillas, espacios internos y caracteres invisibles
    e = e.replace(/^["'\s]+|["'\s,;]+$/g, '').replace(/\s+/g, '').replace(RE_INVISIBLES, '');

    if (!e) return { ok: false, email: '', motivo: 'Vacío', sugerencia: '' };

    if (!RE_EMAIL.test(e)) {
      var motivo = e.indexOf('@') === -1 ? 'Falta el símbolo @' : 'Formato de email inválido';
      return { ok: false, email: e, motivo: motivo, sugerencia: '' };
    }

    // Sugerencia de dominio corregido (no se aplica automáticamente)
    var partes = e.split('@');
    var dominio = partes[1];
    var sugerencia = CORRECCIONES_DOMINIO[dominio]
      ? partes[0] + '@' + CORRECCIONES_DOMINIO[dominio]
      : '';

    return { ok: true, email: e, motivo: '', sugerencia: sugerencia };
  }

  /** Extrae todos los emails presentes en un texto libre. */
  function extraerEmails(texto) {
    var encontrados = String(texto).match(RE_EMAIL_EN_TEXTO);
    return encontrados ? encontrados.map(function (x) { return x.toLowerCase(); }) : [];
  }

  /** ¿Este valor parece un email? (para el detector de columnas) */
  function pareceEmail(texto) {
    if (!texto) return false;
    return RE_EMAIL.test(String(texto).trim().toLowerCase());
  }

  /** Capitaliza correctamente un nombre: "juan de la CRUZ" -> "Juan de la Cruz". */
  var MINUSCULAS = ['de', 'del', 'la', 'las', 'los', 'y', 'da', 'do', 'dos', 'van', 'von', 'di', 'el'];
  function capitalizarNombre(txt) {
    if (!txt) return '';
    return String(txt).trim().toLowerCase().split(/\s+/).map(function (p, i) {
      if (i > 0 && MINUSCULAS.indexOf(p) !== -1) return p;
      // Respeta guiones y apóstrofes: "jean-luc" -> "Jean-Luc"
      return p.replace(/(^|[-'’])([a-záéíóúñüç])/g, function (_, sep, letra) {
        return sep + letra.toUpperCase();
      });
    }).join(' ');
  }

  /** Limpia un texto genérico: recorta espacios y colapsa espacios múltiples. */
  function limpiarTexto(txt) {
    if (txt === null || txt === undefined) return '';
    return String(txt)
      .replace(RE_INVISIBLES, ' ')  // caracteres invisibles
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Separa un nombre completo en NOMBRE y APELLIDO.
   * Reglas:
   *   - "Pérez García, Juan Carlos"  -> nombre: "Juan Carlos", apellido: "Pérez García"
   *   - "Juan Carlos Pérez García"   -> nombre: "Juan Carlos", apellido: "Pérez García"
   *   - "Juan Pérez"                 -> nombre: "Juan",        apellido: "Pérez"
   *   - "Juan"                       -> nombre: "Juan",        apellido: ""
   */
  function separarNombre(completo) {
    var t = limpiarTexto(completo);
    if (!t) return { nombre: '', apellido: '' };

    // Formato "Apellidos, Nombres"
    if (t.indexOf(',') !== -1) {
      var trozos = t.split(',');
      return {
        nombre: capitalizarNombre(limpiarTexto(trozos.slice(1).join(' '))),
        apellido: capitalizarNombre(limpiarTexto(trozos[0]))
      };
    }

    var palabras = t.split(' ');
    if (palabras.length === 1) return { nombre: capitalizarNombre(palabras[0]), apellido: '' };
    if (palabras.length === 2) {
      return { nombre: capitalizarNombre(palabras[0]), apellido: capitalizarNombre(palabras[1]) };
    }
    if (palabras.length === 3) {
      // Convención hispana: 1 nombre + 2 apellidos
      return {
        nombre: capitalizarNombre(palabras[0]),
        apellido: capitalizarNombre(palabras.slice(1).join(' '))
      };
    }
    // 4+ palabras: 2 nombres + resto apellidos
    return {
      nombre: capitalizarNombre(palabras.slice(0, 2).join(' ')),
      apellido: capitalizarNombre(palabras.slice(2).join(' '))
    };
  }

  /** ¿Parece un nombre de persona? (para el detector de columnas) */
  function pareceNombre(texto) {
    if (!texto) return false;
    var t = String(texto).trim();
    if (t.length < 2 || t.length > 60) return false;
    if (t.indexOf('@') !== -1) return false;
    // Debe ser mayoritariamente letras (permite acentos, espacios, guiones, puntos)
    return /^[\p{L}][\p{L}\s.\-'’]*$/u.test(t) && /\p{L}{2,}/u.test(t);
  }

  var API = {
    RE_EMAIL: RE_EMAIL,
    normalizarEmail: normalizarEmail,
    extraerEmails: extraerEmails,
    pareceEmail: pareceEmail,
    pareceNombre: pareceNombre,
    capitalizarNombre: capitalizarNombre,
    limpiarTexto: limpiarTexto,
    separarNombre: separarNombre
  };

  global.CB = global.CB || {};
  global.CB.validacion = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof self !== 'undefined' ? self : this);
