/**
 * Create a new GlyphChart
 * @param {d3.Selection} parent A selection of the parent element to add the chart to
 * @param {String} pathToCsv Path to the CSV file to load data from
 * @param {RegExp} filterRegex Any dimensions whose names match this regex will be excluded from the chart
 * @param {function} callback Called when done loading (not called if there are errors in the data)
 */
function GlyphChart(parent, pathToCsv, filterRegex, callback) {
	//init instance variables
	this.parent = parent;
	this.pathToCsv = pathToCsv;
	this.filterRegex = filterRegex;

	//Sizing
	this.margin = {top: 50, right: 50, bottom: 50, left: 50};
	this.parentRect = parent.node().getBoundingClientRect();
	var internalWidth = this.parentRect.width - this.margin.left - this.margin.right;
	var internalHeight = this.parentRect.height - this.margin.top - this.margin.bottom;
	var squareSize = Math.min(internalHeight,internalWidth);
	this.radius = squareSize/2;
	this.innerMargin = this.radius/11;

	//Scales
	this.scales = {};
	this.rotation = d3.scalePoint();

	//Components
	this.path;
	this.axes;
	this.labels;

	//Append svg
	this.svg = parent.append('svg')
		.attr('class','glyphChart')
		.attr('viewBox',(-this.margin.right)+' '+(-this.margin.top)+' '+
						(this.parentRect.width)+' '+
						(this.parentRect.height))
		.attr('preserveAspectRatio','none')
		.attr('width','100%')
		.attr('height','100%');

	//Data
	this.allDimensions = [];
	this.dimensions = [];
	this.results = [];

	//Parse CSV and build chart
	var self = this;
	getAndParseCSV(this.pathToCsv, function(data) {
		//Check for errors. Stop if any are found
		var error = self.checkErrors(data);
		if (error) {
			console.error(error);
			return;
		}

		//Constant to convert from Radians to Degrees
		var RADTODEG = (180/Math.PI);

		self.allDimensions = data[0];
		//Create result objects from arrays
		self.results = data.slice(1).map(function(d) {
			var obj = {};
			self.allDimensions.forEach(function(p,i){obj[p] = d[i];});
			return obj;
		});
		//Filter dimensions
		self.dimensions = self.allDimensions.filter(function(d) {
			return filterRegex ? !filterRegex.test(d) : true;
		});

		//Create rotation scale (takes in dimension and outputs rotation in radians)
		self.rotation.domain(self.dimensions)
			.range([0,Math.PI*2-Math.PI*2/(self.dimensions.length+1)]);
		//Create scales for each dimension
		self.dimensions.forEach(function(d) {
			//If the dimension is a float or integer type, create a linear scale
			//If the value is the text "NaN," (not case sensitive) then it counts as a float type
			if (!isNaN(self.results[0][d]) || self.results[0][d].toUpperCase() === "NAN") {
				self.scales[d] = d3.scaleLinear()
					.domain(d3.extent(self.results, function(p){return +p[d];}))
					.range([self.radius-self.innerMargin,0]);
			}
			//otherwise, the dimension is a string type so create a point scale
			else {
				self.scales[d] = d3.scalePoint()
					.domain(self.results.map(function(p){return p[d];}))
					.range([self.radius,0]);
			}
		});

		//Add glyph path (by default, bound to the first result)
		self.path = self.svg.append('path')
			.attr('class','glyph')
			.datum(self.results[0])
			.attr('d',function(d){return self.getPath(d);});

		//Add axes
		self.axes = self.svg.append('g')
			.attr('class','axes')
		.selectAll('g.dimension')
			.data(self.dimensions)
			.enter().append('g')
				.attr('class','dimension')
				.attr('dimension',function(d){return d;})
				.attr('transform',function(d) {
					var r = self.radius;
					var rot = self.rotation(d)*RADTODEG;
					return "translate("+r+") "+
						"rotate("+rot+" 0 "+r+")";
				});
		self.axes.append('g')
			.attr('class','axis')
			.each(function(d) {
				d3.select(this).call(d3.axisLeft().scale(self.scales[d]));
				d3.select(this).selectAll('text')
					.style('text-anchor',"middle")
					.attr('transform',"rotate("+self.textRotation(d)+" -15 0)");
			});

		//Add labels
		self.labels = self.svg.append('g')
			.attr('class','labels')
		.selectAll('g','.label')
			.data(self.dimensions)
			.enter().append('g')
				.attr('class','label')
				.attr('transform',function(d) {
					var r = self.radius;
					var rot = self.rotation(d)*RADTODEG;
					return "translate("+r+") "+
						"rotate("+rot+" 0 "+r+")";
				});
		self.labels.append('text')
			.style('text-anchor',"middle")
			.text(function(d){return d;})
			.attr('transform',function(d) {
				return "translate(0 -15) "
					+"rotate("+self.textRotation(d)+")";
			});

		if (callback)
			callback();
	});
}

/**
 * Get the path (contents of the 'd' attribute) for the given data point (result)
 */
GlyphChart.prototype.getPath = function(p) {
	var self = this;
	var path;
	var startPoint;
	this.dimensions.forEach(function(d,i) {
		var point = self.getPoint(d,p);
		if (i == 0) {
			startPoint = point;
			path = "M "+point.x+" "+point.y+" "
		}
		else if (i == self.dimensions.length-1) {
			//loop back to the start point at the end to close the path
			path += "L "+point.x+" "+point.y+" "+
					"L "+startPoint.x+" "+startPoint.y;
		}
		else {
			path += "L "+point.x+" "+point.y+" ";
		}
	});
	return path;
}

/**
 * The x,y point on the chart where the given data point (p) passes
 * through the axis for the given dimension (d)
 */
GlyphChart.prototype.getPoint = function(d,p) {
	if (isNaN(p[d]))
		//NaN values are placed in the center of the chart
		return {x: this.radius, y: this.radius};
	var len = this.radius-this.scales[d](p[d]);
	var rot = this.rotation(d)-Math.PI/2;
	var x = Math.cos(rot)*len;
	var y = Math.sin(rot)*len;
	return {x: x+this.radius, y: y+this.radius};
}

/**
 * Resize the chart. (Call this every time the size of the parent changes)
 */
GlyphChart.prototype.updateSize = function() {
	//Recalculate dimensions
	this.parentRect = this.parent.node().getBoundingClientRect();
	var internalWidth = this.parentRect.width - this.margin.left - this.margin.right;
	var internalHeight = this.parentRect.height - this.margin.top - this.margin.bottom;
	this.svg.attr('viewBox',
						(-this.margin.right)+' '+
						(-this.margin.top)+' '+
						(this.parentRect.width)+' '+
						(this.parentRect.height));
	var squareSize = Math.min(internalHeight,internalWidth);
	this.radius = squareSize/2;
	this.innerMargin = this.radius/11;

	var self = this;

	this.dimensions.forEach(function (d) {
		self.scales[d].range([self.isStringDimension(d) ? self.radius : self.radius-self.innerMargin, 0]);
	});

	//Re-transform axes
	this.axes.attr('transform',function(d) {
		var r = self.radius;
		var rot = self.rotation(d)*(180/Math.PI);
		return "translate("+r+") "+
			"rotate("+rot+" 0 "+r+")";
	})
	//Rebuild axes
	.each(function(d) {
		d3.select(this).call(d3.axisLeft().scale(self.scales[d]));
	});

	//Re-transform labels
	this.labels.attr('transform',function(d) {
		var r = self.radius;
		var rot = self.rotation(d)*(180/Math.PI);
		return "translate("+r+") "+
			"rotate("+rot+" 0 "+r+")";
	});

	//Rebuild path
	this.path.attr('d',function(d) {return self.getPath(d);});
}

/**
 * Change the path in the chart to show the result with the given index
 */
GlyphChart.prototype.setPath = function(index) {
	var self = this;
	this.path.datum(this.results[index])
		.transition(1000).attr('d',function(d) {return self.getPath(d);});
}

/**
 * Whether or not the given dimension represents a string dimension (false if a float or integer dimension)
 */
GlyphChart.prototype.isStringDimension = function(d) {
	return Boolean(this.scales[d].step);
}

/**
 * The local rotation for text in the given dimension.
 * If text would be upside-down, flip it so all text is legible
 */
GlyphChart.prototype.textRotation = function(d) {
	var rot = this.rotation(d)*(180/Math.PI);
	return (rot > 90 && rot < 270) ? 180 : 0;
}

/**
 * Check for critical errors in the given data.
 * Returns an error message if an error was found.
 * Doesn't return anything if no errors were found.
 */
GlyphChart.prototype.checkErrors = function(data) {
	//Check that there are at least two lines of data
	if (data.length < 2)
		return "The first and second lines in the file are required.";

	//Check that there are no empty values in the first two rows
	var emptyValFound = false;
	for (var i in data[0])
		emptyValFound = emptyValFound && (data[0][i] === undefined);
	for (var i in data[1])
		emptyValFound = emptyValFound && (data[1][i] === undefined);
	if (emptyValFound)
		return "Empty values may not occur in the header (first line) or first data row (second line).";

	//Check that all rows of data have the same length
	var testLength = data[0].length;
	for (var i in data)
		if (data[i].length != testLength)
			return "Each line must have an equal number of comma separated values (columns). "+
					"Is there a stray newline at the end of the file?";
}

/*
* Parse the text of a csv file into a 2 dimensional array.
* Distinguishes between empty strings and undefined values
*
* Use this instead of d3's parser which counts undefined values as empty strings
*
* Based on example code from Ben Nadel
* https://www.bennadel.com/blog/1504-ask-ben-parsing-csv-strings-with-javascript-exec-regular-expression-command.htm
*/
function parseCSV(csvText) {
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
	return data;
}

/*
* Get the specified CSV file, parse it, and call callback with the data when done
*/
function getAndParseCSV(path,callback) {
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