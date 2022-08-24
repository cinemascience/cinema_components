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
	 * @param {Object} filter - An object defining a filter to apply to the incoming data (so that
	 * only some of the data from the file is actually represented in the database). Keys in the
	 * filter object should match a numeric dimension and contain an array of two values representing
	 * the minimum and maximum values to allow.
	 */
	CINEMA_COMPONENTS.Database = function(directory, callback, errorCallback, filter) {
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

		/** @type {Object} - The filter applied to incoming data */
		this.filter = filter

		/** @type {boolean} Whether or not this database has additional axis ordering data */
		this.hasAxisOrdering = false;
		/** @type {Object} Axis Ordering data (if it exists) */
		this.axisOrderData;

		this.dispatch = d3.dispatch("dataUpdated");

		this.errorCallback = errorCallback;

		var self = this;
		self.path = directory+'/data.csv';
		getAndParseCSV(self.path, function(data_arr, request) {
			self.prevContentLength = request.getResponseHeader('Content-Length');	

			//Check for errors
			self.error = checkErrors(data_arr);
			if (self.error) {
				console.warn(self.error);
				if (errorCallback)
					errorCallback();
				return;
			}

			calcData(self, data_arr);

			//Attempt to load an axis_order.csv file
			getAndParseCSV(directory+'/axis_order.csv',
				//Normal callback, if axis_order.csv found
				function(axis_data_arr) {
					var error = checkAxisDataErrors(axis_data_arr,self.dimensions);
					if (!error) {
						self.hasAxisOrdering = true;
						self.axisOrderData = parseAxisOrderData(axis_data_arr);
					}
					else
						console.warn("ERROR in axis_order.csv: " + error);
					self.loaded = true;
					if (callback)
						callback(self);
				},
				//Error callback, if axis_order.csv request fails
				function() {
					self.loaded = true;
					if (callback)
						callback(self);
				}
			);
		//errorCallback. If data.csv request fails
		}, function() {
			if (errorCallback)
				errorCallback("Error loading data.csv!");
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
	 * Set the database's data and calculate dimension information based off the given
	 * array of data. Sets the 'data', 'dimensions', 'dimensionTypes' and 'dimensionDomains'
	 * fields in the given database.
	 * @param {object} self - The database object
	 * @param {string} data_arr - The array of data (we assume it has already been error-checked)
	 */
	var calcData = function(self, data_arr) {
		//Get dimensions (First row of data)
		self.dimensions = data_arr[0];
		
		//Convert rows from arrays to objects
		self.data = data_arr.slice(1).map(function(d) {
			var obj = {};
			self.dimensions.forEach(function(p,i){obj[p] = d[i];});
			return obj;
		});

		//Keep track of data that gets caught in the filter while parsing
		//to remove after all the parsing has been done
		var filterdOut = []

		//Determine dimension types and calculate domains
		self.dimensions.forEach(function(d) {
			//The value used to determine the dimension type
			//is the first defined value in the column
			var val = self.data[0][d];
			var i = 0;
			while (val === undefined && i < self.data.length)
				val = self.data[++i][d];

			//Check if value is a float or integer
			//The text "NaN" (not case sensitive) counts as a float
			if (!isNaN(val) || val.toUpperCase() === "NAN") {
				if (isNaN(val) || !Number.isInteger(val))
					self.dimensionTypes[d] = CINEMA_COMPONENTS.DIMENSION_TYPE.FLOAT;
				else
					self.dimensionTypes[d] = CINEMA_COMPONENTS.DIMENSION_TYPE.INTEGER;
				//Check if this dimension is listed in the filter
				var filter = self.filter ? self.filter[d] : null
				if (filter && (!Array.isArray(filter) || filter.length != 2)) {
					console.warn("Filter for dimension '"+d+"' must be an array of length two.")
					filter = null
				}
				//calculate domain for numeric dimension
				var i;//the first index to contain a value that is not "NaN"
				for (i = 0; i < self.data.length && isNaN(self.data[i][d]); i++) {}
				if (i == self.data.length)
					//if all values are NaN, domain is [0,0]
					self.dimensionDomains[d] = [0,0]
				else {
					var min = self.data[i][d];
					var max = self.data[i][d];
					//Calculated min and max cannot extend outside of min and max
					//defined in filter
					if (filter) {
						min = Math.max(min,filter[0])
						max = Math.min(max,filter[1])
					}
					for (var j = i; j < self.data.length; j++) {
						if (!isNaN(self.data[j][d])) {
							//Ignore data that lies outside the min and max defined in the filter
							if (filter &&
								(self.data[j][d] < filter[0] || self.data[j][d] > filter[1])
							) {
								filterdOut[j] = true;
								continue;
							}
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
		});//end dimensions.foreach()

		//Remove any data that was marked to be filtered out while parsing
		self.data = self.data.filter(function(d,i){return !filterdOut[i]});
	};

	/**
	 * Reloads the database's CSV file and refreshes the data if changes have been made.
	 * If changes are found, sends an event through the dataUpdated dispatcher.
	 * By default, this will only check that the size of the CSV has changed (i.e. rows have
	 * been added or removed). Use the reloadAllData parameter to force an update of all data.
	 */
	CINEMA_COMPONENTS.Database.prototype.refreshData = function(reloadAllData) {
		var self = this;

		if (reloadAllData) {
			// Check all data in the file
			getAndParseCSV(self.path,
				function(data_arr, request) { 
					dataUpdateCallback(self, data_arr, request); 
				}, 
				self.errorCallback);
		}
		else {
			// Only check for file size changes
			var xhReq = new XMLHttpRequest();
			xhReq.open("HEAD", self.path, true);//HEAD request returns only Http response header
			xhReq.onreadystatechange = function() {
				if (xhReq.readyState === 4) {
					if (xhReq.status === 200 || 
						//Safari returns 0 on success (while other browsers use 0 for an error)
						(navigator.userAgent.match(/Safari/) && xhReq.status === 0)
					) {
						//If contentLength is different, request the full file
						//and update
						var contentLength = xhReq.getResponseHeader('Content-Length');				
						if (contentLength != self.prevContentLength) {
							getAndParseCSV(self.path,
								function(data_arr, request) { 
									dataUpdateCallback(self, data_arr, request); 
								},
								self.errorCallback);
						}
					}
				}
			}
		
			xhReq.send(null);
		}
	}

	/**
	 * Callback when getAndParseCSV returns a data array to update the data in the database.
	 * @param {object} self - The database object
	 * @param {string} data_arr = The data from the file (not yet error checked)
	 * @param {XMLHttpRequest} request = The request where we can get the response header information
	 */
	var dataUpdateCallback = function(self, data_arr, request) {
		//Ensure that the dimensions have not changed
		if (data_arr[0].length != self.dimensions.length) {
			console.warn("Updates to data cannot change the number of dimensions!")
			return;
		}
		for (var i in self.dimensions) {
			if (self.dimensions[i] != data_arr[0][i]) {
				console.warn("Updates to data cannot change the names of dimensions!")
				return;
			}
		} 

		//If there are errors in the data, don't update
		var error = checkErrors(data_arr);
		if (error) {
			console.warn("Error in updated data!\n"+error);
			return;
		}

		// Get new content length
		self.prevContentLength = request.getResponseHeader('Content-Length');	

		//Convert rows from arrays to objects
		var newData = data_arr.slice(1).map(function(d) {
			var obj = {};
			self.dimensions.forEach(function(p,i){obj[p] = d[i];});
			return obj;
		});

		// Determine whether there has been a change in the data
		var updated = false;
		var updateInfo = { added: [], modified: [], removed: [], oldData: self.data, oldDimensionDomains: self.dimensionDomains };
		for (var f = 0; f < self.data.length || f < newData.length; f++) {
			if (f >= self.data.length) {
				updateInfo.added.push(f);
				updated = true;
			}
			else if (f >= newData.length) {
				updateInfo.removed.push(f);
				updated = true;
			}
			else if (!(JSON.stringify(self.data[f]) === JSON.stringify(newData[f])) ) {
				updateInfo.modified.push(f);
				updated = true;
			}
		}

		// If the data is updated, reset the dimensions and call the dataUpdated dispather.
		if (updated) {
			self.data = newData;
			self.dimensionDomains = {};
			calcData(self, data_arr);

			self.dispatch.call("dataUpdated",self, updateInfo);
		}
	}

	/**
	 * Get data rows (returned as an array of indices) that are similar to the given data.
	 * Difference between two data points is measured as the Manhattan distance where each dimension
	 * is normalized. i.e. The sum of the differencs on each dimension (each scaled from 0 to 1).
	 * On string dimensions, the distance is 0 if the data is a regex match to the query string, Infinity otherwise
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
					//On string dimensions, the distance is considered 0 if the regex matches otherwise Infinity
					if (self.isStringDimension(d))
						dist += (RegExp(query[d]).test(row[d]) ? 0 : Infinity);
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
	
	/**
	 * Parse this database's axis data from the given array of data (from axis_order.csv)
	 */
	var parseAxisOrderData = function(data_arr) {
		var data = {};

		data_arr.slice(1).forEach(function(row) {
			var category = row[0];
			if (!data[category])
				data[category] = [];
			var value = row[1];
			data[category].push({name: value});
			var ordering = data_arr[0].slice(2).map(function(d,i) {
				return [row[i+2],i];
			}).sort(function(a,b) {
				if (a[0] === undefined) {return 1;}
				if (b[0] === undefined) {return -1;}
				return a[0]-b[0];
			}).map(function(d) {return data_arr[0].slice(2)[d[1]];});
			data[category][data[category].length-1].order = ordering;
		});

		return data;
	}

	/**
	 * Fetch a CSV file and parse the data into a two-dimensional array.
	 * @param {String} path URL of CSV file
	 * @param {Function} callback Callback if succesful, provides the data array and a reference
	 * to the XMLHttpRequest that retrieved it
	 * @param {Function} errorCallback Called if an error occured with the request
	 */
	var getAndParseCSV = function(path,callback,errorCallback) {
		var request = new XMLHttpRequest();
		request.open("GET",path,true);
		request.onreadystatechange = function() {
			if (request.readyState === 4) {
				if (request.status === 200 || 
						//Safari returns 0 on success (while other browsers use 0 for an error)
						(navigator.userAgent.match(/Safari/) && request.status === 0)
				) {
					var data = parseCSV(request.responseText);
					if (callback)
						callback(data, request);
				}
				else if (errorCallback) {
					errorCallback();
				}
			}
		}
		request.send(null);
	}

	/**
	 * Get a value from 0 to 1 reprsenting where val lies between min and max
	 */
	var getNormalizedValue = function(val, min, max) {
		return (max-min == 0) ? 0 : ((val-min) / (max-min));
	}

	/**
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

	/**
	 * Check for critical errors in the given data.
	 * Returns an error message if an error was found.
	 * Doesn't return anything if no errors were found.
	 */
	var checkErrors = function(data) {
		//Check that there are at least two lines of data
		if (data.length < 2)
			return "The first and second lines in the file are required.";

		//Check that there at least two dimensions to the data
		if (data[0].length < 2)
			return "The dataset must include at least two dimensions";

		//Check that there are no empty values in the first row
		var emptyValFound = false;
		for (var i in data[0])
			emptyValFound = emptyValFound || (data[0][i] === undefined);
		if (emptyValFound)
			return "Empty values may not occur in the header (first line).";

		//Check that all rows of data have the same length
		var testLength = data[0].length;
		for (var i in data)
			if (data[i].length != testLength)
				return "Each line must have an equal number of comma separated values (columns).";

		//Check that no colummns have all undefined values
		for (var i = 0; i < data[0].length; i++) {
			var allEmpty = true;
			for (var j = 0; j < data.length; j++)
				allEmpty = allEmpty && (data[j][i] === undefined);
			if (allEmpty)
				return "There cannot be any columns with all undefined values.";
		}
	}

	/**
	 * Check for critical errors in the given axis data
	 * Checks against the given list of dimensions
	 * Returns an error message if an error was found.
	 * Doesn't return anything if no errors were found
	 */
	var checkAxisDataErrors = function(data, dimensions) {
		//Check that there are at least two lines of data
		if (data.length < 2)
			return "The first and second lines in the file are required.";

		//Check that all rows of data have the same length
		var testLength = data[0].length;
		for (var i in data)
			if (data[i].length != testLength)
				return "Each line must have an equal number of comma separated values (columns).";

		/*//Check that there are dimensions+2 columns (+2 for category and value columns)
		if (data[0].length !== dimensions.length+2)
			return "All dimensions must be specified in the header of the file."*/

		//Check that each dimension in the header is valid
		for (var i = 2; i < data[0].length; i++) {
			if (!dimensions.includes(data[0][i]))
				return "Dimension in axis order file '"+data[0][i]+"' is not valid";
		}

		//Check that the first two columns contain to undefined values
		for (var i = 0; i < data.length; i++) {
			if (data[i][0] === undefined)
				return "Category cannot be undefined."
			if (data[i][1] === undefined)
				return "Value cannot be undefined."
		}

		//Check that all other data are numbers
		for (var i = 1; i < data.length; i++) {
			for (var j = 2; j < data[i].length; j++) {
				if (isNaN(data[i][j]) && data[i][j] !== undefined)
					return "Values for dimensions cannot be NaN."
			}
		}
	}

})();
