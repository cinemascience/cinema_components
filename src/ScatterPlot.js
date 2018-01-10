'use strict';
(function() {
	/**
	 * CINEMA_COMPONENTS
	 * SCATTER_PLOT
	 * 
	 * The ScatterPlot component for the CINEMA_COMPONENTS library.
	 * Contains the constructor for ScatterPlot Components (Eg. ScatterPlotSVG, ScatterPlotCanvas)
	 * It is a subclass of Component and contains methods and fields common to all ScatterPlot Components
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

	//Require that the Component module be included
	if (!CINEMA_COMPONENTS.COMPONENT_INCLUDED)
		throw new Error("CINEMA_COMPONENTS ScatterPlot module requires that Component"+
			" module be included. Please make sure that Component module"+
			" is included BEFORE ScatterPlot module");

	//Require that d3 be included
	if (!window.d3) {
		throw new Error("CINEMA_COMPONENTS ScatterPlot module requires that"+
		" d3 be included (at least d3v4). Please make sure that d3 is included BEFORE the"+
		" the ScatterPlot module");
	}

	/** @type {boolean} - Flag to indicate that the ScatterPlot module has been included */
	CINEMA_COMPONENTS.SCATTER_PLOT_INCLUDED = true;

	/**
	 * Abstract constructor for ScatterPlot Components
	 * Represents a component for displaying the data in a database on a 2D scatter plot.
	 * Objects such as ScatterPlotSVG and ScatterPlotCanvas inherit from this.
	 * @param {DOM} parent - The DOM object to build this component inside of
	 * @param {CINEMA_COMPONENTS.Database} database - The database behind this component
	 * @param {RegExp} filterRegex - A regex to determine which dimensions to NOT show on the component
	 */
	CINEMA_COMPONENTS.ScatterPlot = function(parent, database, filterRegex) {
		/*if (this.constructor === CINEMA_COMPONENTS.ScatterPlot)
			throw new Error("Cannot instantiate abstract class 'ScatterPlot'"+
				"Please use a subclass.");*/

		var self = this;

		/***************************************
		 * SIZING
		 ***************************************/

		/** @type {CINEMA_COMPONENTS.Margin} Override default margin */
		this.margin = new CINEMA_COMPONENTS.Margin(25,25,60,150);

		//Call super-constructor
		CINEMA_COMPONENTS.Component.call(this,parent,database,filterRegex);

		/***************************************
		 * DATA
		 ***************************************/

		/** @type {number[]} Indices of all currently displayed data */
		this.selection = [];
		/** @type {number} Indices of all currently highlighted data */
		this.highlighted = [];
		/** @type {CINEMA_COMPONENTS.ExtraData[]} Custom data to overlay on chart */
		this.overlayData = [];

		/** @type {string} The currently selected dimensions for each axis*/
		this.xDimension = this.dimensions[0];
		this.yDimension = this.dimensions[1];

		/***************************************
		 * EVENTS
		 ***************************************/

		/** @type {d3.dispatch} Hook for events on chart 
		 * Set handlers with on() function. Ex: this.dispatch.on('mouseover',handlerFunction(i))
		 * 'mouseover': Triggered when selection of data changes.
		 *     (called with the index of moused over data and a reference to the mouse event)
		*/
		this.dispatch = d3.dispatch("mouseover");

		/***************************************
		 * SCALES
		 ***************************************/

		/** @type {d3.scale} The scales for the x and y axes */
		this.x = (this.db.isStringDimension(this.xDimension) ? d3.scalePoint() : d3.scaleLinear())
			.domain(this.db.dimensionDomains[this.xDimension])
			.range([0,this.internalWidth]);
		this.y = (this.db.isStringDimension(this.yDimension) ? d3.scalePoint() : d3.scaleLinear())
		.domain(this.db.dimensionDomains[this.yDimension])
		.range([this.internalHeight,0]);

		/***************************************
		 * DOM Content
		 ***************************************/

		//Specify that this a ScatterPlot component
		d3.select(this.container).classed('SCATTER_PLOT',true);

		/** @type {d3.selection} Where the data on the chart will be drawn
		 * The actual drawing depends on the specific ScatterPlot sublcass
		 */
		this.pointContainer = d3.select(this.container).append('div')
			.classed('pointContainer',true)
			.style('position','absolute')
			.style('top',this.margin.top+'px')
			.style('right',this.margin.right+'px')
			.style('bottom',this.margin.bottom+'px')
			.style('left',this.margin.left+'px')
			.style('width',this.internalWidth+'px')
			.style('height',this.internalHeight+'px');

		/** @type {DOM (select)} The select elements for selecting the dimension for each axis */
		//x
		this.xSelect = d3.select(this.container).append('select')
			.classed('dimensionSelect x',true)
			.style('position','absolute')
			.node();
		//y
		this.ySelect = d3.select(this.container).append('select')
			.classed('dimensionSelect y',true)
			.style('position','absolute')
			.node();
		//Bind data and append options
		//x
		d3.select(this.xSelect).selectAll('option')
			.data(this.dimensions)
			.enter().append('option')
				.attr('value',function(d){return d;})
				.text(function(d){return d;});
		d3.select(this.xSelect).node().value = this.xDimension;
		//y
		d3.select(this.ySelect).selectAll('option')
			.data(this.dimensions)
			.enter().append('option')
				.attr('value',function(d){return d;})
				.text(function(d){return d;});
		d3.select(this.ySelect).node().value = this.yDimension;
		//Add change listeners to select elements
		//x
		d3.select(this.xSelect).on('input',function() {
			self.xDimension = this.value;
			self.x = (self.db.isStringDimension(self.xDimension) ? d3.scalePoint() : d3.scaleLinear())
				.domain(self.db.dimensionDomains[self.xDimension])
				.range([0,self.internalWidth]);
			self.xAxisContainer.select('.axis')
				.call(d3.axisBottom().scale(self.x));
			self.redrawPoints();
		});
		//y
		d3.select(this.ySelect).on('input',function() {
			self.yDimension = this.value;
			self.y = (self.db.isStringDimension(self.yDimension) ? d3.scalePoint() : d3.scaleLinear())
				.domain(self.db.dimensionDomains[self.yDimension])
				.range([self.internalHeight,0]);
			self.yAxisContainer.select('.axis')
				.call(d3.axisLeft().scale(self.y));
			self.redrawPoints();
		});

		/** @type {d3.selection} A readout in the corner of the chart
		 * that warns if any data could not be plotted
		 */
		this.warningReadout = d3.select(this.container).append('div')
			.classed('warningReadout',true)
			.style('position','absolute');

		/***************************************
		 * AXES
		 ***************************************/

		/** @type {d3.selection} The container for each axis */
		//x
		this.xAxisContainer = d3.select(this.container).append('svg')
			.classed('axisContainer x',true)
			.style('position','absolute')
			.style('width',this.internalWidth+'px')
			.style('height',25+'px')
			.style('top',this.margin.top+this.internalHeight+'px')
			.style('left',this.margin.left+'px');
		//y
		this.yAxisContainer = d3.select(this.container).append('svg')
			.classed('axisContainer y',true)
			.style('position','absolute')
			.style('width',50+'px')
			.style('height',this.internalHeight+'px')
			.style('left',(this.margin.left-50)+'px')
			.style('top',this.margin.top+'px');
		//Add axis to each axis container
		//x
		this.xAxisContainer.append('g')
			.classed('axis',true)
			.call(d3.axisBottom().scale(this.x));
		//y
		this.yAxisContainer.append('g')
			.classed('axis',true)
			.attr('transform','translate(50)')
			.call(d3.axisLeft().scale(this.y));

	};
	//establish prototype chain
	CINEMA_COMPONENTS.ScatterPlot.prototype = Object.create(CINEMA_COMPONENTS.Component.prototype);
	CINEMA_COMPONENTS.ScatterPlot.prototype.constructor = CINEMA_COMPONENTS.ScatterPlot;

	/**
	 * Should be called every time the size of the chart's container changes.
	 * Updates the sizing and scaling of all parts of the chart and redraws
	 */
	CINEMA_COMPONENTS.ScatterPlot.prototype.updateSize = function() {
		//Call super (will recalculate size)
		CINEMA_COMPONENTS.Component.prototype.updateSize.call(this);

		//update pointContainer size
		this.pointContainer
			.style('width',this.internalWidth+'px')
			.style('height',this.internalHeight+'px');

		//Rescale
		this.x.range([0,this.internalWidth]);
		this.y.range([this.internalHeight,0]);

		//Reposition and rescale axes
		this.xAxisContainer
			.style('top',this.margin.top+this.internalHeight+'px')
			.style('width',this.internalWidth+'px')
			.select('.axis')
				.call(d3.axisBottom().scale(this.x));
		this.yAxisContainer
			.style('height',this.internalHeight+'px')
			.select('.axis')
				.call(d3.axisLeft().scale(this.y));

		this.redrawPoints();
	}

	//Shortcut function for redrawSelectedPoints, redrawHighlightedPoints and redrawOverlayPoints
	CINEMA_COMPONENTS.ScatterPlot.prototype.redrawPoints = function() {
		this.redrawSelectedPoints();
		this.redrawHighlightedPoints();
		//this.redrawOverlayPoints();
	}

	/**
	 * Filter the given selection into only the points that can be shown
	 * on the plot (i.e. do not have NaN or undefined values on current dimensions)
	 */
	CINEMA_COMPONENTS.ScatterPlot.prototype.getPlottablePoints = function(selection) {
		var self = this;
		return selection.filter(function(d) {
			var xCoord = self.x(self.db.data[d][self.xDimension]);
			var yCoord = self.y(self.db.data[d][self.yDimension]);
			return !(isNaN(xCoord) || isNaN(yCoord));
		});
	}

	/**
	 * Set the chart's selection of data to the data represented
	 * by the given list of indices
	 */
	CINEMA_COMPONENTS.ScatterPlot.prototype.setSelection = function(selection) {
		this.selection = selection;
		this.redrawSelectedPoints();
	}

	/**
	 * Set the chart's current highlighted data to the data represented
	 * by the given list of indices
	 */
	CINEMA_COMPONENTS.ScatterPlot.prototype.setHighlightedPoints = function(indices) {
		this.highlighted = indices;
		this.redrawHighlightedPoints();
	}

	/**
	 * Set the current overlay points
	 */
	CINEMA_COMPONENTS.ScatterPlot.prototype.setOverlayPoints = function(data) {
		this.overlayData = data;
		this.redrawOverlayPaths();
	};

	/**
	 * Redraw the current selection of points.
	 * Actual implementation is up to specific subclasses
	 */
	CINEMA_COMPONENTS.ScatterPlot.prototype.redrawSelectedPoints = function() {
		throw new Error("Cannot call abstract function 'redrawSelectedPoints()'!"+
			" Please override function in a subclass");
	}

	/**
	 * Redraw the currently highlighted points.
	 * Actual implementation is up to specific subclasses
	 */
	CINEMA_COMPONENTS.ScatterPlot.prototype.redrawHighlightedPoints = function() {
		throw new Error("Cannot call abstract function 'redrawHighlightedPoints()'!"+
			" Please override function in a subclass");
	}

	/**
	 * Redraw the overlay points.
	 * Actual implementation is up to specific subclasses
	 */
	CINEMA_COMPONENTS.ScatterPlot.prototype.redrawOverlayPoints = function() {
		throw new Error("Cannot call abstract function 'redrawOverlayPoints()'!"+
			" Please override function in a subclass");
	}
})();