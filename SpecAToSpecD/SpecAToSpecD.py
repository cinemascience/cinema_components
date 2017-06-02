import json
import sys
import os
import errno
import csv
import copy
from shutil import copyfile

#Recursively generate results for all possible combinations of parameters
#Starts from the parameter at index, and uses values for the value of earlier parameters
#generate_results(0,{}) will generate ALL possible results for ALL parameters
def generate_results(index, values):
	global fieldnames
	global SPEC_A_JSON
	results = []
	for val in SPEC_A_JSON["arguments"][fieldnames[index]]["values"]:
		values[fieldnames[index]] = val
		if index == len(fieldnames)-1:
			#print values
			results.append(copy.copy(values))
		else:
			results += (generate_results(index+1,copy.copy(values)))
	return results

#Begin Main Threat

if len(sys.argv) != 3:
	print "Usage: python SpecAToSpecD path/to/info.json output_directory"
	exit()

PATH_TO_JSON = sys.argv[1]
OUTPUT_DIRECTORY = sys.argv[2]

#Verify paths
if not os.path.isfile(PATH_TO_JSON):
	print 'Could not find info.json: %s' % PATH_TO_JSON
	exit()

if os.path.exists(OUTPUT_DIRECTORY):
	print 'Output directory already exists! Please remove it or choose a different directory.'
	exit()

try:
	os.mkdir(OUTPUT_DIRECTORY)
except OSError as exc:
	if exc.errno != errno.EEXIST:
		raise
	pass

#Load info.json
with open(PATH_TO_JSON) as f:
	SPEC_A_JSON = json.load(f)

INPUT_DIRECTORY = os.path.dirname(PATH_TO_JSON)

#Get fieldnames (parameters) from JSON
fieldnames = []
for arg in SPEC_A_JSON["arguments"]:
	fieldnames.append(str(arg))

#Write csv and copy images
with open((OUTPUT_DIRECTORY)+'/info.csv', 'w+') as csvfile:
	writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
	writer.writeheader()

	NAME_PATTERN = str(SPEC_A_JSON["name_pattern"])
	EXTENSION = os.path.splitext(NAME_PATTERN)[1]

	#get results
	values = {}
	results = generate_results(0, {})

	i = 0
	for result in results:
		pattern = copy.copy(NAME_PATTERN)
		for dimension in result.iterkeys():
			pattern = pattern.replace('{'+dimension+'}',str(result[dimension]))
		#If an image for the result exists, copy the image to the output
		#and write a line to the csv
		if os.path.exists(INPUT_DIRECTORY+'/'+pattern):
			src = INPUT_DIRECTORY+'/'+pattern
			i += 1
			dst = OUTPUT_DIRECTORY+'/'+str(i)+str(EXTENSION)
			copyfile(src,dst)
			writer.writerow(result)

print "Done!"
