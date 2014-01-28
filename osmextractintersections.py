"""Extract a JSON-formatted NetworkX-compatible graph from OpenStreetMap XML.

Contains only sufficiently relevant roads. If an edge exists in the graph,
then those two roads intersect.
"""

import xml.etree.cElementTree as ET
import networkx as nx
import networkx.readwrite.json_graph
import sys

tree = ET.parse(sys.argv[1])
root = tree.getroot()

nodes = {}
ways = {}

for child in root:
	if child.tag == 'node':
		id_ = child.attrib['id']
		tags = {node.attrib['k']: node.attrib['v'] for node in child
				if node.tag == 'tag'}
		nodes[id_] = ((float(child.attrib['lat']), float(child.attrib['lon'])), tags)
	elif child.tag == 'way':
		id_ = child.attrib['id']
		waynodes = [node.attrib['ref'] for node in child if node.tag == 'nd']
		tags = {node.attrib['k']: node.attrib['v'] for node in child
				if node.tag == 'tag'}
		if 'name' not in tags:
			continue
		ways[id_] = (waynodes, tags)

def is_relevant_highway(tags):
	return 'highway' in tags and tags['highway'] in {'motorway', 'trunk', 'primary', 'secondary', 'tertiary'}


intersecting_ways = set()

for id_a, a in ways.items():
	for id_b, b in ways.items():
		if a is b:
			continue
		if not is_relevant_highway(a[1]) or not is_relevant_highway(b[1]):
			continue
		if any(i in a[0] for i in b[0]):
			intersecting_ways.add(tuple(sorted((id_a, id_b))))

G = nx.Graph()

for a, b in intersecting_ways:
	nodes_a = ways[a][0]
	name_a = ways[a][1]['name']

	nodes_b = ways[b][0]
	name_b = ways[b][1]['name']

	if name_a != name_b:  # Guard against duplicates with different IDs.
		G.add_edge(name_a, name_b)

	# intersections = [x for x in nodes_a if x in nodes_b]
	# latlons = [nodes[x][0] for x in intersections]

	# print("%s/%s at %r" % (ways[a][1]['name'], ways[b][1]['name'], latlons))

Gp = G
# Gp = nx.line_graph(Gp)
# Gp = nx.relabel_nodes(Gp, lambda x: "%s/%s" % x)
nx.readwrite.json_graph.dump(Gp, sys.stdout)
