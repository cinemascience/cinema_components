#Parallel Coordinates Chart
##Version 1.11

###Usage

Please see **example.html** to see this in action.

####Creating a new chart
To create a new chart, simply call the constructor like so:
```javascript
	var chart = new ParallelCoordinatesChart(parent, pathToCSV, doneLoading, selectionChanged, mouseOverChanged, filter);
```
#####Arguments
* **parent**: A d3 selection of the container for the chart. The chart will be appended to this and will be made to fill the entire size of the parent. If you wish to use padding, margins or other layout techniques, it is recommended to wrap this parent in another container first.
* **pathToCSV**: The path to CSV file that the chart will use for its data.
* **doneLoading (optional)**: Done Loading callback function. See **callbacks** for more info.
* **selectionChanged (optional)**: Selection Changed callback function. See **callbacks** for more info.
* **mouseOverChanged (optional)**: Mouse-over Changed callback function. See **callbacks** for more info.
* **filter (optional)**: An array of dimensions to ignore when building the chart. Dimensions that are filtered out will still be accessible from results, but will not appear on the chart.

####Commonly-accessed fields
* **ParallelCoordinatesChart.results**: An array of all the results in the chart (as objects). Since most callbacks only provide an index, you will want to make use of this array to access the fields of a result.
Example:
```javascript
	function mouseOverChanged(index) {
		console.log('Moused over: ' + chart.results[index].name);
	}
```
* **ParallelCoordinatesChart.query**: An array of the indices of all currently selected results.
* **ParallelCoordinatesChart.dimensions**: An array of the dimensions used in the chart. (This will not include dimensions filtered out in the **filter** argument of the constructor).

####Callbacks
Creating and interacting with the chart will often call a number of callback methods that can be used to get information out of the chart and its selected results.
* **doneLoading**: This function is called when the chart has finished loading the csv file and has drawn the chart for the first time. Attempting to access fields in the chart before it has finished loading may lead to getting undefined values.
* **selectionChanged(query)**: This function is called whenever the selected results in the chart change. **query** is an array of the indices of all of the selected results.
* **mouseOverChanged(index, event)**: This function is called when a result in the chart is moused-over. **index** is the index of the moused-over result. **event** is the mouse event that triggered it. When a result is moused-off, this function is called again, but with **index** being **null**.

####Commonly-used functions
* **ParallelCoordinatesChart.updateSize()**: Redraw the chart to fit into the current size of its parent. This should be called whenever its parent may change size. If not, the chart will still fit inside the parent, but it will appear distorted.
* **ParallelCoordinatesChart.setHighlight(index)**: Highlight the path of the result represented by the given index in the chart. To un-set the highlight, call this again with **null** for **index**.

####Again, look at **example.html**. It will all make more sense then.

####Other things
#####To change the dataset used by the chart:
Simply create another chart by calling the constructor again, set to look at the new csv file. (Don't forget to remove the old chart from its parent, first)
```javascript
//This function can be called multiple times with different csv files.
//It will simply replace the current chart (all callbacks should work the same)
function load(pathToCSV) {
	d3.select('#svgContainer').html('');
	chart = new ParallelCoordinatesChart(d3.select('#svgContainer'),
										pathToCSV,
										doneLoading,
										onSelectionChange,
										updateInfoPane,
										filter);
}
```

#Changelog
###v1.11 (June 5, 2016)
- Fixed Brushes on NaN dimensions not resizing vertically
###v1.1 (June 2, 2016)
- Added support for NaN dimensions
###v1.0 (June 1, 2016)
- Initial


