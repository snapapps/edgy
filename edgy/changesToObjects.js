// Since we're not supposed to be altering the original file too much, monkey
// patching is in order.

(function() {
"use strict";

var graphEl = d3.select(document.body)
        .append('div')
        .attr('id', 'graph-display')
        .style('position', 'absolute'),
    currentGraph = null, // The current JSNetworkX graph to display.
    layout = null; // The d3.layout instance controlling the graph display.

// We want to forward mouse events to the Snap! canvas.
function forwardMouseEvent(e, target) {
    var evtCopy;

    if(target.ownerDocument.createEvent)
    {
        // For modern browsers.
        evtCopy = target.ownerDocument.createEvent('MouseEvents');
        evtCopy.initMouseEvent(e.type, e.bubbles, e.cancelable, e.view,
            e.detail, e.pageX || e.layerX, e.pageY || e.layerY, e.clientX,
            e.clientY, e.ctrlKey, e.altKey, e.shiftKey, e.metaKey, e.button,
            e.relatedTarget);
        return !target.dispatchEvent(evtCopy);
    }
    else if (target.ownerDocument.createEventObject) {
        // For IE.
        evtCopy = target.ownerDocument.createEventObject(e);
        return target.fireEvent('on' + e, evtCopy);
    }
}

function mouseEventForwarder() {
    forwardMouseEvent(d3.event, document.getElementById("world"));
}

graphEl.on("mousedown", mouseEventForwarder);
graphEl.on("mouseup", mouseEventForwarder);
graphEl.on("mousemove", mouseEventForwarder);
// Prevent the browser's context menu from coming up.
graphEl.on("contextmenu", function() { d3.event.preventDefault(); });

// Monitor for new nodes and edges, and attach event handlers appropriately.
graphEl.on("DOMNodeInserted", function() {
    var node = d3.select(d3.event.relatedNode);
    if(node.classed("node")) {
        node.on("mouseup", function() {
            if(d3.event.ctrlKey || d3.event.button === 2)
            {
                var menu = new MenuMorph(this);

                d3.event.preventDefault();
                d3.event.stopPropagation();

                menu.addItem('delete', function () {
                    var d = node.datum();
                    d.G.remove_node(d.node);
                });
                menu.addItem('set label', function () {
                    new DialogBoxMorph(null, function (label) {
                        var d = node.datum();
                        d.G.node.get(d.node).label = autoNumericize(label);
                        node.select("text").node().textContent = label;
                    }).prompt('Node label', '', world);
                    world.worldCanvas.focus();
                });
                menu.addItem('set color', function () {
                    new DialogBoxMorph(null, function (color) {
                        var d = node.datum();
                        d.G.add_node(d.node, {color: color});
                    }).prompt('Node color', '', world);
                    world.worldCanvas.focus();
                });
                menu.popUpAtHand(world);
            }
        });
    } else if(node.classed("edge")) {
        node.on("mouseup", function() {
            if(d3.event.ctrlKey || d3.event.button === 2)
            {
                var menu = new MenuMorph(this);

                d3.event.preventDefault();
                d3.event.stopPropagation();

                menu.addItem('delete', function () {
                    var d = node.datum();
                    d.G.remove_edges_from([d.edge]);
                });
                menu.addItem('set label', function () {
                    new DialogBoxMorph(null, function (label) {
                        var d = node.datum();
                        d.G.adj.get(d.edge[0]).get(d.edge[1]).label = autoNumericize(label);
                        node.select("text").node().textContent = label;
                    }).prompt('Edge label', '', world);
                    world.worldCanvas.focus();
                });
                menu.addItem('set color', function () {
                    new DialogBoxMorph(null, function (color) {
                        var d = node.datum();
                        d.G.add_edge(d.edge[0], d.edge[1], {color: color});
                    }).prompt('Edge color', '', world);
                    world.worldCanvas.focus();
                });
                menu.popUpAtHand(world);
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

var DEFAULT_NODE_COLOR = "white",
    DEFAULT_EDGE_COLOR = "black",
    DEFAULT_LABEL_COLOR = "black";

function redrawGraph() {
    // console.log("redrawing graph")
    layout = jsnx.draw(currentGraph, {
        element: graphEl.node(),
        with_labels: true,
        with_edge_labels: true,
        layout_attr: {
            linkDistance: 70
        },
        node_style: {
            fill: function(d) {
                return d.data.color || DEFAULT_NODE_COLOR;
            }
        },
        edge_style: {
            fill: function(d) {
                return d.data.color || DEFAULT_EDGE_COLOR;
            },
            'stroke-width': 8
        },
        label_style: {fill: DEFAULT_LABEL_COLOR},
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
        pan_zoom: {enabled: false} // Allow forwarding mouse events to Snap!
    }, true);
}

function setGraphToDisplay (G) {
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

        menu.addItem("add node", function () {
            new DialogBoxMorph(null, function (name) {
                currentGraph.add_node(parseNode(name));
            }).prompt('Node name', '', world);
            world.worldCanvas.focus();
        });

        menu.addItem("add edge", function () {
            new DialogBoxMorph(null, function (start) {
                new DialogBoxMorph(null, function (end) {
                    currentGraph.add_edge(parseNode(start), parseNode(end));
                }).prompt('End node', '', world);
                world.worldCanvas.focus();
            }).prompt('Start node', '', world);
            world.worldCanvas.focus();
        });

        menu.addItem("export to file", function () {
            var data = JSON.stringify(graphToObject(currentGraph)),
                link = document.createElement('a');

            link.setAttribute('href', 'data:application/json,' + encodeURIComponent(data));
            link.setAttribute('download', (this.parentThatIsA(IDE_Morph).projectName || 'project') + '.json');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
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
        }
        this.nodeAttributes = [];
        this.nodeAttributes.toXML = serializeAttributes;
        this.edgeAttributes = [];
        this.edgeAttributes.toXML = serializeAttributes;
        var retval = oldInit.call(this, globals);

        this.name = localize('Graph');
        this.hide();

        return retval;
    };
}(SpriteMorph.prototype.init));

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
    var oldGraph = this.G;
    this.G = jsnx.Graph();
    if(currentGraph === oldGraph) {
        this.setActiveGraph();
    }
};

SpriteMorph.prototype.newDiGraph = function() {
    var oldGraph = this.G;
    this.G = jsnx.DiGraph();
    if(currentGraph === oldGraph) {
        this.setActiveGraph();
    }
};

SpriteMorph.prototype.setActiveGraph = function() {
    setGraphToDisplay(this.G);
};

SpriteMorph.prototype.clearGraph = function() {
    this.G.clear();
};

SpriteMorph.prototype.numberOfNodes = function () {
    return this.G.number_of_nodes();
};

SpriteMorph.prototype.numberOfEdges = function () {
    return this.G.number_of_edges();
};

SpriteMorph.prototype.addNode = function(nodes) {
    this.G.add_nodes_from(nodes.asArray().map(parseNode));
};

SpriteMorph.prototype.removeNode = function(node) {
    this.G.remove_node(node);
};

SpriteMorph.prototype.addEdge = function(edges) {
    this.G.add_edges_from(edges.asArray().map(function(x) { return x.asArray().map(parseNode); }));
};

SpriteMorph.prototype.removeEdge = function(edge) {
    var a = parseNode(edge.at(1)), b = parseNode(edge.at(2));
    this.G.remove_edge(a, b);
};

SpriteMorph.prototype.getNeighbors = function(node) {
    return new List(this.G.neighbors(node));
};

SpriteMorph.prototype.setNodeAttrib = function(attrib, node, val) {
    node = parseNode(node);
    if(this.G.has_node(node)) {
        var data = {};
        data[attrib] = val;
        this.G.add_node(node, data);

        // HACK: work around JSNetworkX bug with not updating labels.
        if(attrib === "label" && currentGraph === this.G) {
            var nodes = graphEl.selectAll(".node");
            nodes.each(function(d, i) {
                if(d.node === node) {
                    var textEl = d3.select(nodes[0][i]).select("text");
                    textEl.node().textContent = val.toString();
                }
            });
        }
    }
};

SpriteMorph.prototype.getNodeAttrib = function(attrib, node) {
    node = parseNode(node);
    var val = this.G.node.get(node)[attrib];
    // Can't return undefined, since it is special to Snap, and will cause an
    // infinite loop.
    if(val === undefined) {
        if(attrib === "color")
            return DEFAULT_NODE_COLOR;
        if(attrib === "label")
            return node.toString();

        throw new Error("Undefined attribute " + attrib.toString() + " on node " + node);
    } else {
        return val;
    }
};

SpriteMorph.prototype.setEdgeAttrib = function(attrib, edge, val) {
    var a = parseNode(edge.at(1)), b = parseNode(edge.at(2));
    if(this.G.has_edge(a, b)) {
        var data = {};
        data[attrib] = val;
        this.G.add_edge(a, b, data);

        // HACK: work around JSNetworkX bug with not updating labels.
        if(attrib === "label" && currentGraph === this.G) {
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
        b = parseNode(edge.at(2)),
        val = this.G.adj.get(a).get(b)[attrib];
    // Can't return undefined, since it is special to Snap, and will cause an
    // infinite loop.
    if(val === undefined) {
        if(attrib === "color")
            return DEFAULT_EDGE_COLOR;
        if(attrib === "label")
            return "";

        throw new Error("Undefined attribute " + attrib.toString() + " on edge (" + a + ", " + b + ")");
    } else {
        return val;
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

function addGraph(G, other) {
    if(!areDisjoint(G, other)) {
        throw new Error("The graphs are not disjoint.");
    }
    // HACK: for some reason, JSNetworkX throws an exception if I try adding
    // the nodes along with their attributes in a single pass.
    G.add_nodes_from(other.nodes());
    G.add_nodes_from(other.nodes(true));
    G.add_edges_from(other.edges(null, true));
}

function renumberAndAdd(G, other, startNum) {
    var relabeled = jsnx.relabel.relabel_nodes(other, function (n) { return n + startNum; });
    addGraph(G, relabeled);
}

SpriteMorph.prototype.generateBalancedTree = function(r, h, n) {
    var tree = jsnx.generators.classic.balanced_tree(r, h, new this.G.constructor());
    renumberAndAdd(this.G, tree, n);
};

SpriteMorph.prototype.generateCycleGraph = function(l, n) {
    var cycle = jsnx.generators.classic.cycle_graph(l, new this.G.constructor());
    renumberAndAdd(this.G, cycle, n);
};

SpriteMorph.prototype.generateCompleteGraph = function(k, n) {
    var complete = jsnx.generators.classic.complete_graph(k, new this.G.constructor());
    renumberAndAdd(this.G, complete, n);
};

SpriteMorph.prototype.generatePathGraph = function(k, n) {
    var path = jsnx.generators.classic.path_graph(k, new this.G.constructor());
    renumberAndAdd(this.G, path, n);
};

SpriteMorph.prototype.generateGridGraph = function(w, h) {
    var grid = jsnx.generators.classic.grid_2d_graph(w, h, false, new this.G.constructor());
    // Grid graphs by default come with labels as [x, y], which blow up with
    // the renderer for some reason. Stringify the labels instead.
    grid = jsnx.relabel.relabel_nodes(grid, function(x) { return x.toString(); });
    addGraph(this.G, grid);
};

SpriteMorph.prototype.loadGraphFromURL = function(url) {
    var request = new XMLHttpRequest();
    request.open('GET', url, false);
    request.send(null);
    if (request.status === 200) {
        addGraph(this.G, objectToGraph(JSON.parse(request.responseText)));
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
                  '&api_key=94a9d34efc73dc347b144a2f4dd94471&format=json' +
                  '&limit=5&callback={callback}';
        d3.jsonp(url, function(data) {
            myself.context.lastfmfriends = data;
        });
    }

    if(this.context.lastfmfriends)
    {
        var data = this.context.lastfmfriends;
        this.popContext();
        this.pushContext('doYield');
        return new List(data.friends.user.map(function(x) { return x.name; }));
    }

    this.pushContext('doYield');
    this.pushContext();
};

(function() {
    delete SpriteMorph.prototype.categories[SpriteMorph.prototype.categories.indexOf("motion")];
    delete SpriteMorph.prototype.categories[SpriteMorph.prototype.categories.indexOf("pen")];
    delete SpriteMorph.prototype.categories[SpriteMorph.prototype.categories.indexOf("sensing")];
    SpriteMorph.prototype.categories.push('network');
    SpriteMorph.prototype.categories.push('nodes+edges');
    SpriteMorph.prototype.categories.push('external');
    SpriteMorph.prototype.blockColor.network = new Color(74, 108, 212);
    SpriteMorph.prototype.blockColor['nodes+edges'] = new Color(215, 0, 64);
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
            spec: 'display current graph'
        },
        clearGraph: {
            type: 'command',
            category: 'network',
            spec: 'clear graph'
        },
        numberOfNodes: {
            type: 'reporter',
            category: 'nodes+edges',
            spec: 'number of nodes'
        },
        numberOfEdges: {
            type: 'reporter',
            category: 'nodes+edges',
            spec: 'number of edges'
        },
        addNode: {
            type: 'command',
            category: 'nodes+edges',
            spec: 'add node %exp'
        },
        removeNode: {
            type: 'command',
            category: 'nodes+edges',
            spec: 'remove node %s'
        },
        addEdge: {
            type: 'command',
            category: 'nodes+edges',
            spec: 'add edge %expL'
        },
        removeEdge: {
            type: 'command',
            category: 'nodes+edges',
            spec: 'remove edge %l'
        },
        getNeighbors: {
            type: 'reporter',
            category: 'nodes+edges',
            spec: 'neighbors of %s'
        },
        setNodeAttrib: {
            type: 'command',
            category: 'nodes+edges',
            spec: 'set %nodeAttr of node %s to %s'
        },
        getNodeAttrib: {
            type: 'reporter',
            category: 'nodes+edges',
            spec: '%nodeAttr of node %s'
        },
        setEdgeAttrib: {
            type: 'command',
            category: 'nodes+edges',
            spec: 'set %edgeAttr of edge %l to %s'
        },
        getEdgeAttrib: {
            type: 'reporter',
            category: 'nodes+edges',
            spec: '%edgeAttr of edge %l'
        },
        getNodes: {
            type: 'reporter',
            category: 'nodes+edges',
            spec: 'all the nodes'
        },
        getNodesWithAttr: {
            type: 'reporter',
            category: 'nodes+edges',
            spec: 'nodes with %nodeAttr equal to %s'
        },
        getEdges: {
            type: 'reporter',
            category: 'nodes+edges',
            spec: 'all the edges'
        },
        getEdgesWithAttr: {
            type: 'reporter',
            category: 'nodes+edges',
            spec: 'edges with %edgeAttr equal to %s'
        },
        hasNode: {
            type: 'predicate',
            category: 'nodes+edges',
            spec: 'node %s exists'
        },
        hasEdge: {
            type: 'predicate',
            category: 'nodes+edges',
            spec: 'edge %l exists'
        },
        getOutgoing: {
            type: 'reporter',
            category: 'nodes+edges',
            spec: 'outgoing nodes of %s'
        },
        getIncoming: {
            type: 'reporter',
            category: 'nodes+edges',
            spec: 'incoming nodes of %s'
        },
        getNeighborEdges: {
            type: 'reporter',
            category: 'nodes+edges',
            spec: 'edges of %s'
        },
        getOutgoingEdges: {
            type: 'reporter',
            category: 'nodes+edges',
            spec: 'outgoing edges of %s'
        },
        getIncomingEdges: {
            type: 'reporter',
            category: 'nodes+edges',
            spec: 'incoming edges of %s'
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
            category: 'network',
            spec: 'load graph from URL: %s'
        },
        topologicalSort: {
            type: 'reporter',
            category: 'network',
            spec: 'topological sort'
        },
        reportEdge: {
            type: 'reporter',
            category: 'nodes+edges',
            spec: 'edge %s %s'
        },
        sortNodes: {
            type: 'reporter',
            category: 'nodes+edges',
            spec: 'nodes %l sorted by %nodeAttr %ascdesc'
        },
        sortEdges: {
            type: 'reporter',
            category: 'nodes+edges',
            spec: 'edges %l sorted by %nodeAttr %ascdesc'
        },
        getLastfmFriends: {
            type: 'reporter',
            category: 'external',
            spec: 'friends of %s'
        }
    };

    // Add the new blocks.
    for (blockName in networkBlocks) {
        if(networkBlocks.hasOwnProperty(blockName)) {
            SpriteMorph.prototype.blocks[blockName] = networkBlocks[blockName];
        }
    }
}());

function allNodeAttributes(morph) {
    return morph.parentThatIsA(StageMorph).nodeAttributes.concat(morph.nodeAttributes);
}

function addNodeAttribute(morph, name, global) {
    var attrs;
    if(global) {
        attrs = morph.parentThatIsA(StageMorph).nodeAttributes
    } else {
        attrs = morph.nodeAttributes;
    }

    if(allNodeAttributes(morph).indexOf(name) === -1) {
        attrs.push(name);
        return true;
    }

    return false;
}

function deleteNodeAttribute(morph, name) {
    var idx = morph.parentThatIsA(StageMorph).nodeAttributes.indexOf(name);
    if(idx > -1) {
        morph.parentThatIsA(StageMorph).nodeAttributes.splice(idx, 1);
        return true;
    }
    idx = morph.nodeAttributes.indexOf(name);
    if(idx > -1) {
        morph.nodeAttributes.splice(idx, 1)
        return true;
    }
    return false;
}

InputSlotMorph.prototype.getNodeAttrsDict = function () {
    var block = this.parentThatIsA(BlockMorph),
        sprite,
        dict = {'color': 'color', 'label': 'label'};

    if (!block) {
        return dict;
    }
    sprite = block.receiver();

    allNodeAttributes(sprite).forEach(function (name) {
        dict[name] = name;
    });

    return dict;
};

function allEdgeAttributes(morph) {
    return morph.parentThatIsA(StageMorph).edgeAttributes.concat(morph.edgeAttributes);
}

function addEdgeAttribute(morph, name, global) {
    var attrs;
    if(global) {
        attrs = morph.parentThatIsA(StageMorph).edgeAttributes
    } else {
        attrs = morph.edgeAttributes;
    }

    if(allEdgeAttributes(morph).indexOf(name) === -1) {
        attrs.push(name);
        return true;
    }

    return false;
}

function deleteEdgeAttribute(morph, name) {
    var idx = morph.parentThatIsA(StageMorph).edgeAttributes.indexOf(name);
    if(idx > -1) {
        morph.parentThatIsA(StageMorph).edgeAttributes.splice(idx, 1);
        return true;
    }
    idx = morph.edgeAttributes.indexOf(name);
    if(idx > -1) {
        morph.edgeAttributes.splice(idx, 1)
        return true;
    }
    return false;
}


InputSlotMorph.prototype.getEdgeAttrsDict = function () {
    var block = this.parentThatIsA(BlockMorph),
        sprite,
        dict = {'color': 'color', 'label': 'label'};

    if (!block) {
        return dict;
    }
    sprite = block.receiver();

    allEdgeAttributes(sprite).forEach(function (name) {
        dict[name] = name;
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
            blocks.push(block('clearGraph'));
            blocks.push(block('setActiveGraph'));
            blocks.push('-');
            blocks.push(block('isEmpty'));
            blocks.push(block('isCyclic'));
            blocks.push(block('isConnected'));
            blocks.push(block('isStronglyConnected'));
            blocks.push(block('isWeaklyConnected'));
            blocks.push('-');
            blocks.push(block('topologicalSort'));
            blocks.push('-');
            blocks.push(block('loadGraphFromURL'));
            blocks.push('-');
            blocks.push(block('generateBalancedTree'));
            blocks.push(block('generateCycleGraph'));
            blocks.push(block('generateCompleteGraph'));
            blocks.push(block('generatePathGraph'));
            blocks.push(block('generateGridGraph'));
        } else if(category === 'nodes+edges') {
            // Node attributes.
            button = new PushButtonMorph(
                null,
                function () {
                    new VariableDialogMorph(
                        null,
                        function (pair) {
                            if (addNodeAttribute(myself, pair[0], pair[1])) {
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

            if (allNodeAttributes(this).length > 0) {
                button = new PushButtonMorph(
                    null,
                    function () {
                        var menu = new MenuMorph(
                            function(attr) {
                                if(deleteNodeAttribute(myself, attr)) {
                                    myself.blocksCache[category] = null;
                                    myself.paletteCache[category] = null;
                                    myself.parentThatIsA(IDE_Morph).refreshPalette();
                                }
                            },
                            null,
                            myself
                        );
                        allNodeAttributes(myself).forEach(function (name) {
                            menu.addItem(name, name);
                        });
                        menu.popUpAtHand(myself.world());
                    },
                    'Delete a node attribute'
                );
                blocks.push(button);
            }

            blocks.push('-');

            // Edge attributes.
            button = new PushButtonMorph(
                null,
                function () {
                    new VariableDialogMorph(
                        null,
                        function (pair) {
                            if (addEdgeAttribute(myself, pair[0], pair[1])) {
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

            if (allEdgeAttributes(this).length > 0) {
                button = new PushButtonMorph(
                    null,
                    function () {
                        var menu = new MenuMorph(
                            function(attr) {
                                if(deleteEdgeAttribute(myself, attr)) {
                                    myself.blocksCache[category] = null;
                                    myself.paletteCache[category] = null;
                                    myself.parentThatIsA(IDE_Morph).refreshPalette();
                                }
                            },
                            null,
                            myself
                        );
                        allEdgeAttributes(myself).forEach(function (name) {
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
            blocks.push(block('addNode'));
            blocks.push(block('addEdge'));
            blocks.push(block('removeNode'));
            blocks.push(block('removeEdge'));
            blocks.push(block('hasNode'));
            blocks.push(block('hasEdge'));
            blocks.push('-');
            blocks.push(block('numberOfNodes'));
            blocks.push(block('numberOfEdges'));
            blocks.push(block('getNodes'));
            blocks.push(block('getEdges'));
            blocks.push('-');
            blocks.push(block('setNodeAttrib'));
            blocks.push(block('setEdgeAttrib'));
            blocks.push(block('getNodeAttrib'));
            blocks.push(block('getEdgeAttrib'));
            blocks.push(block('getNodesWithAttr'));
            blocks.push(block('getEdgesWithAttr'));
            blocks.push(block('sortNodes'));
            blocks.push(block('sortEdges'));
            blocks.push('-');
            blocks.push(block('getNeighbors'));
            blocks.push(block('getOutgoing'));
            blocks.push(block('getIncoming'));
            blocks.push('-');
            blocks.push(block('getNeighborEdges'));
            blocks.push(block('getOutgoingEdges'));
            blocks.push(block('getIncomingEdges'));
        } else if (category === 'external') {
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
        }
        return blocks.concat(oldBlockTemplates.call(this, category));
    };
}(SpriteMorph.prototype.blockTemplates));

SpriteMorph.prototype.graphToJSON = function() {
    return JSON.stringify(graphToObject(this.G));
};

SpriteMorph.prototype.graphFromJSON = function(json) {
    var myself = this;
    this.G = objectToGraph(JSON.parse(json));
    jsnx.forEach(this.G.nodes_iter(true), function (node) {
        var data = node[1], k;
        for (k in data) {
            if (data.hasOwnProperty(k) && k !== 'color' && k !== 'label') {
                addNodeAttribute(myself, k, false);
            }
        }
    });
    jsnx.forEach(this.G.edges_iter(true), function (edge) {
        var data = edge[2], k;
        for (k in data) {
            if (data.hasOwnProperty(k) && k !== 'color' && k !== 'label') {
                addEdgeAttribute(myself, k, false);
            }
        }
    });
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
    data.graph = [];
    mergeObjectIn(data.graph, G.graph, function(k, v) { return [k, v]; });

    data.nodes = [];
    jsnx.forEach(G.nodes_iter(true), function(node) {
        var d = {id: node[0]};
        mergeObjectIn(d, node[1]);
        delete d.__d3datum__; // Don't serialize the D3 gunk.
        data.nodes.push(d);
    });

    if (multigraph) {
        data.links = [];
        jsnx.forEach(G.edges_iter(true, true), function(edge) {
            var u = edge[0], v = edge[1], k = edge[2], d = edge[3],
                link = {source: mapping[u], target: mapping[v], key: k};
            mergeObjectIn(link, d);
            data.links.push(link);
        });
    } else {
        data.links = [];
        jsnx.forEach(G.edges_iter(true, true), function(edge) {
            var u = edge[0], v = edge[1], d = edge[3],
                link = {source: mapping[u], target: mapping[v]};
            mergeObjectIn(link, d);
            data.links.push(link);
        });
    }

    return data;
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
