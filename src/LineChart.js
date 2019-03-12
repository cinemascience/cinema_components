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

	//Retrieve if a value is contained in an array
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

	CINEMA_COMPONENTS.LineChart = function(parent, database, filterRegex) {
		var self = this;

		/***************************************
		 * SIZING
		 ***************************************/

		/** @type {CINEMA_COMPONENTS.Margin} Override default margin */
		this.margin = new CINEMA_COMPONENTS.Margin(20,30,50,40);
		this.axismargin = new CINEMA_COMPONENTS.Margin(10,10,10,10);

		//call super-constructor
		CINEMA_COMPONENTS.Component.call(this,parent,database,filterRegex);
		//after size is calculate in the super-constructor, set radius and innerMargin

		/***************************************
		 * DATA
		 ***************************************/

		/** @type {string} The currently selected dimensions for each axis*/
		this.xDimension = this.dimensions[0];

		this.plotData = {};
		this.prepareData();

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
		this.dispatch = d3.dispatch("mouseover","mousemove","mouseenter","mouseleave","xchanged");

		/***************************************
		 * CHART LINES
		 ***************************************/

		this.chartline = d3.line()
			.defined(d => !isNaN(d))
			.x((d, i) => this.x(this.plotData.dates[i]))
			.y(d => this.y(d))

		/***************************************
		 * DOM Content
		 ***************************************/

		//Plot
		d3.select(this.container).classed('MULTILINE_PLOT',true);

		this.mainContainer = d3.select(this.container).append('div')
			.classed('mainContainer',true)
			.style('position','absolute')
			.style('top',this.margin.top+'px')
			.style('right',this.margin.right+'px')
			.style('bottom',this.margin.bottom+'px')
			.style('left',this.margin.left+'px')
			.style('width',this.internalWidth+'px')
			.style('height',this.internalHeight+'px');

		/** @type {DOM (select)} The select elements for selecting the dimension for x axis */
		//Get all non uncertainty and non file dimensions
		this.validDim = [];
		for(var i=0, len=this.dimensions.length; i < len; i++)
			if(!(
			this.dimensions[i].startsWith("u_min_") ||
			this.dimensions[i].startsWith("u_avg_") ||
			this.dimensions[i].startsWith("u_max_") ||
			this.dimensions[i].startsWith("FILE")
			))
				this.validDim.push(this.dimensions[i]);

		this.xSelect = d3.select(this.container).append('select')
			.classed('dimensionSelect x',true)
			.style('position','absolute')
			.node();

		d3.select(this.xSelect).selectAll('option')
			.data(this.validDim)
			.enter().append('option')
				.attr('value',function(d){return d;})
				.text(function(d){return d;});
		d3.select(this.xSelect).node().value = this.xDimension;

		d3.select(this.xSelect).on('input',function() {
			self.xDimension = this.value;
			self.updateData();
			self.x = d3.scaleLinear()
				.domain(d3.extent(self.plotData.dates));
			self.xAxisContainer.select('.axis')
				.call(d3.axisBottom().scale(self.x));
			self.dispatch.call('xchanged',self,self.xDimension);
			self.redraw();
		});

		this.initChart = function() {
			this.svg = this.mainContainer.append('svg')
				.attr('class','lineChart')
				.attr('viewBox','0 0 '+this.internalWidth+' '+this.internalHeight)
				.attr('preserveAspectRatio','none')
				.attr('width','100%')
				.attr('height','100%');

			this.path = this.svg.append("g")
				.attr("fill", "none")
				.attr("stroke", "steelblue")
				.attr("stroke-width", 1.5)
				.attr("stroke-linejoin", "round")
				.attr("stroke-linecap", "round")
				.selectAll("path")
				.data(this.plotData.series)
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
			});

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

		/***************************************
		 * AXES
		 ***************************************/

		/** @type {d3.selection} The container for each axis */
		this.x = d3.scaleLinear()
			.domain(d3.extent(this.plotData.dates))
			.range([this.axismargin.left,self.internalWidth - this.axismargin.right]);

		this.y = d3.scaleLinear()
			.domain([0, d3.max(this.plotData.series, d => d3.max(d.values))]).nice()
			.range([self.internalHeight - this.axismargin.bottom,this.axismargin.top]);

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

		this.axislineWidth = parseInt(getComputedStyle(
			document.querySelector('.CINEMA_COMPONENT.MULTILINE_PLOT .axis line'))
			.getPropertyValue('stroke-width'), 10);

		this.xAxisContainer.style('top',this.margin.top+this.internalHeight+this.axislineWidth+'px');
		this.yAxisContainer.style('left', (this.margin.left - 50 - this.axislineWidth) +'px');

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
		//Call super (will recalculate size)
		CINEMA_COMPONENTS.Component.prototype.updateSize.call(this);

		if(this.internalHeight > 100){
			//update mainContainer size
			this.mainContainer
				.style('width',this.internalWidth+'px')
				.style('height',this.internalHeight+'px');

			this.svg.attr('viewBox','0 0 '+this.internalWidth+' '+this.internalHeight);

				//Rescale
			this.x.range([this.axismargin.left, this.internalWidth - this.axismargin.right]);
			this.y.range([this.internalHeight - this.axismargin.bottom, this.axismargin.top]);

			this.xAxisContainer
				.style('width',this.internalWidth+'px')
				.style('top',this.margin.top+this.internalHeight+this.axislineWidth+'px')
				.select('.axis')
					.call(d3.axisBottom().scale(this.x));

			this.yAxisContainer
				.style('height',this.internalHeight+'px')
				.select('.axis')
					.call(d3.axisLeft().scale(this.y));

			this.chartline
				.x((d, i) => this.x(this.plotData.dates[i]))
				.y(d => this.y(d))

			this.path
				.attr("d", d => this.chartline(d.values));
		}
	};

	CINEMA_COMPONENTS.LineChart.prototype.setSelection = function(selection) {
		this.selection = selection;
		//this.redrawSelectedPoints();
	}

	CINEMA_COMPONENTS.LineChart.prototype.moved = function(eventdata) {
		var self = this;
		eventdata.preventDefault();
		var ym = this.y.invert(eventdata.layerY);
		var xm = this.x.invert(eventdata.layerX);
		var i1 = d3.bisectLeft(this.plotData.dates, xm, 1);
		var i0 = i1 - 1;
		var i = xm - self.plotData.dates[i0] > self.plotData.dates[i1] - xm ? i1 : i0;
		var s = this.plotData.series.reduce((a, b) => Math.abs(a.values[i] - ym) < Math.abs(b.values[i] - ym) ? a : b);
		this.path.attr("stroke", d => d === s ? null : "#ddd").filter(d => d === s).raise();
		this.dot.attr("transform", `translate(${self.x(self.plotData.dates[i])},${self.y(s.values[i])})`);
		this.dot.attr("overflow", "visible").select("text").text(s.name);
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
		self.prepareData();
	};

	/**
	 * Redraw the glyph path
	 */
	CINEMA_COMPONENTS.LineChart.prototype.redraw = function() {
		var self = this;

		console.log(self.plotData);

		self.x
			.domain(d3.extent(self.plotData.dates))
			.range([self.axismargin.left, self.internalWidth - self.axismargin.right]);

		self.y
			.domain([0, d3.max(self.plotData.series, d => d3.max(d.values))]).nice()
			.range([self.internalHeight - self.axismargin.bottom, self.axismargin.top]);

		self.xAxisContainer
			.select('.axis')
				.call(d3.axisBottom().scale(self.x));

		self.yAxisContainer
			.select('.axis')
				.call(d3.axisLeft().scale(self.y));

		self.chartline
			.x((d, i) => self.x(self.plotData.dates[i]))
			.y(d => self.y(d));

		self.path
			.data(this.plotData.series)
			.attr("d", d => self.chartline(d.values));
	};

	CINEMA_COMPONENTS.LineChart.prototype.prepareData = function() {
		var self = this;
		//Retrieve all uncertainty dimensions
		var uncertaintyDims = [];
		for(var i=0, len=this.dimensions.length; i < len; i++)
			if(
			this.dimensions[i].startsWith("u_min_") ||
			this.dimensions[i].startsWith("u_avg_") ||
			this.dimensions[i].startsWith("u_max_"))
				uncertaintyDims.push(this.dimensions[i]);

		//Retrieve all possible values of the current dimension
		var dataDates = [];
		this.db.data.forEach(function(value) {
			if(!containedInArray.call(dataDates, value[self.xDimension]))
				dataDates.push(value[self.xDimension]);
		});
		dataDates.sort(function(a, b){return a-b});

		//Create data template
		var dataSeries = [];
		uncertaintyDims.forEach(function(value) {
			dataSeries.push({
				name: value,
				values : Array(dataDates.length).fill(0),
				occurences : Array(dataDates.length).fill(0)
			});
		});

		//Fill with data values
		this.db.data.forEach(function(dataRow) {
			const currentIndex = dataDates.indexOf(dataRow[self.xDimension]);
			dataSeries.forEach(function(dataSeriesObject) {
				dataSeriesObject.values[currentIndex] += parseFloat(dataRow[dataSeriesObject.name]);
				dataSeriesObject.occurences[currentIndex] += 1;
			});
		});

		//Divide by occurences to retrieve the average
		dataSeries.forEach(function(dataSeriesObject, indexObject) {
			dataSeriesObject.values.forEach(function(dataValue, index) {
				dataSeries[indexObject].values[index] = dataValue / dataSeriesObject.occurences[index];
			});
		});

		//Calculate average uncertainty
		var averageUncertainty = Array(dataDates.length).fill(0);
		var count = 0;

		dataSeries.forEach(function(dataSeriesObject, indexObject) {
			dataSeriesObject.values.forEach(function(value, index) {
				averageUncertainty[index] += value;
			});
			count += 1;
		});

		averageUncertainty.forEach(function(value, index) {
			averageUncertainty[index] = value / count;
		});

		dataSeries.push({
			name: "Average Uncertainty",
			values : averageUncertainty,
			occurences : count
		});

		//Convert dates to numbers
		dataDates.forEach(function(value, index) {
			dataDates[index] = parseInt(value, 10);
		});

		//Combine the data
		this.plotData = {
			series: dataSeries,
			dates: dataDates
		};
	};

})();
