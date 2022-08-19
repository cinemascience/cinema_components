'use strict';
(function() {
	/**
	 * CINEMA_COMPONENTS
	 * PCOORD
	 *
	 * The Pcoord Component for the CINEMA_COMPONENTS library.
	 * Contains the constructor for Parallel Coordinates Components (e.g. PcoordSVG, PcoordCanvas)
	 * It is a sublcass of Component and contains methods and fields common to all Parallel Coordinates Components
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
		throw new Error("CINEMA_COMPONENTS Pcoord module requires that Component"+
			" module be included. Please make sure that Component module"+
			" is included BEFORE Pcoord module");

	//Require that d3 be included
	if (!window.d3) {
		throw new Error("CINEMA_COMPONENTS Pcoord module requires that"+
		" d3 be included (at least d3v4). Please make sure that d3 is included BEFORE the"+
		" the Pcoord module");
	}

	/** @type {boolean} - Flag to indicate that the Pcoord module has been included */
	CINEMA_COMPONENTS.PCOORD_INCLUDED = true;

	/**
	 * Abstract constructor for Pcoord Components
	 * Represents a component for displaying and interacting with a database on a parallel coordinates chart
	 * Objects such as PcoordSVG and PcoordCanvas inherit from this
	 * @param {DOM} parent - The DOM object to build this component inside of
	 * @param {CINEMA_COMPONENTS.Database} database - The database behind this component
	 * @param {RegExp} filterRegex - A regex to determine which dimensions to NOT show on the component
	 */
	CINEMA_COMPONENTS.Pcoord = function(parent, database, filterRegex) {
		if (this.constructor === CINEMA_COMPONENTS.Pcoord)
			throw new Error("Cannot instantiate abstract class 'Pcoord'"+
			" Please use a subclass");

		var self = this;

		/***************************************
		 * SIZING
		 ***************************************/

		/** @type {CINEMA_COMPONENTS.Margin} Override default margin */
		this.margin = new CINEMA_COMPONENTS.Margin(30,10,10,10);
		/** @type {number} the room left at the bottom of the chart for NaN values */
		this.NaNMargin;

		//call super-constructor
		CINEMA_COMPONENTS.Component.call(this,parent,database,filterRegex);
		//after size is calculated in the super-constructor, Set NaNMargin
		this.NaNMargin = this.internalHeight/11;

		/***************************************
		 * DATA
		 ***************************************/

		/** @type {number[]} Indices of all currently selected data */
		this.selection = d3.range(0,this.db.data.length);
		/** @type {number} Indices of all currently highlighted data*/
		this.highlighted = [];
		/** @type {CINEMA_COMPONENTS.ExtraData[]} Custom data to overlay on chart */
		this.overlayData = [];

		/***************************************
		 * EVENTS
		 ***************************************/

		/** @type {d3.dispatch} Hook for events on chart
		 * Set handlers with on() function. Ex: this.dispatch.on('click',handlerFunction(i))
		 * 'selectionchange': Triggered when selection of data changes
		 *     (called with array of indices of selected data)
		 * 'mouseover': Triggered when a path is moused over
		 *     (called with index of moused over data and reference to mouse event)
		 * 'click': Triggered when a path is clicked on
		 *     (called with index of clicked data and reference to mouse event)
		 * 'axisorderchange': Triggered when the axis ordering is manually changed
		 *     (called with the list of the dimensions in the new order)
		 */
		this.dispatch = d3.dispatch("selectionchange", "mouseover", "click", "axisorderchange");

		/***************************************
		 * SCALES
		 ***************************************/

		/** @type {d3.scalePoint} - Scale for x axis on chart
		 * Maps dimensions to position (in pixels) along width of chart.*/
		this.x = d3.scalePoint()
			.domain(this.dimensions)
			.range([0,this.internalWidth])
			.padding(1);

		/** @type {Object(d3.scale)}
		 * Scales for each dimension axis on the chart. One scale for each dimension */
		this.y = {};
		this.dimensions.forEach(function (d) {
			//Create point scale for string dimensions
			if (self.db.isStringDimension(d)) {
				if (!self.y[d]) {
					self.y[d] = d3.scalePoint();
				}
				self.y[d].domain(self.db.dimensionDomains[d])
					.range([self.internalHeight,0]);
			}
			//Create linear scale for numeric dimensions
			else {
				if (!self.y[d]) {
					self.y[d] = d3.scaleLinear();
				}
				self.y[d].domain(self.db.dimensionDomains[d])
					.range([self.internalHeight-self.NaNMargin,0]);
			}
		});

		/***************************************
		 * DRAGGING
		 ***************************************/

		/** @type {Object (numbers)} Keeps track of the x-position of each axis currently being dragged */
		this.dragging = {};

		//Drag event handlers
		this.axisDragStart = function(d) {
			self.dragging[d] = self.x(d);
			//Reorder axes such that the one being dragged is on top
			self.axes.sort(function(a,b) {
				if (a == d) return 1;
				if (b == d) return -1;
				return 0;
			});
		};
		this.axisDrag = function(d) {
			self.dragging[d] = Math.min(self.internalWidth,Math.max(0,d3.event.x));
			self.redrawPaths();
			var oldDimensions = self.dimensions.slice();
			self.dimensions.sort(function(a,b){
				return self.getXPosition(a)-self.getXPosition(b);
			});
			if (!arraysEqual(oldDimensions,self.dimensions))
				self.dispatch.call('axisorderchange',self,self.dimensions);
			self.x.domain(self.dimensions);
			self.axes.attr('transform',function(d) {
				return "translate("+self.getXPosition(d)+")";
			});
		};
		this.axisDragEnd = function(d) {
			delete self.dragging[d];
			d3.select(this).attr('transform',"translate("+self.x(d)+")");
			//Reorder axes in DOM
			self.axes.sort(function(a,b){
				return self.x(a) - self.x(b);
			});
			self.redrawPaths();
		};

		/** @type {d3.drag} */
		this.drag = d3.drag()
			.subject(function(d){return {x: self.x(d)};})
			.on('start',this.axisDragStart)
			.on('drag',this.axisDrag)
			.on('end',this.axisDragEnd);

		/** keep track of dimensions in their original, unpermuted order
		 * before axis dragging **/
		this.originalDimensions = JSON.parse(JSON.stringify(this.dimensions))

		/***************************************
		 * BRUSHES
		 ***************************************/

		/**
		Initialize member variables for tracking brushes
		but not DOM elements or d3.brush objects
		*/
		this.brushMemberInit = function() {
			this.dontUpdateSelectionOnBrush = false;
		 	this.brushes = {}
		 	this.brushSelections = {}
		 	for (var d of self.dimensions){
		 		this.brushSelections[d] = [];
		 	}
		 };
		 this.brushMemberInit();

		// Brush event handler
		this.updateBrushSelection = function(d, i) {
			// If this is called due to an event (as opposed to called by cinema directly)
			// update corresponding brush selection
			if (d3.event != null) {
				var selection = d3.event.selection;
				if (selection != null && selection[0] === selection[1])
					selection = null
				self.brushSelections[d][i] = selection;
			}
			if (!self.dontUpdateSelectionOnBrush)
				self.updateSelection();
		}

		/** @type {d3.brushY} Create a new brush object in the brushGroup for a given axis */
		this.newBrush = function(g){
			var brush = d3.brushY();
			var dim = g.node().getAttribute('dimension');

			// brushes for each dimension are identified by an integer index
			var id = self.brushes[dim] ? self.brushes[dim].length : 0;

			// the DOM node is identified by 'brush-{dimension_index}-{brush_index}'
			var node = 'brush-' + self.originalDimensions.indexOf(dim) + '-' + id;

			// update member variables to keep track of brush objects, their ids, DOM nodes, and selections
			if (self.brushes[dim]) {
				self.brushes[dim].push({id, brush, node})
			} else {
				self.brushes[dim] = [{id, brush, node}]
			}
			self.brushSelections[dim][id] = null;

			// Set brush properties and callbacks
			brush.extent([[-8,0],[8,self.internalHeight]])
				.on('start', function() {
					if (d3.event.selection !== null)
						d3.event.sourceEvent.stopPropagation();
				})
				.on('brush', function() {self.updateBrushSelection(dim, id)})
				.on('end', function() {
					// Get the topmost brush in the dimension
				  var topBrushID = self.brushes[dim][self.brushes[dim].length - 1].id;
				  var topBrush = document.getElementById(
					'brush-' +
					  self.originalDimensions.indexOf(dim) +
					  '-' +
					  topBrushID
				  );
				  var topBrushSelection = d3.brushSelection(topBrush);
				  if (
				  	// if the selection is nonempty
					topBrushSelection !== undefined &&
					topBrushSelection !== null &&
					topBrushSelection[0] !== topBrushSelection[1]
				  ) {
				  	  // Create a new brush for this brushgroup.
					  // This recursion will only go one level deep
					  // because the new brush will have an empty selection.
					  self.newBrush(g);
					  self.drawBrushes(g);
					  // update the current brush's selection
					  self.updateBrushSelection(dim, id);
				  } else if (
				  	// if the user clicks on the axis
				  	d3.event.sourceEvent &&
					  d3.event.sourceEvent.toString() === '[object MouseEvent]' &&
					  d3.event.selection === null
				  ) {
					  self.brushReset(dim);
				  }
				});
			return brush
		};

		// Draws DOM elements for the brushes of a given dimension
		this.drawBrushes = (brushGroup) => {
			var dim = brushGroup.node().getAttribute('dimension');
			var brushes = self.brushes[dim];
		    var brushSelection = brushGroup.selectAll('.brush').data(brushes, d => d.id);
		    brushSelection
		    	.enter()
			    .insert('g', '.brush')
				.attr('class', 'brush')
				.attr('dimension', dim)
				.attr('id',
					  b => 'brush-' + self.originalDimensions.indexOf(dim) + '-' + b.id
				)
				.each(function(brushObject) {
			 		 brushObject.brush(d3.select(this));
				});
		  	brushSelection.each(function(brushObject) {
				d3.select(this)
			  		.attr('class', 'brush')
			  		.selectAll('.overlay')
			  		.style('pointer-events', function() {
			  			const brush = brushObject.brush;
			  			if (brushObject.id === brushes.length - 1 && brush !== undefined) {
			  				return 'all';
			  			} else {
			  				return 'none';
			  			}
			  		});
		  	});
		  	brushSelection.exit().remove();
		};

		/***************************************
		 * DOM Content
		 ***************************************/

		//Create DOM content
		//Specify that this is a Pcoord component
		d3.select(this.container).classed('PCOORD',true);
		/** @type {d3.selection} Where the paths for the chart will be drawn
		 * The actual drawing of paths depends on the specific Pcoord subclass
		 */
		this.pathContainer = d3.select(this.container).append('div')
			.classed('pathContainer',true)
			.style('position','absolute')
			.style('width',this.parentRect.width+'px')
			.style('height',this.parentRect.height+'px');

		/** @type {boolean} Indicates if the lines on the chart should be smooth(curved) or not
		 * Be sure to call redrawPaths() after changing this so it takes effect
		*/
		this.smoothPaths = true;

		/***************************************
		 * AXES
		 ***************************************/

		/** @type {d3.selection} The container for all axes (as an svg object) */
		this.axisContainer = d3.select(this.container).append('svg')
			.classed('axisContainer',true)
			.style('position','absolute')
			.attr('viewBox',(-this.margin.right)+' '+(-this.margin.top)+' '+
							(this.parentRect.width)+' '+
							(this.parentRect.height))
			.attr('preserveAspectRatio','none')
			.attr('width','100%')
			.attr('height','100%')
			//disable pointer events on axisContainer so it doesn't block pathContainer
			.style('pointer-events','none');
		/** @type {d3.selction} Groups for each axis */
		this.axes = this.axisContainer.selectAll('.axisGroup')
			.data(this.dimensions)
		.enter().append('g')
			.classed('axisGroup',true)
			.attr('dimension',function(d){return d;})
			.attr('transform', function(d) {
				return "translate("+self.x(d)+")";
			})
			.call(this.drag)
		//Add d3 axes to each axis group
		this.axes.append('g')
			.classed('axis',true)
			.each(function(d) {
				d3.select(this).call(d3.axisLeft().scale(self.y[d]));
				if (!self.db.isStringDimension(d))
					self.addNaNExtensionToAxis(this);
			});
		var labels = this.axes.append('g')
			.classed('axisLabel',true)
			//allow pointer-events on axisLabel so axes can be dragged
			.style('pointer-events','initial')
		//add text to each label
		labels.append('text')
			.style('text-anchor','middle')
			.attr('y',-9)
			.text(function(d){return d;});
		//prepend background rectangle to each label
		labels.insert('rect',':first-child')
			//each background is bound to their corresponding text's
			//bounding box as data
			.data(function() {
				var boxes = [];
				labels.selectAll('text').each(function(){
					boxes.push(this.getBBox());
				});
				return boxes;
			})
			.attr('x',function(d){return d.x + 3;})
			.attr('y',function(d){return d.y;})
			.attr('width',function(d){return d.width - 6;})
			.attr('height',function(d){return d.height;});

		this.brushDOMInit = function() {
			//Add brush group to each axis group
			this.axes
				.data(this.originalDimensions)
				.append('g')
				.classed('brushgroup',true)
				.attr('dimension', function(d) {return d})
				.each(function() {
					d3.select(this)
						.call(self.newBrush)
						.call(self.drawBrushes);
				});
		}
		this.brushDOMInit()

		/**
		After calling, brushes behave as if they were in initial state.
		 reset brushes for dim if dim is passed, else reset for all dims

		 Note: Old brushes are *not* deleted, but their selections are set to null.
		 (Deleting them causes strange d3 errors)
		 */
		this.brushReset = function(dim) {
			// dims is always an array to keep code dry
			var dims;
			if (dim === undefined) {
				dims = this.originalDimensions
			} else {
				dims = [dim]
			}
			dims.forEach((d, pos) => {
				if (dim !== undefined) {
					// if dim was not passed as an argument, get its index
					pos = this.originalDimensions.indexOf(dim)
				}
				this.brushes[d].forEach((e, i) => {
					// dont update the topmost brush for dim
					if (i === this.brushes[d].length-1)
						return
					const brushElem = document.getElementById('brush-' + pos + '-' + i);
					if (d3.brushSelection(brushElem) !== null) {
						// move the d3 brush object to null
						this.axisContainer
							.select('#brush-' + pos + '-' + i)
							.call(e.brush)
							.call(e.brush.move, null)
						// make corresponding update to member variable
						this.brushSelections[d][i] = null
					}
				});
		  	});
		this.updateSelection();
		}
	};
	//establish prototype chain
	CINEMA_COMPONENTS.Pcoord.prototype = Object.create(CINEMA_COMPONENTS.Component.prototype);
	CINEMA_COMPONENTS.Pcoord.prototype.constructor = CINEMA_COMPONENTS.Pcoord;

	/**
	 * Add an additional line segment and tick to the end of an axis to represent the area
	 * for NaN values.
	 * @param {DOM} node - The DOM node for the svg group containing the axis (g.axis)
	 */
	CINEMA_COMPONENTS.Pcoord.prototype.addNaNExtensionToAxis = function(node) {
		d3.select(node).append('path')
			.attr('class','NaNExtension')
			.attr('d',"M0.5,"+String(this.internalHeight-this.NaNMargin+0.5)+"V"+String(this.internalHeight-0.5));
		var NaNTick = d3.select(node).append('g')
			.attr('class','NaNExtensionTick')
			.attr('transform',"translate(0,"+String(this.internalHeight-0.5)+")");
		NaNTick.append('line')
			.attr('x2','-6');
		NaNTick.append('text')
			.attr('x','-9')
			.attr('dy','0.32em')
			.text('NaN');
	}

	/**
	 * Should be called every time the size of the chart's container changes.
	 * Updates the sizing and scaling of all parts of the chart and redraws
	 */
	CINEMA_COMPONENTS.Pcoord.prototype.updateSize = function() {
		var self = this;
		var oldHeight = this.internalHeight;//old height needed to rescale brushes

		//Call super (will recalculate size)
		CINEMA_COMPONENTS.Component.prototype.updateSize.call(this);

		//update NaNMargin
		this.NaNMargin = this.internalHeight/11;

		//update PathContainer size
		this.pathContainer
			.style('width',this.parentRect.width+'px')
			.style('height',this.parentRect.height+'px');

		//Rescale x
		this.x.range([0,this.internalWidth]);

		//Rescale y scales
		this.dimensions.forEach(function(d) {
			self.y[d].range([self.db.isStringDimension(d) ? self.internalHeight : self.internalHeight-self.NaNMargin, 0]);
		});

		this.redrawPaths();

		//Reposition and rescale axes
		this.axisContainer
			.attr('viewBox',(-this.margin.right)+' '+(-this.margin.top)+' '+
						(this.parentRect.width)+' '+
						(this.parentRect.height));
		this.axes.attr("transform", function(d) {
			return "translate("+self.getXPosition(d)+")";
		});
		this.axes.each(function(d) {
			d3.select(this).select('.axis').call(d3.axisLeft().scale(self.y[d]));
			//if scale is linear, then update the NaN extension on the axis
			if (!self.db.isStringDimension(d)) {
				d3.select(this).select('path.NaNExtension')
					.attr('d',"M0.5,"+String(self.internalHeight-self.NaNMargin+0.5)+"V"+String(self.internalHeight-0.5));
				d3.select(this).select('.NaNExtensionTick')
					.attr('transform',"translate(0,"+String(self.internalHeight-0.5)+")");
			}
		});

		// Redraw brushes
		this.dontUpdateSelectionOnBrush = true; //avoid updating selection when resizing brushes
		self.originalDimensions.forEach((d, pos) => {
			self.brushes[d].forEach((e, i) => {
				const brushElem = document.getElementById('brush-' + pos + '-' + i);
				e.brush.extent([[-8,0],[8,this.internalHeight]]);
				var brushSelection = self.axisContainer
					.select('#brush-' + pos + '-' + i)
					.call(e.brush)
				if (d3.brushSelection(brushElem) !== null){
					var old_selections = self.brushSelections[d][i];
					var new_selections = old_selections.map(function(_) {
						return _/oldHeight * self.internalHeight;
					});
						brushSelection.call(e.brush.move, new_selections)
				}
			  });
		  });
		this.dontUpdateSelectionOnBrush = false;
	}

	/**
	 * Should be called whenever the data in the associated database changes.
	 * Will update scales, axes and selection to fit the new data.
	 */
	CINEMA_COMPONENTS.Pcoord.prototype.updateData = function() {
		var self = this;

		//Update scale domains
		this.dimensions.forEach(function(d){
			self.y[d].domain(self.db.dimensionDomains[d]);
		});

		//Rebuild axes
		this.axes.each(function(d) {
			d3.select(this).select('.axis').call(d3.axisLeft().scale(self.y[d]));
		});

		this.updateSelection(true);
	}

	/**
	 * Called whenever a brush changes the selection
	 * Updates selection to hold the indices of all data points that are
	 * selected by the brushes.
	 * @param {bool} force - If true, selectionchange event will be triggered
	 * 	and paths will be redrawn even if the set the of selected points did
	 * 	not change.
	 */
	CINEMA_COMPONENTS.Pcoord.prototype.updateSelection = function(force) {
		var self = this;
		var newSelection = [];
		this.db.data.forEach(function(d, i) {
			// Assume that each datapoint should be selected.
			// This will be falsified if it is not included in the brushes
			// of *all* dims that are brushed.
			var selected = true;
			for (var dim of self.dimensions) {
				var dim_is_brushed = !self.brushSelections[dim].every(e => e === null);
				if (dim_is_brushed) {
					var in_any_brush_of_dim = false;
					var dim_selections = self.brushSelections[dim].filter(e => e !== null);
					for (var selection of dim_selections) {
						var y = self.getYPosition(dim, d);
						in_any_brush_of_dim = selection[0] <= y && y <= selection[1]
						if (in_any_brush_of_dim) {
							// no need to continue searching
							break;
						}
					}
					selected = selected && in_any_brush_of_dim;
					if (!selected)
						// this datapoint has been excluded
						break;
				}
			}
			if (selected)
				newSelection.push(i);
		});
		if (!arraysEqual(this.selection,newSelection) || force) {
			this.selection = newSelection;
			this.dispatch.call("selectionchange",this, this.selection.slice());
			this.redrawSelectedPaths();
		}
	}

	/**
	 * Set the indices of the currently highlighted data
	 */
	CINEMA_COMPONENTS.Pcoord.prototype.setHighlightedPaths = function(indices) {
		this.highlighted = indices;
		this.redrawHighlightedPaths();
	}

	/**
	 * Set the current overlay paths
	 */
	CINEMA_COMPONENTS.Pcoord.prototype.setOverlayPaths = function(data) {
		this.overlayData = data;
		this.redrawOverlayPaths();
	};

	//Shortcut function for redrawSelectedPaths, redrawHighlightedPath, redrawOverlayPaths
	CINEMA_COMPONENTS.Pcoord.prototype.redrawPaths = function() {
		this.redrawSelectedPaths();
		this.redrawHighlightedPaths();
		this.redrawOverlayPaths();
	}

	/**
	 * Set the chart's selection to encapsulate the data represented by
	 * the given array of indices
	 *
	 * For each dimension d:
	 *   if d is checked in the query pane:
	 *     if d is a numeric variable:
	 *       draw one brush corresponding to the slider
	 *     else if d is a string variable:
	 *       draw one brush for each member string that matches the regex query
	 *   else:
	 *     draw one brush for the entire axis
	 */
	CINEMA_COMPONENTS.Pcoord.prototype.setSelection = function(selection) {
		var ranges = {};
		var self = this;
		this.brushReset()
		this.originalDimensions.forEach(function(d, pos) {
			if (!self.db.isStringDimension(d)) {
				ranges[d] = d3.extent(selection, function(i) {
					return self.getYPosition(d, self.db.data[i]);
				});
				var lastIx = self.brushes[d].length - 1;
				var brush = self.brushes[d][lastIx].brush
				var newPos = [ranges[d][0]-5, ranges[d][1]+5];
				self.brushSelections[d][lastIx] = newPos;
				self.axisContainer
					.select('#brush-' + pos + '-' + lastIx)
					.call(brush)
					.call(brush.move, newPos)
			} else {
				// get the unique elements of the string variable in the selection
				var unique = new Set();
				selection.forEach((i) => {
					unique.add(self.db.data[i][d])
				});
				unique.forEach((e) => {
					var y = self.y[d](e)
					var pad = self.y[d].step()/3
					var lastIx = self.brushes[d].length - 1;
					var brush = self.brushes[d][lastIx].brush
					var newPos = [y-pad, y+pad];
					self.brushSelections[d][lastIx] = newPos;
					self.axisContainer
						.select('#brush-' + pos + '-' + lastIx)
						.call(brush)
						.call(brush.move, newPos)
					self.axisContainer
						.select('.brushgroup[dimension='+d+']')
						.call(self.newBrush)
						.call(self.drawBrushes)
				})
			}

		});
	}

	/**
	 * Set the chart's selection to match the ranges defined in the given
	 * filter.
	 * @param {Object} filter Object defining the filter. Each key is the name
	 * of numeric dimension and each value is a 2-length array containing the minimum
	 * and maximum values.
	 */
	CINEMA_COMPONENTS.Pcoord.prototype.filterSelection = function(filter) {
		var self = this;
		this.dimensions
			.filter((d) => {return !self.db.isStringDimension(d)})
			.forEach(function(d) {
			//get filter for this particular dimension 'f'
			var f = filter ? filter[d] : null
			if (f && Array.isArray(f) && f.length == 2 && !isNaN(f[0]) && !isNaN(f[1])) {
				//clamp range to bounds of chart
				var range = [
					Math.max(self.y[d](f[1]),0),
					Math.min(self.y[d](f[0]),self.internalHeight)
				]
				var brush = self.brushes[d][0].brush
				self.axisContainer
					.select('#brush-' + self.originalDimensions.indexOf(d) + '-0')
					.call(brush)
					.call(brush.move, function() {return range;});
			}
		});
		this.updateSelection();
	}

	/**
	 * Reorder the axes to the order given
	 */
	CINEMA_COMPONENTS.Pcoord.prototype.setAxisOrder = function(order) {
		var self = this;
		//filter out dimensions in order, but not in chart's dimensions
		var order = order.filter(function(d) {
			return self.dimensions.includes(d);
		});
		//Add any dimensions in chart's dimensions but not in order
		this.dimensions.forEach(function(d) {
			if (!order.includes[d])
				order.push(d);
		});
		//update domain
		this.x.domain(order);
		//update dimensions list
		self.dimensions.sort(function(a,b){
			return self.getXPosition(a)-self.getXPosition(b);
		});
		//update axes
		this.axes.attr('transform',function(d) {
			return "translate("+self.getXPosition(d)+")";
		});
		//Reorder axes in DOM
		self.axes.sort(function(a,b){
			return self.x(a) - self.x(b);
		});
		//redraw
		this.redrawPaths();
	}

	/**
	 * Redraw the current selection of paths.
	 * Actual implementation is up to specific subclasses
	 */
	CINEMA_COMPONENTS.Pcoord.prototype.redrawSelectedPaths = function() {
		throw new Error("Cannot call abstract function 'redrawSelectedPaths()'!"+
			" Please override function in a subclass");
	}

	/**
	 * Redraw the currently highlighted path.
	 * Actual implementation is up to specific subclasses
	 */
	CINEMA_COMPONENTS.Pcoord.prototype.redrawHighlightedPaths = function() {
		throw new Error("Cannot call abstract function 'redrawHighlightedPaths()'!"+
			" Please override function in a subclass");
	}

	/**
	 * Redraw the overlay paths.
	 * Actual implementation is up to specific subclasses
	 */
	CINEMA_COMPONENTS.Pcoord.prototype.redrawOverlayPaths = function() {
		throw new Error("Cannot call abstract function 'redrawOverlayPaths()'!"+
			" Please override function in a subclass");
	}

	/**
	 * Get the path (the contents of the 'd' attribute) for the path
	 * represented by the given data point.
	 * Draws a physical break in the path where values are undefined.
	 * @param {Object} d The data point to base the path off
	 */
	CINEMA_COMPONENTS.Pcoord.prototype.getPath = function(d) {
		var self = this;
		var curveLength = this.smoothPaths ? this.internalWidth/this.dimensions.length/3 : 0;
		var singleSegmentLength = this.internalWidth/this.dimensions.length/5;
		var path = '';

		//Split dimensions into sections deliminated by undefined values
		var sections = [];
		var currentSection = [];
		this.dimensions.forEach(function(p) {
			if (d[p] != undefined) {
				currentSection.push(p);
			}
			else if (currentSection.length != 0) {
				sections.push(currentSection.slice());
				currentSection = [];
			}
		});
		if (currentSection.length > 0)
			sections.push(currentSection.slice());

		//Draw individual sections
		sections.forEach(function(section) {
			//If a section contains only one dimension, draw a short line across the axis
			if (section.length == 1) {
				var p = section[0];
				var x = self.getXPosition(p);
				var y = self.getYPosition(p,d);
				path += ('M '+(x-singleSegmentLength/2)+' '+y+' L ')+
						((x+singleSegmentLength/2)+' '+y);
			}
			else {
				section.forEach(function (p,i) {
					var x = self.getXPosition(p);
					var y = self.getYPosition(p,d);
					if (i == 0) {//beginning of path
						path += ('M '+x+' '+y+' C ')+
								((x+curveLength)+' '+y+' ');
					}
					else if (i == section.length-1) {//end of path
						path += ((x-curveLength)+' '+y+' ')+
								(x+' '+y+' ');
					}
					else {//midpoints
						path += ((x-curveLength)+' '+y+' ')+
								(x+' '+y+' ')+
								((x+curveLength)+' '+y+' ');
					}
				});
			}
		});
		return path;
	}

	/**
	 * Get the x-coordinate of the axis representing the given dimension
	 * @param {string} d - The dimension to get the x-coordinate for
	 */
	CINEMA_COMPONENTS.Pcoord.prototype.getXPosition = function(d) {
		var v = this.dragging[d];
		return v == null ? this.x(d) : v;
	};

	/**
	 * Get the y-coordinate of the line for data point p on dimension d
	 * @param {string} d - The dimension on the data point
	 * @param {Object} p - The data point
	 */
	CINEMA_COMPONENTS.Pcoord.prototype.getYPosition = function(d, p) {
		if (!this.db.isStringDimension(d) && isNaN(p[d]))
			//If the value is NaN on a linear scale, return internalHeight as the position
			//(to place the line on the NaN tick)
			return this.internalHeight;
		return this.y[d](p[d]);
	}

	/**
	 * Get the y-coordinate of the line for data point p on dimension d
	 * @param {Object} dimObject - dimension / startDate / endDate selected}
	 */
	//todo: ask if this is ever used anymore
	CINEMA_COMPONENTS.Pcoord.prototype.addSelectionByDimensionValues = function(dimObject) {
		var self = this;

		//Get pixel values of given dates
		var startpx = this.y[dimObject.dimension](dimObject.startDate)
		var endpx = this.y[dimObject.dimension](dimObject.endDate)

		//avoid 0px selection
		if(startpx === endpx) {
			startpx += 1;
			endpx -= 1;
		}

		//Check if inside boundary
		var range = [
			Math.min(endpx,self.internalHeight),
			Math.max(startpx,0)
		]

		//Set selection
		self.axisContainer
		.select('.axisGroup[dimension='+dimObject.dimension+']')
		.select('g.brush')
			.call(self.brush.move, function() {return range;});
	}

	/**
	 * Convenience function to compare arrays
	 * (used to compare the selection to the previous one)
	 */
	function arraysEqual(a, b) {
		if (a === b) return true;
		if (a == null || b == null) return false;
		if (a.length != b.length) return false;

		for (var i = 0; i < a.length; ++i) {
			if (a[i] !== b[i]) return false;
		}
		return true;
	}

})();
