'use strict';
(function() {
	/**
	 * CINEMA_COMPONENTS
	 * COMPONENT
	 * 
	 * The Component module for the CINEMA_COMPONENTS library.
	 * Contiains the prototype object for components (PcoordSVG,PcoordCanvas,Glyph, etc.)
	 * The object contains common methods and fields used by all components.
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

	//Require that the database module be included
	if (!CINEMA_COMPONENTS.DATABASE_INCLUDED)
		throw new Error("CINEMA_COMPONENTS Component module requires that Database"+
				" module be included. Please make sure that Database module"+
				" is included BEFORE Component module");

	/** @type {boolean} - Flag to indicate that the Component module has been included */
	CINEMA_COMPONENTS.COMPONENT_INCLUDED = true;

	/**
	 * Abstract constructor for Component.
	 * Represents a component for displaying and interacting with a database.
	 * Objects such as PcoordSVG, PcoordCanvas and Glyph inherit from this
	 * @param {DOM} parent - The DOM object to build this component inside of (all children will be removed)
	 * @param {CINEMA_COMPONENTS.Database} database - The database behind this component
	 * @param {RegExp} filterRegex - A regex to determine which dimensions to NOT show on the component
	 */
	CINEMA_COMPONENTS.Component = function(parent, database, filterRegex) {
		if (this.constructor === CINEMA_COMPONENTS.Component)
			throw new Error("Cannot instantiate abstract class 'Component.'"+
				" Please use a subclass.");

		/** @type {DOM} The parent DOM object to build this component inside of */
		this.parent = parent;

		//Clear children
		this.parent.innerHTML = '';

		/** @type {CINEMA_COMPONENTS.Database} A reference to the database behind this component */
		this.db = database;
		/** @type {string[]} The filtered list of dimensions that are shown on the component */
		this.dimensions = [];

		//NOTE that this.dimensions is filtered to have only the dimensions shown on the component
		//while this.db.dimensions includes all dimensions in the database

		/** @type {RegExp} The regex used to filter out dimensions to not be shown on the component*/
		this.filter = filterRegex;

		//Get filtered Dimensions according to filterRegex
		this.dimensions = this.db.dimensions.filter(function(d) {
			return filterRegex ? !filterRegex.test(d) : true;
		});

		this.updateSize();
	};

	CINEMA_COMPONENTS.Component.prototype.updateSize = function(){
		this.margin = this.margin || {top: 0, right: 0, bottom: 0, left: 0};//default margins
		this.parentRect = this.parent.getBoundingClientRect();
		this.internalWidth = this.parentRect.width - this.margin.left - this.margin.right;
		this.internalHeight = this.parentRect.height - this.margin.top - this.margin.bottom;
	};
})();