/*!
 * UCSV 1.1.0
 * Provided under MIT License.
 *
 * Copyright 2010-2012, Peter Johnson
 * http://www.uselesscode.org/javascript/csv/
 */

/* jsLint stuff */
/*global exports */
/*members apply, arrayToCsv, charAt, csvToArray, length, prototype, push,
 replace, substring, test, toString, trim
*/

/**
 * Namespace for CSV functions
 * @namespace
 */
var CSV = (function () {
	"use strict";

	var rxIsInt = /^\d+$/,
		rxIsFloat = /^\d*\.\d+$|^\d+\.\d*$/,
		// If a string has leading or trailing space,
		// contains a comma double quote or a newline
		// it needs to be quoted in CSV output
		rxNeedsQuoting = /^\s|\s$|,|"|\n/,
		trim = (function () {
			// Fx 3.1 has a native trim function, it's about 10x faster, use it if it exists
			if (String.prototype.trim) {
				return function (s) {
					return s.trim();
				};
			} else {
				return function (s) {
					return s.replace(/^\s*/, '').replace(/\s*$/, '');
				};
			}
		}());

	function isNumber(o) {
		return Object.prototype.toString.apply(o) === '[object Number]';
	}

	function isString(o) {
		return Object.prototype.toString.apply(o) === '[object String]';
	}

	function chomp(s) {
		if (s.charAt(s.length - 1) !== "\n") {
			// Does not end with \n, just return string
			return s;
		} else {
			// Remove the \n
			return s.substring(0, s.length - 1);
		}
	}

 /**
	* Converts an array into a Comma Separated Values list.
	* Each item in the array should be an array that represents one line in the CSV.
	* Nulls are interpreted as empty fields.
	*
	* @param {String} a The array to convert
	*
	* @returns A CSV representation of the provided array.
	* @type string
	* @public
	* @static
	* @example
	* var csvArray = [
	* ['Leno, Jay', 10],
	* ['Conan "Conando" O\'Brien', '11:35' ],
	* ['Fallon, Jimmy', '12:35' ]
	* ];
	* CSV.arrayToCsv(csvArray);
	* // Outputs a string containing:
	* // "Leno, Jay",10
	* // "Conan ""Conando"" O'Brien",11:35
	* // "Fallon, Jimmy",12:35
	*/
	function arrayToCsv(a) {
		var cur,
			out = '',
			row,
			i,
			j;

		for (i = 0; i < a.length; i += 1) {
			row = a[i];
			for (j = 0; j < row.length; j += 1) {
				cur = row[j];

				if (isString(cur)) {
					// Escape any " with double " ("")
					cur = cur.replace(/"/g, '""');

					// If the field starts or ends with whitespace, contains " or , or is a string representing a number
					if (rxNeedsQuoting.test(cur) || rxIsInt.test(cur) || rxIsFloat.test(cur)) {
						cur = '"' + cur + '"';
					// quote empty strings
					} else if (cur === "") {
						cur = '""';
					}
				} else if (isNumber(cur)) {
					cur = cur.toString(10);
				} else if (cur === null) {
					cur = '';
				} else {
					cur = cur.toString();
				}

				out += j < row.length - 1 ? cur + ',' : cur;
			}
			// End record
			out += "\n";
		}

		return out;
	}

	/**
	 * Converts a Comma Separated Values string into an array of arrays.
	 * Each line in the CSV becomes an array.
	 * Empty fields are converted to nulls and non-quoted numbers are converted to integers or floats.
	 *
	 * @return The CSV parsed as an array
	 * @type Array
	 * 
	 * @param {String} s The string to convert
	 * @param {Boolean} [trm=false] If set to True leading and trailing whitespace is stripped off of each non-quoted field as it is imported
	 * @public
	 * @static
	 * @example
	 * var csv = '"Leno, Jay",10' + "\n" +
	 * '"Conan ""Conando"" O\'Brien",11:35' + "\n" +
	 * '"Fallon, Jimmy",12:35' + "\n";
	 *
	 * var array = CSV.csvToArray(csv);
	 * 
	 * // array is now
	 * // [
	 * // ['Leno, Jay', 10],
	 * // ['Conan "Conando" O\'Brien', '11:35' ],
	 * // ['Fallon, Jimmy', '12:35' ]
	 * // ];
	 */
	function csvToArray(s, trm) {
		// Get rid of any trailing \n
		s = chomp(s);

		var cur = '', // The character we are currently processing.
			inQuote = false,
			fieldQuoted = false,
			field = '', // Buffer for building up the current field
			row = [],
			out = [],
			i,
			processField;

		processField = function (field) {
			if (fieldQuoted !== true) {
				// If field is empty set to null
				if (field === '') {
					field = null;
				// If the field was not quoted and we are trimming fields, trim it
				} else if (trm === true) {
					field = trim(field);
				}

				// Convert unquoted numbers to their appropriate types
				if (rxIsInt.test(field)) {
					field = parseInt(field, 10);
				} else if (rxIsFloat.test(field)) {
					field = parseFloat(field, 10);
				}
			}
			return field;
		};

		for (i = 0; i < s.length; i += 1) {
			cur = s.charAt(i);

			// If we are at a EOF or EOR
			if (inQuote === false && (cur === ',' || cur === "\n")) {
				field = processField(field);
				// Add the current field to the current row
				row.push(field);
				// If this is EOR append row to output and flush row
				if (cur === "\n") {
					out.push(row);
					row = [];
				}
				// Flush the field buffer
				field = '';
				fieldQuoted = false;
			} else {
				// If it's not a ", add it to the field buffer
				if (cur !== '"') {
					field += cur;
				} else {
					if (!inQuote) {
						// We are not in a quote, start a quote
						inQuote = true;
						fieldQuoted = true;
					} else {
						// Next char is ", this is an escaped "
						if (s.charAt(i + 1) === '"') {
							field += '"';
							// Skip the next char
							i += 1;
						} else {
							// It's not escaping, so end quote
							inQuote = false;
						}
					}
				}
			}
		}

		// Add the last field
		field = processField(field);
		row.push(field);
		out.push(row);

		return out;
	}

	// Add support for use as a CommonJS module.
	// This allows use as a library with the Mozilla Add-On SDK
	// or a module in Node.js via a call to require().
	if (typeof exports === "object") {
		exports.arrayToCsv = arrayToCsv;
		exports.csvToArray = csvToArray;
	}

	return {
		arrayToCsv: arrayToCsv,
		csvToArray: csvToArray
	};
}());
