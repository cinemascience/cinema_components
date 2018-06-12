FILES=Database.js Component.js Glyph.js ImageSpread.js Pcoord.js PcoordCanvas.js PcoordSVG.js Query.js ScatterPlot.js ScatterPlotCanvas.js ScatterPlotSVG.js
VERSION=$(shell cat version)
OUTPUT_PREFIX=CinemaComponents.v$(VERSION).min

minify:
	mkdir -p build
	cd src; cat $(FILES) | babel-minify > ../build/$(OUTPUT_PREFIX).js
	cat css/*.css > build/$(OUTPUT_PREFIX).css

build/cinemascience.github.io:
	cd build; git clone https://github.com/cinemascience/cinemascience.github.io.git

deploy: minify build/cinemascience.github.io
	cd build/cinemascience.github.io; git pull
	cp -f build/$(OUTPUT_PREFIX).* build/cinemascience.github.io/release
	cd build/cinemascience.github.io; git add .; git commit -m "Updated Cinema Components version $(VERSION)."; git push

clean:
	rm -rf build
