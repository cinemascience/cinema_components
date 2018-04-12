FILES 	= Database.js Component.js Glyph.js ImageSpread.js Pcoord.js PcoordCanvas.js PcoordSVG.js Query.js ScatterPlot.js ScatterPlotCanvas.js ScatterPlotSVG.js
VERSION = 2.4
OUTPUT 	= CinmemaComponents.v$(VERSION).min.js

minify:
	cd src; minify $(FILES) --output ../$(OUTPUT)

clean:
	rm -f $(OUTPUT)
