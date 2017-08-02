#Parallel Coordinates Chart
##Version 1.3.2

##Usage

Please see **example.html** to see this in action.
**reverseQueryExample.html** is more advanced but demonstrates some unique features such as setting the selection in the chart or finding results similiar to an arbitary result.
####NOTE: Version 1.2 (and up) requries d3 v4.
####Version 1.2 also changed how callbacks work and requires changes be made to any client programs

##Creating a new chart
To create a new chart, simply call the constructor like so:
```javascript
	var chart = new ParallelCoordinatesChart(parent, pathToCSV, filter, callback);
```
####Arguments
* **parent**: A d3 selection of the container for the chart. The chart will be appended to this and will be made to fill the entire size of the parent. If you wish to use padding, margins or other layout techniques, it is recommended to wrap this parent in another container first.
* **pathToCSV**: The path to CSV file that the chart will use for its data.
* **filter (optional)**: An array of dimensions to ignore when building the chart. Dimensions that are filtered out will still be accessible from results, but will not appear on the chart.
* **callback (optional)**: Done Loading callback function. Called when the chart has finished loading. Some functions of the chart may not work if called before the chart has finished loading.

##Commonly-accessed fields
* **ParallelCoordinatesChart.results**: An array of all the results in the chart (as objects). Since most callbacks only provide an index, you will want to make use of this array to access the fields of a result.
Example:
```javascript
	chart.dispatch.on("mouseover", function(index) {
		console.log('Moused over: ' + chart.results[index].name);
	});
```
* **ParallelCoordinatesChart.query**: An array of the indices of all currently selected results.
* **ParallelCoordinatesChart.dimensions**: An array of the dimensions used in the chart. (This will not include dimensions filtered out in the **filter** argument of the constructor).
* **ParallelCoordinatesChart.dispatch**: The emitter for various event triggers (see **Events**)
* **ParallelCoordinatesChart.overlayPathData**: An array of data for the overlay paths to be drawn on top of the chart. Overlay paths are paths of representing arbitrary data that can be drawn over the chart. Each object in the array is formatted like so:
```javascript
overlayPathData = [{data: dataToDrawPathFrom, style: styleAttributeForPath}]
```
The data does not need to include values for every dimension. Missing dimensions are simply skipped over when drawing the path.
* **ParallelCoordinatesChart.smoothPaths**: A boolean value indicating whether or not to smooth the paths drawn on the chart. If changing this live, the **redrawPaths** function should be called after changing it to update the chart.

##Events
Creating and interacting with the chart will often trigger events through the **dispatch**. The functions for these events can be set using the **on** function.
* **selectionChanged(query)**: 
```javascript
chart.dispatch.on("selectionchange",function(query){
	//handle event
});
```
This function is called whenever the selected results in the chart change. **query** is an array of the indices of all of the selected results.
* **mouseover (index, event)**:
```javascript
chart.dispatch.on("mouseover",function(index, event){
	//handle event
});
```
This function is called when a result in the chart is moused-over. **index** is the index of the moused-over result. **event** is the mouse event that triggered it. When a result is moused-off, this function is called again, but with **index** being **null**.
* **click (index, event)**:
```javascript
chart.dispatch.on("click", function(index, event){
	//handle event
});
```
This function is called when a result in the chart is clicked on. **index** is the index of the clicked-on result. **event**
is the mouse event that triggered it.

##Commonly-used functions
* **ParallelCoordinatesChart.updateSize()**: Redraw the chart to fit into the current size of its parent. This should be called whenever its parent may change size. If not, the chart will still fit inside the parent, but it will appear distorted.
* **ParallelCoordinatesChart.setHighlight(index)**: Highlight the path of the result represented by the given index in the chart. To un-set the highlight, call this again with **null** for **index**.
* **ParallelCoordinatesChart.setSelection(indices)**: Sets the selection in the chart to encapsulate all of the given results.
**indices** is an array of the indices of all the results to select.
* **ParallelCoordinatesChart.getSimiliar(data, threshold)**: Get all the results (as an array of indices) the are similiar to the given data. **data** does not need to include a value for every dimension. However every dimension that is included must be numeric. **threshold** is the maximum difference for results to be included. Difference is measured as the Manhattan distance where each dimension is normalized. i.e: The sum of the differences on each dimensions (scaled from 0 to 1.0).
* **ParallelCoordinatesChart.updateOverlayPaths(repressTransition)**: Update the overlay paths according to **overlayPathData**. Call this whenever overlayPathData is changed. If **repressTransition** is true, then the paths will snap instantly to their new location, otherwise, they will smoothly transition.

####Again, look at the examples. It will all make more sense then.

##CSS
Use the following selectors to select various parts of the chart
```css
/*The entire chart (svg)*/
.pCoordChart {}
/*All result paths (path)*/
.pCoordChart .resultPath {}
/*Result path with index X (path)*/
.pCoordChart .resultPath[index="X"] {}
/*Highlight path (path)*/
.pCoordChart .highlightPath {}
/*Default overlay path (path) (may be overriden in code)*/
.pCoordChart .overlayPath {}
/*Axis lines*/
.pCoordChart .axis line, .pCoordChart .axis path {}
/*Axis text*/
.pCoordChart .axis text {}
/*Brush*/
.pCoordChart .brush .extent {}
```

##Other things
###To change the dataset used by the chart:
Simply create another chart by calling the constructor again, set to look at the new csv file. (Don't forget to remove the old chart from its parent, first)
```javascript
//This function can be called multiple times with different csv files.
//It will simply replace the current chart (all callbacks should work the same)
function load(pathToCSV) {
	d3.select('#svgContainer').html('');
	chart = new ParallelCoordinatesChart(d3.select('#svgContainer'),
										pathToCSV,
										filter,
										callback);
}
```

#Changelog
##v1.3.2 (August 2, 2017)
- Added smoothPaths option
##v1.3.1 (June 9, 2017)
- Fixed getSimiliar algorithm returning incorrect results
- Added repressTransition option to updateOverlayPaths()
- Added getIncompletePath()
##v1.3 (June 7, 2017)
- Added setSelection function
- Added getSimiliar function
- Added overlay paths
- Added new example to demonstrate new features
##v1.2 (June 6, 2017)
- Updated to d3 v4
- selectionChanged and mouseOverChanged have been renamed to selectionchange and mouseover, and now work as events through **chart.dispatch**
##v1.11 (June 5, 2017)
- Fixed Brushes on NaN dimensions not resizing vertically
##v1.1 (June 2, 2017)
- Added support for NaN dimensions
##v1.0 (June 1, 2017)
- Initial


