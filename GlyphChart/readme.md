# GlyphChart
## Version 1.0

## Usage
Please see **example.html** to see the component in action.

## Creating a new chart
To create a new chart, simply call the constructor like so:
```javascript
	var chart = new GlyphChart(parent, pathToCSV, filterRegex, callback);
```
#### Arguments
* **parent**: A d3 selection of the container for the chart. The chart will be appended to this and will be made to fill the entire size of the parent. If you wish to use padding, margins or other layout techniques, it is recommended to wrap this parent in another container first.
* **pathToCSV**: The path to CSV file that the chart will use for its data.
* **filterRegex (optional)**: Any dimensions whose names match with this regular expression will not be shown on the chart. Their information will still be available in individual results, however.
* **callback (optional)**: Done Loading callback function. Called when the chart has finished loading. Some functions of the chart may not work if called before the chart has finished loading.

## Commonly-accessed fields
* **GlyphChart.results**: An array of all the results in the chart (as objects). Since most callbacks only provide an index, you will want to make use of this array to access the fields of a result.
Example:
```javascript
	var readout = "First result: " + JSON.Stringify(chart.results[0]);
```
* **GlyphChart.dimensions**: An array of the dimensions used in the chart. (This will not include dimensions filtered out in the **filterRegex** argument of the constructor).
* **GlyphChart.allDimensions**: An array of all dimensions for hte data (including the ones filtered out)

## Commonly-used functions
* **GlyphChart.updateSize()**: Redraw the chart to fit into the current size of its parent. This should be called whenever its parent may change size. If not, the chart will still fit inside the parent, but it will appear distorted.
* **GlyphChart.setPath(index)**: Set the path displayed in the chart to show the result with the given index in **GlyphChart.results**
* **GlyphChart.isStringDimension(dimension)**: Returns a boolean value representing whether or not the given dimension is of type string (otherwise it is either of type float or integer).

## CSS
Use the following selectors to change the appearence of the chart
```css
/*The axis line and ticks*/
.glyphChart .axes path {}
/*The tick labels on the axes*/
.glyphChart .axes text {}
/*The text labels for each dimension*/
.glyphChart .labels .label {}
/*The glyph itself*/
.glyphChart .glyph {}
```

## Other things
### To change the dataset used by the chart:
Simply create another chart by calling the constructor again, set to look at the new csv file. (Don't forget to remove the old chart from its parent, first)
```javascript
//This function can be called multiple times with different csv files.
//It will simply replace the current chart (all callbacks should work the same)
function load(pathToCSV) {
	d3.select('#svgContainer').html('');
	chart = new GlyphChart(d3.select('#svgContainer'),pathToCSV,filterRegex,callback);
}
```

# Changelog
## v1.0 (December 18, 2017)
- Initial release