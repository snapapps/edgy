// Since we're not supposed to be altering the original file too much, monkey
// patching is in order.

(function() {
"use strict";

var graphEl = d3.select(document.body)
        .append('div')
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
graphEl.on("contextmenu", function() { d3.event.preventDefault(); })


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

function redrawGraph() {
    // console.log("redrawing graph")
    layout = jsnx.draw(currentGraph, {
        element: graphEl.node(),
        with_labels: true,
        node_style: {
            fill: function(d) {
                return d.data.color || "white";
            }
        },
        edge_style: {
            fill: function(d) {
                return d.data.color || "black";
            }
        },
        label_style: {fill: 'black' },
        labels: function(d) {
            if(d.data.label !== undefined) {
                return d.data.label;
            } else {
                return d.node.toString();
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
        updateGraphDimensions(this);
        if(graphNeedsRedraw)
        {
            redrawGraph();
            graphNeedsRedraw = false;
        }
        return result;
    };
}(StageMorph.prototype.changed));

function placeholderGraph () {
    var G = jsnx.DiGraph();
    G.add_nodes_from([1,2,3,4,5,[9,{color: '#008A00'}]], {color: '#0064C7'});
    G.add_cycle([1,2,3,4,5]);
    G.add_edges_from([[1,9], [9,1]]);
    return G;
}

SpriteMorph.prototype.init = (function init (oldInit) {
    return function (globals)
    {
        this.G = placeholderGraph();
        if(currentGraph === null) {
            setGraphToDisplay(this.G);
        }
        var retval = oldInit.call(this, globals);

        this.hide();

        return retval;
    };
}(SpriteMorph.prototype.init));


// Graph block bindings

SpriteMorph.prototype.newGraph = function() {
    this.G = jsnx.Graph();
};

SpriteMorph.prototype.newDiGraph = function() {
    this.G = jsnx.DiGraph();
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

SpriteMorph.prototype.addNode = function(node) {
    this.G.add_node(node);
};

SpriteMorph.prototype.removeNode = function(node) {
    this.G.remove_node(node);
};

SpriteMorph.prototype.addEdge = function(a, b) {
    this.G.add_edge(a, b);
};

SpriteMorph.prototype.removeEdge = function(a, b) {
    this.G.remove_edge(a, b);
};

SpriteMorph.prototype.getNeighbors = function(node) {
    return new List(this.G.neighbors(node));
};

SpriteMorph.prototype.setNodeAttrib = function(attrib, node, val) {
    if(this.G.has_node(node)) {
        var data = {};
        data[attrib] = val;
        this.G.add_node(node, data);
    }
};

SpriteMorph.prototype.getNodeAttrib = function(attrib, node) {
    var val = this.G.node.get(node)[attrib];
    // Can't return undefined, since it is special to Snap, and will cause an
    // infinite loop.
    if(val === undefined) {
        throw new Error("Undefined attribute " + attrib.toString());
    } else {
        return val;
    }
};

SpriteMorph.prototype.setEdgeAttrib = function(attrib, a, b, val) {
    if(this.G.has_edge(a, b)) {
        var data = {};
        data[attrib] = val;
        this.G.add_edge(a, b, data);
    }
};

SpriteMorph.prototype.getEdgeAttrib = function(attrib, a, b) {
    var val = his.G.adj.get(a).get(b)[attrib];
    // Can't return undefined, since it is special to Snap, and will cause an
    // infinite loop.
    if(val === undefined) {
        throw new Error("Undefined attribute " + attrib.toString());
    } else {
        return val;
    }
};

SpriteMorph.prototype.getNodes = function() {
    return new List(this.G.nodes());
};


SpriteMorph.prototype.getNodesWithAttr = function(attr, val) {
    var nodes = [];
    jsnx.forEach(this.G.nodes_iter(true), function (node) {
        if (node[1][attr] === val) {
            nodes.push(node[0]);
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
    var edges = [];
    jsnx.forEach(this.G.edges_iter(), function (edge) {
        if (edge[2][attr] === val) {
            edges.push(new List(edge.slice(0, 3)));
        }
    });
    return new List(edges);
};

SpriteMorph.prototype.hasNode = function(node) {
    return this.G.has_node(node);
};

SpriteMorph.prototype.hasEdge = function(from, to) {
    return this.G.has_edge(from, to);
};

SpriteMorph.prototype.getOutgoing = function(node) {
    return new List(this.G.successors(node));
};

SpriteMorph.prototype.getIncoming = function(node) {
    return new List(this.G.predecessors(node));
};

SpriteMorph.prototype.isConnected = function() {
    if (this.G.is_directed()) {
        throw new Error("Not allowed for directed graphs. Use 'is strongly/weakly connected.'");
    }

    if (this.G.number_of_nodes() == 0) {
        return false;
    }

    var l = jsnx.single_source_shortest_path_length(this.G,
        this.G.nodes_iter().next()).count();

    return l == this.G.number_of_nodes();
};

SpriteMorph.prototype.isStronglyConnected = function() {
    if (!this.G.is_directed()) {
        throw new Error("Not allowed for undirected graphs. Use 'is connected.'");
    }

    if (this.G.number_of_nodes() == 0) {
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
    return visited.count() == this.G.number_of_nodes();
};

SpriteMorph.prototype.isWeaklyConnected = function() {
    if (!this.G.is_directed()) {
        throw new Error("Not allowed for undirected graphs. Use 'is connected.'");
    }

    if (this.G.number_of_nodes() == 0) {
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
    return visited.count() == this.G.number_of_nodes();
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

(function() {
    delete SpriteMorph.prototype.categories[SpriteMorph.prototype.categories.indexOf("sensing")];
    SpriteMorph.prototype.categories.push('graph');
    SpriteMorph.prototype.blockColor.graph = new Color(74, 108, 212);

    var blockName, graphBlocks = {
        // Graph
        newGraph: {
            type: 'command',
            category: 'graph',
            spec: 'new undirected graph',
        },
        newDiGraph: {
            type: 'command',
            category: 'graph',
            spec: 'new directed graph',
        },
        setActiveGraph: {
            type: 'command',
            category: 'graph',
            spec: 'display current graph'
        },
        clearGraph: {
            type: 'command',
            category: 'graph',
            spec: 'clear graph'
        },
        numberOfNodes: {
            type: 'reporter',
            category: 'graph',
            spec: 'number of nodes'
        },
        addNode: {
            type: 'command',
            category: 'graph',
            spec: 'add node %s'
        },
        removeNode: {
            type: 'command',
            category: 'graph',
            spec: 'remove node %s'
        },
        addEdge: {
            type: 'command',
            category: 'graph',
            spec: 'add edge between %s and %s'
        },
        removeEdge: {
            type: 'command',
            category: 'graph',
            spec: 'remove edge between %s and %s'
        },
        getNeighbors: {
            type: 'reporter',
            category: 'graph',
            spec: 'neighbors of %s'
        },
        setNodeAttrib: {
            type: 'command',
            category: 'graph',
            spec: 'set attribute %s of node %s to %s'
        },
        getNodeAttrib: {
            type: 'reporter',
            category: 'graph',
            spec: 'attribute %s of node %s'
        },
        setEdgeAttrib: {
            type: 'command',
            category: 'graph',
            spec: 'set attribute %s of edge %s , %s to %s'
        },
        getEdgeAttrib: {
            type: 'reporter',
            category: 'graph',
            spec: 'attribute %s of edge %s , %s'
        },
        getNodes: {
            type: 'reporter',
            category: 'graph',
            spec: 'all the nodes'
        },
        getNodesWithAttr: {
            type: 'reporter',
            category: 'graph',
            spec: 'nodes with attribute %s equal to %s'
        },
        getEdges: {
            type: 'reporter',
            category: 'graph',
            spec: 'all the edges'
        },
        getEdgesWithAttr: {
            type: 'reporter',
            category: 'graph',
            spec: 'edge with attribute %s equal to %s'
        },
        hasNode: {
            type: 'predicate',
            category: 'graph',
            spec: 'node %s exists'
        },
        hasEdge: {
            type: 'predicate',
            category: 'graph',
            spec: 'edge from %s to %s exists'
        },
        getOutgoing: {
            type: 'reporter',
            category: 'graph',
            spec: 'outgoing nodes of %s'
        },
        getIncoming: {
            type: 'reporter',
            category: 'graph',
            spec: 'incoming nodes of %s'
        },
        isConnected: {
            type: 'predicate',
            category: 'graph',
            spec: 'is connected'
        },
        isStronglyConnected: {
            type: 'predicate',
            category: 'graph',
            spec: 'is strongly connected'
        },
        isWeaklyConnected: {
            type: 'predicate',
            category: 'graph',
            spec: 'is weakly connected'
        },
        generateBalancedTree: {
            type: 'command',
            category: 'graph',
            spec: 'generate balanced tree of degree %n and height %n numbered from %n'
        },
        generateCycleGraph: {
            type: 'command',
            category: 'graph',
            spec: 'generate cycle graph of length %n numbered from %n'
        },
        generateCompleteGraph: {
            type: 'command',
            category: 'graph',
            spec: 'generate complete graph on %n vertices numbered from %n'
        },
        generatePathGraph: {
            type: 'command',
            category: 'graph',
            spec: 'generate path graph of length %n numbered from %n'
        },
        generateGridGraph: {
            type: 'command',
            category: 'graph',
            spec: 'generate a %n by %n 2D grid graph'
        },
        loadGraphFromURL: {
            type: 'command',
            category: 'graph',
            spec: 'load graph from URL: %s'
        },
        topologicalSort: {
            type: 'reporter',
            category: 'graph',
            spec: 'topological sort'
        }
    };

    // Add the new blocks.
    for (blockName in graphBlocks) {
        if(graphBlocks.hasOwnProperty(blockName)) {
            SpriteMorph.prototype.blocks[blockName] = graphBlocks[blockName];
        }
    }
}());


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

        var blocks = [];
        if(category === 'graph')
        {
            blocks.push(block('newGraph'));
            blocks.push(block('newDiGraph'));
            blocks.push(block('clearGraph'));
            blocks.push(block('setActiveGraph'));
            blocks.push(block('numberOfNodes'));
            blocks.push(block('addNode'));
            blocks.push(block('removeNode'));
            blocks.push(block('addEdge'));
            blocks.push(block('removeEdge'));
            blocks.push(block('getNeighbors'));
            blocks.push(block('setNodeAttrib'));
            blocks.push(block('getNodeAttrib'));
            blocks.push(block('setEdgeAttrib'));
            blocks.push(block('getEdgeAttrib'));
            blocks.push(block('getNodes'));
            blocks.push(block('getNodesWithAttr'));
            blocks.push(block('getEdges'));
            blocks.push(block('getEdgesWithAttr'));
            blocks.push(block('hasNode'));
            blocks.push(block('hasEdge'));
            blocks.push(block('getOutgoing'));
            blocks.push(block('getIncoming'));
            blocks.push(block('isConnected'));
            blocks.push(block('isStronglyConnected'));
            blocks.push(block('isWeaklyConnected'));
            blocks.push(block('generateBalancedTree'));
            blocks.push(block('generateCycleGraph'));
            blocks.push(block('generateCompleteGraph'));
            blocks.push(block('generatePathGraph'));
            blocks.push(block('generateGridGraph'));
            blocks.push(block('loadGraphFromURL'));
            blocks.push(block('topologicalSort'));
        }
        return blocks.concat(oldBlockTemplates.call(this, category));
    };
}(SpriteMorph.prototype.blockTemplates));

SpriteMorph.prototype.graphToJSON = function() {
    return JSON.stringify(graphToObject(this.G));
};

SpriteMorph.prototype.graphFromJSON = function(json) {
    this.G = objectToGraph(JSON.parse(json));
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
