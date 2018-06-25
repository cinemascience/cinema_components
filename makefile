FILES=Database.js Component.js Glyph.js ImageSpread.js Pcoord.js PcoordCanvas.js PcoordSVG.js Query.js ScatterPlot.js ScatterPlotCanvas.js ScatterPlotSVG.js
VERSION=$(shell cat version)
OUTPUT_PREFIX=CinemaComponents.v$(VERSION)

full:
	mkdir -p build
	cd src; cat $(FILES) > ../build/$(OUTPUT_PREFIX).js
	cp build/$(OUTPUT_PREFIX).js build/$(OUTPUT_PREFIX).min.js
	cat css/*.css > build/$(OUTPUT_PREFIX).min.css

minify: full
	mkdir -p build
	cat build/$(OUTPUT_PREFIX).js | babel-minify > build/$(OUTPUT_PREFIX).min.js

build/cinemascience.github.io:
	cd build; git clone https://github.com/cinemascience/cinemascience.github.io.git

deploy: minify build/cinemascience.github.io
	cd build/cinemascience.github.io; git pull
	cp -f build/$(OUTPUT_PREFIX).* build/cinemascience.github.io/release
	cd build/cinemascience.github.io; git add .; git commit -m "Updated Cinema Components version $(VERSION)."; git push

clean:
	rm -rf build
