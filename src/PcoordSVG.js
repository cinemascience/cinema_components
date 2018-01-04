'use strict'
(function() {
	/**
	 * CINEMA_COMPONENTS
	 * PCOORDSVG
	 * 
	 * The PcoordSVG Component for the CINEMA_COMPONENTS library.
	 * Contains the constructor for the PcoordSVG component:
	 * A subclass of Pcoord which draws a Paralell Coordinates chart using SVG.
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

	//Require that the Pcoord Component be included
	if (!CINEMA_COMPONENTS.PCOORD_INCLUDED)
		throw new Error("CINEMA_COMPONENTS PcoordSVG Component requires that Pcoord"+
			" component be included. Please make sure that Pcoord component"+
			" is included BEFORE PcoordSVG module");

	/** @type {boolean} - Flag to indicate that the PcoordSVG Component has been included */
	CINEMA_COMPONENTS.PCOORDSVG_INCLUDED = true;

	/**
	 * Constructor for PcoordSVG Component
	 * Represents a component for displaying and interacting with a database on a parallel coordinates chart
	 * rendered with SVG
	 * @param {DOM} parent - The DOM object to build this component inside of
	 * @param {CINEMA_COMPONENTS.Database} database - The database behind this component
	 * @param {RegExp} filterRegex - A regex to determine which dimensions to NOT show on the component
	 */
	CINEMA_COMPONENTS.PcoordSVG = function(parent, database, filterRegex) {
		//call super-constructor
		CINEMA_COMPONENTS.Pcoord.call(this,parent,database,filterRegex);

		//Add SVG Components to pathContainer
		this.paths = 
	}
	//establish prototype chain
	CINEMA_COMPONENTS.PcoordSVG.prototype = Object.create(CINEMA_COMPONENTS.Pcoord.prototype);
	CINEMA_COMPONENTS.PcoordSVG.prototype.constructor = CINEMA_COMPONENTS.PcoordSVG;


})();