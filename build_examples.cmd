@ECHO OFF

REM Concatenates all source files together and deploys to
REM examples\lib\CinemaComponents.js

SETLOCAL
SET FILES=src\Database.js src\Component.js src\Glyph.js src\ImageSpread.js src\Pcoord.js src\PcoordCanvas.js src\PcoordSVG.js src\Query.js src\ScatterPlot.js src\ScatterPlotCanvas.js src\ScatterPlotSVG.js
SET BUILDPATH=examples\lib\CinemaComponents.js

REM Delete build if it already exists
if exist %BUILDPATH% (
    del %BUILDPATH%
)

REM Iterate through files and append to BUILDPATH
FOR %%i IN (%FILES%) DO (
    type %%i >> %BUILDPATH%
)