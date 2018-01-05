# CINEMA_COMPONENTS
## Version 2.0
A javascript library containing prebuilt components for viewing and querying Cinema SpecD databases.

**Requires D3v4**

## Components
### PcoordSVG
A component for viewing and browsing a database on a Parallel Coordinates Chart (rendered with SVG)
### PcoordCanvas
(Coming Soon!)
### Glyph
A component for viewing data on a Glyph Chart

## Usage
Below is a simple example of a webpage containing a PcoordSVG component
```html
<html>
<head>
	<!--Import D3-->
	<script src="lib/d3.min.js"></script>
	<!--Import Cinema Components Library-->
	<script src="CinemaComponents.min.js"></script>
	<!--Include Component's CSS-->
	<link rel='stylesheet' href='css/PcoordSVG.css'>
</head>
<body>
	<!--The component will be placed inside container-->
	<div id="container" style="width:500px;height:400px;"></div>
	<script>
		var chart;
		//First create a database
		var database = new CINEMA_COMPONENTS.Database('mydata.cdb',function() {
			//This callback function is called when the database has finished loading
			//Use it to create your component
			chart = new CINEMA_COMPONENTS.PcoordSVG(document.getElementByID('container'), database);
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
* Component.js *must* be included before Glyph.js and Pcoord.js
* Pcoord.js *must* be included before PcoordSVG.js

## Full Documentation Coming Soon

## Changelog

### Version 2.0
- First release of this major rewrite
