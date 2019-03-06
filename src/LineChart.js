'use strict';
(function() {
	/**
	 * CINEMA_COMPONENTS
	 * PCOORD
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

	//Constants
	var testData = {
		y: "% Unemployment",
		series:
		[
			{name: "Test", values: [2.5, 2.6, 2.7, 2.0, 3.0]},
			{name: "Tesy", values: [3.5, 3.6, 3.7, 2.0, 1.0]}
		],
		dates:
		[
			0,1,2,3,4
		]
	};

	CINEMA_COMPONENTS.LineChart = function(parent, database, filterRegex) {
		var self = this;

		/***************************************
		 * SIZING
		 ***************************************/

		/** @type {CINEMA_COMPONENTS.Margin} Override default margin */
		this.margin = new CINEMA_COMPONENTS.Margin(20,20,30,40);

		//call super-constructor
		CINEMA_COMPONENTS.Component.call(this,parent,database,filterRegex);
		//after size is calculate in the super-constructor, set radius and innerMargin

		/***************************************
		 * EVENTS
		 ***************************************/

		/** @type {d3.dispatch} Hook for events on chart
		 * Set handlers with on() function. Ex: this.dispatch.on('mouseover',handlerFunction(i))
		 * 'mouseover': Triggered when a point is moused over.
		 *     (called with the index of moused over data and a reference to the mouse event)
		 * 'xchanged': Triggered when the x dimension being viewed is changed
		 *     (called with the new dimension as an argument)
		 * 'ychanged': Triggered when the y dimension being viewed is changed
		 *     (called with the new dimension as an argument)
		*/
		this.dispatch = d3.dispatch("mouseover","mousemove","mouseenter","mouseleave");

		/***************************************
		 * SCALES
		 ***************************************/

		this.xscale = d3.scaleTime()
			.domain(d3.extent(testData.dates))
			.range([this.margin.left, this.parentRect.width - this.margin.right])

		this.yscale = d3.scaleLinear()
			.domain([0, d3.max(testData.series, d => d3.max(d.values))]).nice()
			.range([this.parentRect.height - this.margin.bottom, this.margin.top])

		/***************************************
		 * CHART AXIS
		 ***************************************/

		this.xaxis = g => g
			.attr("transform", `translate(0,${this.parentRect.height - this.margin.bottom})`)
			.call(d3.axisBottom(this.xscale).ticks(this.parentRect.width / 80).tickSizeOuter(0))

		this.yaxis = g => g
			.attr("transform", `translate(${this.margin.left},0)`)
			.call(d3.axisLeft(this.yscale))
			.call(g => g.select(".domain").remove())
			.call(g => g.select(".tick:last-of-type text").clone()
			.attr("x", 3)
			.attr("text-anchor", "start")
			.attr("font-weight", "bold")
			.text(testData.y))

		/***************************************
		 * CHART LINES
		 ***************************************/

		this.chartline = d3.line()
			.defined(d => !isNaN(d))
			.x((d, i) => this.xscale(testData.dates[i]))
			.y(d => this.yscale(d))

		/***************************************
		 * FUNCTIONS
		 ***************************************/

		this.hover = function(svg, path) {
			svg.style("position", "relative");

			if ("ontouchstart" in document) {
				svg.style("-webkit-tap-highlight-color", "transparent")
				.on("touchmove", moved)
				.on("touchstart", entered)
				.on("touchend", left)
			}
			else {
				svg.on("mousemove", moved)
					.on("mouseenter", entered)
					.on("mouseleave", left);
			}

			const dot = svg.append("g")
				.attr("display", "none");

			dot.append("circle")
				.attr("r", 2.5);

			dot.append("text")
				.style("font", "10px sans-serif")
				.attr("text-anchor", "middle")
				.attr("y", -8);

			function moved() {
				//d3.event.preventDefault();
				//const ym = this.yscale.invert(d3.event.layerY);
				//const xm = this.xscale.invert(d3.event.layerX);
				//const i1 = d3.bisectLeft(testData.dates, xm, 1);
				//const i0 = i1 - 1;
				//const i = xm - testData.dates[i0] > testData.dates[i1] - xm ? i1 : i0;
				//const s = testData.series.reduce((a, b) => Math.abs(a.values[i] - ym) < Math.abs(b.values[i] - ym) ? a : b);
				//path.attr("stroke", d => d === s ? null : "#ddd").filter(d => d === s).raise();
				//dot.attr("transform", `translate(${this.xscale(testData.dates[i])},${this.yscale(s.values[i])})`);
				//dot.select("text").text(s.name);
			}

			function entered() {
				//path.style("mix-blend-mode", null).attr("stroke", "#ddd");
				//dot.attr("display", null);
			}

			function left() {
				//path.style("mix-blend-mode", "multiply").attr("stroke", null);
				//dot.attr("display", "none");
			}
		}

		/***************************************
		 * DOM Content
		 ***************************************/

		//Create DOM content
		//Specify that this is a Glyph component
		d3.select(this.container).classed('LINE',true);

		this.initChart = function() {
			this.svg = d3.select(this.container).append('svg')
				.attr('class','lineChart')
				.attr('viewBox',(-this.margin.right)+' '+(-this.margin.top)+' '+
								(this.parentRect.width)+' '+
								(this.parentRect.height))
				.attr('preserveAspectRatio','none')
				.attr('width','100%')
				.attr('height','100%');

			/** @type {Axis} The axis for the coordinate system */
			this.svg.append("g")
				.call(this.xaxis);

			this.svg.append("g")
				.call(this.yaxis);

			this.path = this.svg.append("g")
				.attr("fill", "none")
				.attr("stroke", "steelblue")
				.attr("stroke-width", 1.5)
				.attr("stroke-linejoin", "round")
				.attr("stroke-linecap", "round")
				.selectAll("path")
				.data(testData.series)
				.join("path")
				.style("mix-blend-mode", "multiply")
				.attr("d", d => this.chartline(d.values));

				//this.svg.call(this.hover, this.path);
				this.svg.style("position", "relative");

				this.svg
				.on('mousemove', function(d) {
					self.dispatch.call('mousemove',self,null,d3.event);
				})
				.on('mouseenter', function(d) {
					self.dispatch.call('mouseenter',self,null,d3.event);
				})
				.on('mouseleave', function(d) {
					self.dispatch.call('mouseleave',self,null,d3.event);
				})

				this.dot = this.svg.append("g")
					.attr("display", "none");

				this.dot.append("circle")
					.attr("r", 2.5);

				this.dot.append("text")
					.style("font", "10px sans-serif")
					.attr("text-anchor", "middle")
					.attr("y", -8);

  			return this.svg.node();
		}

		/** @type {d3.selection (svg)} The SVG element containing all the content of the component */
		this.chart = this.initChart();

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
	};

	CINEMA_COMPONENTS.LineChart.prototype.setSelection = function(selection) {
		this.selection = selection;
		//this.redrawSelectedPoints();
	}

	CINEMA_COMPONENTS.LineChart.prototype.moved = function(eventdata) {
		eventdata.preventDefault();
		const ym = this.yscale.invert(eventdata.layerY);
		const xm = this.xscale.invert(eventdata.layerX);
		const i1 = d3.bisectLeft(testData.dates, xm, 1);
		const i0 = i1 - 1;
		const i = xm - testData.dates[i0] > testData.dates[i1] - xm ? i1 : i0;
		const s = testData.series.reduce((a, b) => Math.abs(a.values[i] - ym) < Math.abs(b.values[i] - ym) ? a : b);
		this.path.attr("stroke", d => d === s ? null : "#ddd").filter(d => d === s).raise();
		this.dot.attr("transform", `translate(${this.xscale(testData.dates[i])},${this.yscale(s.values[i])})`);
		this.dot.select("text").text(s.name);
	}

	CINEMA_COMPONENTS.LineChart.prototype.entered = function() {
		this.path.style("mix-blend-mode", null).attr("stroke", "#ddd");
		this.dot.attr("display", null);
	}

	CINEMA_COMPONENTS.LineChart.prototype.left = function() {
		this.path.style("mix-blend-mode", "multiply").attr("stroke", null);
		this.dot.attr("display", "none");
	}

	/**
	 * Should be called whenever the data in the associated database changes.
	 * Will update scales, axes and selection to fit the new data.
	 */
	CINEMA_COMPONENTS.LineChart.prototype.updateData = function() {
		var self = this;

		this.redraw();
	};

	/**
	 * Redraw the glyph path
	 */
	CINEMA_COMPONENTS.LineChart.prototype.redraw = function() {
		var self = this;
	};

})();
