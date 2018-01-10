# CINEMA_COMPONENTS
## Version 2.3
A javascript library containing prebuilt components for viewing and querying Cinema SpecD databases.

**Requires D3v4**

## Components
### PcoordSVG
A component for viewing and browsing a database on a Parallel Coordinates Chart (rendered with SVG)
### PcoordCanvas
(Coming Soon!)
### Glyph
A component for viewing data on a Glyph Chart
### ImageSpread
A component for viewing image data for a set of data points
### Query
A component that provides an interface for defining a custom data point and querying the database for similar points.
### ScatterPlotSVG
A component for viewing data on a Scatter plot (rendered with SVG)
### ScatterPlotCanvas
(Coming Soon!)

## Usage
Below is a simple example of a webpage that uses a pcoordSVG component to control the display of an ImageSpread component
```html
<html>
<head>
	<!--Import D3-->
	<script src="lib/d3.min.js"></script>
	<!--Import Cinema Components Library-->
	<script src="CinemaComponents.min.js"></script>
	<!--Include Component's CSS-->
	<link rel='stylesheet' href='css/PcoordSVG.css'>
	<link rel='stylesheet' href='css/ImageSpread.css'>
</head>
<body>
	<!--The component will be placed inside container-->
	<div id="pcoord_container" style="width:500px;height:400px;"></div>
	<div id="spread_container" style="width:100%;height:400px;"></div>
	<script>
		var chart, spread;
		//First create a database
		var database = new CINEMA_COMPONENTS.Database('mydata.cdb',function() {
			//This callback function is called when the database has finished loading
			//Use it to create your components
			chart = new CINEMA_COMPONENTS.PcoordSVG(document.getElementByID('pcoord_container'), database);
			spread = new CINEMA_COMPONENTS.ImageSpread(document.getElementByID('spread_container'),database);

			//Using dispatch events, components can communicate with each other
			chart.dispatch.on('selectionchange',function(selection) {
				spread.setSelection(selection);
			});
		});
	</script>
</body>
</html>
```
Please see example files for more information: **example_pcoord.html**,
**example_query.html** and
**example_glyph.html**

## How to Build

The **CinemaComponents.min.js** file can be built with whatever minify-ing tool you prefer, but please be aware of the following rules when building:
* Database.js *must* be included before Component.js
* Component.js *must* be included before Glyph.js, Pcoord.js, ImageSpread.js, Query.js and ScatterPlot.js
* Pcoord.js *must* be included before PcoordSVG.js
* ScatterPlot.js *must* be included before ScatterPlotSVG.js

## Full Documentation Coming Soon

## Changelog
### Version 2.3
- Added ScatterPlotSVG Component
- Databases now verfiy that there are at least two dimensions when error-checking
### Version 2.2
- Databases now support extra axis ordering information (in axis_order.csv files)
- Added setAxisOrder to Pcoord Component
- Added dispatch 'axisorderchanged' to Pcoord Component
### Version 2.1
- Added ImageSpread and Query components (ported over from pcoord_viewer project)
- Added destroy() function to Component
### Version 2.0
- First release of this major rewrite
