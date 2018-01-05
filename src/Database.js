'use strict';
(function() {
	/**
	 * CINEMA_COMPONENTS
	 * DATABASE
	 * 
	 * The Database module for the CINEMA_COMPONENTS library.
	 * Contains functions and objects for dealing with the purely data-related 
	 * parts of a SpecD database. (Parsing, Querying, etc. data. No GUI stuff)
	 * 
	 * @exports CINEMA_COMPONENTS
	 * 
	 * @author Cameron Tauxe
	 */

	//If CINEMA_COMPONENTS is already defined, add to it, otherwise create it
	var CINEMA_COMPONENTS = {}
	if (window.CINEMA_COMPONENTS)
		CINEMA_COMPONENTS = window.CINEMA_COMPONENTS;
	else
		window.CINEMA_COMPONENTS = CINEMA_COMPONENTS;

	/** @type {boolean} - Flag to indicate that the Database module has been included */
	CINEMA_COMPONENTS.DATABASE_INCLUDED = true;

	/**
	 * Enum for the type of dimension (column)
	 * @enum {number}
	 */
	CINEMA_COMPONENTS.DIMENSION_TYPE = Object.freeze({
			INTEGER: 0,
			FLOAT: 1,
			STRING: 2
		});
	
	/**
	 * Database
	 * Creates a new instance of Database which represents the data in a SpecD Database
	 * 
	 * @constructor
	 * @param {string} directory - Path to the '.cdb' directory containing the database
	 * @param {function({Database} self)} callback - Function to call when loading has finished 
	 * (only called if loading finished without errors)
	 * @param {function({string} message)} errorCallback - Function to call if errors were found with data
	 */
	CINEMA_COMPONENTS.Database = function(directory, callback, errorCallback) {
		/** @type {string} - Path to the '.cdb' directory containing the database */
		this.directory = directory;
	
		/** @type {boolean} - Whether or not the database has finished loading */
		this.loaded = false;

		/** @type {string?} - The error message for errors found in the data. Undefined if no errors */
		this.error;

		/** @type {Object[]} - An array of the data rows */
		this.data = [];
		/** @type {string[]} - An array of dimension names for the data (column headers) */
		this.dimensions = [];
		/** @type {Object} - Contains the type for each dimension */
		this.dimensionTypes = {};
		/** @type {Object} - Contains the domains for each dimension (formatted like the domain for a d3 scale) */
		this.dimensionDomains = {};

		var self = this;
		getAndParseCSV(directory+'/data.csv', function(data_arr) {
			//Check for errors
			self.error = checkErrors(data_arr);
			if (self.error) {
				if (errorCallback)
					errorCallback();
				return;
			}

			//Get dimensions (First row of data)
			self.dimensions = data_arr[0];
			
			//Convert rows from arrays to objects
			self.data = data_arr.slice(1).map(function(d) {
				var obj = {};
				self.dimensions.forEach(function(p,i){obj[p] = d[i];});
				return obj;
			});

			//Determine dimension types and calculate domains
			self.dimensions.forEach(function(d) {
				var val = self.data[0][d];
				//Check if value is a float or integer
				//The text "NaN" (not case sensitive) counts as a float
				if (!isNaN(val) || val.toUpperCase() === "NAN") {
					if (isNaN(val) || !Number.isInteger(val))
						self.dimensionTypes[d] = CINEMA_COMPONENTS.DIMENSION_TYPE.FLOAT;
					else
						self.dimensionTypes[d] = CINEMA_COMPONENTS.DIMENSION_TYPE.INTEGER;
					//calculate domain for numeric dimension
					var i;//the first index to contain a value that is not "NaN"
					for (i = 0; i < self.data.length && isNaN(self.data[i][d]); i++) {}
					if (i == self.data.length)
						//if all values are NaN, domain is [0,0]
						self.dimensionDomains[d] = [0,0]
					else {
						var min = self.data[i][d];
						var max = self.data[i][d];
						for (var j = i; j < self.data.length; j++) {
							if (!isNaN(self.data[j][d])) {
								min = Math.min(min,self.data[j][d]);
								max = Math.max(max,self.data[j][d]);
							}
						}
						self.dimensionDomains[d] = [min,max];
					}
				}
				//Anything else is a string type
				else {
					self.dimensionTypes[d] = CINEMA_COMPONENTS.DIMENSION_TYPE.STRING;
					self.dimensionDomains[d] = self.data.map(function(p){return p[d];});
				}
			});

			self.loaded = true;
			if (callback)
				callback(self);
		});
	
	};

	/**
	 * Shortcut function to check if a given dimension is of type string or not
	 * @param {string} dimension - The dimension to check
	 */
	CINEMA_COMPONENTS.Database.prototype.isStringDimension = function(dimension) {
		return this.dimensionTypes[dimension] === CINEMA_COMPONENTS.DIMENSION_TYPE.STRING;
	};

	/**
	 * Get data rows (returned as an array of indices) that are similar to the given data.
	 * Difference between two data points is measured as the Manhattan distance where each dimension
	 * is normalized. i.e. The sum of the differencs on each dimension (each scaled from 0 to 1).
	 * On string dimensions, the distance is considered 0 if the strings are the same, otherwise 1
	 * NaN values have 0 distance from each other, but 1 from anything else
	 * undefined values 0 distance from each other, but 1 from defined values
	 * @param {Object} query - An object representing the data to compare against 
	 * (it does not necessarily have to be a data point already in the database)
	 * (dimensions in query can be undefined and will not add to distance)
	 * @param {number} threshold - The value that the difference must be below to be considerd "similiar"
	 */
	CINEMA_COMPONENTS.Database.prototype.getSimilar = function(query, threshold) {
		var self = this;
		var similar = [];
		this.data.forEach(function(row,index) {
			var dist = 0; //manhattan distance
			self.dimensions.forEach(function(d) {
				if (query[d] !== undefined) {
					//On string dimensions, the distance is considered 0 if the strings are the same, otherwise 1
					if (self.isStringDimension(d))
						dist += (row[d] == query[d] ? 0 : 1);
					//Compare number dimensions
					else {
						//NaN values have 0 distance from each other, but 1 from anything else
						if (isNaN(query[d]))
							dist += (isNaN(row[d]) ? 0 : 1);
						//undefined values 0 distance from each other, but 1 from defined values
						else if (row[d] === undefined)
							dist += 1;
						//calculate normalized distance
						else {
							var extent = self.dimensionDomains[d];
							dist += Math.abs(
								getNormalizedValue(query[d],extent[0],extent[1])
								-
								getNormalizedValue(row[d],extent[0],extent[1])
							);
						}
					}
				}
			});//end self.dimensions.forEach()
			if (dist <= threshold) {
				similar.push(index);
			}
		});//end this.data.forEach()
		return similar;
	}
	
	//Fetch a csv file, parse data out of it. Return data with callback
	var getAndParseCSV = function(path,callback) {
		var request = new XMLHttpRequest();
		request.open("GET",path,true);
		request.onreadystatechange = function() {
			if (request.readyState === 4) {
				if (request.status === 200 || request.status === 0) {
					var data = parseCSV(request.responseText);
					if (callback)
						callback(data);
				}
			}
		}
		request.send(null);
	}
	
	//Get a value from 0 to 1 reprsenting where val lies between min and max
	var getNormalizedValue = function(val, min, max) {
		return (max-min == 0) ? 0 : ((val-min) / (max-min));
	}

	/*
	* Parse the text of a csv file into a 2 dimensional array.
	* Distinguishes between empty strings and undefined values
	*
	* Based on example code from Ben Nadel
	* https://www.bennadel.com/blog/1504-ask-ben-parsing-csv-strings-with-javascript-exec-regular-expression-command.htm
	*/
	var parseCSV = function(csvText) {
		//               (delimiter)     (quoted value)           (value)
		var csvRegex = /(\,|\r?\n|\r|^)(?:"([^"]*(?:""[^"]*)*)"|([^\,\r\n]*))/gi;
		var data = [];
		var matches;
		//If text is empty, stop now. Otherwise will get caught in infinite loop
		if (csvText === "")
			return data;
		while (matches = csvRegex.exec(csvText)) {
			//Newline,beginning of string, or a comma
			var delimiter = matches[1];
			//If the value is in quotes, it will be here (without the outside quotes)
			var quotedValue = matches[2];
			//If the value wasn't in quotes, it will be here
			var value = matches[3];
	
			//If the deilimiter is not a comma (meaning its a new line),
			//add a row to the data
			if (delimiter != ',')
				data.push([]);
			//If a quoted value, escape any pairs of quotes and add to data
			if (quotedValue !== undefined)
				data[data.length-1].push(quotedValue.replace(/""/g,"\""));
			//If an unquoted value, escape any pairs of quotes add to data, or undefined if empty
			else
				data[data.length-1].push(value === "" ? undefined : value.replace(/""/g,"\""));
		}
		//If the last line is a single, undefined value (caused by a stray newline at the end of the file), remove it.
		if (data.length > 1 && data[data.length-1].length == 1 && data[data.length-1][0] === undefined) {
			data = data.slice(0,data.length-1);
		}
		return data;
	}

	/*
	 * Check for critical errors in the given data.
	 * Returns an error message if an error was found.
	 * Doesn't return anything if no errors were found.
	 */
	var checkErrors = function(data) {
		//Check that there are at least two lines of data
		if (data.length < 2)
			return "The first and second lines in the file are required.";

		//Check that there are no empty values in the first two rows
		var emptyValFound = false;
		for (var i in data[0])
			emptyValFound = emptyValFound || (data[0][i] === undefined);
		for (var i in data[1])
			emptyValFound = emptyValFound || (data[1][i] === undefined);
		if (emptyValFound)
			return "Empty values may not occur in the header (first line) or first data row (second line).";

		//Check that all rows of data have the same length
		var testLength = data[0].length;
		for (var i in data)
			if (data[i].length != testLength)
				return "Each line must have an equal number of comma separated values (columns).";
	}

})();