'use strict';
(function() {
	/**
	 * CINEMA_COMPONENTS
	 * LineChart
	 *
	 * The LineChart Component for the CINEMA_COMPONENTS library.
	 * It is a sublcass of Component
	 *
	 * @exports CINEMA_COMPONENTS
	 *
	 * @author Robin Maack
	 */

	//If CINEMA_COMPONENTS is already defined, add to it, otherwise create it
	var CINEMA_COMPONENTS = {}
	if (window.CINEMA_COMPONENTS)
		CINEMA_COMPONENTS = window.CINEMA_COMPONENTS;
	else
		window.CINEMA_COMPONENTS = CINEMA_COMPONENTS;

	//Require that the Component module be included
	if (!CINEMA_COMPONENTS.COMPONENT_INCLUDED)
		throw new Error("CINEMA_COMPONENTS LineChart module requires that Component"+
			" module be included. Please make sure that Component module"+
			" is included BEFORE LineChart module");

	//Require that d3 be included
	if (!window.d3) {
		throw new Error("CINEMA_COMPONENTS LineChart module requires that"+
		" d3 be included (at least d3v5). Please make sure that d3 is included BEFORE the"+
		" the Pcoord module");
	}

	/** @type {boolean} - Flag to indicate that the LineChart module has been included */
	CINEMA_COMPONENTS.LINECHART_INCLUDED = true;

	/**
	 * Retrieve if a value is contained in an array
	 * @param {ANY} needle - Element to search for in Array
	 */
	var containedInArray = function(needle) {
		//Per spec, the way to identify NaN is that it is not equal to itself
		var findNaN = needle !== needle;
		var indexOf;

		if(!findNaN && typeof Array.prototype.indexOf === 'function') {
			indexOf = Array.prototype.indexOf;
		}
		else {
			indexOf = function(needle) {
				var i = -1, index = -1;

				for(i = 0; i < this.length; i++) {
					var item = this[i];

					if((findNaN && item !== item) || item === needle) {
						index = i;
						break;
					}
				}

			return index;
			};
		}

		return indexOf.call(this, needle) > -1;
	};

	/** @type {RegExp} - Regular Expression to check for scientific notation*/
	const scientificNotationRegExp = new RegExp(/^((\d)+|(\d+\.\d+))(e|E)(\+|-)(\d)+$/);

	/**
	 * Check if numberString is in scientifc notation
	 * @param {String} numberString - String which might contain a scientific notation
	 */
	var isInScientificNotation = function(numberString) {
		if(typeof numberString === 'string' || numberString instanceof String)
			if(scientificNotationRegExp.test(numberString))
				return true;
		return false;
	}

	/**
	 * Checks if a dimension name starts with a string from the list
	 * @type {String} dimension - name of the dimension to check
	 * @type {Array} prefixList - list of prefixes
	 */
	var startsWithPrefixes = function(dimension, prefixList) {
		if(typeof prefixList === 'undefined')
			return false;
		for(i = 0; i < prefixList.length; i++) {
			if(dimension.startsWith(prefixList[i]))
				return true;
		}
		return false;
	}

	/**
	 * Abstract constructor for LineCart Components
	 * Represents a component for displaying and interacting with a database on a multiple lines chart
	 * @param {DOM} parent - The DOM object to build this component inside of
	 * @param {CINEMA_COMPONENTS.Database} database - The database behind this component
	 * @param {RegExp} filterRegex - A regex to determine which dimensions to NOT show on the component
	 */
	CINEMA_COMPONENTS.LineChart = function(parent, database, filterRegex, image_measures, excluded_dimensions) {
		var self = this;

		//call super-constructor
		CINEMA_COMPONENTS.Component.call(this,parent,database,filterRegex);

		//Allowed prefixes for image measures, check for unused beforehand
		if(typeof image_measures !== 'undefined') {
			this.allowedUPrefixes = [];
			const image_measuresLength = image_measures.length;
			for (var i = 0; i < image_measuresLength; i++) {
				for (var key in self.db.dimensionTypes) {
					if(key.startsWith(image_measures[i])) {
						this.allowedUPrefixes.push(image_measures[i]);
						break;
					}
				}
			}
		}

		//Excluded dimensions for x-axis
		this.excludedDim = excluded_dimensions;

		/***************************************
		 * SIZING
		 ***************************************/

		/** @type {CINEMA_COMPONENTS.Margin} Override default margin */
		this.margin = new CINEMA_COMPONENTS.Margin(20,30,50,170);

		/** @type {CINEMA_COMPONENTS.Margin} Margins of axis to the SVG plane */
		this.axismargin = new CINEMA_COMPONENTS.Margin(15,15,15,15);

		/***************************************
		 * DATA
		 ***************************************/

		/** @type {String} The currently selected dimensions for each axis*/
		this.xDimension = this.dimensions[0];

		/** @type {Object} Currently selected data point*/
		this.currentlySelectedPoint = {};

		/** @type {Object} Data to be shown by the plot*/
		this.plotData = {};

		//Prepare the plot data
		this.prepareData();

		/***************************************
		 * EVENTS
		 ***************************************/

		/** @type {d3.dispatch} Hook for events on chart
		 * Set handlers with on() function. Ex: this.dispatch.on('mousemove',handlerFunction(i))
		 * 'mousemove': Triggered when movinge mouse over the svg plane.
		 *     (called with the index of moused move data and a reference to the mouse event)
		 * 'mouseenter': Triggered when a mouse enters the svg plane.
		 *     (called with the index of moused enter data and a reference to the mouse event)
		 * 'mouseleave': Triggered when a mouse leaves the svg plane.
		 *     (called with the index of mouse leave data and a reference to the mouse event)
		 * 'mousedown': Triggered when the left mouse button is pushed down.
		 *     (called with the index of mouse down data and a reference to the mouse event)
		 * 'mouseup': Triggered when the left mouse button is released.
		 *     (called with the index of mouse up data and a reference to the mouse event)
		 * 'xchanged': Triggered when the x dimension being viewed is changed
		 *     (called with the new dimension as an argument)
		*/
		this.dispatch = d3.dispatch("mousemove","mouseenter","mouseleave","mousedown","mouseup","xchanged");

		/***************************************
		 * DRAGGING
		 ***************************************/

		/** @type {boolean} Is left mouse button pushed down*/
		this.dragging = false;

		/** @type {int} svg x position where mouse left mouse button was pushed down*/
		this.dragStartX = 0;

		/** @type {Object} Save selected data when mouse button was pushed down*/
		this.dragStartData = {};

		/** @type {Object} Save start and end data if drag action */
		this.dragResult = {};

		/***************************************
		 * DOM Content
		 ***************************************/

		 /** Main Container **/

		//Give plot container a class
		d3.select(this.container).classed('MULTILINE_PLOT',true);

		//Add a div as main container to add other components later
		this.mainContainer = d3.select(this.container).append('div')
			.classed('mainContainer',true)
			.style('position','absolute')
			.style('top',this.margin.top+'px')
			.style('right',this.margin.right+'px')
			.style('bottom',this.margin.bottom+'px')
			.style('left',this.margin.left+'px')
			.style('width',this.internalWidth+'px')
			.style('height',this.internalHeight+'px');

		/** Dimension selection for x-axis **/

		//Get all non image measure and non file dimensions
		this.validDim = [];
		for(var i=0, len=self.dimensions.length; i < len; i++) {
			if(!(self.dimensions[i].startsWith("FILE") ||
			startsWithPrefixes(self.dimensions[i], this.allowedUPrefixes) ||
			startsWithPrefixes(self.dimensions[i], this.excludedDim))) {
				self.validDim.push(self.dimensions[i]);
			}
		}

		//Add Dimension selection dropdown menu
		this.xSelect = d3.select(this.container).append('select')
			.classed('dimensionSelect x', true)
			.style('position','absolute')
			.node();

		//Add all options to dropdown menu
		d3.select(this.xSelect).selectAll('option')
			.data(this.validDim)
			.enter().append('option')
				.attr('value',function(d){return d;})
				.text(function(d){return d;});
		d3.select(this.xSelect).node().value = this.xDimension;

		//Define actions when a new Dimension is selected
		d3.select(this.xSelect).on('input',function() {
			self.xDimension = this.value;
			self.updateData();
			self.x = (self.db.isStringDimension(self.xDimension) ? d3.scalePoint() : d3.scaleLinear())
				.domain(d3.extent(self.plotData.dates));
			self.xAxisContainer.select('.axis')
				.call(d3.axisBottom().scale(self.x));
			self.dispatch.call('xchanged',self,self.xDimension);
			self.updateLineVisibility();
			self.redraw();
		});

		/** Checkboxtable for selecting uncertainty measures **/

		this.tableContainer = d3.select(this.container).append('div')
			.classed('tableContainer',true)
			.style('position','absolute')
			.style('top', 20 + 'px')
			.style('left', 5 + 'px')
			.style('bottom',this.margin.bottom+'px')
			.style('overflow-y', 'auto')
			.style('overflow-x', 'hidden');

		//Set the checkboxes for the whole group and update
		this.updateLineGroupVisibility = function() {
			d3.selectAll(".lineGroupSelectCheckbox").each(function(d) {
				const cbgroup = d3.select(this);
				d3.selectAll(".lineSelectCheckbox").each(function(d) {
					const cb = d3.select(this);
					if(cb.property("value").startsWith(cbgroup.property("value")))
						cb.property("checked", cbgroup.property("checked"));
				});
			});
			self.updateLineVisibility();
		}

		//Function to toggle Checkboxes for uncertainty measures
		this.updateLineVisibility = function() {
			d3.selectAll(".lineSelectCheckbox").each(function(d) {
				const cb = d3.select(this);
				self.setLineVisibility(cb.property("value"), cb.property("checked"));
			});
			self.redraw();
		}

		/** Measure group checkboxes **/

		//Table containing the checkboxes
		this.ySelectGroupTable = self.tableContainer
			.append('table')
				.classed("lineSelect yGroup", true);

		//Rows in the checkbox table
		this.yTableGroupRows = this.ySelectGroupTable.selectAll('tr')
			.classed("lineSelectRow y", true)
			.data(this.allowedUPrefixes)
			.enter().append('tr');

		//Add checkboxes to the table
		this.yTableGroupRows.selectAll('td')
			.data((d) => [d])
			.enter()
			.append('td')
			.append("input")
				.classed("lineGroupSelectCheckbox", true)
				.attr("checked", true)
				.attr("type", "checkbox")
				.attr("id", function(d,i) { return 'a'+i; })
				.attr("value", (d) => d)
				.on("change", self.updateLineGroupVisibility);

		//Add text next to the checkboxes
		this.yTableGroupRows.selectAll("td")
			.data((d) => [d])
			.append("text")
				.classed("lineGroupSelect checkboxtext", true)
				.text((d) => "All " + d);

		/** Measure checkboxes **/

		//Table containing the checkboxes
		this.ySelectTable = self.tableContainer
			.append('table')
				.classed("lineSelect y", true);

		//Rows in the checkbox table
		this.yTableRows = this.ySelectTable.selectAll('tr')
			.classed("lineSelectRow y", true)
			.data(self.plotData.series)
			.enter().append('tr');

		//Add checkboxes to the table
		this.yTableRows.selectAll('td')
			.data((d) => [d])
			.enter()
			.append('td')
			.append("input")
				.classed("lineSelectCheckbox", true)
				.attr("checked", true)
				.attr("type", "checkbox")
				.attr("id", function(d,i) { return 'a'+i; })
				.attr("value", (d) => d.name)
				.on("change", self.updateLineVisibility);

		//Add text next to the checkboxes
		this.yTableRows.selectAll("td")
			.data((d) => [d])
			.append("text")
				.classed("lineSelect checkboxtext", true)
				.text((d) => d.name);

		/** SVG plane **/

		this.initChart = function() {
			/** SVG plane creation **/

			//Create svg plane
			this.svg = this.mainContainer.append('svg')
				.attr('class','lineChart')
				.attr('viewBox','0 0 '+this.internalWidth+' '+this.internalHeight)
				.attr('preserveAspectRatio','none')
				.attr('width','100%')
				.attr('height','100%');

			//set svg position
			this.svg.style("position", "relative");

			//Add interaction to the svg plane
			this.svg
			.on('mousemove', function() {
				self.dispatch.call('mousemove',self,null,d3.event);
			})
			.on('mouseenter', function() {
				self.dispatch.call('mouseenter',self,null,d3.event);
			})
			.on('mouseleave', function() {
				self.dispatch.call('mouseleave',self,null,d3.event);
			})
			.on("mousedown", function() {
				self.dispatch.call('mousedown',self,null,d3.event);
			})
			.on("mouseup", function() {
				self.dispatch.call('mouseup',self,null,d3.event);
			});

			/** Draw paths **/

			//Line to draw on svg plane, mapping data and indexes to lines
			this.chartline = d3.line()
				.defined(d => !isNaN(d))
				.x((d, i) => this.x(this.plotData.dates[i]))
				.y(d => this.y(d));

			//Create all g elements for lines in the plot
			this.path = this.svg.append("g")
				.attr("fill", "none")
				.attr("stroke", "steelblue")
				.attr("stroke-width", 1.5)
				.attr("stroke-linejoin", "round")
				.attr("stroke-linecap", "round")

			//Add all chartlines
			this.path.selectAll("path")
				.data(this.plotData.series.filter(entry => entry.show))
				.join("path")
				.style("mix-blend-mode", "multiply")
				.attr("d", d => self.chartline(d.values));

			/** Add dot/circle to show current data point **/

			//create Dot g element to show currently selected data
			this.dot = this.svg.append("g")
				.attr("display", "none");

			//Add the circle
			this.dot.append("circle")
				.attr("r", 2.5);

			//Add text showing the uncertainty measure name
			this.dot.append("text")
				.attr("id", "dot_name_text")
				.style("font", "10px sans-serif")
				.attr("text-anchor", "middle")
				.attr("y", -6);

			//Add text showing the current value of the uncertainty measure
			this.dot.append("text")
				.attr("id", "dot_number_text")
				.style("font", "10px sans-serif")
				.attr("text-anchor", "middle")
				.attr("y", +10);

  		return this.svg.node();
		}

		/***************************************
		 * AXES
		 ***************************************/

		/** @type {d3.scalePoint} - Scale for x axis on chart
		 * Maps dimension value to position (in pixels) along width of chart.*/
		this.x = (this.db.isStringDimension(this.xDimension) ? d3.scalePoint() : d3.scaleLinear())
			.domain(d3.extent(this.plotData.dates))
			.range([this.axismargin.left,self.internalWidth - this.axismargin.right]);

		/** @type {d3.scalePoint} - Scale for x axis on chart
		 * Maps measure values to position (in pixels) along height of chart.*/
		this.y = d3.scaleLinear()
			.domain([0, d3.max(this.plotData.series, d => d3.max(d.values))]).nice()
			.range([self.internalHeight - this.axismargin.bottom,this.axismargin.top]);

		//Container for the x-axis
		this.xAxisContainer = d3.select(this.container).append('svg')
			.classed('axisContainer x',true)
			.style('position','absolute')
			.style('width',this.internalWidth+'px')
			.style('height',25+'px')
			.style('top',this.margin.top+this.internalHeight+'px')
			.style('left',this.margin.left+'px');

		//Container for the y-axis
		this.yAxisContainer = d3.select(this.container).append('svg')
			.classed('axisContainer y',true)
			.style('position','absolute')
			.style('width',50+'px')
			.style('height',this.internalHeight+'px')
			.style('left',(this.margin.left-50)+'px')
			.style('top',this.margin.top+'px');

		//Draw the x-axis
		this.xAxisContainer.append('g')
			.classed('axis',true)
			.call(d3.axisBottom().scale(this.x));

		//Draw the y-axis
		this.yAxisContainer.append('g')
			.classed('axis',true)
			.attr('transform','translate(50)')
			.call(d3.axisLeft().scale(this.y));

		//Save the width of the axis line to adjust the graph later on
		this.axislineWidth = parseInt(getComputedStyle(
			document.querySelector('.CINEMA_COMPONENT.MULTILINE_PLOT .axis line'))
			.getPropertyValue('stroke-width'), 10);

		//Set the position of both axis
		this.xAxisContainer.style('top',this.margin.top+this.internalHeight+this.axislineWidth+'px');
		this.yAxisContainer.style('left', (this.margin.left - 50 - this.axislineWidth) +'px');

		/** @type {d3.selection (svg)} The SVG element containing all the content of the svg plane */
		this.chart = this.initChart();

		//Draw
		this.redraw();
	}
	//establish prototype chain
	CINEMA_COMPONENTS.LineChart.prototype = Object.create(CINEMA_COMPONENTS.Component.prototype);
	CINEMA_COMPONENTS.LineChart.prototype.constructor = CINEMA_COMPONENTS.LineChart;
	/**
	 * Should be called every time the size of the chart's container changes.
	 * Updates the sizing and scaling of all parts of the chart and redraws
	 */
	CINEMA_COMPONENTS.LineChart.prototype.updateSize = function() {
		var self = this;

		//Call super (will recalculate size)
		CINEMA_COMPONENTS.Component.prototype.updateSize.call(this);

		if(this.internalHeight > 100){
			//update mainContainer size
			this.mainContainer
				.style('width',this.internalWidth+'px')
				.style('height',this.internalHeight+'px');

			//update svg plane size
			this.svg.attr('viewBox','0 0 '+this.internalWidth+' '+this.internalHeight);

			//Rescale
			this.x.range([this.axismargin.left, this.internalWidth - this.axismargin.right]);
			this.y.range([this.internalHeight - this.axismargin.bottom, this.axismargin.top]);

			//Update the x-axis
			this.xAxisContainer
				.style('width',this.internalWidth+'px')
				.style('top',this.margin.top+this.internalHeight+this.axislineWidth+'px')
				.select('.axis')
					.call(d3.axisBottom().scale(this.x));

			//Update the y-axis
			this.yAxisContainer
				.style('height',this.internalHeight+'px')
				.select('.axis')
					.call(d3.axisLeft().scale(this.y));

			//Update the chart line drawing method
			this.chartline
				.x((d, i) => this.x(this.plotData.dates[i]))
				.y(d => this.y(d))

			//Redraw all paths
			this.path.selectAll("path")
				.attr("d", d => self.chartline(d.values));
		}
	};

	/**
	 * Gets called when the mouse is moved inside the svg plane
	 * Highlights the selected path and changes the selected data point
	 * Updates the dragging square if currently dragging
	 * @type {Object} eventdata - Mouse event data
	 */
	CINEMA_COMPONENTS.LineChart.prototype.moved = function(eventdata) {
		var self = this;
		if(this.getVisibileLineCount()) {
			//Prevent selecting text
			eventdata.preventDefault();

			//Get currently selected data point
			var currentDatapoint = this.getMousePositionData(eventdata);

			//If dragging update dragging square
			if(this.dragging) {
				//Startpoint is right of current position
				if(self.dragStartX > eventdata.layerX){
					self.svg.select("rect")
						.attr("x", eventdata.layerX)
						.attr("width", self.dragStartX - eventdata.layerX);
				}
				//Startpoint is left of current position
				else {
					self.svg.select("rect")
						.attr("width", eventdata.layerX - self.dragStartX);
				}
			}

			//Redraw paths and dot
			this.path.selectAll("path").attr("stroke", d => d === currentDatapoint.series ? null : "#ddd").filter(d => d === currentDatapoint.series).raise();
			this.dot.attr("transform", `translate(${self.x(currentDatapoint.date)},${self.y(currentDatapoint.value)})`);
			this.dot.select("#dot_name_text").attr("overflow", "visible").text(currentDatapoint.umeasurename);
			this.dot.select("#dot_number_text").attr("overflow", "visible").text(currentDatapoint.value.toFixed(2));
		}
	}

	/**
	 * Gets called when the mouse enters the svg plane
	 * Resets the paths and dot
	 * @type {Object} eventdata - Mouse event data
	 */
	CINEMA_COMPONENTS.LineChart.prototype.entered = function() {
		if(this.getVisibileLineCount()) {
			this.path.selectAll("path").style("mix-blend-mode", null).attr("stroke", "#ddd");
			this.dot.attr("display", null);
		}
	}

	/**
	 * Gets called when the mouse leaves the svg plane
	 * Resets the paths and dot
	 * @type {Object} eventdata - Mouse event data
	 */
	CINEMA_COMPONENTS.LineChart.prototype.left = function() {
		var self = this;

		//Reset paths and dot
		if(this.getVisibileLineCount()) {
			this.path.selectAll("path").style("mix-blend-mode", "multiply").attr("stroke", null);
			this.dot.attr("display", "none");
		}
		//Prevent draging from continuing and show failure(red square)
		if(self.dragging) {
			self.dragging = false;
			self.svg.selectAll("rect")
				.transition()
					.duration(100)
					.attr("stroke-width", 10)
					.attr("stroke", "red")
				.delay(200)
				.transition()
					.duration(1000)
					.attr("opacity", 0.0)
					.remove();
		}
	}

	/**
	 * Gets called when the mouse gets pushed down on the svg plane
	 * Saves the start position and data
	 * Creates the dragging rectange
	 * @type {Object} eventdata - Mouse event data
	 */
	CINEMA_COMPONENTS.LineChart.prototype.down = function(eventdata) {
		var self = this;

		if(eventdata.button === 0) {
			//Prevent selecting text
			eventdata.preventDefault();

			//Set dragging values
			self.dragging = true;
			self.dragStartData = this.getMousePositionData(eventdata);
			self.dragStartX = eventdata.layerX;

			//Create dragging rectange
			var rect = this.svg.append("rect")
				.attr("x", self.dragStartX)
				.attr("y", 0)
				.attr("width", 1)
				.attr("height", self.svg.style("height"))
				.attr("opacity", 0.5)
				.attr("fill", "yellow");
		}
	}

	/**
	 * Gets called when the mouse gets released on the svg plane
	 * Calculates the result of draggung(selected Data)
	 * Draws the succesful rectange and destroys it
	 * @type {Object} eventdata - Mouse event data
	 */
	CINEMA_COMPONENTS.LineChart.prototype.up = function(eventdata) {
		var self = this;

		if(eventdata.button === 0 && self.dragging) {
			//Stop dragging
			self.dragging = false;

			//Get data point ad end location
			var dragEndData = this.getMousePositionData(eventdata);

			//Calculate the selected start and end date
			self.dragResult = {
				dimension : self.xDimension,
				startDate: self.dragStartData.date < dragEndData.date ? self.dragStartData.date : dragEndData.date,
				endDate: self.dragStartData.date > dragEndData.date ? self.dragStartData.date : dragEndData.date
			}

			//Adjusted X and Y position of the rectange to include all selected data
			var adjustedStartX = self.x(self.dragResult.startDate);
			var adjustedEndX = self.x(self.dragResult.endDate);

			//Solve problem with 0 width rectange
			if(adjustedStartX === adjustedEndX) {
				adjustedStartX -= 1;
				adjustedEndX += 1;
			}

			//Draw animation and destroy
			self.svg.selectAll("rect")
				.transition()
				.duration(500)
					.attr("x", adjustedStartX)
					.attr("width", adjustedEndX - adjustedStartX)
				.delay(50)
				.transition()
					.duration(100)
					.attr("stroke-width", 10)
					.attr("stroke", "green")
				.delay(200)
				.transition()
					.duration(1000)
					.attr("opacity", 0.0)
					.remove();
		}
	}

	/**
	 * Receive the closest data point to the current mouse location
	 * @type {Object} eventdata - Mouse event data
	 */
	CINEMA_COMPONENTS.LineChart.prototype.getMousePositionData = function(eventdata) {
		var self = this;

		//If any line is visible
		if(this.getVisibileLineCount()) {
			//Get position in svg plane as dimension value
			var ym = this.y.invert(eventdata.layerY);
			var xm = this.x.invert(eventdata.layerX);

			//Find closest point
			var i1 = d3.bisectLeft(this.plotData.dates, xm, 1);
			var i0 = i1 - 1;
			var i = xm - self.plotData.dates[i0] > self.plotData.dates[i1] - xm ? i1 : i0;
			var s = this.plotData.series.filter(entry => entry.show).reduce((a, b) => Math.abs(a.values[i] - ym) < Math.abs(b.values[i] - ym) ? a : b);

			//Save the selected point
			this.currentlySelectedPoint = {
				date: self.plotData.dates[i],
				value: s.values[i],
				umeasurename: s.name,
				series: s
			}
			return this.currentlySelectedPoint;
		}
	}

	/**
	 * Should be called whenever the data in the associated database changes.
	 */
	CINEMA_COMPONENTS.LineChart.prototype.updateData = function() {
		var self = this;
		self.prepareData();
		self.redraw();
	};

	/**
	 * Redraw the chart path
	 */
	CINEMA_COMPONENTS.LineChart.prototype.redraw = function() {
		var self = this;

		//Rescale x-axis
		self.x
			.domain(d3.extent(self.plotData.dates))
			.range([self.axismargin.left, self.internalWidth - self.axismargin.right]);

		//Rescale y-axis
		self.y
			.domain([
				d3.min(self.plotData.series.filter(entry => entry.show), d => d3.min(d.values)),
				d3.max(self.plotData.series.filter(entry => entry.show), d => d3.max(d.values))
			 	]).nice()
			.range([self.internalHeight - self.axismargin.bottom, self.axismargin.top]);

		//Redraw x-axis
		self.xAxisContainer
			.select('.axis')
				.call(d3.axisBottom().scale(self.x));

		//Redraw y-axis
		self.yAxisContainer
			.select('.axis')
				.call(d3.axisLeft().scale(self.y));

		//Recalculate chartline method
		self.chartline
			.x((d, i) => self.x(self.plotData.dates[i]))
			.y(d => self.y(d));

		//Enter Update Exit paths
		var updatePaths = self.path.selectAll("path")
			.data(this.plotData.series.filter(entry => entry.show));

		updatePaths.enter()
			.append('path')
		.merge(updatePaths)
			.join("path")
			.style("mix-blend-mode", "multiply")
			.attr("d", d => self.chartline(d.values));

		updatePaths.exit()
			.remove();
	};

	/**
	 * Take the data from cinema DB and put it in a format readable for the plot
	 */
	CINEMA_COMPONENTS.LineChart.prototype.prepareData = function() {
		var self = this;

		//Retrieve all uncertainty dimensions
		var uncertaintyDims = [];
		for(var i=0, len=this.dimensions.length; i < len; i++)
			if(startsWithPrefixes(self.dimensions[i], this.allowedUPrefixes)
			&& !startsWithPrefixes(self.dimensions[i], this.excludedDim))
				uncertaintyDims.push(this.dimensions[i]);

		//Retrieve all possible values of the current dimension
		var dataDates = [];
		this.db.data.forEach(function(value) {
			if(!containedInArray.call(dataDates, Number(value[self.xDimension]))) {
				dataDates.push(Number(value[self.xDimension]));
			}
		});
		dataDates.sort(function(a, b){return a-b});

		//Create data template
		var dataSeries = [];
		uncertaintyDims.forEach(function(value) {
			dataSeries.push({
				name: value,
				values : Array(dataDates.length).fill(0),
				occurences : Array(dataDates.length).fill(0),
				show : true
			});
		});

		//Fill with data values / Sum on same dimension value and count occurences
		this.db.data.forEach(function(dataRow) {
			var currentIndex = dataDates.indexOf(Number(dataRow[self.xDimension]));

			dataSeries.forEach(function(dataSeriesObject) {
				if(!isNaN(dataRow[dataSeriesObject.name])) {
					dataSeriesObject.values[currentIndex] += parseFloat(dataRow[dataSeriesObject.name]);
					dataSeriesObject.occurences[currentIndex] += 1;
				}
			});
		});

		//Divide by occurences to retrieve the average
		dataSeries.forEach(function(dataSeriesObject, indexObject) {
			dataSeriesObject.values.forEach(function(dataValue, index) {
				dataSeries[indexObject].values[index] = dataValue / dataSeriesObject.occurences[index];
			});
		});

		//Add summed uncertainty measures for each dimension type => e.g. Total avg brightness uncertainty
		this.allowedUPrefixes.forEach(function(uncertaintyDim, index) {
			var averageUncertainty = Array(dataDates.length).fill(0);
			var count = 0;

			//Sum and count
			dataSeries.forEach(function(dataSeriesObject, indexObject) {
				if(dataSeriesObject.name.startsWith(uncertaintyDim))
				{
					dataSeriesObject.values.forEach(function(value, index) {
						averageUncertainty[index] += value;
					});
					count += 1;
				}
			});

			//Calculate averages
			if(count > 0) {
				averageUncertainty.forEach(function(value, index) {
					averageUncertainty[index] = value / count;
				});

				//Put into object
				dataSeries.push({
					name: uncertaintyDim + " Uncertainty",
					values : averageUncertainty,
					occurences : count,
					show : true
				});
			}
		});

		//Combine the data
		this.plotData = {
			series: dataSeries,
			dates: dataDates
		};
	};

	/**
	 * Set the visibility of a line by using the uncertainty measure name
	 * @type {String} name - name of uncertainty measure
	 * @type {boolean} isShown - if the line shoudl be shown
	 */
	CINEMA_COMPONENTS.LineChart.prototype.setLineVisibility = function(name, isShown) {
		var self = this;
		for(var i = 0; i < this.plotData.series.length; i++) {
			if(self.plotData.series[i].name === name) {
				self.plotData.series[i].show = isShown;
				break;
			}
		}
	}

	/**
	 * Retrieve the amount of visible lines
	 */
	CINEMA_COMPONENTS.LineChart.prototype.getVisibileLineCount = function() {
		return this.plotData.series.filter(entry => entry.show).length;
	}

	CINEMA_COMPONENTS.LineChart.prototype.getCheckboxStates = function() {
		var lineGroupSelectData = [];
		d3.selectAll(".lineGroupSelectCheckbox").each(function(d) {
			const cb = d3.select(this);
			lineGroupSelectData.push([cb.property("value"), cb.property("checked")]);
		});
		var lineSelectData = [];
		d3.selectAll(".lineSelectCheckbox").each(function(d) {
			const cb = d3.select(this);
			lineSelectData.push([cb.property("value"), cb.property("checked")]);
		});

		return {lineGroup: lineGroupSelectData, line: lineSelectData};
	}

	CINEMA_COMPONENTS.LineChart.prototype.setCheckboxStates = function(dataObject) {
		d3.selectAll(".lineSelectCheckbox").each(function(d) {
			const cb = d3.select(this);
			for(var i = 0; i < dataObject.line.length; i++) {
				if(dataObject.line[i][0] === cb.property("value"))
					cb.property("checked", dataObject.line[i][1]) ;
			}
		});
		var lineGroupSelectData = [];
		d3.selectAll(".lineGroupSelectCheckbox").each(function(d) {
			const cb = d3.select(this);
			for(var i = 0; i < dataObject.lineGroup.length; i++) {
				if(dataObject.lineGroup[i][0] === cb.property("value"))
					cb.property("checked", dataObject.lineGroup[i][1]);
			}
		});
		this.updateLineVisibility();
	}

})();

//CINEMA_COMPONENTS.LineChart.prototype.getPicturePathsForPoint = function() {
//	var self = this;

//	if(self.currentlySelectedPoint === {})
//		return([]);
//	else {
//		var imagePaths = [];
//		self.db.data.forEach(function(dataRow) {
//			if(dataRow[self.xDimension] == self.currentlySelectedPoint.date) {
//				for (var key in dataRow) {
//					if(key.startsWith("FILE_"))
//						if(key.replace(/FILE_/gi,"") === self.currentlySelectedPoint.umeasurename.replace(self.allowedUPrefixesRegEx,""))
//							imagePaths.push(dataRow[key]);
//				}
//			}
//		});
//		return imagePaths;
//	}
//}

//Create a regular expression checking for allowed prefixes
//this.allowedUPrefixesRegEx = "/";
//self.allowedUPrefixes.forEach(function(value,index) {
//	if(index === 0)
//		self.allowedUPrefixesRegEx += value;
//	else
//		self.allowedUPrefixesRegEx += "|" + value;
//});
//this.allowedUPrefixesRegEx = new RegExp(self.allowedUPrefixesRegEx + "/gi");
