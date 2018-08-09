FILES=Database.js Component.js Glyph.js ImageSpread.js Pcoord.js PcoordCanvas.js PcoordSVG.js Query.js ScatterPlot.js ScatterPlotCanvas.js ScatterPlotSVG.js
BUILD_OPTS=$(shell if [ -e build_options.local ]; then echo build_options.local; else echo build_options; fi)
VERSION=$(shell grep version $(BUILD_OPTS) | sed -e 's/^version //')
MINIFIER=$(shell grep minifier $(BUILD_OPTS) | sed -e 's/^minifier //')
EXPLORER_DIR=$(shell grep explorer_dir $(BUILD_OPTS) | sed -e 's/^explorer_dir //')
OUTPUT_PREFIX=CinemaComponents.v$(VERSION)

full:
	mkdir -p build
	cd src; cat $(FILES) > ../build/$(OUTPUT_PREFIX).js
	cp build/$(OUTPUT_PREFIX).js build/$(OUTPUT_PREFIX).min.js
	cat css/*.css > build/$(OUTPUT_PREFIX).min.css

deploy/examples: full
	cp build/$(OUTPUT_PREFIX).js examples/lib/CinemaComponents.js
	cp build/$(OUTPUT_PREFIX).min.css examples/css/CinemaComponents.min.css

deploy/explorer: full
	cp build/$(OUTPUT_PREFIX).js $(EXPLORER_DIR)/test/CinemaComponents.js
	cp build/$(OUTPUT_PREFIX).min.css $(EXPLORER_DIR)/test/CinemaComponents.min.css

minify: full
	mkdir -p build
	cat build/$(OUTPUT_PREFIX).js | $(MINIFIER) > build/$(OUTPUT_PREFIX).min.js

build/cinemascience.github.io:
	cd build; git clone https://github.com/cinemascience/cinemascience.github.io.git

deploy: minify build/cinemascience.github.io
	cd build/cinemascience.github.io; git pull
	cp -f build/$(OUTPUT_PREFIX).* build/cinemascience.github.io/release
	cd build/cinemascience.github.io; git add .; git commit -m "Updated Cinema Components version $(VERSION)."; git push

clean:
	rm -rf build
