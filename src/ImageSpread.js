'use strict';
(function() {
	/**
	 * CINEMA_COMPONENTS
	 * IMAGESPREAD
	 *
	 * The ImageSpread Component for the CINEMA_COMPONENTS library.
	 * Contains the constructor for the ImageSpread Component
	 * Which displays image data for a set of rows in a database.
	 *
	 * @exports CINEMA_COMPONENTS
	 *
	 * @author Cameron Tauxe
	 */

	//If CINEMA_COMPONENTS is already defined, add to it, otherwise create it
	var CINEMA_COMPONENTS = {}
	if(window.CINEMA_COMPONENTS)
		CINEMA_COMPONENTS = window.CINEMA_COMPONENTS;
	else
		window.CINEMA_COMPONENTS = CINEMA_COMPONENTS;

	//Require that the Component module be included
	if(!CINEMA_COMPONENTS.COMPONENT_INCLUDED)
		throw new Error("CINEMA_COMPONENTS ImageSpread module requires that Component" +
			" module be included. Please make sure that Component module" +
			" is included BEFORE ImageSpread module");

	//Require that d3 be included
	if(!window.d3) {
		throw new Error("CINEMA_COMPONENTS ImageSpread module requires that" +
			" d3 be included (at least d3v4). Please make sure that d3 is included BEFORE the" +
			" the ImageSpread module");
	}

	/** @type {boolean} - Flag to indicate that the ImageSpread module has been included */
	CINEMA_COMPONENTS.IMAGE_SPREAD_INCLUDED = true;

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
	 * Constructor for ImageSpread Component
	 * Represents a component for viewing a spread of images from a selection of data
	 * @param {DOM} parent - The DOM object to build this component inside of
	 * @param {CINEMA_COMPONENTS.Database} database - The database behind this component
	 * (Note that ImageSpread does not use a filterRegex)
	 */
	CINEMA_COMPONENTS.ImageSpread = function(parent, database, image_measures, excluded_dimensions) {
		var self = this;

		/***************************************
		 * SIZING
		 ***************************************/

		//Call super-constructor (will calculate size)
		CINEMA_COMPONENTS.Component.call(this, parent, database);

		/***************************************
		 * DATA
		 ***************************************/

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

		//Get all non image measure and non file dimensions
		this.validDim = [];
		for(var i=0, len=self.dimensions.length; i < len; i++) {
			if(!(self.dimensions[i].startsWith("FILE") ||
			startsWithPrefixes(self.dimensions[i], this.allowedUPrefixes) ||
			startsWithPrefixes(self.dimensions[i], this.excludedDim))) {
				self.validDim.push(self.dimensions[i]);
			}
		}

		//override this.dimensions to include only FILE dimensions
		this.dimensions = this.dimensions.filter(function(d) {
			return (/^FILE/).test(d);
		});
		/** @type {boolean} Whether any FILE dimensions exist in the dataset */
		this.hasFileDimensions = this.dimensions.length != 0;

		/** @type {number[]} Inidices of all the data points to display */
		this.selection = [];

		/** @type {number} The page number currently being viewed*/
		this.currentPage = 1;

		/***************************************
		 * EVENTS
		 ***************************************/

		/** @type {d3.dispatch} Hook for events on chart
		 * Set handlers with on() function. Ex: this.dispatch.on('mouseover',handlerFunction(i))
		 * 'mouseover': Triggered when a set of images is moused over
		 *	 (arguments are the index of moused over data and mouse event)
		 */
		this.dispatch = d3.dispatch('mouseover', 'click');

		/***************************************
		 * DOM Content
		 ***************************************/

		//Specify that this is an ImageSpread component
		d3.select(this.container).classed('IMAGE_SPREAD', true);

		//If there are no file dimensions, place a warning and stop here
		if(!this.hasFileDimensions) {
			this.noFileWarning = d3.select(this.container).append('div')
				.classed('noFileWarning', true)
				.text("No file information to display");
			return;
		}

		//NOTHING IN THE CONSTRUCTOR AFTER THIS POINT WILL BE EXECUTED
		//IF THERE ARE NO FILE DIMENSIONS

		/** @type {d3.selection} The header/control panel */
		this.header = d3.select(this.container).append('div')
			.classed('header', true)
			.style('position', 'absolute')
			.style('width', '100%');

		/** @type {d3.selection} The container for all the images */
		this.imageContainer = d3.select(this.container).append('div')
			.classed('imageContainer', true)
			.style('position', 'absolute')
			.style('width', '100%')
			.style('overflow-y', 'auto');

		/***************************************
		 * HEADER/CONTROLS
		 ***************************************/

		//pageSize controls
		/** @type {d3.selection} The control panel for pageSize */
		this.pageSizeContainer = this.header.append('div')
			.classed('controlPanel pageSize', true);
		this.pageSizeContainer.append('span')
			.classed('label', true)
			.text("Results Per Page:");
		this.pageSizeContainer.append('br');
		/** @type {DOM (select)} The select node controlling page size */
		this.pageSizeNode = this.pageSizeContainer.append('select')
			.on('change', function() {
				self.updatePageNav();
				self.populateResults();
			})
			.node();
		//append options
		d3.select(this.pageSizeNode).selectAll('option')
			.data([10, 25, 50, 100])
			.enter().append('option')
			.attr('value', function(d) {
				return d;
			})
			.text(function(d) {
				return d;
			});
		//Select 25 as default option
		d3.select(this.pageSizeNode).select('option[value="25"]')
			.attr('selected', 'true');

		//sort controls
		/** @type {d3.selection} The control panel for choosing sort dimension */
		this.sortContainer = this.header.append('div')
			.classed('controlPanel sort', true);
		this.sortContainer.append('span')
			.classed('label', true)
			.text("Sort By:");
		this.sortContainer.append('br');
		/** @type {DOM (select)} The select node controlling sort dimension */
		this.sortNode = this.sortContainer.append('select')
			.on('change', function() {
				self.selection.sort(self.getSortComparator());
				self.populateResults();
			})
			.node();
		//append options
		d3.select(this.sortNode).selectAll('option')
			.data(this.db.dimensions.filter(function(d) {
				return !self.db.isStringDimension(d);
			}))
			.enter().append('option')
			.attr('value', function(d) {
				return d;
			})
			.text(function(d) {
				return d;
			});

		//sortOrder controls
		/** @type {d3.selection} The control panel for toggling sort order */
		this.sortOrderContainer = this.header.append('div')
			.classed('controlPanel sortOrder', true);
		this.sortOrderContainer.append('span')
			.classed('label', true)
			.text("Reverse Sort Order:");
		this.sortOrderContainer.append('br');
		/** @type {DOM (input/checkbox)} The node for toggling sort order */
		this.sortOrderNode = this.sortOrderContainer.append('input')
			.attr("type", "checkbox")
			.on('change', function() {
				self.selection.sort(self.getSortComparator());
				self.populateResults();
			})
			.node();

			//grouping controls
			/** @type {d3.selection} The control panel for toggling sort order */
			this.groupsortingContainer = this.header.append('div')
				.classed('controlPanel groupingOption', true);
			this.groupsortingContainer.append('span')
				.classed('label', true)
				.text("Group equal values:");
			this.groupsortingContainer.append('br');
			/** @type {DOM (input/checkbox)} The node for toggling grouping order */
			this.groupsortingNode = this.groupsortingContainer.append('input')
				.attr('type', 'checkbox')
				.on('change', function() {
					self.selection.sort(self.getSortComparator());
					self.populateResults();
				})
				.node();

		//imageSize controls
		/** @type {d3.selection} The control panel for controlling image size */
		this.imageSizeContainer = this.header.append('div')
			.classed('controlPanel imageSize', true);
		this.imageSizeContainer.append('span')
			.classed('label', true)
			.text("Image Size: 150px");
		this.imageSizeContainer.append('br');
		/** @type {DOM (input/range)} The node for adjusting imageSize */
		this.imageSizeNode = this.imageSizeContainer.append('input')
			.attr('type', 'range')
			.attr('min', '100')
			.attr('max', '500')
			.on('input', function() {
				d3.select(self.container).selectAll('.fileDisplay .display')
					.style('width', this.value + 'px');
				d3.select(self.container).selectAll('.detailDisplay .display')
					.style('width', Math.min(1.25*this.value, 300) + 'px');
				d3.select(self.container).selectAll('.detailDisplay .display')
					.style('height', 0.75*this.value + 'px');
				d3.select(self.container).selectAll('.display.textfile')
					.style('width', Math.min(1.25*this.value, 300) + 'px');
				d3.select(self.container).selectAll('.display.textfile')
					.style('height', 0.75*this.value + 'px');
				d3.select(self.container).select('.controlPanel.imageSize .label')
					.text("Image Size: " + this.value + "px");
			})
			.node();
		this.imageSizeNode.value = 150;

		//Update size
		this.updateSize();
	}
	//establish prototype chain
	CINEMA_COMPONENTS.ImageSpread.prototype = Object.create(CINEMA_COMPONENTS.Component.prototype);
	CINEMA_COMPONENTS.ImageSpread.prototype.constructor = CINEMA_COMPONENTS.ImageSpread;

	/**
	 * Should be called every time the size of the component's container changes.
	 * Updates the sizing of the imageSpread container
	 */
	CINEMA_COMPONENTS.ImageSpread.prototype.updateSize = function() {
		//Call super
		CINEMA_COMPONENTS.Component.prototype.updateSize.call(this);

		if(this.hasFileDimensions) {
			var headerSize = this.header.node().getBoundingClientRect().height;
			this.imageContainer
				.style('top', headerSize + 'px')
				.style('height', (this.parentRect.height - headerSize) + 'px');
		}
	};

	/**
	 * Set the data to be shown to the data represented with the given array of indices
	 */
	CINEMA_COMPONENTS.ImageSpread.prototype.setSelection = function(indices) {
		this.selection = indices;
		this.selection.sort(this.getSortComparator());
		this.updatePageNav();
		this.populateResults();
	}

	/**
	 * Get a comparator function for sorting the selection
	 * according to selected sort dimension and the sortOrder checkbox
	 */
	CINEMA_COMPONENTS.ImageSpread.prototype.getSortComparator = function() {
		var self = this;
		var d = this.sortNode.value;
		var checkedMultiplier = 1;

		if(this.sortOrderNode.checked)
			checkedMultiplier = -1;

		//Group images with equal values, not looking at the sort dimension
		//Then sort groups by the sorting dimension
		if(this.groupsortingNode.checked) {
			return function(a, b) {
				if(self.db.data[a][d] === undefined)
					return -1 * checkedMultiplier;

				if(self.db.data[b][d] === undefined)
					return 1 * checkedMultiplier;

				if(isNaN(self.db.data[a][d]))
					return -1 * checkedMultiplier;

				if(isNaN(self.db.data[b][d]))
					return 1 * checkedMultiplier;

				//Get all  vlid dimensions but the sorting dimension
				const nonSortDimensions = self.validDim.filter(function(value) {
					return value != d;
				});
				//Grouping
				for(var i = 0; i < nonSortDimensions.length; i += 1) {
					if(self.db.data[a][nonSortDimensions[i]] == self.db.data[b][nonSortDimensions[i]]) {
						continue;
					}
					else {
						return (self.db.data[a][nonSortDimensions[i]] - self.db.data[b][nonSortDimensions[i]]) * checkedMultiplier;
					}
				}
				//Equal non sorting dimensions, sort by sorting dimension
				return  (self.db.data[a][d] - self.db.data[b][d]) * checkedMultiplier;
			}
		}
		//Only sort by sorting dimension
		else {
			return function(a, b) {
				if(self.db.data[a][d] === undefined)
					return -1 * checkedMultiplier;

				if(self.db.data[b][d] === undefined)
					return 1 * checkedMultiplier;

				if(isNaN(self.db.data[a][d]))
					return -1 * checkedMultiplier;

				if(isNaN(self.db.data[b][d]))
					return 1 * checkedMultiplier;

				return (self.db.data[a][d] - self.db.data[b][d]) * checkedMultiplier;
			}
		}
	}

	/**
	 * Fill the imageContainer with dataDisplays for the current page of results
	 */
	CINEMA_COMPONENTS.ImageSpread.prototype.populateResults = function() {
		var self = this;
		if(this.hasFileDimensions) {
			var pageSize = this.pageSizeNode.value;
			var pageData = this.selection.slice((this.currentPage - 1) * pageSize,
				Math.min(this.currentPage * pageSize, this.selection.length));
			//Bind pageData and update dataDisplays
			var displays = this.imageContainer.selectAll('.dataDisplay')
				.data(pageData);
			displays.exit().remove(); //remove unused dataDisplays
			displays.enter() //add new dataDisplays
				.append('div').classed('dataDisplay', true)
				.merge(displays) //update
				//Set up mouse events
				.on('mouseenter', function(d) {
					self.dispatch.call('mouseover', self, d, d3.event);
				})
				.on('mouseleave', function(d) {
					self.dispatch.call('mouseover', self, null, d3.event);
				})
				//For each data display, create file displays for every file in it
				.each(function(d) {
					var files = self.dimensions.map(function(dimension) {
						return self.db.data[d][dimension];
					});
					// track index in html for easy scrolling
					d3.select(this).attr('index', d);
					//bind files data
					var fileDisplays = d3.select(this).selectAll('.fileDisplay')
						.data(files);
					fileDisplays.exit().remove();

					// create the div for detail displays
					var detailDisplays = d3.select(this).selectAll('.detailDisplay').data([d]);
					detailDisplays.exit().remove();


					var ENTER = fileDisplays.enter().append('div')
						.classed('fileDisplay', true);
					ENTER.append('div').classed('display', true)
						.style('width', self.imageSizeNode.value + 'px');
					ENTER.append('div').classed('displayLabel', true);

					var ENTER_DETAIL = detailDisplays
						.enter().append('div')
								.classed('detailDisplay', true);
					ENTER_DETAIL.append('div').classed('display', true);
					ENTER_DETAIL.append('div').classed('displayLabel', true);
					var UPDATE = ENTER.merge(fileDisplays)
						//Create content of each file display
						.each(function(f, i) {
							d3.select(this).select('.display').html('');
							//Create an image in the display if the it is an image filetype
							var ext = getFileExtension(f);
							if (isValidFiletype(ext)) {
								if (ext.toUpperCase() === 'VTI') {
									d3.select(this).select('.display')
										.classed('image', true)
										.classed('text', false).append('img')
										.attr('src', 'https://kitware.github.io/vtk-js/logo.svg')
										.attr('width', '100%')
										.on('click', function () {
											self.createModalVTI(self.db.directory + '/' + f);
										});
								} else if (ext.toUpperCase() === 'PDB') {
									d3.select(this).select('.display')
										.classed('image', true)
										.classed('text', false).append('img')
										.attr('src', 'https://kitware.github.io/vtk-js/logo.svg')
										.attr('width', '100%')
										.on('click', function () {
											self.createModalPDB(self.db.directory + '/' + f);
										});
								} else if (ext.toUpperCase() === 'MOL2') {
									d3.select(this).select('.display')
										.classed('image', true)
										.classed('text', false).append('img')
										//.attr('src', self.db.directory + '/' + f.substr(0, f.lastIndexOf(".")) + ".png")
										.attr('src', 'https://miketynes.github.io/bucket/3dmoljs.png')
										.attr('width', '100%')
										.on('click', function () {
											self.createModalMOL2(self.db.directory + '/' + f);
										});
								} else if (ext.toUpperCase() === "TXT") {
									var DISPLAY = d3.select(this).select('.display')
										.classed('image', false)
										.classed('text', false)
										.classed('textfile', true)
									var request = new XMLHttpRequest();
									request.open("GET", self.db.directory + '/' + f, true);
									request.onreadystatechange = function () {
										if (request.readyState === 4) {
											if (request.status === 200 ||
												(navigator.userAgent.match(/Safari/) && request.status === 0)
											) {
												DISPLAY.text(request.responseText);
											}
										}
									};
									d3.select(this).select('.display.textfile')
										.style('width', 1.25 * self.imageSizeNode.value + 'px');
									d3.select(this).select('.display.textfile')
										.style('height', 0.75 * self.imageSizeNode.value + 'px')
									request.send(null)
								} else {
									d3.select(this).select('.display')
										.classed('image', true)
										.classed('text', false)
										.append('img')
										.attr('src', self.db.directory + '/' + f)
										.attr('width', '100%')
										.on('click', self.createModalImg);
								}
							} else if (f === undefined) {
								d3.select(this).select('.display')
								.classed('text', true)
								.classed('image', false)
								.append('div')
								.attr('class', 'resultErrorText')
								.text('File not found in database');
							}
							//Otherwise create an error message
							else
								d3.select(this).select('.display')
								.classed('text', true)
								.classed('image', false)
								.append('div')
								.attr('class', 'resultErrorText')
								.text('Unable to disolay file "' + f + '". Download available:');
							//Update label
							d3.select(this).select('.displayLabel')
								.text(self.dimensions[i] + ' ')
							if (f !== undefined) {
								//Add a download link
								d3.select(this).select('.displayLabel')
									.append('a')
									.attr('href', self.db.directory + '/' + f)
									.attr('download', f)
									.text('Download')
							}
						});

					var UPDATE_DETAIL = ENTER_DETAIL
						.merge(detailDisplays)
						.on('click', function(d) {
				            self.dispatch.call('click', self, d, d3.event);
				        })
						.each(() => {
							d3.select(this).select('.detailDisplay .display')
								.html(() => {
									var data = self.db.data[d];
									var text = ''
									for (var _ in data) {
										text += ('<b>' + _ + ':</b> ');
										text += (data[_] + '<br>');
									}
									return text;
								})
							d3.select(this).select('.detailDisplay .displayLabel')
								.text('DETAILS');
							d3.select(this).select('.detailDisplay .display')
								.style('width', 1.25*self.imageSizeNode.value + 'px');
							d3.select(this).select('.detailDisplay .display')
								.style('height', 0.75*self.imageSizeNode.value + 'px')
						})
				});

		}
	};

	/**
	 * An event handler for an image that will create a modal overlay
	 * of the image when clicked
	 */
	CINEMA_COMPONENTS.ImageSpread.prototype.createModalImg = function() {
		d3.select('body').append('div')
			.attr('class', 'modalBackground')
			.on('click', function() {
				//clicking the modal removes it
				d3.select(this).remove();
			})
			.append('img')
			.attr('class', 'modalImg')
			.attr('src', d3.select(this).attr('src'));
	}

	/**
	 * An event handler for an image that will create a modal overlay
	 * of the image when clicked
	 */
	CINEMA_COMPONENTS.ImageSpread.prototype.createModalVTI = function(url) {
		const rootContainer = d3.select('body');
		const backgroundContainer = d3.select('body').append('div');
		backgroundContainer.attr('class', 'modalBackground')
			.on('click', function() {
				//clicking the modal removes it
				if(d3.event.target.tagName === 'IMG') {
					d3.select(this).remove();
				}
			});
		const container = backgroundContainer.append('div');
		container.attr('class', 'modalViewer').on('click', function() {
			//clicking the modal removes it
			d3.select(this).remove();
			d3.event.stopPropagation();
		});

		var global = {};
		// ----------------------------------------------------------------------------
		// Standard rendering code setup
		// ----------------------------------------------------------------------------

		//const rootContainer = document.querySelector('body');
		const background = [1, 1, 1];
		const fullScreenRenderer = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
			background: background,
			rootContainer: rootContainer.node(),
			//containerStyle: { height: '100%' },
			container: container.node()
		});
		const renderer = fullScreenRenderer.getRenderer();
		const renderWindow = fullScreenRenderer.getRenderWindow();

		// ----------------------------------------------------------------------------
		// Example code
		// ----------------------------------------------------------------------------

		const reader = vtk.IO.Misc.vtkPDBReader.newInstance();
		const filter = vtk.Filters.General.vtkMoleculeToRepresentation.newInstance();
		const sphereMapper = vtk.Rendering.Core.vtkSphereMapper.newInstance();
		const stickMapper = vtk.Rendering.Core.vtkStickMapper.newInstance();
		const sphereActor = vtk.Rendering.Core.vtkActor.newInstance();
		const stickActor = vtk.Rendering.Core.vtkActor.newInstance();

		const vtiReader = vtk.IO.XML.vtkXMLImageDataReader.newInstance();
		//vtiReader.parseAsArrayBuffer(fileContents);


		filter.setInputConnection(reader.getOutputPort());
		//filter.setInputConnection(vtiReader.getOutputPort());
		//filter.setHideElements(['H']);

		// render sphere
		sphereMapper.setInputConnection(filter.getOutputPort(0));
		sphereMapper.setScaleArray(filter.getSphereScaleArrayName());
		sphereActor.setMapper(sphereMapper);

		// render sticks
		stickMapper.setInputConnection(filter.getOutputPort(1));
		stickMapper.setScaleArray('stickScales');
		stickMapper.setOrientationArray('orientation');
		stickActor.setMapper(stickMapper);

		vtk.IO.Core.DataAccessHelper.get().fetchBinary(url, {
			function(pe) {
				console.log(pe);
			},
		}).then((binary) => {
			vtiReader.parseAsArrayBuffer(binary);
			const source = vtiReader.getOutputData(0);
			const mapper = vtk.Rendering.Core.vtkVolumeMapper.newInstance();
			const actor = vtk.Rendering.Core.vtkVolume.newInstance();

			const dataArray =
				source.getPointData().getScalars() || source.getPointData().getArrays()[0];
			const dataRange = dataArray.getRange();

			const lookupTable = vtk.Rendering.Core.vtkColorTransferFunction.newInstance();
			const piecewiseFunction = vtk.Common.DataModel.vtkPiecewiseFunction.newInstance();

			// Pipeline handling
			actor.setMapper(mapper);
			mapper.setInputData(source);
			renderer.addActor(actor);

			// Configuration
			const sampleDistance =
				0.7 *
				Math.sqrt(
					source
					.getSpacing()
					.map((v) => v * v)
					.reduce((a, b) => a + b, 0)
				);
			mapper.setSampleDistance(sampleDistance);
			actor.getProperty().setRGBTransferFunction(0, lookupTable);
			actor.getProperty().setScalarOpacity(0, piecewiseFunction);
			// actor.getProperty().setInterpolationTypeToFastLinear();
			actor.getProperty().setInterpolationTypeToLinear();

			// For better looking volume rendering
			// - distance in world coordinates a scalar opacity of 1.0
			actor
				.getProperty()
				.setScalarOpacityUnitDistance(
					0,
					vtk.Common.DataModel.vtkBoundingBox.getDiagonalLength(source.getBounds()) /
					Math.max(...source.getDimensions())
				);
			// - control how we emphasize surface boundaries
			//	=> max should be around the average gradient magnitude for the
			//	 volume or maybe average plus one std dev of the gradient magnitude
			//	 (adjusted for spacing, this is a world coordinate gradient, not a
			//	 pixel gradient)
			//	=> max hack: (dataRange[1] - dataRange[0]) * 0.05
			actor.getProperty().setGradientOpacityMinimumValue(0, 0);
			actor
				.getProperty()
				.setGradientOpacityMaximumValue(0, (dataRange[1] - dataRange[0]) * 0.05);
			// - Use shading based on gradient
			actor.getProperty().setShade(true);
			actor.getProperty().setUseGradientOpacity(0, true);
			// - generic good default
			actor.getProperty().setGradientOpacityMinimumOpacity(0, 0.0);
			actor.getProperty().setGradientOpacityMaximumOpacity(0, 1.0);
			actor.getProperty().setAmbient(0.2);
			actor.getProperty().setDiffuse(0.7);
			actor.getProperty().setSpecular(0.3);
			actor.getProperty().setSpecularPower(8.0);

			// Control UI
			const controllerWidget = vtk.Interaction.UI.vtkVolumeController.newInstance({
				size: [400, 150],
				rescaleColorMap: true,
			});
			const isBackgroundDark = background[0] + background[1] + background[2] < 1.5;
			controllerWidget.setContainer(container.node());
			controllerWidget.setupContent(renderWindow, actor, isBackgroundDark);
			fullScreenRenderer.setResizeCallback(({
				width,
				height
			}) => {
				// 2px padding + 2x1px boder + 5px edge = 14
				if(width > 414) {
					controllerWidget.setSize(400, 150);
				} else {
					controllerWidget.setSize(width - 14, 150);
				}
				controllerWidget.render();
				//fpsMonitor.update();
			});

			// First render
			renderer.resetCamera();
			renderWindow.render();

			global.pipeline = {
				actor,
				renderer,
				renderWindow,
				lookupTable,
				mapper,
				source,
				piecewiseFunction,
				fullScreenRenderer,
			};
		});
	}
	/*		.append('img')
				.attr('class', 'modalImg')
				.attr('src',d3.select(this).attr('src'));*/


	/**
	 * An event handler for an image that will create a modal overlay
	 * of the image when clicked
	 */
	CINEMA_COMPONENTS.ImageSpread.prototype.createModalPDB = function(url) {
		const rootContainer = d3.select('body');
		const backgroundContainer = d3.select('body').append('div');
		backgroundContainer.attr('class', 'modalBackground')
			.on('click', function() {
				//clicking the modal removes it
				if(d3.event.target.tagName === 'IMG') {
					d3.select(this).remove();
				}
			});
		const container = backgroundContainer.append('div');
		container.attr('class', 'modalViewer').on('click', function() {
			//clicking the modal removes it
			//d3.select(this).remove();
			//d3.event.stopPropagation();
		});

		var global = {};
		// ----------------------------------------------------------------------------
		// Standard rendering code setup
		// ----------------------------------------------------------------------------

		//const rootContainer = document.querySelector('body');
		const background = [1, 1, 1];
		const fullScreenRenderer = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
			background: background,
			rootContainer: rootContainer.node(),
			//containerStyle: { height: '100%' },
			container: container.node()
		});
		const renderer = fullScreenRenderer.getRenderer();
		const renderWindow = fullScreenRenderer.getRenderWindow();
		// ----------------------------------------------------------------------------
		// Example code
		// ----------------------------------------------------------------------------

		const reader = vtk.IO.Misc.vtkPDBReader.newInstance();
		const filter = vtk.Filters.General.vtkMoleculeToRepresentation.newInstance();
		const sphereMapper = vtk.Rendering.Core.vtkSphereMapper.newInstance();
		const stickMapper = vtk.Rendering.Core.vtkStickMapper.newInstance();
		const sphereActor = vtk.Rendering.Core.vtkActor.newInstance();
		const stickActor = vtk.Rendering.Core.vtkActor.newInstance();




		filter.setInputConnection(reader.getOutputPort());
		filter.setHideElements(['H']);

		// render sphere
		sphereMapper.setInputConnection(filter.getOutputPort(0));
		sphereMapper.setScaleArray(filter.getSphereScaleArrayName());
		sphereActor.setMapper(sphereMapper);

		// render sticks
		stickMapper.setInputConnection(filter.getOutputPort(1));
		stickMapper.setScaleArray('stickScales');
		stickMapper.setOrientationArray('orientation');
		stickActor.setMapper(stickMapper);

		// reader.setUrl(`${__BASE_PATH__}/data/molecule/pdb/caffeine.pdb`).then(() => {
		reader.setUrl(url).then(() => {
			renderer.resetCamera();
			renderWindow.render();
		});

		renderer.addActor(sphereActor);
		renderer.addActor(stickActor);
		renderer.resetCamera();
		renderWindow.render();

		// -----------------------------------------------------------
		// Make some variables global so that you can inspect and
		// modify objects in your browser's developer console:
		// -----------------------------------------------------------

		global.reader = reader;
		global.filter = filter;
		global.sphereMapper = sphereMapper;
		global.stickMapper = stickMapper;
		global.sphereActor = sphereActor;
		global.stickActor = stickActor;
		global.renderer = renderer;
		global.renderWindow = renderWindow;
	}

	// MOl2 file handler
	CINEMA_COMPONENTS.ImageSpread.prototype.createModalMOL2 = function(path) {
		const rootContainer = d3.select('body');
		const backgroundContainer = d3.select('body').append('div');
		backgroundContainer.attr('class', 'modalBackground')
		backgroundContainer.attr('id', 'background')
		const container = backgroundContainer.append('div');
		container.attr('class', 'modalMol')
		container.attr('id', 'modalMol')
		container.attr('href', path)

		$(function () {
			$.ajax({
				url: path,
				async: false,   // asynchronous request? (synchronous requests are discouraged...)
				cache: false,   // with this, you can force the browser to not make cache of the retrieved data
				dataType: "text",  // jQuery will infer this, but you can set explicitly
				success: function (data, textStatus, jqXHR) {
					let viewer = '';
					let element = $('#modalMol');
					let config = {
						backgroundColor: 'white',
					};
					viewer = $3Dmol.createViewer(element, config);
					viewer.addModel(data, 'mol2');
					// viewer.addSphere({ center: {x:0, y:0, z:0}, radius: 10.0, color: 'green' }); For testing
					viewer.setStyle({}, {stick: {'colorscheme': 'Jmol'}});
					viewer.render();
					viewer.zoomTo();
				}
			});
		});
		container.attr('class', 'modalMol')


		// Add button for closing.
		let btn = document.createElement("button");
		let ele = document.getElementById('background');
		btn.innerHTML += 'Close Viewer!'
		btn.className = 'modalButton'
		btn.id = 'buttonclose'
		btn.onclick = function () {
			d3.select('#background').remove();
		};
		ele.appendChild(btn)
	}

	CINEMA_COMPONENTS.ImageSpread.prototype.goToPageWithIx = function(ix) {
		var self = this;
		var page = Math.floor(self.selection.indexOf(ix)  / self.pageSizeNode.value) + 1;
		if (self.currentPage !== page) {
			self.currentPage = page
			self.updatePageNav();
			self.populateResults();
		}
	}

	/**
	 * Calculate the number of pages needed to show all results and rebuild
	 * the page navigation widget.
	 */
	CINEMA_COMPONENTS.ImageSpread.prototype.updatePageNav = function() {
		var self = this;
		d3.select(this.container).select('.pageNavWrapper').remove(); //remove previous widget
		var pageSize = this.pageSizeNode.value;
		//If there are more results than can fit on one page, build a pageNav widget
		if(this.selection.length > pageSize) {
			//calculate number of pages needed
			var numPages = Math.ceil(this.selection.length / pageSize);
			//If the currently selected page is higher than the new number of pages, set to last page
			if(this.currentPage > numPages) {
				this.currentPage = numPages
			};
			//Add pageNav and buttons
			d3.select(this.container).append('div')
				.classed('pageNavWrapper', true)
				.append('ul')
				.classed('pageNav', true)
				.selectAll('li')
				//Get data for which buttons to build, then build
				.data(getPageButtons(numPages, this.currentPage))
				.enter().append('li')
				.classed('pageButton', true)
				.attr('mode', function(d) {
					return d.page == self.currentPage ? 'selected' : 'default';
				})
				.text(function(d) {
					return d.text;
				})
				.on('click', function(d) {
					if(d3.select(this).attr('mode') != 'selected') {
						self.currentPage = d.page;
						if(d.do_rebuild) {
							self.updatePageNav();
							self.populateResults();
						} else {
							d3.select(self.container).select('.pageButton[mode="selected"]')
								.attr('mode', 'default');
							d3.select(this).attr('mode', 'selected');
							d3.select('.pageReadout').text(self.currentPage + " / " + numPages);
							self.populateResults();
						}
					}
				});
			//Add readout of currentPage/totalPages
			d3.select('.pageNavWrapper').append('div')
				.classed('pageReadout', true)
				.text(this.currentPage + " / " + numPages);
		} //end if(this.selection.length > pageSize)
		//Otherwise, don't build a widget and go to first (only) page
		else {
			this.currentPage = 1;
		}
	}

	/**
	 * Get the state of all inputs
	 */
	CINEMA_COMPONENTS.ImageSpread.prototype.getOptionsData = function() {
		return {
			pageSize: this.pageSizeNode.value,
			sortDimension: this.sortNode.value,
			sortOrderIsReversed: this.sortOrderNode.checked,
			sortOrderIsGrouped: this.groupsortingNode.checked,
			imageSize: this.imageSizeNode.value
		};
	}

	/**
	 * Set the state of all inputs
	 */
	CINEMA_COMPONENTS.ImageSpread.prototype.setOptionsData = function(dataObject) {
		d3.select(this.pageSizeNode).property("value", dataObject.pageSize);
		d3.select(this.sortNode).property("value", dataObject.sortDimension);
		d3.select(this.sortOrderNode).property("checked", dataObject.sortOrderIsReversed);
		d3.select(this.groupsortingNode).property("checked", dataObject.sortOrderIsGrouped);
		d3.select(this.imageSizeNode).property("value", dataObject.imageSize);
		d3.select(this.container).select('.controlPanel.imageSize .label')
			.text("Image Size: " + dataObject.imageSize + "px");
	}

	/**
	 * Given the number of pages needed and the currently selected page, return
	 * a list of objects represented the pageNav buttons to show
	 * objects are formatted like so:
	 * {text: [button_text],
	 * page: [pageNumber to link to],
	 * do_rebuild: [whether or not the pageNav widget should be rebuilt when this button is clicked]}
	 **/
	function getPageButtons(numPages, current) {
		//If there are 7 or fewer pages, create a widget with a button for each page ([1|2|3|4|5|6|7])
		if(numPages <= 7) {
			var pageData = [];
			for (var i = 0; i < numPages; i++)
				pageData.push({
					text: i + 1,
					page: i + 1,
					do_rebuild: false
				});
			return pageData;
		}
		//Otherwise, create a widget with buttons for navigating relative to selected page ([|<|<<|10|20|30|>>|>|])
		else {
			//step size is one order of magnitude below the total number of pages
			var stepSize = Math.pow(10, Math.round(Math.log10(numPages) - 1));
			var pageData = [];
			//Create buttons for selecting lower pages if current is not already one
			if(current != 1) {
				pageData.push({
					text: "|<",
					page: 1,
					do_rebuild: true
				});
				pageData.push({
					text: "<",
					page: current - 1,
					do_rebuild: true
				});
				var prevStep = current - stepSize >= 1 ? current - stepSize : current - 1;
				pageData.push({
					text: prevStep,
					page: prevStep,
					do_rebuild: true
				});
			}
			//Create button for currently selected page
			pageData.push({
				text: current,
				page: current,
				do_rebuild: false
			});
			//Create buttons for selecting higher pages if current is not already at the end
			if(current != numPages) {
				var nextStep = current + stepSize <= numPages ? current + stepSize : current + 1;
				pageData.push({
					text: nextStep,
					page: nextStep,
					do_rebuild: true
				});
				pageData.push({
					text: ">",
					page: current + 1,
					do_rebuild: true
				});
				pageData.push({
					text: ">|",
					page: numPages,
					do_rebuild: true
				});
			}
			return pageData;
		}
	}

	//Get if the given filetype is a valid image filetype
	function isValidFiletype(type) {
		if(!type)
			return false;
		var validFiletypes = ['JPG', 'JPEG', 'PNG', 'GIF', 'VTI', 'PDB', 'MOL2', 'TXT'];
		type = type.trimLeft().trimRight();
		var index = validFiletypes.indexOf(type.toUpperCase());

		return (index >= 0);
	}

	//Get the extension/filetype of the given path
	function getFileExtension(path) {
		return path ? path.substr(path.lastIndexOf('.') + 1).trimRight() : undefined;
	}

})();
