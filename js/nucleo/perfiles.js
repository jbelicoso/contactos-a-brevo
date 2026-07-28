/**
 * perfiles.js
 * -----------------------------------------------------------------------------
 * Perfiles de exportación: definen las columnas y su orden en el CSV final
 * según la plataforma de destino.
 *
 * El campo interno (EMAIL, NOMBRE, ...) se traduce al nombre de columna que
 * espera cada plataforma.
 * -----------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var PERFILES = {
    brevo: {
      id: 'brevo',
      nombre: 'Brevo (ex Sendinblue)',
      delimitadorSugerido: ';',
      limite: 100000,
      // orden de columnas: [campo interno, encabezado en el CSV]
      columnas: [
        ['EMAIL',    'EMAIL'],
        ['NOMBRE',   'NOMBRE'],
        ['APELLIDO', 'APELLIDO'],
        ['TELEFONO', 'TELEFONO'],
        ['EMPRESA',  'EMPRESA'],
        ['LISTA',    'LISTA']
      ],
      nota: 'Sube el archivo en Brevo desde Contactos → Importar contactos. ' +
            'Si vas a enviar SMS/WhatsApp, crea también el atributo SMS con el mismo teléfono.'
    },

    mailchimp: {
      id: 'mailchimp',
      nombre: 'Mailchimp',
      delimitadorSugerido: ',',
      limite: 100000,
      columnas: [
        ['EMAIL',    'Email Address'],
        ['NOMBRE',   'First Name'],
        ['APELLIDO', 'Last Name'],
        ['TELEFONO', 'Phone Number'],
        ['EMPRESA',  'Company'],
        ['LISTA',    'Tags']
      ],
      nota: 'Mailchimp espera coma como separador y la columna "Email Address" obligatoria.'
    },

    hubspot: {
      id: 'hubspot',
      nombre: 'HubSpot',
      delimitadorSugerido: ',',
      limite: 100000,
      columnas: [
        ['EMAIL',    'Email'],
        ['NOMBRE',   'First Name'],
        ['APELLIDO', 'Last Name'],
        ['TELEFONO', 'Phone Number'],
        ['EMPRESA',  'Company Name'],
        ['LISTA',    'Lifecycle Stage']
      ],
      nota: 'En HubSpot usa Contactos → Importar → Archivo desde el equipo.'
    },

    generico: {
      id: 'generico',
      nombre: 'Genérico (columnas internas)',
      delimitadorSugerido: ',',
      limite: 1000000,
      columnas: [
        ['EMAIL',    'EMAIL'],
        ['NOMBRE',   'NOMBRE'],
        ['APELLIDO', 'APELLIDO'],
        ['TELEFONO', 'TELEFONO'],
        ['EMPRESA',  'EMPRESA'],
        ['LISTA',    'LISTA']
      ],
      nota: 'Formato neutro, útil para importar en cualquier otra herramienta.'
    }
  };

  var API = { PERFILES: PERFILES };

  global.CB = global.CB || {};
  global.CB.perfiles = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof self !== 'undefined' ? self : this);
