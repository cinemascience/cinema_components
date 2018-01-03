'use strict'
(function() {
	/**
	 * CINEMA_COMPONENTS
	 * PCOORD
	 * 
	 * The Pcoord Component for the CINEMA_COMPONENTS library.
	 * Contains the prototype object for Parallel Coordinates Components (e.g. PcoordSVG, PcoordCanvas)
	 * It is a sublcass of Component and contains methods and fields common to all Parallel Coordinates Components
	 * 
	 * @exports CINEMA_COMPONENTS
	 * 
	 * @author Cameron Tauxe
	 * @version 2.0
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
	if (!d3) {
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

		//Sizing
		this.margin = {top: 30, right: 10, bottom: 10, left: 10};//override margin
		this.NaNMargin; // the room left at the bottom of the chart for NaN values

		//call super-constructor
		CINEMA_COMPONENTS.Component.call(this,parent,database,filterRegex);

		this.NaNMargin = this.internalHeight/11;

		//Events
		this.dispatch = d3.dispatch("selectionchange","mouseover","click");

		//xScale
		this.x = d3.scalePoint()
			.domain(this.dimensions)
			.range([0,this.internalWidth])
			.padding(1);
		//yScales (one for each dimension)
		this.y = {};
		this.dimensions.forEach(function (d) {
			if (self.db.isStringDimension(d))
				self.y[d] = d3.scalePoint()
					.domain(self.db.dimensionDomains[d])
					.range([self.internalHeight,0]);
			else
				self.y[d] = d3.scaleLinear()
					.domain(self.db.dimensionDomains[d])
					.range([self.internalHeight-self.NaNMargin,0]);
		});

	}
})();