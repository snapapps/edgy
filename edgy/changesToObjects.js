// Since we're not supposed to be altering the original file too much, monkey
// patching is in order.

(function() {
"use strict";

var graphEl = d3.select(document.body)
        .append('div')
        .style('position', 'absolute'),
    currentGraph = null, // The current JSNetworkX graph to display.
    layout = null; // The d3.layout instance controlling the graph display.

graphEl.on("contextmenu", function() { d3.event.preventDefault(); })

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
                return d.data.color;
            }
        },
        label_style: {fill: 'white' },
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

        return oldInit.call(this, globals);
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
    return this.G.size();
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
    try {
        return this.G.node.get(node)[attrib];
    } catch(e) { // Do not die if we ask about a nonexistent node or attrib.
        return null;
    }
};

(function() {
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
        }
        return blocks.concat(oldBlockTemplates.call(this, category));
    };
}(SpriteMorph.prototype.blockTemplates));

}());
