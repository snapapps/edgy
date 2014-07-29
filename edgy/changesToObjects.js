// Since we're not supposed to be altering the original file too much, monkey
// patching is in order.

var redrawGraph;

(function() {
"use strict";

var graphEl = d3.select(document.body)
        .append('div')
        .attr('id', 'graph-display')
        .style({'position': 'absolute',
                '-moz-user-select': 'none',
                '-khtml-user-select': 'none',
                '-webkit-user-select': 'none',
                'user-select': 'none'}),
    currentGraph = null, // The current JSNetworkX graph to display.
    currentGraphSprite = null,
    hiddenCurrentGraph = null, // Last graph hidden.
    layout = null, // The d3.layout instance controlling the graph display.
    costumeIdMap = {},
    numEdgePatterns = 0,
    sliceStart,
    sliceRadius;

graphEl.on("mousedown", function() {
    world.hand.processMouseDown(d3.event);
    var morph = world.hand.morphAtPointer();
    // If we've started dragging a Snap! element, don't propagate the
    // mousedown to the graph display. (Elements being dragged are temporarily
    // borrowed by HandMorph.)
    //
    // FIXME: there are some minor edge cases which will cause sudden panning
    // if dragging a dialog box around the graph display (violently).
    if(world.hand.children.length || !(morph instanceof StageMorph)) {
        d3.event.stopPropagation();
    }
}).on("mousemove", function() {
    world.hand.processMouseMove(d3.event);
    var morph = world.hand.morphAtPointer();
    // Don't pan the graph display if we're dragging something.
    if(world.hand.children.length || !(morph instanceof StageMorph)) {
        d3.event.stopPropagation();
    }
}).on("mouseup", function() {
    world.hand.processMouseUp(d3.event);
}).on("contextmenu", function() {
    // Prevent the browser's context menu from coming up.
    d3.event.preventDefault();
});

function graphDisplayCostumesMenu() {
    var rcvr = currentGraphSprite,
        dict = {};
    dict["default"] = "default";
    dict["~"] = null;
    rcvr.costumes.asArray().forEach(function (costume) {
        dict[costume.name] = costume.name;
    });
    return dict;
};

// Monitor for new nodes and edges, and attach event handlers appropriately.
graphEl.on("DOMNodeInserted", function() {
    var node = d3.select(d3.event.relatedNode);
    if(node.classed("node")) {
        node.on("mouseup", function() {
            var d = node.datum();
            if(d3.event.ctrlKey || d3.event.button === 2)
            {
                var menu = new MenuMorph(this);

                if(!d.G.parent_graph) {
                    menu.addItem('delete', function () {
                        d.G.remove_node(d.node);
                    });
                }
                menu.addItem('set label', function () {
                    new DialogBoxMorph(null, function (label) {
                        d.data.label = autoNumericize(label);
                        node.select("text").node().textContent = label;
                        updateNodeDimensionsAndCostume(node);
                    }).prompt('Node label', (d.data.label || d.node).toString(), world);
                    world.worldCanvas.focus();
                });
                menu.addItem('set color', function () {
                    new DialogBoxMorph(null, function (color) {
                        d.data.color = autoNumericize(color);
                        node.select(".node-shape").style("fill", LAYOUT_OPTS.node_style.fill);
                    }).prompt('Node color', (d.data.color || DEFAULT_NODE_COLOR).toString(), world);
                    world.worldCanvas.focus();
                });
                menu.addItem('set scale', function () {
                    new DialogBoxMorph(null, function (scale) {
                        d.data.scale = autoNumericize(scale);
                        updateNodeDimensionsAndCostume(node);
                    }).prompt('Node scale', (d.data.scale || 1).toString(), world);
                    world.worldCanvas.focus();
                });
                menu.addItem('set costume', function () {
                    new DialogBoxMorph(null, function (costumename) {
                        currentGraphSprite.setNodeCostume(d.node, costumename);
                    }).prompt('Node costume',
                              d.data.__costume__ ? d.data.__costume__.name : "",
                              world,
                              null,
                              graphDisplayCostumesMenu,
                              true);
                    world.worldCanvas.focus();
                });
                menu.addLine();
                currentGraphSprite.allNodeAttributes().forEach(function(attr) {
                    menu.addItem('set "' + attr + '"', function () {
                        new DialogBoxMorph(null, function (value) {
                            currentGraphSprite.setNodeAttrib(attr, d.node, value)
                        }).prompt(attr,
                                  d.data[attr] !== undefined ? d.data[attr] : "",
                                  world);
                        world.worldCanvas.focus();
                    });
                });
                menu.popUpAtHand(world);
            } else {
                // Layout uses the fixed attribute for other things during
                // dragging, so it would get overwritten if we tried to set it
                // immediately. Wait until the layout is done dealing with
                // the dragging before fixing the node position.
                if(currentGraphSprite.parentThatIsA(IDE_Morph).useManualLayout) {
                    setTimeout(function() {
                        d.fixed = true;
                    }, 0);
                }
            }
        }).on("dblclick", function() {
            if(d3.event.button === 0) {
                var hats = currentGraphSprite.scripts.children.filter(function (morph) {
                    return morph.selector === 'receiveNodeClick';
                });
                hats.forEach(function (block) {
                    var stage = currentGraphSprite.parentThatIsA(StageMorph);
                    var proc = stage.threads.startProcess(block, stage.isThreadSafe);
                    proc.pushContext('doYield');
                    var uv = block.inputs()[0].evaluate();
                    // console.log(proc, uv);
                    proc.context.outerContext.variables.addVar(uv, node.datum().node);
                });
                d3.event.stopPropagation();
            }
        });
    } else if(node.classed("edge")) {
        node.on("mouseup", function() {
            if(d3.event.ctrlKey || d3.event.button === 2)
            {
                var menu = new MenuMorph(this);
                var d = node.datum();

                if(!d.G.parent_graph) {
                    menu.addItem('delete', function () {
                        d.G.remove_edges_from([d.edge]);
                    });
                }
                menu.addItem('set label', function () {
                    new DialogBoxMorph(null, function (label) {
                        d.data.label = autoNumericize(label);
                        node.select("text").node().textContent = label;
                    }).prompt('Edge label', (d.data.label || '').toString(), world);
                    world.worldCanvas.focus();
                });
                menu.addItem('set color', function () {
                    new DialogBoxMorph(null, function (color) {
                        d.data.color = autoNumericize(color);
                        node.select(".line").style("fill", LAYOUT_OPTS.edge_style.fill);
                    }).prompt('Edge color', (d.data.color || DEFAULT_EDGE_COLOR).toString(), world);
                    world.worldCanvas.focus();
                });
                menu.addItem('set width', function () {
                    new DialogBoxMorph(null, function (width) {
                        d.G.add_edge(d.edge[0], d.edge[1], {width: parseFloat(width)});
                    }).prompt('Edge width', (d.data.width || 1).toString(), world);
                    world.worldCanvas.focus();
                });
                menu.addItem('set costume', function () {
                    new DialogBoxMorph(null, function (costumename) {
                        currentGraphSprite.setEdgeCostume(new List(d.edge), costumename);
                    }).prompt('Edge costume',
                              d.data.__costume__ ? d.data.__costume__.name : "",
                              world,
                              null,
                              graphDisplayCostumesMenu,
                              true);
                    world.worldCanvas.focus();
                });
                menu.addLine();
               currentGraphSprite.allEdgeAttributes().forEach(function(attr) {
                    menu.addItem('set "' + attr + '"', function () {
                        new DialogBoxMorph(null, function (value) {
                            currentGraphSprite.setEdgeAttrib(attr, new List(d.edge), value)
                        }).prompt(attr,
                                  d.data[attr] !== undefined ? d.data[attr] : "",
                                  world);
                        world.worldCanvas.focus();
                    });
                });
                menu.popUpAtHand(world);
                d3.event.stopPropagation();
            }
        });

        // Prevent panning of the graph if we've right clicked on an edge.
        node.on("mousedown", function() {
            if(d3.event.ctrlKey || d3.event.button === 2)
            {
                d3.event.stopPropagation();
            }
        });
    }
});

function updateGraphDimensions(stage) {
    // console.log("resizing graph element to %dx%d", stage.width(), stage.height());
    graphEl.style({
        top: stage.top() + "px",
        left: stage.left() + "px",
        width: stage.width() + "px",
        height: stage.height() + "px"
    });
    graphEl.select("svg")
        .attr("width", stage.width())
        .attr("height", stage.height());
    if(layout) // Make sure the layout has been initialized.
    {
        layout.size([stage.width(), stage.height()]);
        layout.resume(); // Reflow the graph.
    }
}

function getNodeElementType(d)
{
    return d.data.__costume__ ? "use" : "rect";
}

function updateNodeDimensionsAndCostume(node) {
    // If the current type of the node element is not what it should be (e.g.
    // the node had a costume added), fix that.
	var shape = getNodeElementType(node.datum());
    var shapeEl = node.select(shape);
    if (shapeEl.size() == 0)
    {
        node.selectAll(".node-shape").remove();
        shapeEl = node.insert(shape, "text").classed("node-shape", true);
    }

    // Reapply styles and attributes to reflect any changes (e.g. label
    // changed).
    shapeEl.style(LAYOUT_OPTS.node_style);
    shapeEl.attr(LAYOUT_OPTS.node_attr);
}

function svgTextDimensions(text)
{
	var svgEl = graphEl.select("svg");
	var appendedText = svgEl.append("text");
	var appendedNode = appendedText.node();
	appendedNode.textContent = text;
	var retnVal = appendedNode.getBBox();
	appendedText.remove();
	return retnVal;
}

var DEFAULT_NODE_COLOR = "white",
    DEFAULT_EDGE_COLOR = "black",
    DEFAULT_LABEL_COLOR = "black",
    EDGE_WIDTH_FACTOR = 8,
    DEFAULT_LINK_DISTANCE = 60,
    LAYOUT_OPTS = {
        layout: function () {
			return edgyLayoutAlgorithm();  /* See changesToGui.js... change it if you want! */
		},
        element: graphEl.node(),
        with_labels: true,
        with_edge_labels: true,
        layout_attr: {
            linkDistance: function(d) {
				if (!d)
				{
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
        node_shape: function(d) {
            return this.ownerDocument.createElementNS(this.namespaceURI, getNodeElementType(d));
        },
        node_style: {
            fill: function(d) {
                return d.data.color || DEFAULT_NODE_COLOR;
            },
            'stroke-width': function(d) {
                return 1 / (d.data.scale || 1);
            },
            stroke: function(d) {
                return d.data.__costume ? undefined : '#333333';
            }
        },
        node_attr: {
			width: function(d) {
                if (d.data.__costume__)
                    return undefined;
				var dim = svgTextDimensions(d.data.label || d.node);
				d.width = dim.width + 16;
				return dim.width + 8;
			},
			height: function(d) {
                if (d.data.__costume__)
                    return undefined;
				var dim = svgTextDimensions(d.data.label || d.node);
				d.height = dim.height + 16;
				return dim.height + 8;
			},
			transform: function(d) {
				var dim = svgTextDimensions(d.data.label || d.node);
				var scale = (d.data.scale || 1);
                var transform = ['scale(', scale, ')'];
                if(!d.data.__costume__) {
                    // No costume, adjust rectangle position.
                    transform = transform.concat(['translate(', (-(dim.width + 8) / 2), ',', (-(dim.height + 8) / 2), ')']);
                }
                return transform.join('');
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
        edge_style: {
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
        edge_attr: {
            transform: function(d) {
                if(d.data.__costume__) {
                    return "scale(" + (d.data.width || 1) + ")";
                }
            }
        },
        edge_len: function(d) {
            if(d.data.__costume__) {
                return 1 / (d.data.width || 1);
            } else {
                return 1;
            }
        },
        label_style: {fill: DEFAULT_LABEL_COLOR},
        label_attr: {
			transform: function(d) {
				return 'scale(' + (d.data.scale || 1) + ')';
			}
        },
        labels: function(d) {
            if(d.data.label !== undefined) {
                return d.data.label.toString();
            } else {
                return d.node.toString();
            }
        },
        edge_label_style: {fill: DEFAULT_LABEL_COLOR},
        edge_labels: function(d) {
            if(d.data.label !== undefined) {
                return d.data.label.toString();
            } else {
                return '';
            }
        },
        pan_zoom: {enabled: true}
    };

redrawGraph = function() {
    // console.log("redrawing graph")
    layout = jsnx.draw(currentGraph, LAYOUT_OPTS, true);

    if(layout.flowLayout && window.ide_ && window.ide_.useDownwardEdgeConstraint) {
        layout.flowLayout("y", DEFAULT_LINK_DISTANCE);
        layout.start(10, 15, 20);
    }

    // Calling jsnx.draw() will purge the graph container element, so we need
    // to re-add the edge patterns regardless of whether they have changed.
    for(var costumeId in costumeIdMap) {
        if(costumeIdMap.hasOwnProperty(costumeId)) {
            var costume = costumeIdMap[costumeId];
            addEdgePattern(costume.patternNum, costume.contents);
        }
    }
}


function setGraphToDisplay (G) {
    // Remove the JSNetworkX mutator bindings from the current graph, so we
    // don't get mysterious slowdowns from unbound graphs floating around and
    // being laid out in the background.
    if(currentGraph) {
        jsnx.unbind(currentGraph, true);
    }
    if(hiddenCurrentGraph) {
        jsnx.unbind(hiddenCurrentGraph, true);
    }
    if(layout) {
        layout.stop();
    }
    currentGraph = G;
    redrawGraph();
}

StageMorph.prototype.changed = (function changed (oldChanged) {
    var graphNeedsRedraw = true;
    return function ()
    {
        // console.log("stage changed");
        var result = oldChanged.call(this);
        // HACK: work around spontaneous resizing due to transient StageMorphs
        // being created for e.g. loading blocks and calling changed()
        if(this.parent !== null)
        {
            updateGraphDimensions(this);
            if(graphNeedsRedraw)
            {
                redrawGraph();
                graphNeedsRedraw = false;
            }
        }
        return result;
    };
}(StageMorph.prototype.changed));

StageMorph.prototype.userMenu = (function changed (oldUserMenu) {
    return function ()
    {
        var ide = this.parentThatIsA(IDE_Morph),
            menu = new MenuMorph(this),
            myself = this,
            world = this.world();

        if(!currentGraph.parent_graph && !hiddenCurrentGraph && currentGraphSprite) {
            menu.addItem("add node", function () {
                new DialogBoxMorph(null, function (name) {
                    currentGraph.add_node(parseNode(name));
                }).prompt('Node name', '', world);
                world.worldCanvas.focus();
            });

            menu.addItem("add edge", function () {
                new DialogBoxMorph(null, function (start) {
                    // HACK: work around not being able to give focus to the
                    // new DialogBoxMorph while the previous one still exists.
                    setTimeout(function() {
                        new DialogBoxMorph(null, function (end) {
                            currentGraph.add_edge(parseNode(start), parseNode(end));
                        }).prompt('End node', '', world);
                    }, 0);
                }).prompt('Start node', '', world);
                world.worldCanvas.focus();
            });
        }

        menu.addItem("export to file", function () {
            var submenu = new MenuMorph(myself);
            submenu.addItem("JSON", function() {
                var data = JSON.stringify(graphToObject(currentGraph)),
                    link = document.createElement('a');

                link.setAttribute('href', 'data:application/json,' + encodeURIComponent(data));
                link.setAttribute('download', (myself.parentThatIsA(IDE_Morph).projectName || 'project') + '.json');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
            submenu.addItem("comma-separated adjacency matrix", function() {
                var G = currentGraph,
                    nodes = G.nodes(),
                    header = [""].concat(nodes),
                    data = [header];

                for (var i = 0; i < nodes.length; i++) {
                    var row = [nodes[i]];
                    for (var j = 0; j < nodes.length; j++) {
                        if(G.has_edge(nodes[i], nodes[j])) {
                            var label = G.edge.get(nodes[i]).get(nodes[j]).label;
                            if(label) {
                                row.push(label);
                            } else {
                                row.push(1);
                            }
                        } else {
                            row.push("");
                        }
                    }
                    data.push(row);
                }

                var csv = CSV.arrayToCsv(data);

                var link = document.createElement('a');

                link.setAttribute('href', 'data:text/csv,' + encodeURIComponent(csv));
                link.setAttribute('download', (myself.parentThatIsA(IDE_Morph).projectName || 'project') + '.csv');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
            submenu.addItem("DOT format", function() {
                var G = currentGraph,
                    edgeout = "",
                    graphtype = jsnx.is_directed(G) ? "digraph" : "graph",
                    edgeseparator = jsnx.is_directed(G) ? "->" : "--";

                function formatID(x) { return '"' + x.toString().replace('"', '\\"') + '"'; }
                function formatAttrs(attrs) {
                    var output = [];
                    for(var k in attrs) {
                        if(attrs.hasOwnProperty(k)) {
                            output.push([k, "=", attrs[k]].join(""));
                        }
                    }
                    if(output.length > 0) {
                        return "[" + output.join(",") + "]";
                    } else {
                        return "";
                    }
                }

                var nodeout = jsnx.toArray(jsnx.map(G.nodes_iter(true), function(x) {
                    var node = x[0],
                        data = x[1],
                        dotattrs = {};
                    for(var k in data) {
                        if(data.hasOwnProperty(k)) {
                            // We don't really have an option for radius
                            // unless we force circular nodes and dot will
                            // autosize the nodes anyway, so don't handle it.
                            //
                            // label is handled implicitly
                            if(k === "__d3datum__" || k === "__costume__") {
                                continue
                            } else if(k === "color") {
                                dotattrs["style"] = "filled";
                                dotattrs["fillcolor"] = formatID(data[k]);
                            } else {
                                dotattrs[formatID(k)] = formatID(data[k]);
                            }
                        }
                    }
                    return [formatID(node), " ", formatAttrs(dotattrs),
                            ";"].join("");
                })).join("\n");

                var edgeout = jsnx.toArray(jsnx.map(G.edges_iter(true), function(x) {
                    var a = x[0],
                        b = x[1],
                        data = x[2],
                        dotattrs = {};
                    for(var k in data) {
                        if(data.hasOwnProperty(k)) {
                            // label and color are handled implicitly
                            if(k === "__d3datum__" || k === "__costume__") {
                                continue
                            } else if(k === "width") {
                                dotattrs["penwidth"] = formatID(data[k]);
                            } else {
                                dotattrs[formatID(k)] = formatID(data[k]);
                            }
                        }
                    }
                    return [formatID(a), " ", edgeseparator, " ",
                            formatID(b), formatAttrs(dotattrs),
                            ";"].join("");
                })).join("\n");

                var dot = [graphtype, " {\n", nodeout, "\n\n", edgeout, "\n}\n"].join("");

                var link = document.createElement('a');

                link.setAttribute('href', 'data:text/plain,' + encodeURIComponent(dot));
                link.setAttribute('download', (myself.parentThatIsA(IDE_Morph).projectName || 'project') + '.dot');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
            submenu.popUpAtHand(world);
        });

        menu.addItem("import from file", function () {
            var inp = document.createElement('input');
            inp.type = 'file';
            inp.style.color = "transparent";
            inp.style.backgroundColor = "transparent";
            inp.style.border = "none";
            inp.style.outline = "none";
            inp.style.position = "absolute";
            inp.style.top = "0px";
            inp.style.left = "0px";
            inp.style.width = "0px";
            inp.style.height = "0px";
            inp.addEventListener(
                "change",
                function () {
                    document.body.removeChild(inp);
                    var frd = new FileReader();
                    var s = currentGraphSprite;
                    frd.onloadend = function(e) {
                        // console.log(e);
                        try {
                            s.loadGraphFromString(e.target.result);
                        } catch(e) {
                            ide.showMessage("Error loading file: " + e.message);
                        }
                    }
                    // console.log(inp.files);
                    for (var i = 0; i < inp.files.length; i += 1) {
                        frd.readAsText(inp.files[i]);
                    }
                },
                false
            );
            document.body.appendChild(inp);
            inp.click();
        });

        return menu;
    };
}(StageMorph.prototype.userMenu));

function serializeAttributes(serializer) {
    return this.reduce(function (result, name) {
        var val = serializer.format('<attribute name="@"/>', name);
        return result + val;
    }, '');
}

StageMorph.prototype.init = (function init (oldInit) {
    return function (globals)
    {
        this.nodeAttributes = [];
        this.nodeAttributes.toXML = serializeAttributes;
        this.edgeAttributes = [];
        this.edgeAttributes.toXML = serializeAttributes;
        return oldInit.call(this, globals);
    };
}(StageMorph.prototype.init));


SpriteMorph.prototype.init = (function init (oldInit) {
    return function (globals)
    {
        this.G = new jsnx.Graph();
        if(currentGraph === null) {
            setGraphToDisplay(this.G);
            currentGraphSprite = this;
        }
        this.nodeAttributes = [];
        this.nodeAttributes.toXML = serializeAttributes;
        this.edgeAttributes = [];
        this.edgeAttributes.toXML = serializeAttributes;
        var retval = oldInit.call(this, globals);

        this.name = localize('Graph');

		this.isDraggable = false;
        return retval;
    };
}(SpriteMorph.prototype.init));

// Stub this out to hide the actual sprite on the stage.
SpriteMorph.prototype.drawOn = function() {}

SpriteMorph.prototype.loadCostumesAsPatterns = function() {
    this.costumes.asArray().forEach(loadCostumeAsEdgePattern);
}

StageMorph.prototype.maxVisibleNodesChanged = SpriteMorph.prototype.maxVisibleNodesChanged = function(num) {
    if(hiddenCurrentGraph &&
       num >= hiddenCurrentGraph.number_of_nodes()) {
        try {
            this.setGraphToDisplay2(hiddenCurrentGraph);
        } catch(e) {
            this.parentThatIsA(IDE_Morph).showMessage(e.message);
        }
        hiddenCurrentGraph = null;
    } else if (currentGraph.number_of_nodes() > num) {
        hiddenCurrentGraph = currentGraph;
        justHideGraph();
    }
}

function formatCostumeImageId(name) {
    return "costume-" + name;
}

function formatEdgePatternId(name) {
    return "edgepattern-" + name;
}

function addEdgePattern(name, canvas) {
    // Make the edge pattern element. We're using SVG's pattern support to
    // make the fancy tiled edge patterns work.
    var costumeId = formatCostumeImageId(name),
        patternId = formatEdgePatternId(name),
        image = graphEl.select("#" + costumeId),
        pattern = graphEl.select("#" + patternId);
    if(pattern.empty()) {
        var defs = graphEl.select("svg").insert("defs", ":first-child");
        image = defs.append("image");
        var pattern = defs.append("pattern")
            .attr({
                id: patternId,
                patternUnits: "userSpaceOnUse",
            });
        pattern.append("use").attr({"xlink:href": "#" + costumeId});
    }

    pattern.attr({
        width: canvas.width,
        height: canvas.height
    });
    image.attr({
        id: costumeId,
        width: canvas.width,
        height: canvas.height,
        // Compensate for image origin offset.
        x: -canvas.width/2,
        y: -canvas.height/2,
        "xlink:href": canvas.toDataURL()
    });
    // Compensate for pattern bounding box.
    pattern.select("use").attr("transform", ["translate(", canvas.width/2, " ", 0, ")"].join(""));
    return patternId;
}

function loadCostumeAsEdgePattern(costume) {
    // numEdgePatterns might be modified later, so save it here if we use the
    // loaded callback.
    var num = numEdgePatterns, costumeId;
    numEdgePatterns++;
    if(costume.loaded === true) {
        costumeId = addEdgePattern(num, costume.contents);
    } else {
        costume.loaded = (function loaded(oldLoaded) {
            return function() {
                addEdgePattern(num, costume.contents);
                return oldLoaded.call(costume);
            }
        }(costume.loaded));
        var costumeId = formatEdgePatternId(num);
    }
    costume.patternId = costumeId;
    costume.patternNum = num;
    costumeIdMap[costumeId] = costume;
    return costumeId;
}

SpriteMorph.prototype.addCostume = (function addCostume(oldAddCostume) {
    return function(costume) {
        loadCostumeAsEdgePattern(costume);
        return oldAddCostume.call(this, costume);
    };
}(SpriteMorph.prototype.addCostume));

Costume.prototype.edit = (function edit(oldEdit) {
    return function (aWorld, anIDE, isnew, oncancel, onsubmit) {
        var myself = this;
        function newonsubmit() {
            if(myself.patternNum !== undefined) {
                addEdgePattern(myself.patternNum, myself.contents);
            }

            if(onsubmit) {
                onsubmit();
            }
        }
        return oldEdit.call(this, aWorld, anIDE, isnew, oncancel, newonsubmit);
    };
}(Costume.prototype.edit));

function autoNumericize(x) {
    if(isNumeric(x)) {
        return parseFloat(x);
    }

    return x;
}

function parseNode(node) {
    return autoNumericize(node);
}

// Graph block bindings

SpriteMorph.prototype.newGraph = function() {
    this.setGraph(jsnx.Graph());
};

SpriteMorph.prototype.newDiGraph = function() {
    this.setGraph(jsnx.DiGraph());
};

function formatTooManyNodesMessage(n, max) {
    return "Too many nodes to display (" + n + ", maximum is " + max + ")." +
           "\nConsider increasing the limit under Settings > Maximum " +
           "visible nodes or displaying a subgraph.";
}

StageMorph.prototype.setGraphToDisplay2 = SpriteMorph.prototype.setGraphToDisplay2 = function(G) {
    var ide = this.parentThatIsA(IDE_Morph),
        maxVisibleNodes = DEFAULT_MAX_VISIBLE_NODES;
    if(ide) {
        maxVisibleNodes = ide.maxVisibleNodes;
    }

    if(G.number_of_nodes() <= maxVisibleNodes) {
        setGraphToDisplay(G);
        currentGraphSprite = this;
        hiddenCurrentGraph = null;
    } else {
        hiddenCurrentGraph = G;
        var msg = formatTooManyNodesMessage(G.number_of_nodes(), maxVisibleNodes);
        if(ide) {
            throw new Error(msg);
        } else {
            // Argh. We don't have a parent IDE_Morph, because we're doing
            // loading or something.
            ide_.showMessage(msg);
        }
    }
};

SpriteMorph.prototype.setActiveGraph = function() {
    this.setGraphToDisplay2(this.G);
};

SpriteMorph.prototype.showGraphSlice = function(start, radius) {
    var start = parseNode(start),
        G;

    if(!this.G.has_node(start)) {
        this.setGraphToDisplay2(new this.G.constructor())
        return;
    }

    if(this.G.is_directed())
    {
        var distancesA = jsnx.single_source_shortest_path_length(this.G, start, radius);
        this.G.reverse(false);
        var distancesB = jsnx.single_source_shortest_path_length(this.G, start, radius);
        this.G.reverse(false);
        G = this.G.subgraph(distancesA.keys().concat(distancesB.keys()));
    }
    else
    {
        var distances = jsnx.single_source_shortest_path_length(this.G, start, radius);
        G = this.G.subgraph(distances.keys());
    }

    if(currentGraph.parent_graph === this.G) {
        currentGraph.add_nodes_from(G);
        currentGraph.add_edges_from(G.edges(true, null));
        // Delete nodes from currentGraph not in G.
        currentGraph.remove_nodes_from(currentGraph.nodes().filter(function(n) {
            return !G.has_node(n);
        }));
        // Delete edges from currentGraph not in G.
        currentGraph.remove_edges_from(currentGraph.edges().filter(function(e) {
            return !G.has_edge(e[0], e[1]);
        }));
    } else {
        G.parent_graph = this.G;
        this.setGraphToDisplay2(G);
    }
    sliceStart = start;
    sliceRadius = radius;
};

function justHideGraph() {
    setGraphToDisplay(jsnx.Graph());
    currentGraphSprite = null;
}

SpriteMorph.prototype.isActiveGraph = function() {
    return currentGraph === this.G || currentGraph.parent_graph === this.G || hiddenCurrentGraph === this.G;
};

SpriteMorph.prototype.resumeLayout = function() {
    if(this.isActiveGraph()) {
        layout.resume();
    }
}

SpriteMorph.prototype.hideActiveGraph = function() {
    if(this.isActiveGraph()) {
        justHideGraph();
    }
};

SpriteMorph.prototype.clearGraph = function() {
    this.G.clear();
    if(currentGraph.parent_graph === this.G) {
        this.setActiveGraph();
    }
};

SpriteMorph.prototype.numberOfNodes = function () {
    return this.G.number_of_nodes();
};

SpriteMorph.prototype.numberOfEdges = function () {
    return this.G.number_of_edges();
};

SpriteMorph.prototype.addNode = function(nodes) {
    var ide = this.parentThatIsA(IDE_Morph),
        totalNodes = this.G.number_of_nodes() + nodes.length();
    if(totalNodes > ide.maxVisibleNodes && this.G === currentGraph) {
        // Too many nodes. Hide the graph and throw up a message.
        hiddenCurrentGraph = this.G;
        this.hideActiveGraph();
        ide.showMessage(formatTooManyNodesMessage(totalNodes,
                                                  ide.maxVisibleNodes));
    }
    this.G.add_nodes_from(nodes.asArray().map(parseNode));
    // No need to update the slice, as adding nodes can never update a slice
    // due to not being connected.
};

SpriteMorph.prototype.removeNode = function(node) {
    this.G.remove_node(parseNode(node));
    if(currentGraph.parent_graph === this.G) {
        if(currentGraph.has_node(node)) {
            this.showGraphSlice(sliceStart, sliceRadius);
        }
    }
};

SpriteMorph.prototype.addEdge = function(edges) {
    edges = edges.asArray();
    this.G.add_edges_from(edges.map(function(x) { return x.asArray().map(parseNode); }));
    if(currentGraph.parent_graph === this.G) {
        this.showGraphSlice(sliceStart, sliceRadius);
    }
};

SpriteMorph.prototype.removeEdge = function(edge) {
    var a = parseNode(edge.at(1)), b = parseNode(edge.at(2));
    this.G.remove_edge(a, b);
    if(currentGraph.parent_graph === this.G) {
        if(currentGraph.has_node(a) || currentGraph.has_node(b)) {
            this.showGraphSlice(sliceStart, sliceRadius);
        }
    }
};

SpriteMorph.prototype.getNeighbors = function(node) {
    return new List(this.G.neighbors(parseNode(node)));
};

SpriteMorph.prototype.setNodeAttrib = function(attrib, node, val) {
    node = parseNode(node);
    if(this.G.has_node(node)) {
        // For consistency's sake, we use autoNumericize() to normalize
        // attribute values since Snap's UI does not distinguish between the
        // number 1 and the string "1".
        if(attrib === "color" || attrib === "label" || attrib === "scale") {
            var data = {};
            data[attrib] = autoNumericize(val);
            this.G.add_node(node, data);
            if(this.G === currentGraph.parent_graph) {
                currentGraph.add_node(node, data);
            }
        } else {
            this.G.node.get(node)[attrib] = autoNumericize(val);
        }

        // HACK: work around JSNetworkX bug with not updating labels.
        if(attrib === "label" && this.isActiveGraph()) {
            var nodes = graphEl.selectAll(".node");
            nodes.each(function(d, i) {
                if(d.node === node) {
                    var nodeSelection = d3.select(nodes[0][i]);
                    var textEl = nodeSelection.select("text");
                    textEl.node().textContent = val.toString();
                    updateNodeDimensionsAndCostume(nodeSelection);
                }
            });
        }
    }
};

SpriteMorph.prototype.getNodeAttrib = function(attrib, node) {
    node = parseNode(node);
    if(this.G.has_node(node)) {
        var val = this.G.node.get(node)[attrib];
    } else {
        throw new Error("Node '" + node.toString() + "' does not exist.")
    }
    // Can't return undefined, since it is special to Snap, and will cause an
    // infinite loop.
    if(val === undefined) {
        if(attrib === "color")
            return DEFAULT_NODE_COLOR;
        if(attrib === "label")
            return node.toString();
        if(attrib === "scale")
            return 1;

        throw new Error("Undefined attribute " + attrib.toString() + " on node " + node);
    } else {
        return val;
    }
};

SpriteMorph.prototype.getNodeAttribDict = function(node) {
    var myself = this;
    var attribs = this.allNodeAttributes().concat(["color", "label", "scale"]);
    return new Map(attribs.map(function(attr) {
        return [attr, myself.getNodeAttrib(attr, node)];
    }));
};

SpriteMorph.prototype.setNodeAttribsFromDict = function(node, dict) {
    var myself = this;
    if(!this.hasNode(node)) {
        this.addNode(new List([node]));
    }
    dict.forEach(function(v, k) {
        myself.setNodeAttrib(k, node, v);
    });
};

SpriteMorph.prototype.setEdgeAttrib = function(attrib, edge, val) {
    var a = parseNode(edge.at(1)), b = parseNode(edge.at(2));
    if(this.G.has_edge(a, b)) {
        // For consistency's sake, we use autoNumericize() to normalize
        // attribute values since Snap's UI does not distinguish between the
        // number 1 and the string "1".
        if(attrib === "color" || attrib === "label" || attrib === "scale") {
            var data = {};
            data[attrib] = autoNumericize(val);
            this.G.add_edge(a, b, data);
            if(this.G === currentGraph.parent_graph) {
                currentGraph.add_edge(a, b, data);
            }
        } else {
            this.G.edge.get(a).get(b)[attrib] = autoNumericize(val);
        }

        // HACK: work around JSNetworkX bug with not updating labels.
        if(attrib === "label" && this.isActiveGraph()) {
            var edges = graphEl.selectAll(".edge");
            edges.each(function(d, i) {
                if(d.edge[0] === a && d.edge[1] === b) {
                    var textEl = d3.select(edges[0][i]).select("text");
                    textEl.node().textContent = val.toString();
                }
            });
        }
    }
};

SpriteMorph.prototype.getEdgeAttrib = function(attrib, edge) {
    var a = parseNode(edge.at(1)),
        b = parseNode(edge.at(2));

    if(this.G.has_edge(a, b)) {
        var val = this.G.adj.get(a).get(b)[attrib];
    } else {
        throw new Error(["Edge (", a.toString(), ",", b.toString(), ") does not exist."].join(""));
    }
    // Can't return undefined, since it is special to Snap, and will cause an
    // infinite loop.
    if(val === undefined) {
        if(attrib === "color")
            return DEFAULT_EDGE_COLOR;
        if(attrib === "label")
            return "";
        if(attrib === "width")
            return 1; // Width is normalized to 1; multiplied with EDGE_WIDTH_FACTOR.

        throw new Error("Undefined attribute " + attrib.toString() + " on edge (" + a + ", " + b + ")");
    } else {
        return val;
    }
};

SpriteMorph.prototype.getEdgeAttribDict = function(node) {
    var myself = this;
    var attribs = this.allEdgeAttributes().concat(["color", "label", "width"]);
    return new Map(attribs.map(function(attr) {
        return [attr, myself.getEdgeAttrib(attr, node)];
    }));
};

SpriteMorph.prototype.setEdgeAttribsFromDict = function(edge, dict) {
    var myself = this;
    if(!this.hasEdge(edge)) {
        this.addEdge(new List([edge]));
    }
    dict.forEach(function(v, k) {
        myself.setEdgeAttrib(k, edge, v);
    });
};

SpriteMorph.prototype.setNodeCostume = function(node, costumename) {
    // NB: Due to InputSlotMorph not having support for multiple dropdown
    // elements with the same name, we are only able to get the first costume
    // with the given name. Other costumes which share the same name will be
    // unusable unless renamed.
    var n = parseNode(node);
    if(this.G.has_node(n)) {
        var props = this.G.node.get(n);
        if(costumename === "default") {
            delete props.__costume__;
        } else {
            props.__costume__ = detect(this.costumes.asArray(), function(costume) {
                return costume.name === costumename;
            });
        }
        if(this.isActiveGraph()) {
            var nodes = graphEl.selectAll(".node");
            nodes.each(function(d, i) {
                if(d.node === node) {
                    updateNodeDimensionsAndCostume(d3.select(nodes[0][i]));
                }
            });
        }
    }
};


SpriteMorph.prototype.setEdgeCostume = function(edge, costumename) {
    // NB: Due to InputSlotMorph not having support for multiple dropdown
    // elements with the same name, we are only able to get the first costume
    // with the given name. Other costumes which share the same name will be
    // unusable unless renamed.
    var a = parseNode(edge.at(1)), b = parseNode(edge.at(2));
    if(this.G.has_edge(a, b)) {
        var props = this.G.edge.get(a).get(b);
        if(costumename === "default") {
            delete props.__costume__;
        } else {
            props.__costume__ = detect(this.costumes.asArray(), function(costume) {
                return costume.name === costumename;
            });
        }
        if(this.isActiveGraph()) {
            graphEl.select(".line").style("fill", LAYOUT_OPTS["edge_style"]["fill"]);
            graphEl.select(".line").attr("transform", LAYOUT_OPTS["edge_attr"]["transform"]);
            layout.resume();
        }
    }
};

SpriteMorph.prototype.getNodes = function() {
    return new List(this.G.nodes());
};


SpriteMorph.prototype.getNodesWithAttr = function(attr, val) {
    var nodes = [],
        myself = this;
    jsnx.forEach(this.G.nodes_iter(), function (node) {
        if (snapEquals(myself.getNodeAttrib(attr, node), val)) {
            nodes.push(node);
        }
    });
    return new List(nodes);
};

SpriteMorph.prototype.getEdges = function() {
    var edges = [];
    jsnx.forEach(this.G.edges_iter(), function (edge) {
        edges.push(new List(edge));
    });
    return new List(edges);
};

SpriteMorph.prototype.getDegree = function(node) {
    return this.G.degree(node);
};

SpriteMorph.prototype.getInDegree = function(node) {
    return this.G.in_degree(node);
};

SpriteMorph.prototype.getOutDegree = function(node) {
    return this.G.out_degree(node);
};

SpriteMorph.prototype.getEdgesWithAttr = function(attr, val) {
    var edges = [],
        myself = this;
    jsnx.forEach(this.G.edges_iter(), function (edge) {
        var s_edge = new List(edge);
        if (snapEquals(myself.getEdgeAttrib(attr, s_edge), val)) {
            edges.push(s_edge);
        }
    });
    return new List(edges);
};

SpriteMorph.prototype.hasNode = function(node) {
    return this.G.has_node(parseNode(node));
};

SpriteMorph.prototype.hasEdge = function(edge) {
    var from = parseNode(edge.at(1)), to = parseNode(edge.at(2));
    return this.G.has_edge(from, to);
};

SpriteMorph.prototype.getOutgoing = function(node) {
    return new List(this.G.successors(parseNode(node)));
};

SpriteMorph.prototype.getIncoming = function(node) {
    return new List(this.G.predecessors(parseNode(node)));
};

SpriteMorph.prototype.getNeighborEdges = function(node) {
    return new List(this.G.edges([parseNode(node)]).map(function(x) { return new List(x); }));
};

SpriteMorph.prototype.getOutgoingEdges = function(node) {
    return new List(this.G.out_edges([parseNode(node)]).map(function(x) { return new List(x); }));
};

SpriteMorph.prototype.getIncomingEdges = function(node) {
    return new List(this.G.in_edges([parseNode(node)]).map(function(x) { return new List(x); }));
};

SpriteMorph.prototype.isConnected = function() {
    if (this.G.is_directed()) {
        throw new Error("Not allowed for directed graphs. Use 'is strongly/weakly connected.'");
    }

    if (this.G.number_of_nodes() === 0) {
        return false;
    }

    var l = jsnx.single_source_shortest_path_length(this.G,
        this.G.nodes_iter().next()).count();

    return l === this.G.number_of_nodes();
};

SpriteMorph.prototype.isStronglyConnected = function() {
    if (!this.G.is_directed()) {
        throw new Error("Not allowed for undirected graphs. Use 'is connected.'");
    }

    if (this.G.number_of_nodes() === 0) {
        return false;
    }

    // Adapted version of Kosaraju's algorithm.
    var start = this.G.nodes_iter().next();

    var stack = [start];
    var visited = new jsnx.contrib.Set();
    while(stack.length > 0) {
        var node = stack.pop();
        visited.add(node);
        jsnx.forEach(this.G.successors_iter(node), function(successor) {
            if(!visited.has(successor)) {
                stack.push(successor);
            }
        });
    }

    if(visited.count() !== this.G.number_of_nodes())
        return false;

    var stack = [start];
    var visited = new jsnx.contrib.Set();
    while(stack.length > 0) {
        var node = stack.pop();
        visited.add(node);
        jsnx.forEach(this.G.predecessors_iter(node), function(predecessor) {
            if(!visited.has(predecessor)) {
                stack.push(predecessor);
            }
        });
    }

    return visited.count() === this.G.number_of_nodes();
};

SpriteMorph.prototype.isWeaklyConnected = function() {
    if (!this.G.is_directed()) {
        throw new Error("Not allowed for undirected graphs. Use 'is connected.'");
    }

    if (this.G.number_of_nodes() === 0) {
        return false;
    }

    var stack = [this.G.nodes_iter().next()];
    var visited = new jsnx.contrib.Set();
    while(stack.length > 0) {
        var node = stack.pop();
        visited.add(node);
        jsnx.forEach(this.G.successors_iter(node), function(successor) {
            if(!visited.has(successor)) {
                stack.push(successor);
            }
        });
        jsnx.forEach(this.G.predecessors_iter(node), function(predecessor) {
            if(!visited.has(predecessor)) {
                stack.push(predecessor);
            }
        });
    }
    return visited.count() === this.G.number_of_nodes();
};

SpriteMorph.prototype.isCyclic = function() {
    if(this.G.is_directed()) {
        try {
            jsnx.topological_sort(this.G);
            return false;
        } catch (e) {
            return e instanceof jsnx.JSNetworkXUnfeasible;
        }
    } else {
        var iter = jsnx.sentinelIterator(this.G.nodes_iter(), null),
            visited = new jsnx.contrib.Set(),
            hasCycle = false,
            stack, node, pred;

        while((node = iter.next()) !== null) {
            if(visited.has(node))
                continue;

            stack = [node];
            pred = {};
            while(stack.length > 0 && !hasCycle) {
                var node = stack.pop();
                visited.add(node);
                jsnx.forEach(this.G.neighbors_iter(node), function(neighbor) {
                    if(visited.has(neighbor)) {
                        // Make sure we haven't seen this edge before.
                        if(neighbor !== pred[node]) {
                            hasCycle = true;
                        }
                    } else {
                        pred[neighbor] = node;
                        stack.push(neighbor);
                    }
                });
            }

            if(hasCycle)
                return true;
        }

        return false;
    }
};

SpriteMorph.prototype.getMatrixEntry = function(a, b) {
    var edge = new List([a, b]);
    if(this.G.hasEdge(edge)) {
        return 1;
    } else {
        return 0;
    }
};

SpriteMorph.prototype.setMatrixEntry = function(a, b, val) {
    var edge = new List([a, b]);
    if(val) {
        this.addEdge(new List([edge]));
    } else {
        this.removeEdge(edge);
    }
};

SpriteMorph.prototype.getMatrixEntryWeighted = function(a, b, weightKey) {
    var edge = new List([a, b]);
    if(this.hasEdge(edge)) {
        return this.getEdgeAttrib(weightKey, edge);
    } else {
        return Infinity;
    }
};

SpriteMorph.prototype.setMatrixEntryWeighted = function(a, b, weightKey, val) {
    var edge = new List([a, b]);
    if(isFinite(val)) {
        this.addEdge(new List([edge]));
        this.setEdgeAttrib(weightKey, edge, val);
    } else {
        this.removeEdge(edge);
    }
};

SpriteMorph.prototype.isEmpty = function() {
    return this.G.number_of_nodes() === 0;
};

function areDisjoint(a, b) {
    var nodeName, nodes = b.nodes();
    for (var i = 0; i < nodes.length; i++) {
        if(a.has_node(nodes[i])) {
            return false;
        }
    }
    return true;
}

function NotDisjointError(message) {
    this.name = 'NotDisjointError';
    this.message = message;
    this.stack = (new Error()).stack;
}
NotDisjointError.prototype = new Error;

SpriteMorph.prototype.addGraph = function(other) {
    if(!areDisjoint(this.G, other)) {
        throw new NotDisjointError("The graphs are not disjoint.");
    }
    var ide = this.parentThatIsA(IDE_Morph),
        totalNodes = this.G.number_of_nodes() + other.number_of_nodes();
    if(totalNodes > ide.maxVisibleNodes && this.G === currentGraph) {
        // Too many nodes. Hide the graph and throw up a message.
        hiddenCurrentGraph = this.G;
        this.hideActiveGraph();
        ide.showMessage(formatTooManyNodesMessage(totalNodes,
                                                  ide.maxVisibleNodes));
    }
    // FIXME: JSNetworkX throws an exception if iterators are used here.
    this.G.add_nodes_from(other.nodes(true));
    this.G.add_edges_from(other.edges(null, true));
}

SpriteMorph.prototype.renumberAndAdd = function(other, startNum) {
    var relabeled = jsnx.relabel.relabel_nodes(other, function (n) { return n + startNum; });
    this.addGraph(relabeled);
}

SpriteMorph.prototype.generateBalancedTree = function(r, h, n) {
    var tree = jsnx.generators.classic.balanced_tree(r, h, new this.G.constructor());
    this.renumberAndAdd(tree, n);
};

SpriteMorph.prototype.generateCycleGraph = function(l, n) {
    var cycle = jsnx.generators.classic.cycle_graph(l, new this.G.constructor());
    this.renumberAndAdd(cycle, n);
};

SpriteMorph.prototype.generateCompleteGraph = function(k, n) {
    var complete = jsnx.generators.classic.complete_graph(k, new this.G.constructor());
    this.renumberAndAdd(complete, n);
};

SpriteMorph.prototype.generatePathGraph = function(k, n) {
    var path = jsnx.generators.classic.path_graph(k, new this.G.constructor());
    this.renumberAndAdd(path, n);
};

SpriteMorph.prototype.generateGridGraph = function(w, h) {
    var grid = jsnx.generators.classic.grid_2d_graph(w, h, false, new this.G.constructor());
    // Grid graphs by default come with labels as [x, y], which blow up with
    // the renderer for some reason. Stringify the labels instead.
    grid = jsnx.relabel.relabel_nodes(grid, function(x) { return x.toString(); });
    this.addGraph(G, grid);
};

SpriteMorph.prototype.addAttrsFromGraph = function(graph) {
    var myself = this,
        nodeattrset = {},
        edgeattrset = {};
    if(!graph) {
        graph = this.G;
    }
    jsnx.forEach(graph.nodes_iter(true), function(n) {
        Object.keys(n[1]).forEach(function(attr) {
            nodeattrset[attr] = true;
        });
    });
    jsnx.forEach(graph.edges_iter(true), function(e) {
       Object.keys(e[2]).forEach(function(attr) {
            edgeattrset[attr] = true;
        });
    });
    Object.keys(nodeattrset).forEach(function(attr) {
        myself.addNodeAttribute(attr, false);
    });
    Object.keys(edgeattrset).forEach(function(attr) {
        myself.addEdgeAttribute(attr, false);
    });
}

SpriteMorph.prototype.loadGraphFromString = function(string) {
    try {
        this.graphFromJSON(string, true);
        return;
    } catch(e) {
        if(!(e instanceof SyntaxError)) {
            throw e;
        }
    }

    try {
        var dotgraph = new DotGraph(DotParser.parse(string)),
            graph;
        dotgraph.walk();
        if(dotgraph.rootGraph.type == "graph") {
            graph = jsnx.Graph();
        } else if(dotgraph.rootGraph.type == "digraph") {
            graph = jsnx.DiGraph();
        } else {
            throw new Error("Invalid DOT graph type");
        }
        // console.log(dotgraph);
        for(var node in dotgraph.nodes) {
            if(dotgraph.nodes.hasOwnProperty(node)) {
                var ournode = parseNode(node);
                graph.add_node(ournode);
                // console.log(ournode);
                var attrs = dotgraph.nodes[node].attrs;
                for(var attr in attrs) {
                    if(attrs.hasOwnProperty(attr)) {
                        if(attr === "fillcolor") {
                            graph.node.get(ournode).color = attrs[attr];
                        } else {
                            graph.node.get(ournode)[attr] = attrs[attr];
                        }
                    }
                }
            }
        }
        for(var edgeid in dotgraph.edges) {
            if(dotgraph.edges.hasOwnProperty(edgeid)) {
                dotgraph.edges[edgeid].forEach(function(datum) {
                    var edge = datum.edge;
                    var a = parseNode(edge[0]), b = parseNode(edge[1]);
                    graph.add_edge(a, b);
                    // console.log(a, b);
                    var attrs = datum.attrs;
                    for(var attr in attrs) {
                        if(attrs.hasOwnProperty(attr)) {
                            if(attr === "penwidth") {
                                graph.edge.get(a).get(b).width = attrs[attr];
                            } else {
                                graph.edge.get(a).get(b)[attr] = attrs[attr];
                            }
                        }
                    }
                });
            }
        }
        this.importGraph(graph, true);
        return;
    } catch(e) {
        if(!(e instanceof DotParser.SyntaxError)) {
            throw e;
        }
    }

    var data = CSV.csvToArray(string);
    if(data[0][0] === '' || data[0][0] === null) {
        // Try parsing as adjacency matrix.
        this.importGraph(parseAdjacencyMatrix(data), true);
    } else {
        // Try parsing as adjacency list.
        this.importGraph(parseAdjacencyList(data), true);
    }
};

SpriteMorph.prototype.loadGraphFromURL = function(url) {
    var request = new XMLHttpRequest();
    request.open('GET', url, false);
    request.send(null);
    if (request.status === 200) {
        this.loadGraphFromString(request.responseText);
    } else {
        throw new Error("Could not load URL: " + request.statusText);
    }
};

SpriteMorph.prototype.topologicalSort = function() {
    return new List(jsnx.algorithms.dag.topological_sort(this.G));
};

SpriteMorph.prototype.reportEdge = function(a, b) {
    return new List([a, b]);
};

SpriteMorph.prototype.startNode = function(edge) {
    if(!(edge instanceof List) || edge.length() !== 2) {
        throw new Error(edge.toString() + " is not an edge.");
    }
    return edge.at(1);
};

SpriteMorph.prototype.endNode = function(edge) {
    if(!(edge instanceof List) || edge.length() !== 2) {
        throw new Error(edge.toString() + " is not an edge.");
    }
    return edge.at(2);
};

SpriteMorph.prototype.sortNodes = function(nodes, attr, ascdesc) {
    var nodesArr = nodes.asArray().slice(0),
        myself = this,
        ascending = (ascdesc === "ascending");

    nodesArr.sort(function(a, b) {
        var na = myself.G.node.get(parseNode(a))[attr],
            nb = myself.G.node.get(parseNode(b))[attr];
        if(na < nb)
            return ascending ? -1 : 1;
        if(na > nb)
            return ascending ? 1 : -1;
        return 0;
    });

    return new List(nodesArr);
};

SpriteMorph.prototype.sortEdges = function(edges, attr, ascdesc) {
    var edgesArr = edges.asArray().map(function(x) { return x.asArray(); }),
        myself = this,
        ascending = (ascdesc === "ascending");

    edgesArr.sort(function(a, b) {
        var ea = myself.G.adj.get(parseNode(a[0])).get(parseNode(a[1]))[attr],
            eb = myself.G.adj.get(parseNode(b[0])).get(parseNode(b[1]))[attr];
        if(ea < eb)
            return ascending ? -1 : 1;
        if(ea > eb)
            return ascending ? 1 : -1;
        return 0;
    });

    return new List(edgesArr.map(function(x) { return new List(x); }));
};

Process.prototype.doForEach = function(uv, list, body) {
    if(!list.length() || !body)
        return;

    if(this.context.loopIdx === undefined) {
        this.context.upvars = new UpvarReference(this.context.upvars);
        this.context.loopIdx = 1;
    } else if(this.context.loopIdx < list.length()) {
        this.context.loopIdx++;
    } else {
        return;
    }

    this.context.outerContext.variables.addVar(uv, list.at(this.context.loopIdx));
    this.context.upvars.addReference(
        list.at(this.context.loopIdx),
        this.context.inputs[0],
        this.context.outerContext.variables
    );

    this.pushContext('doYield');
    if (body) {
        this.pushContext(body.blockSequence());
    }
    this.pushContext();
}

Process.prototype.doNumericFor = function(uv, start, end, body) {
    if(!body)
        return;

    if(!isNumeric(start)) {
        throw new Error("start '"+ start.toString() +"' is not a number");
    }
    if(!isNumeric(end)) {
        throw new Error("end '"+ end.toString() +"' is not a number");
    }

    start = parseInt(start, 10);
    end = parseInt(end, 10);

    if(this.context.loopIdx === undefined) {
        this.context.upvars = new UpvarReference(this.context.upvars);
        this.context.loopIdx = start;
    } else if(this.context.loopIdx !== end) {
        if(start < end) {
            this.context.loopIdx++;
        } else {
            this.context.loopIdx--;
        }
    } else {
        return;
    }

    this.context.outerContext.variables.addVar(uv, this.context.loopIdx);
    this.context.upvars.addReference(
        this.context.loopIdx,
        this.context.inputs[0],
        this.context.outerContext.variables
    );

    this.pushContext('doYield');
    if (body) {
        this.pushContext(body.blockSequence());
    }
    this.pushContext();
}

Process.prototype.getLastfmFriends = function(username) {
    var myself = this, url, api_key;

    if(!this.context.gettinglastfmfriends)
    {
        this.context.gettinglastfmfriends = true;
        this.context.lastfmfriends = null;
        api_key = this.homeContext.receiver.parentThatIsA(StageMorph).lastfmAPIkey;
        if(!api_key) {
            throw new Error("You need to specify a last.fm API key.");
        }
        url = 'http://ws.audioscrobbler.com/2.0/?method=user.getfriends' +
                  '&user=' + encodeURIComponent(username) +
                  '&api_key=' + api_key + '&format=json' +
                  '&limit=50&callback={callback}';
        d3.jsonp(url, function(data) {
            myself.context.lastfmfriends = data;
        });
    }

    if(this.context.lastfmfriends)
    {
        var data = this.context.lastfmfriends;
        this.popContext();
        this.pushContext('doYield');
        if(data.error) {
            throw new Error(data.message);
        }
        if(data.friends.user === undefined) {
            return new List();
        } else if(!(data.friends.user instanceof Array)) {
            data.friends.user = [data.friends.user];
        }
        return new List(data.friends.user.map(function(x) { return x.name; }));
    }

    this.pushContext('doYield');
    this.pushContext();
};

Process.prototype.getLastfmUserLovedTracks = function(username) {
    var myself = this, url, api_key;

    if(!this.context.gettinglastfmfriends)
    {
        this.context.gettinglastfmfriends = true;
        this.context.lastfmfriends = null;
        api_key = this.homeContext.receiver.parentThatIsA(StageMorph).lastfmAPIkey;
        if(!api_key) {
            throw new Error("You need to specify a last.fm API key.");
        }
        url = 'http://ws.audioscrobbler.com/2.0/?method=user.getlovedtracks' +
                  '&user=' + encodeURIComponent(username) +
                  '&api_key=' + api_key + '&format=json' +
                  '&limit=50&callback={callback}';
        d3.jsonp(url, function(data) {
            myself.context.lastfmfriends = data;
        });
    }

    if(this.context.lastfmfriends)
    {
        var data = this.context.lastfmfriends;
        this.popContext();
        this.pushContext('doYield');
        if(data.error) {
            throw new Error(data.message);
        }
        if(data.lovedtracks.track === undefined) {
            return new List();
        } else if(!(data.lovedtracks.track instanceof Array)) {
            data.lovedtracks.track = [data.lovedtracks.track];
        }
        return new List(data.lovedtracks.track.map(function(track) {
            return track.artist.name + " - " + track.name;
        }));
    }

    this.pushContext('doYield');
    this.pushContext();
};

Process.prototype.getTMDBMoviesByTitle = function(title) {
    var myself = this, url, api_key;

    if(!this.context.gettingTMDBMovies)
    {
        this.context.gettingTMDBMovies = true;
        this.context.TMDBMovies = null;
        api_key = this.homeContext.receiver.parentThatIsA(StageMorph).tmdbAPIkey;
        if(!api_key) {
            throw new Error("You need to specify a TMDB API key.");
        }
        url = 'https://api.themoviedb.org/3/search/movie?' +
                  '&query=' + encodeURIComponent(title) +
                  '&api_key=' + api_key +
                  '&callback={callback}';
        d3.jsonp(url, function(data) {
            myself.context.TMDBMovies = data;
        });
    }

    if(this.context.TMDBMovies)
    {
        var data = this.context.TMDBMovies;
        this.popContext();
        this.pushContext('doYield');
        if(data.status_code) {
            throw new Error("TMDB API error: " + data.status_message);
        }

        return new List(data.results.map(function(movie) {
            return movie.id;
        }));
    }

    this.pushContext('doYield');
    this.pushContext();
};

Process.prototype.getTMDBPeopleByName = function(name) {
    var myself = this, url, api_key;

    if(!this.context.gettingTMDBPeople)
    {
        this.context.gettingTMDBPeople = true;
        this.context.TMDBPeople = null;
        api_key = this.homeContext.receiver.parentThatIsA(StageMorph).tmdbAPIkey;
        if(!api_key) {
            throw new Error("You need to specify a TMDB API key.");
        }
        url = 'https://api.themoviedb.org/3/search/person?' +
                  '&query=' + encodeURIComponent(name) +
                  '&api_key=' + api_key +
                  '&callback={callback}';
        d3.jsonp(url, function(data) {
            myself.context.TMDBPeople = data;
        });
    }

    if(this.context.TMDBPeople)
    {
        var data = this.context.TMDBPeople;
        this.popContext();
        this.pushContext('doYield');
        if(data.status_code) {
            throw new Error("TMDB API error: " + data.status_message);
        }

        return new List(data.results.map(function(person) {
            return person.id;
        }));
    }

    this.pushContext('doYield');
    this.pushContext();
};

Process.prototype.getTMDBTitle = function(movie) {
    var myself = this, url, api_key;

    if(!this.context.gettingTMDBMovieData)
    {
        this.context.gettingTMDBMovieData = true;
        this.context.TMDBMovieData = null;
        api_key = this.homeContext.receiver.parentThatIsA(StageMorph).tmdbAPIkey;
        if(!api_key) {
            throw new Error("You need to specify a TMDB API key.");
        }
        url = 'https://api.themoviedb.org/3/movie/' + encodeURIComponent(movie) +
                  '?api_key=' + api_key +
                  '&callback={callback}';
        d3.jsonp(url, function(data) {
            myself.context.TMDBMovieData = data;
        });
    }

    if(this.context.TMDBMovieData)
    {
        var data = this.context.TMDBMovieData;
        this.popContext();
        this.pushContext('doYield');
        if(data.status_code) {
            throw new Error("TMDB API error: " + data.status_message);
        }

        return data.title;
    }

    this.pushContext('doYield');
    this.pushContext();
};

Process.prototype.getTMDBCast = function(movie) {
    var myself = this, url, api_key;

    if(!this.context.gettingTMDBMovieCredits)
    {
        this.context.gettingTMDBMovieCredits = true;
        this.context.TMDBMovieCredits = null;
        api_key = this.homeContext.receiver.parentThatIsA(StageMorph).tmdbAPIkey;
        if(!api_key) {
            throw new Error("You need to specify a TMDB API key.");
        }
        url = 'https://api.themoviedb.org/3/movie/' + encodeURIComponent(movie) + '/credits' +
                  '?api_key=' + api_key +
                  '&callback={callback}';
        d3.jsonp(url, function(data) {
            myself.context.TMDBMovieCredits = data;
        });
    }

    if(this.context.TMDBMovieCredits)
    {
        var data = this.context.TMDBMovieCredits;
        this.popContext();
        this.pushContext('doYield');
        if(data.status_code) {
            throw new Error("TMDB API error: " + data.status_message);
        }

        return new List(data.cast.map(function(credit) {
            return new List([credit.id, credit.character]);
        }));
    }

    this.pushContext('doYield');
    this.pushContext();
};

Process.prototype.getTMDBMoviesByPerson = function(person) {
    var myself = this, url, api_key;

    if(!this.context.gettingTMDBMovies)
    {
        this.context.gettingTMDBMovies = true;
        this.context.TMDBMovies = null;
        api_key = this.homeContext.receiver.parentThatIsA(StageMorph).tmdbAPIkey;
        if(!api_key) {
            throw new Error("You need to specify a TMDB API key.");
        }
        url = 'https://api.themoviedb.org/3/person/' + encodeURIComponent(person) + '/movie_credits' +
                  '?api_key=' + api_key +
                  '&callback={callback}';
        d3.jsonp(url, function(data) {
            myself.context.TMDBMovies = data;
        });
    }

    if(this.context.TMDBMovies)
    {
        var data = this.context.TMDBMovies;
        this.popContext();
        this.pushContext('doYield');
        if(data.status_code) {
            throw new Error("TMDB API error: " + data.status_message);
        }

        return new List(data.cast.map(function(credit) {
            return credit.id;
        }));
    }

    this.pushContext('doYield');
    this.pushContext();
};

Process.prototype.getTMDBPersonName = function(person) {
    var myself = this, url, api_key;

    if(!this.context.gettingTMDBMovies)
    {
        this.context.gettingTMDBMovies = true;
        this.context.TMDBMovies = null;
        api_key = this.homeContext.receiver.parentThatIsA(StageMorph).tmdbAPIkey;
        if(!api_key) {
            throw new Error("You need to specify a TMDB API key.");
        }
        url = 'https://api.themoviedb.org/3/person/' + encodeURIComponent(person) +
                  '?api_key=' + api_key +
                  '&callback={callback}';
        d3.jsonp(url, function(data) {
            myself.context.TMDBMovies = data;
        });
    }

    if(this.context.TMDBMovies)
    {
        var data = this.context.TMDBMovies;
        this.popContext();
        this.pushContext('doYield');
        if(data.status_code) {
            throw new Error("TMDB API error: " + data.status_message);
        }

        return data.name;
    }

    this.pushContext('doYield');
    this.pushContext();
};

SpriteMorph.prototype.getWordNetNounHypernyms = function(noun) {
    if(!this.wordnet_nouns) {
        throw new Error("WordNet is not loaded. Please load WordNet.")
    }

    return new List(this.wordnet_nouns.predecessors(noun));
};

SpriteMorph.prototype.getWordNetNounHyponyms = function(noun) {
    if(!this.wordnet_nouns) {
        throw new Error("WordNet is not loaded. Please load WordNet.")
    }

    return new List(this.wordnet_nouns.successors(noun));
};

SpriteMorph.prototype.getWordNetSynsets = function(lemma) {
    if(!this.wordnet_nouns) {
        throw new Error("WordNet is not loaded. Please load WordNet.")
    }

    return new List(jsnx.toArray(jsnx.filter(this.wordnet_nouns.nodes_iter(), function(synset) {
        return synset.substr(0, lemma.length + 1) === lemma.toString() + '.';
    })));
};

SpriteMorph.prototype.getWordNetDefinition = function(noun) {
    if(!this.wordnet_nouns) {
        throw new Error("WordNet is not loaded. Please load WordNet.")
    }

    if(this.wordnet_nouns.has_node(noun)) {
        return this.wordnet_nouns.node.get(noun).definition;
    } else {
        throw new Error(noun.toString() + " could not be found.")
    }
};

SpriteMorph.prototype.setGraph = function(newGraph) {
    var wasActive = this.isActiveGraph();
    this.G = newGraph;
    if(wasActive) {
        if(currentGraph.parent_graph) {
            this.showGraphSlice(sliceStart, sliceRadius);
        } else {
            this.setActiveGraph();
        }
    }
};

SpriteMorph.prototype.convertToDigraph = function() {
    if(!jsnx.is_directed(this.G)) {
        this.setGraph(jsnx.DiGraph(this.G));
    }
};

SpriteMorph.prototype.convertToGraph = function() {
    if(jsnx.is_directed(this.G)) {
        this.setGraph(jsnx.Graph(this.G));
    }
};


(function() {
    delete SpriteMorph.prototype.categories[SpriteMorph.prototype.categories.indexOf("motion")];
    delete SpriteMorph.prototype.categories[SpriteMorph.prototype.categories.indexOf("pen")];
    delete SpriteMorph.prototype.categories[SpriteMorph.prototype.categories.indexOf("sensing")];
    SpriteMorph.prototype.categories.push('network');
    SpriteMorph.prototype.categories.push('nodes');
    SpriteMorph.prototype.categories.push('edges');
    SpriteMorph.prototype.categories.push('external');
    SpriteMorph.prototype.blockColor.network = new Color(74, 108, 212);
    SpriteMorph.prototype.blockColor['nodes'] = new Color(215, 0, 64);
    SpriteMorph.prototype.blockColor['edges'] = new Color(180, 34, 64);
    SpriteMorph.prototype.blockColor.external = new Color(74, 108, 212);

    var blockName, networkBlocks = {
        // Network
        newGraph: {
            type: 'command',
            category: 'network',
            spec: 'new graph',
        },
        newDiGraph: {
            type: 'command',
            category: 'network',
            spec: 'new digraph',
        },
        setActiveGraph: {
            type: 'command',
            category: 'network',
            spec: 'show'
        },
        showGraphSlice: {
            type: 'command',
            category: 'network',
            spec: 'show subgraph from node %s of depth %n'
        },
        hideActiveGraph: {
            type: 'command',
            category: 'network',
            spec: 'hide'
        },
        clearGraph: {
            type: 'command',
            category: 'network',
            spec: 'clear'
        },
        numberOfNodes: {
            type: 'reporter',
            category: 'nodes',
            spec: 'number of nodes'
        },
        numberOfEdges: {
            type: 'reporter',
            category: 'edges',
            spec: 'number of edges'
        },
        addNode: {
            type: 'command',
            category: 'nodes',
            spec: 'add node %exp'
        },
        removeNode: {
            type: 'command',
            category: 'nodes',
            spec: 'remove node %s'
        },
        addEdge: {
            type: 'command',
            category: 'edges',
            spec: 'add edge %expL'
        },
        removeEdge: {
            type: 'command',
            category: 'edges',
            spec: 'remove edge %l'
        },
        getNeighbors: {
            type: 'reporter',
            category: 'nodes',
            spec: 'neighbors of %s'
        },
        setNodeAttrib: {
            type: 'command',
            category: 'nodes',
            spec: 'set %nodeAttr of node %s to %s'
        },
        getNodeAttrib: {
            type: 'reporter',
            category: 'nodes',
            spec: '%nodeAttr of node %s'
        },
        getNodeAttribDict: {
            type: 'reporter',
            category: 'nodes',
            spec: 'all attributes of %s'
        },
        setNodeAttribsFromDict: {
            type: 'command',
            category: 'nodes',
            spec: 'set attributes of %s from dict %l'
        },
        setEdgeAttrib: {
            type: 'command',
            category: 'edges',
            spec: 'set %edgeAttr of edge %l to %s'
        },
        getEdgeAttrib: {
            type: 'reporter',
            category: 'edges',
            spec: '%edgeAttr of edge %l'
        },
        getEdgeAttribDict: {
            type: 'reporter',
            category: 'edges',
            spec: 'all attributes of %l'
        },
        setEdgeAttribsFromDict: {
            type: 'command',
            category: 'edges',
            spec: 'set attributes of %s from dict %l'
        },
        setNodeCostume: {
            type: 'command',
            category: 'nodes',
            spec: 'set costume of node %s to %cst2'
        },
        setEdgeCostume: {
            type: 'command',
            category: 'edges',
            spec: 'set costume of edge %l to %cst2'
        },
        getNodes: {
            type: 'reporter',
            category: 'nodes',
            spec: 'all the nodes'
        },
        getNodesWithAttr: {
            type: 'reporter',
            category: 'nodes',
            spec: 'nodes with %nodeAttr equal to %s'
        },
        getEdges: {
            type: 'reporter',
            category: 'edges',
            spec: 'all the edges'
        },
        getDegree: {
            type: 'reporter',
            category: 'nodes',
            spec: 'degree of %s'
        },
        getInDegree: {
            type: 'reporter',
            category: 'nodes',
            spec: 'in-degree of %s'
        },
        getOutDegree: {
            type: 'reporter',
            category: 'nodes',
            spec: 'out-degree of %s'
        },
        getEdgesWithAttr: {
            type: 'reporter',
            category: 'edges',
            spec: 'edges with %edgeAttr equal to %s'
        },
        hasNode: {
            type: 'predicate',
            category: 'nodes',
            spec: 'node %s exists'
        },
        hasEdge: {
            type: 'predicate',
            category: 'edges',
            spec: 'edge %l exists'
        },
        getOutgoing: {
            type: 'reporter',
            category: 'nodes',
            spec: 'outgoing nodes of %s'
        },
        getIncoming: {
            type: 'reporter',
            category: 'nodes',
            spec: 'incoming nodes of %s'
        },
        getNeighborEdges: {
            type: 'reporter',
            category: 'edges',
            spec: 'edges of %s'
        },
        getOutgoingEdges: {
            type: 'reporter',
            category: 'edges',
            spec: 'outgoing edges of %s'
        },
        getIncomingEdges: {
            type: 'reporter',
            category: 'edges',
            spec: 'incoming edges of %s'
        },
        getMatrixEntry: {
            type: 'reporter',
            category: 'network',
            spec: 'adj %s , %s'
        },
        setMatrixEntry: {
            type: 'command',
            category: 'network',
            spec: 'set adj %s , %s to %n'
        },
        getMatrixEntryWeighted: {
            type: 'reporter',
            category: 'network',
            spec: 'adj %s , %s %edgeAttr'
        },
        setMatrixEntryWeighted: {
            type: 'command',
            category: 'network',
            spec: 'set adj %s , %s %edgeAttr to %n'
        },
        isEmpty: {
            type: 'predicate',
            category: 'network',
            spec: 'is empty'
        },
        isCyclic: {
            type: 'predicate',
            category: 'network',
            spec: 'is cyclic'
        },
        isConnected: {
            type: 'predicate',
            category: 'network',
            spec: 'is connected'
        },
        isStronglyConnected: {
            type: 'predicate',
            category: 'network',
            spec: 'is strongly connected'
        },
        isWeaklyConnected: {
            type: 'predicate',
            category: 'network',
            spec: 'is weakly connected'
        },
        generateBalancedTree: {
            type: 'command',
            category: 'network',
            spec: 'generate balanced tree of degree %n and height %n numbered from %n'
        },
        generateCycleGraph: {
            type: 'command',
            category: 'network',
            spec: 'generate cycle graph of length %n numbered from %n'
        },
        generateCompleteGraph: {
            type: 'command',
            category: 'network',
            spec: 'generate complete graph on %n vertices numbered from %n'
        },
        generatePathGraph: {
            type: 'command',
            category: 'network',
            spec: 'generate path graph of length %n numbered from %n'
        },
        generateGridGraph: {
            type: 'command',
            category: 'network',
            spec: 'generate a %n by %n 2D grid graph'
        },
        loadGraphFromURL: {
            type: 'command',
            category: 'external',
            spec: 'load graph from URL: %txt'
        },
        topologicalSort: {
            type: 'reporter',
            category: 'network',
            spec: 'topological sort'
        },
        reportEdge: {
            type: 'reporter',
            category: 'edges',
            spec: 'edge %s %s'
        },
        startNode: {
            type: 'reporter',
            category: 'nodes',
            spec: 'start node of %l'
        },
        endNode: {
            type: 'reporter',
            category: 'nodes',
            spec: 'end node of %l'
        },
        sortNodes: {
            type: 'reporter',
            category: 'nodes',
            spec: 'nodes %l sorted by %nodeAttr %ascdesc'
        },
        sortEdges: {
            type: 'reporter',
            category: 'edges',
            spec: 'edges %l sorted by %edgeAttr %ascdesc'
        },
        getLastfmFriends: {
            type: 'reporter',
            category: 'external',
            spec: 'friends of %txt'
        },
        getLastfmUserLovedTracks: {
            type: 'reporter',
            category: 'external',
            spec: 'loved tracks of %txt'
        },
        getWordNetNounHypernyms: {
            type: 'reporter',
            category: 'external',
            spec: 'hypernyms of %txt'
        },
        getWordNetNounHyponyms: {
            type: 'reporter',
            category: 'external',
            spec: 'hyponyms of %txt'
        },
        getWordNetSynsets: {
            type: 'reporter',
            category: 'external',
            spec: 'synsets of %txt'
        },
        getWordNetDefinition: {
            type: 'reporter',
            category: 'external',
            spec: 'definition of %txt'
        },
        getTMDBMoviesByTitle: {
            type: 'reporter',
            category: 'external',
            spec: 'movie #s where title has %txt'
        },
        getTMDBPeopleByName: {
            type: 'reporter',
            category: 'external',
            spec: 'person #s where name has %txt'
        },
        getTMDBTitle: {
            type: 'reporter',
            category: 'external',
            spec: 'title of movie %n'
        },
        getTMDBCast: {
            type: 'reporter',
            category: 'external',
            spec: 'cast of movie %n'
        },
        getTMDBMoviesByPerson: {
            type: 'reporter',
            category: 'external',
            spec: 'movies with person %n'
        },
        getTMDBPersonName: {
            type: 'reporter',
            category: 'external',
            spec: 'name of person %n'
        },
        convertToDigraph: {
            type: 'command',
            category: 'network',
            spec: 'convert to digraph'
        },
        convertToGraph: {
            type: 'command',
            category: 'network',
            spec: 'convert to graph'
        },
        doForEach: {
            type: 'command',
            category: 'control',
            spec: 'for each %upvar of %l %c',
            defaults: ['item']
        },
        doNumericFor: {
            type: 'command',
            category: 'control',
            spec: 'for %upvar = %n to %n %c',
            defaults: ['i', 1, 10]
        },
        receiveNodeClick: {
            type: 'hat',
            category: 'control',
            spec: 'when node %upvar double-clicked',
            defaults: ['node']
        }
    };

    // Add the new blocks.
    for (blockName in networkBlocks) {
        if(networkBlocks.hasOwnProperty(blockName)) {
            SpriteMorph.prototype.blocks[blockName] = networkBlocks[blockName];
        }
    }
}());

StageMorph.prototype.allNodeAttributes = SpriteMorph.prototype.allNodeAttributes = function() {
    return this.parentThatIsA(StageMorph).nodeAttributes.concat(this.nodeAttributes);
}

StageMorph.prototype.isNodeAttrAvailable = SpriteMorph.prototype.isNodeAttrAvailable = function(name) {
    var attrs = this.allNodeAttributes().concat(["label", "color", "scale"]);
    return attrs.indexOf(name) === -1;
}

StageMorph.prototype.addNodeAttribute = SpriteMorph.prototype.addNodeAttribute = function(name, global) {
    var attrs;
    if(global) {
        attrs = this.parentThatIsA(StageMorph).nodeAttributes;
    } else {
        attrs = this.nodeAttributes;
    }

    if(this.isNodeAttrAvailable(name)) {
        attrs.push(name);
        return true;
    }

    return false;
}

StageMorph.prototype.deleteNodeAttribute = SpriteMorph.prototype.deleteNodeAttribute = function(name) {
    var idx = this.parentThatIsA(StageMorph).nodeAttributes.indexOf(name);
    if(idx > -1) {
        this.parentThatIsA(StageMorph).nodeAttributes.splice(idx, 1);
        return true;
    }
    idx = this.nodeAttributes.indexOf(name);
    if(idx > -1) {
        this.nodeAttributes.splice(idx, 1)
        return true;
    }
    return false;
}

InputSlotMorph.prototype.getNodeAttrsDict = function () {
    var block = this.parentThatIsA(BlockMorph),
        sprite,
        dict = {'color': 'color', 'label': 'label', 'scale': 'scale'};

    if (!block) {
        return dict;
    }
    sprite = block.receiver();

    sprite.allNodeAttributes().forEach(function (name) {
        dict[name] = name;
    });

    return dict;
};


StageMorph.prototype.allEdgeAttributes = SpriteMorph.prototype.allEdgeAttributes = function() {
    return this.parentThatIsA(StageMorph).edgeAttributes.concat(this.edgeAttributes);
}

StageMorph.prototype.isEdgeAttrAvailable = SpriteMorph.prototype.isEdgeAttrAvailable = function(name) {
    var attrs = this.allEdgeAttributes().concat(["label", "color", "width"]);
    return attrs.indexOf(name) === -1;
}

StageMorph.prototype.addEdgeAttribute = SpriteMorph.prototype.addEdgeAttribute = function(name, global) {
    var attrs;
    if(global) {
        attrs = this.parentThatIsA(StageMorph).edgeAttributes;
    } else {
        attrs = this.edgeAttributes;
    }

    if(this.isEdgeAttrAvailable(name)) {
        attrs.push(name);
        return true;
    }

    return false;
}

StageMorph.prototype.deleteEdgeAttribute = SpriteMorph.prototype.deleteEdgeAttribute = function(name) {
    var idx = this.parentThatIsA(StageMorph).edgeAttributes.indexOf(name);
    if(idx > -1) {
        this.parentThatIsA(StageMorph).edgeAttributes.splice(idx, 1);
        return true;
    }
    idx = this.edgeAttributes.indexOf(name);
    if(idx > -1) {
        this.edgeAttributes.splice(idx, 1)
        return true;
    }
    return false;
}

InputSlotMorph.prototype.getEdgeAttrsDict = function () {
    var block = this.parentThatIsA(BlockMorph),
        sprite,
        dict = {'color': 'color', 'label': 'label', 'width': 'width'};

    if (!block) {
        return dict;
    }
    sprite = block.receiver();

    sprite.allEdgeAttributes().forEach(function (name) {
        dict[name] = name;
    });

    return dict;
};

InputSlotMorph.prototype.costumesMenu2 = function () {
    var rcvr = this.parentThatIsA(BlockMorph).receiver(),
        dict = {};
    dict["default"] = "default";
    dict["~"] = null;
    rcvr.costumes.asArray().forEach(function (costume) {
        dict[costume.name] = costume.name;
    });
    return dict;
};

SpriteMorph.prototype.blockTemplates = (function blockTemplates (oldBlockTemplates) {
    return function (category)
    {
        // block() was copied from objects.js
        function block(selector) {
            if (StageMorph.prototype.hiddenPrimitives[selector]) {
                return null;
            }
            var newBlock = SpriteMorph.prototype.blockForSelector(selector, true);
            newBlock.isTemplate = true;
            return newBlock;
        }

        var blocks = [], button, myself = this;
        if(category === 'network')
        {
            blocks.push(block('newGraph'));
            blocks.push(block('newDiGraph'));
            blocks.push(block('convertToGraph'));
            blocks.push(block('convertToDigraph'));
            blocks.push(block('clearGraph'));
            blocks.push(block('setActiveGraph'));
            blocks.push(block('showGraphSlice'));
            blocks.push(block('hideActiveGraph'));
            blocks.push('-');
            blocks.push(block('getMatrixEntry'));
            blocks.push(block('setMatrixEntry'));
            blocks.push(block('getMatrixEntryWeighted'));
            blocks.push(block('setMatrixEntryWeighted'));
            blocks.push('-');
            blocks.push(block('isEmpty'));
            blocks.push(block('isCyclic'));
            blocks.push(block('isConnected'));
            blocks.push(block('isStronglyConnected'));
            blocks.push(block('isWeaklyConnected'));
            blocks.push('-');
            blocks.push(block('topologicalSort'));
            blocks.push('-');
            blocks.push(block('generateBalancedTree'));
            blocks.push(block('generateCycleGraph'));
            blocks.push(block('generateCompleteGraph'));
            blocks.push(block('generatePathGraph'));
            blocks.push(block('generateGridGraph'));
        } else if(category === 'nodes') {
            // Node attributes.
            button = new PushButtonMorph(
                null,
                function () {
                    new VariableDialogMorph(
                        null,
                        function (pair) {
                            if (myself.addNodeAttribute(pair[0], pair[1])) {
                                myself.blocksCache[category] = null;
                                myself.paletteCache[category] = null;
                                myself.parentThatIsA(IDE_Morph).refreshPalette();
                            }
                        },
                        myself
                    ).prompt(
                        'Attribute name',
                        null,
                        myself.world()
                    );
                },
                'Make a node attribute'
            );
            blocks.push(button);

            if (this.allNodeAttributes().length > 0) {
                button = new PushButtonMorph(
                    null,
                    function () {
                        var menu = new MenuMorph(
                            function(attr) {
                                if(myself.deleteNodeAttribute(attr)) {
                                    myself.blocksCache[category] = null;
                                    myself.paletteCache[category] = null;
                                    myself.parentThatIsA(IDE_Morph).refreshPalette();
                                }
                            },
                            null,
                            myself
                        );
                        myself.allNodeAttributes().forEach(function (name) {
                            menu.addItem(name, name);
                        });
                        menu.popUpAtHand(myself.world());
                    },
                    'Delete a node attribute'
                );
                blocks.push(button);
            }

            blocks.push('-');

            blocks.push(block('startNode'));
            blocks.push(block('endNode'));
            blocks.push('-');
            blocks.push(block('addNode'));
            blocks.push(block('removeNode'));
            blocks.push(block('hasNode'));
            blocks.push('-');
            blocks.push(block('numberOfNodes'));
            blocks.push(block('getNodes'));
            blocks.push('-');
            blocks.push(block('setNodeAttrib'));
            blocks.push(block('getNodeAttrib'));
            blocks.push(block('getNodeAttribDict'));
            blocks.push(block('setNodeAttribsFromDict'));
            blocks.push(block('setNodeCostume'));
            blocks.push(block('getNodesWithAttr'));
            blocks.push(block('sortNodes'));
            blocks.push('-');
            blocks.push(block('getNeighbors'));
            blocks.push(block('getOutgoing'));
            blocks.push(block('getIncoming'));
            blocks.push('-');
            blocks.push(block('getDegree'));
            blocks.push(block('getInDegree'));
            blocks.push(block('getOutDegree'));
        } else if(category === 'edges') {
            // Edge attributes.
            button = new PushButtonMorph(
                null,
                function () {
                    new VariableDialogMorph(
                        null,
                        function (pair) {
                            if (myself.addEdgeAttribute(pair[0], pair[1])) {
                                myself.blocksCache[category] = null;
                                myself.paletteCache[category] = null;
                                myself.parentThatIsA(IDE_Morph).refreshPalette();
                            }
                        },
                        myself
                    ).prompt(
                        'Attribute name',
                        null,
                        myself.world()
                    );
                },
                'Make an edge attribute'
            );
            blocks.push(button);

            if (this.allEdgeAttributes().length > 0) {
                button = new PushButtonMorph(
                    null,
                    function () {
                        var menu = new MenuMorph(
                            function(attr) {
                                if(myself.deleteEdgeAttribute(attr)) {
                                    myself.blocksCache[category] = null;
                                    myself.paletteCache[category] = null;
                                    myself.parentThatIsA(IDE_Morph).refreshPalette();
                                }
                            },
                            null,
                            myself
                        );
                        myself.allEdgeAttributes().forEach(function (name) {
                            menu.addItem(name, name);
                        });
                        menu.popUpAtHand(myself.world());
                    },
                    'Delete an edge attribute'
                );
                blocks.push(button);
            }

            blocks.push('-');

            blocks.push(block('reportEdge'));
            blocks.push('-');
            blocks.push(block('addEdge'));
            blocks.push(block('removeEdge'));
            blocks.push(block('hasEdge'));
            blocks.push('-');
            blocks.push(block('numberOfEdges'));
            blocks.push(block('getEdges'));
            blocks.push('-');
            blocks.push(block('setEdgeAttrib'));
            blocks.push(block('getEdgeAttrib'));
            blocks.push(block('getEdgeAttribDict'));
            blocks.push(block('setEdgeAttribsFromDict'));
            blocks.push(block('setEdgeCostume'));
            blocks.push(block('getEdgesWithAttr'));
            blocks.push(block('sortEdges'));
            blocks.push('-');
            blocks.push(block('getNeighborEdges'));
            blocks.push(block('getOutgoingEdges'));
            blocks.push(block('getIncomingEdges'));
        } else if (category === 'external') {
            blocks.push(block('loadGraphFromURL'));
            blocks.push('-');
            button = new PushButtonMorph(
                null,
                function () {
                    new DialogBoxMorph(
                        null,
                        function receiveKey(key) {
                            if(key) {
                                myself.parentThatIsA(StageMorph).lastfmAPIkey = key;
                            } else {
                                new DialogBoxMorph(null, receiveKey)
                                .prompt(
                                    'API key',
                                    myself.parentThatIsA(StageMorph).lastfmAPIkey || '',
                                    myself.world());
                            }
                        }
                    ).prompt('API key',
                        myself.parentThatIsA(StageMorph).lastfmAPIkey || '',
                        myself.world());
                },
                'Authenticate with last.fm'
            );
            blocks.push(button);
            blocks.push(block('getLastfmFriends'));
            blocks.push(block('getLastfmUserLovedTracks'));
            blocks.push('-');
            button = new PushButtonMorph(
                null,
                function () {
                    new DialogBoxMorph(
                        null,
                        function() {
                            var request = new XMLHttpRequest();
                            request.open('GET', 'wordnet_nouns.json', false);
                            request.send(null);
                            if (request.status === 200) {
                                var data = JSON.parse(request.responseText);
                                myself.wordnet_nouns = objectToGraph(data);
                                // DiGraph.copy() is slow, this is fast. Go
                                // figure.
                                myself.G = objectToGraph(data);
                                myself.addAttrsFromGraph();
                                myself.showGraphSlice('', 0);
                                myself.hideActiveGraph();
                                myself.parentThatIsA(IDE_Morph).showMessage(
                                    "WordNet has been loaded as the " +
                                    "active graph.\nYou may now display a " +
                                    "subgraph starting from a given synset.");
                            } else {
                                throw new Error("Could not load: " + request.statusText);
                            }
                        }
                    ).askYesNo('Are you sure?',
                               'This could take a while to download (12MB). Are you sure you want to continue?',
                                myself.world());
                },
                'Load Princeton WordNet nouns'
            );
            blocks.push(button);
            blocks.push(block('getWordNetNounHypernyms'));
            blocks.push(block('getWordNetNounHyponyms'));
            blocks.push(block('getWordNetSynsets'));
            blocks.push(block('getWordNetDefinition'));
            blocks.push('-');
            button = new PushButtonMorph(
                null,
                function () {
                    new DialogBoxMorph(
                        null,
                        function receiveKey(key) {
                            if(key) {
                                myself.parentThatIsA(StageMorph).tmdbAPIkey = key;
                            } else {
                                new DialogBoxMorph(null, receiveKey)
                                .prompt(
                                    'API key',
                                    myself.parentThatIsA(StageMorph).tmdbAPIkey || '',
                                    myself.world());
                            }
                        }
                    ).prompt('API key',
                        myself.parentThatIsA(StageMorph).tmdbAPIkey || '',
                        myself.world());
                },
                'Authenticate with TMDB'
            );
            blocks.push(button);
            blocks.push(block('getTMDBMoviesByTitle'));
            blocks.push(block('getTMDBPeopleByName'));
            blocks.push(block('getTMDBTitle'));
            blocks.push(block('getTMDBCast'));
            blocks.push(block('getTMDBMoviesByPerson'));
            blocks.push(block('getTMDBPersonName'));
        } else if (category === 'looks') {
            blocks.push(block('doSayFor'));
            blocks.push(block('bubble'));
            blocks.push(block('doThinkFor'));
            blocks.push(block('doThink'));
            if (this.world().isDevMode) {
                blocks.push('-');
                var txt = new TextMorph(localize(
                    'development mode \ndebugging primitives:'
                ));
                txt.fontSize = 9;
                txt.setColor(this.paletteTextColor);
                blocks.push(txt);
                blocks.push('-');
                blocks.push(block('log'));
                blocks.push(block('alert'));
            }
        } else if (category === 'control') {
            blocks = blocks.concat(oldBlockTemplates.call(this, category));
            blocks.push(block('doForEach'));
            blocks.push(block('doNumericFor'));
            blocks.push('-');
            blocks.push(block('receiveNodeClick'));
        } else {
            return blocks.concat(oldBlockTemplates.call(this, category));
        }
        return blocks;
    };
}(SpriteMorph.prototype.blockTemplates));

SpriteMorph.prototype.graphToJSON = function() {
    return JSON.stringify(graphToObject(this.G));
};

SpriteMorph.prototype.graphFromJSON = function(json, addTo) {
    var myself = this,
        parsed = JSON.parse(json);
    parsed.graph.forEach(function(el) {
        var k = el[0], v = el[1];
        if(k === "__costumes__") {
            for(var name in v) {
                if(v.hasOwnProperty(name)) {
                    var costume = new Costume(null, name, new Point());
                    costume.loaded = function() {};
                    var image = new Image();
                    image.onload = function () {
                        var canvas = newCanvas(
                                new Point(image.width, image.height)
                            ),
                            context = canvas.getContext('2d');
                        context.drawImage(image, 0, 0);
                        costume.contents = canvas;
                        costume.version = +new Date();
                        if (typeof costume.loaded === 'function') {
                            costume.loaded();
                        } else {
                            costume.loaded = true;
                        }
                    };
                    image.src = v[name];
                    myself.addCostume(costume);
                }
            }
        }
    });
    this.importGraph(objectToGraph(parsed), addTo);
}

SpriteMorph.prototype.importGraph = function(G, addTo) {
    var myself = this;
    jsnx.forEach(G.nodes_iter(true), function (node) {
        var data = node[1], k;
        for (k in data) {
            if (data.hasOwnProperty(k)) {
                if(k === "__costume__") {
                    var costume = detect(myself.costumes.asArray(), function(costume) {
                        return costume.name === data[k];
                    });
                    if(costume) {
                        data[k] = costume;
                    } else {
                        delete data[k];
                    }
                } else if(k !== 'color' && k !== 'label') {
                    myself.addNodeAttribute(k, false);
                }
            }
        }
    });
    jsnx.forEach(G.edges_iter(true), function (edge) {
        var data = edge[2], k;
        for (k in data) {
            if (data.hasOwnProperty(k)) {
                if(k === "__costume__") {
                    var costume = detect(myself.costumes.asArray(), function(costume) {
                        return costume.name === data[k];
                    });
                    if(costume) {
                        data[k] = costume;
                    } else {
                        delete data[k];
                    }
                } else if(k !== 'color' && k !== 'label') {
                    this.addEdgeAttribute(k, false);
                }
            }
        }
    });

    if(addTo) {
        this.addGraph(G);
    } else {
        this.setGraph(G);
    }
};

// Merge source into target, possibly applying fn to (key, value) first.
function mergeObjectIn(target, source, fn) {
    var key;
    for(key in source) {
        if (source.hasOwnProperty(key)) {
            if (fn === undefined) {
                target[key] = source[key];
            } else {
                target[key] = fn(key, source[key]);
            }
        }
    }
}

// Taken from http://stackoverflow.com/a/122190/126977
function clone(obj){
    if(obj == null || typeof(obj) != 'object')
        return obj;

    var temp = obj.constructor(); // changed

    for(var key in obj)
        temp[key] = clone(obj[key]);
    return temp;
}

// Port of the functions in nx.readwrite.json_graph.node_link

//    Copyright (C) 2011-2013 by
//    Aric Hagberg <hagberg@lanl.gov>
//    Dan Schult <dschult@colgate.edu>
//    Pieter Swart <swart@lanl.gov>
//    All rights reserved.
//    BSD license.

// Turn a graph into an object ready to be stringified to the NetworkX JSON
// graph format.
function graphToObject(G) {
    var multigraph = G.is_multigraph();

    var mapping = {};
    var i = 0;
    jsnx.forEach(G.nodes_iter(), function(node) {
        mapping[node] = i++;
    });

    var data = {};
    data.directed = G.is_directed();
    data.multigraph = multigraph;
    var costumes = {};
    data.graph = [["__costumes__", costumes]];
    for(var k in G.graph) {
        if(G.graph.hasOwnProperty(k)) {
            data.graph.push([k, G.graph[k]]);
        }
    }

    data.nodes = [];
    jsnx.forEach(G.nodes_iter(true), function(node) {
        var d = {id: node[0]};
        mergeObjectIn(d, node[1]);
        delete d.__d3datum__; // Don't serialize the D3 gunk.
        if(d.__costume__) {
            var name = d.__costume__.name;
            if(!costumes.hasOwnProperty(name)) {
                costumes[name] = d.__costume__.contents.toDataURL();
            }
            d.__costume__ = name;
        }
        data.nodes.push(d);
    });

    if (multigraph) {
        data.links = [];
        jsnx.forEach(G.edges_iter(true), function(edge) {
            var u = edge[0], v = edge[1], k = edge[2], d = edge[3],
                link = {source: mapping[u], target: mapping[v], key: k};
            mergeObjectIn(link, d);
            delete link.__d3datum__;
            delete link.__costume__;
            data.links.push(link);
        });
    } else {
        data.links = [];
        jsnx.forEach(G.edges_iter(true), function(edge) {
            var u = edge[0], v = edge[1], d = edge[2],
                link = {source: mapping[u], target: mapping[v]};
            mergeObjectIn(link, d);
            delete link.__d3datum__;
            if(link.__costume__) {
                var name = link.__costume__.name;
                if(!costumes.hasOwnProperty(name)) {
                    costumes[name] = link.__costume__.contents.toDataURL();

                }
                link.__costume__ = name;
            }
            data.links.push(link);
        });
    }

    return data;
}

function parseAdjacencyList (list) {
    var G = jsnx.DiGraph(),
        row;

    for (var i = 0; i < list.length; i++) {
        row = list[i];

        if(row.length === 3) {
            G.add_edge(parseNode(row[0]), parseNode(row[1]), {label: row[2]})
        } else if(row.length === 2)  {
            G.add_edge(parseNode(row[0]), parseNode(row[1]));
        }
        // Silently swallow non-conforming lines.
    }

    return G;
}

function parseAdjacencyMatrix (mat) {
    var G = jsnx.DiGraph(),
        row, a, b, label_;

    for (var i = 1; i < mat[0].length; i++) {
        G.add_node(mat[0][i].toString());
    }

    for (var i = 1; i < mat.length; i++) {
        row = mat[i];
        for (var j = 1; j < row.length; j++) {
            if(row[j] !== null && row[j] !== '') {
                a = parseNode(row[0].toString());
                b = parseNode(mat[0][j].toString());
                label_ = row[j].toString();
                // Let's hope no one ever uses '1' as an edge label.
                if(label_ === '1') {
                    G.add_edge(a, b);
                } else {
                    G.add_edge(a, b, {label: label_});
                }
            }
        }
    }

    return G;
}

// Transform NetworkX-formatted object to JSNetworkX graph-like object.
function objectToGraph (data) {
    var multigraph = data.multigraph,
        directed = data.directed,
        mapping = [],
        graph, d, node, nodedata, link_data, source, target, edgedata;

    if(multigraph) {
        graph = jsnx.MultiGraph();
    } else {
        graph = jsnx.Graph();
    }

    if(directed) {
        graph = graph.to_directed();
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
        graph.add_node(node, nodedata);
    }

    for (var i = 0; i < data.links.length; i++) {
        d = data.links[i];
        link_data = clone(d);
        source = link_data.source;
        delete link_data.source;
        target = link_data.target;
        delete link_data.target;
        edgedata = link_data;
        graph.add_edge(mapping[source], mapping[target], edgedata);
    }

    return graph;
}

}());
