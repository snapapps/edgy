function drawGraph(json, container) {
	var graphEl = d3.select(container),
        layout = cola.d3adaptor;
	
	// Taken from http://stackoverflow.com/a/122190/126977
	function clone(obj){
		if(obj == null || typeof(obj) != 'object')
			return obj;

		var temp = obj.constructor(); // changed

		for(var key in obj)
			temp[key] = clone(obj[key]);
		return temp;
	}
	
	// Transform NetworkX-formatted object to JSNetworkX graph-like object.
	function objectToGraph (data) {
		var multigraph = data.multigraph,
			directed = data.directed,
            nodeDisplayAttribute = data.nodeDisplayAttribute,
            edgeDisplayAttribute = data.edgeDisplayAttribute,
            layoutAlgorithm = data.layoutAlgorithm,
			mapping = [],
			graph, d, node, nodedata, link_data, source, target, edgedata;

		if(multigraph) {
			graph = new jsnx.MultiGraph();
		} else {
			graph = new jsnx.Graph();
		}

		if(directed) {
			graph = graph.toDirected();
		}

		if(data.graph) {
			for (var i = 0; i < data.graph.length; i++) {
				var k = data.graph[i], v = data.graph[i];
				graph.graph[k] = v;
			}
		}

		var c = 0;
		for (var i = 0; i < data.nodes.length; i++) {
			d = data.nodes[i];
			if(d.id === undefined) {
				node = c++;
			} else {
				node = d.id;
			}
			mapping.push(node);
			nodedata = clone(d);
			delete nodedata.id;
            
			if (nodedata.x || nodedata.y) {
				nodedata.fixed = true;
			}
			graph.addNode(node, nodedata);
		}

		for (var i = 0; i < data.links.length; i++) {
			d = data.links[i];
			link_data = clone(d);
			source = link_data.source;
			delete link_data.source;
			target = link_data.target;
			delete link_data.target;
			edgedata = link_data;
			graph.addEdge(mapping[source], mapping[target], edgedata);
		}

        graph.nodeDisplayAttribute = nodeDisplayAttribute || 'id';
        graph.edgeDisplayAttribute = edgeDisplayAttribute || 'label';

        switch (layoutAlgorithm) {
            case "force":
                layout = d3.layout.force;
                break;
            case "cola":
                layout = cola.d3adaptor;
                break;
            case "tree":
                layout = d3.layout.tree;
                break;
        }

		return graph;
	}

	function getNodeElementType(d) {
		if (d.data.__costume__)
			return "use";
		
		switch (d.data.shape) {
			case "circle":
				return "circle";
			case "ellipse":
				return "ellipse";
			default:
				return "rect";
		}
	}

	function updateNodeAppearance(node) {
		// If the current type of the node element is not what it should be (e.g.
		// the node had a costume added), fix that.
		var shape = getNodeElementType(node.datum());
		var shapeEl = node.select(shape);
		if (shapeEl.size() == 0) {
			node.selectAll(".node-shape").remove();
			shapeEl = node.insert(shape, "text").classed("node-shape", true);
		}

		// Reapply styles and attributes to reflect any changes (e.g. label
		// changed).
		shapeEl.style(LAYOUT_OPTS.nodeStyle);
		shapeEl.attr(LAYOUT_OPTS.nodeAttr);
	}

	function measureText(text) {
		var svg = graphEl.select("svg");
		var textEl = svg.append("text").text(text);
		var bounds = textEl.node().getBBox();
		textEl.remove();
		return bounds;
	}

	function findNodeElement(node) {
		return graphEl.selectAll(".node").filter(function(d) { return d.node === node; });
	}

	function findEdgeElement(edge) {
		var a = parseNode(edge.at(1)), b = parseNode(edge.at(2));
		return graphEl.selectAll(".edge").filter(function(d) {
			return ((d.edge[0] === a && d.edge[1] === b) || (!currentGraph.isDirected()) && (d.edge[0] === b && d.edge[1] === a));
		});
	}

	function getNodeLabel(d) {
		var attr = currentGraph.nodeDisplayAttribute;
		if (attr == '') {
			return '';
		}
		var val = d.data[attr];
		
		if (val !== undefined) {
			return val.toString();
		}
		
		return d.node.toString();
	}

	function getEdgeLabel(d) {
		var attr = currentGraph.edgeDisplayAttribute;
		if (attr == '') {
			return '';
		}
		var val = d.data[attr];

		if (val !== undefined) {
			return val.toString();
		}
		
		return (d.data.label || "").toString();
	}

    function edgyLayoutAlgorithm() {
        return layout();
    }

	var DEFAULT_NODE_COLOR = "white",
		DEFAULT_EDGE_COLOR = "black",
		DEFAULT_LABEL_COLOR = "black",
		SECONDARY_LABEL_COLOR = "lightgray",
		EDGE_WIDTH_FACTOR = 8,
		DEFAULT_LINK_DISTANCE = 60,
		LAYOUT_OPTS = {
			layout: edgyLayoutAlgorithm,
			element: graphEl.node(),
			withLabels: true,
			withEdgeLabels: true,
			layoutAttr: {
				linkDistance: function(d) {
					if (!d) {
						//WebCOLA does not support different link-distances for different nodes.
						return DEFAULT_LINK_DISTANCE;
					}
					var sr = d.source.data.scale || 1,
						tr = d.target.data.scale || 1;
					return DEFAULT_LINK_DISTANCE + (sr + tr);
				},
				charge: function(d) {
					var r = (d.data.scale || 1) * 8;
					return -r*r;
				},
				avoidOverlaps: true
			},
			nodeShape: function(d) {
				return this.ownerDocument.createElementNS(this.namespaceURI, getNodeElementType(d));
			},
			nodeStyle: {
				fill: function(d) {
					return d.data.color || DEFAULT_NODE_COLOR;
				},
				'stroke-width': function(d) {
					var width = d.data["stroke-width"];
					if (!width && width !== 0)
						width = 1;
					return width / (d.data.scale || 1);
				},
				stroke: function(d) {
					if (d.data.__costume)
						return undefined;
					return d.data.stroke || '#333333';
				}
			},
			nodeAttr: {
				width: function(d) {
					if (d.data.__costume__)
						return undefined;
					var dim = measureText(getNodeLabel(d));
					d.width = dim.width + 8;
					return dim.width + 8;
				},
				height: function(d) {
					if (d.data.__costume__)
						return undefined;
					var dim = measureText(getNodeLabel(d));
					d.height = dim.height + 8;
					return dim.height + 8;
				},
				transform: function(d) {
					var scale = (d.data.scale || 1);
					var transform = ['scale(', scale, ')'];
					if(!d.data.__costume__) {
						// No costume
						switch (getNodeElementType(d)) {
							case "circle":
							case "ellipse":
								break;
							default:
								// Adjust rectangle position.
								transform = transform.concat(['translate(', (-(d.width) / 2), ',', (-(d.height) / 2), ')']);
						}
					}
					return transform.join('');
				},
				r: function(d) {
					if (d.data.__costume__ || getNodeElementType(d) != "circle")
						return undefined;
					var dim = measureText(getNodeLabel(d));
					d.width = d.height = dim.width + 16;
					return (dim.width + 16) / 2;
				},
				rx: function(d) {
					if (d.data.__costume__ || getNodeElementType(d) != "ellipse")
						return undefined;
					var dim = measureText(getNodeLabel(d));
					d.width = dim.width + 16;
					return (dim.width + 16) / 2;
				},
				ry: function(d) {
					if (d.data.__costume__ || getNodeElementType(d) != "ellipse")
						return undefined;
					var dim = measureText(getNodeLabel(d));
					d.height = dim.height + 16;
					return (dim.height + 16) / 2;
				},
				"xlink:href": function(d) {
					if(d.data.__costume__) {
						// Display costume if one is set.
						return "#" + formatCostumeImageId(d.data.__costume__.patternNum);
					} else {
						return undefined;
					}
				}
			},
			edgeStyle: {
				fill: function(d) {
					if(d.data.__costume__) {
						// Display edge pattern if there one is set.
						return "url(#" + d.data.__costume__.patternId + ")";
					} else {
						return d.data.color || DEFAULT_EDGE_COLOR;
					}
				},
				'stroke-width': function(d) {
					if(d.data.__costume__) {
						// Needs to be doubled, for some reason.
						return d.data.__costume__.contents.height * 2;
					} else {
						return d.data.width * EDGE_WIDTH_FACTOR || EDGE_WIDTH_FACTOR;
					}
				},
			},
			edgeAttr: {
				transform: function(d) {
					if(d.data.__costume__) {
						return "scale(" + (d.data.width || 1) + ")";
					}
				}
			},
			edgeLen: function(d) {
				if(d.data.__costume__) {
					return 1 / (d.data.width || 1);
				} else {
					return 1;
				}
			},
			labelStyle: {
				fill: function (d) {
					var attr = currentGraph.nodeDisplayAttribute;
					if ((d.data[attr] == undefined) && (attr !== 'id')) {
						return d.data["label-color"] || SECONDARY_LABEL_COLOR;
					} else {
						return d.data["label-color"] || DEFAULT_LABEL_COLOR;
					}
				}
			},
			labelAttr: {
				transform: function(d) {
					return 'scale(' + (d.data.scale || 1) + ')';
				}
			},
			labels: function(d) {
				return getNodeLabel(d);
			},
			edgeLabelStyle: {
				fill: function(d) {
					return d.data["label-color"] || DEFAULT_LABEL_COLOR;
				}
			},
			edgeLabels: function(d) {
				return getEdgeLabel(d);
			},
			edgeOffset: function(d) {
				if (getNodeElementType(d.source) == "circle" &&
					getNodeElementType(d.target) == "circle")
					// If they're both circles, we can display digraphs better
					return [
						(d.source.data.scale || 1) * d.source.width / 2,
						(d.target.data.scale || 1) * d.target.height / 2
					];
				return [10, 10]; // This is the default
			},
			panZoom: {enabled: true}
		};

	var currentGraph = objectToGraph(JSON.parse(json));
	
	jsnx.draw(currentGraph, LAYOUT_OPTS, true);
    
    // Follow stored fixedness, x and y values in layout.
    jsnx.forEach(currentGraph.nodesIter(true), function(node) {
        var data = node[1];
        if(data.fixed) {
            data.__d3datum__.fixed |= 1;
        }

        if(data.x !== undefined) {
            data.__d3datum__.px = data.__d3datum__.x = data.x;
        }

        if(data.y !== undefined) {
            data.__d3datum__.px = data.__d3datum__.y = data.y;
        }
    });
}