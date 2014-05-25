
/* global MultiArgMorph, BoxMorph, SpriteMorph, StringMorph, SyntaxElementMorph,
CellMorph, ScrollFrameMorph, localize, MorphicPreferences, Color, Point,
HandleMorph, ArrowMorph, PushButtonMorph, PushButtonMorph, SpeechBubbleMorph,
MenuMorph, Morph, WatcherMorph, ArgMorph, StageMorph, List */

/**
MultiArgPairsMorph, a morph representing a Map input element.
*/

function MultiArgPairsMorph(
    slotSpec,
    labelTxt,
    min,
    eSpec,
    arrowColor,
    labelColor,
    shadowColor,
    shadowOffset,
    isTransparent
) {
    this.init(
        slotSpec,
        labelTxt,
        min,
        eSpec,
        arrowColor,
        labelColor,
        shadowColor,
        shadowOffset,
        isTransparent
    );
}
MultiArgPairsMorph.prototype = new MultiArgMorph();
MultiArgPairsMorph.prototype.constructor = MultiArgPairsMorph;
MultiArgPairsMorph.uber = MultiArgMorph.prototype;

MultiArgPairsMorph.prototype.addInput = function(contents) {
    // The arrow morph is the last child.
    if (this.children.length > 2) {
        this.children.splice(this.children.length - 1, 0, this.labelPart(','));
    }
    MultiArgMorph.prototype.addInput.call(this, contents);
    MultiArgMorph.prototype.addInput.call(this, contents);
};
MultiArgPairsMorph.prototype.removeInput = function(contents) {
    MultiArgMorph.prototype.removeInput.call(this, contents);
    MultiArgMorph.prototype.removeInput.call(this, contents);
    if (this.children.length > 2) {
        var oldPart = this.children[this.children.length - 2];
        this.removeChild(oldPart);
    }
};

/**
MapMorph, a morph representing Map object outputs.
*/

MapMorph.prototype = new BoxMorph();
MapMorph.prototype.constructor = MapMorph;
MapMorph.uber = BoxMorph.prototype;

// MapMorph default settings

MapMorph.prototype.cellColor =
    SpriteMorph.prototype.blockColor.lists;

// Result element.
function MapMorph(map, parentCell) {
    this.init(map, parentCell);
}

MapMorph.prototype.init = function (map, parentCell) {
    var myself = this;

    this.map = map || new Map();
    this.mapEntries = map.entries();
    if(!(this.mapEntries instanceof Array)){
        // convert iterator to array ([].slice.call doesn't work for firefox)
        var mapEntries = [];
        var iter = this.mapEntries;
        while(true){
            var nextValue = iter.next();
            if(nextValue.done)
                break;
            mapEntries.push(nextValue.value);
        }
        this.mapEntries = mapEntries;
    }
    this.start = 1;
    this.range = 100;
    this.lastUpdated = Date.now();
    this.lastCell = null;
    this.parentCell = parentCell || null; // for circularity detection

    // elements declarations
    this.label = new StringMorph(
        localize('size: ') + this.map.size,
        SyntaxElementMorph.prototype.fontSize,
        null,
        false,
        false,
        false,
        MorphicPreferences.isFlat ? new Point() : new Point(1, 1),
        new Color(255, 255, 255)
    );
    this.label.mouseClickLeft = function () {myself.startIndexMenu(); };


    this.frame = new ScrollFrameMorph(null, 10);
    this.frame.alpha = 0;
    this.frame.acceptsDrops = false;
    this.frame.contents.acceptsDrops = false;

    this.handle = new HandleMorph(
        this,
        80,
        70,
        3,
        3
    );
    this.handle.setExtent(new Point(13, 13));

    this.arrow = new ArrowMorph(
        'down',
        SyntaxElementMorph.prototype.fontSize
    );
    this.arrow.mouseClickLeft = function () {myself.startIndexMenu(); };
    this.arrow.setRight(this.handle.right());
    this.arrow.setBottom(this.handle.top());
    this.handle.add(this.arrow);

    this.plusButton = new PushButtonMorph(
        this.map,
        'add',
        '+'
    );
    this.plusButton.padding = 0;
    this.plusButton.edge = 0;
    this.plusButton.outlineColor = this.color;
    this.plusButton.drawNew();
    this.plusButton.fixLayout();

    MapMorph.uber.init.call(
        this,
        SyntaxElementMorph.prototype.rounding,
        1.000001, // shadow bug in Chrome,
        new Color(120, 120, 120)
    );

    this.color = new Color(220, 220, 220);
    this.isDraggable = true;
    this.setExtent(new Point(80, 70).multiplyBy(
        SyntaxElementMorph.prototype.scale
    ));
    this.add(this.label);
    this.add(this.frame);
    this.add(this.plusButton);
    this.add(this.handle);
    this.handle.drawNew();
    this.update();
    this.fixLayout();
};

MapMorph.prototype.update = function () {
    var i, idx, ceil, morphs, cell, cnts, label, button, max,
        starttime, maxtime = 1000;

    this.frame.contents.children.forEach(function (m) {

        if (m instanceof CellMorph && m.contentsMorph instanceof MapMorph) {
            m.contentsMorph.update();
        }
    });

    this.updateLength(true);

    // adjust start index to current mapEntries length
    this.start = Math.max(
        Math.min(
            this.start,
            Math.floor((this.map.size - 1) / this.range) * this.range + 1
        ),
        1
    );

    // refresh existing cells
    // highest index shown:
    max = Math.min(
        this.start + this.range - 1,
        this.map.size
    );

    // number of morphs available for refreshing
    ceil = Math.min(
        (max - this.start + 1) * 3,
        this.frame.contents.children.length
    );

    for (i = 0; i < ceil; i += 3) {
        idx = this.start + (i / 3);

        cell = this.frame.contents.children[i];
        label = this.frame.contents.children[i + 1];
        button = this.frame.contents.children[i + 2];
        cnts = this.mapEntries[idx];

        if (cell.contents !== cnts) {
            cell.contents = cnts;
            cell.drawNew();
            if (this.lastCell) {
                cell.setLeft(this.lastCell.left());
            }
        }
        this.lastCell = cell;

        if (label.text !== idx.toString()) {
            label.text = idx.toString();
            label.drawNew();
        }

        button.action = idx;
    }

    // remove excess cells
    // number of morphs to be shown
    morphs = (max - this.start + 1) * 3;

    while (this.frame.contents.children.length > morphs) {
        this.frame.contents.children[morphs].destroy();
    }

    // add additional cells
    ceil = morphs; //max * 3;
    i = this.frame.contents.children.length;

    starttime = Date.now();
    if (ceil > i + 1) {
        for (i; i < ceil; i += 3) {
            if (Date.now() - starttime > maxtime) {
                this.fixLayout();
                this.frame.contents.adjustBounds();
                this.frame.contents.setLeft(this.frame.left());
                return null;
            }
            idx = this.start + (i / 3);
            label = new StringMorph(
                idx.toString(),
                SyntaxElementMorph.prototype.fontSize,
                null,
                false,
                false,
                false,
                MorphicPreferences.isFlat ? new Point() : new Point(1, 1),
                new Color(255, 255, 255)
            );
            cell = new CellMorph(
                this.mapEntries[idx-1],
                this.cellColor,
                idx,
                this.parentCell
            );
            button = new PushButtonMorph(
                this.mapEntries.remove,
                idx-1,
                '-',
                this.mapEntries
            );
            button.padding = 1;
            button.edge = 0;
            button.corner = 1;
            button.outlineColor = this.color.darker();
            button.drawNew();
            button.fixLayout();

            this.frame.contents.add(cell);
            if (this.lastCell) {
                cell.setPosition(this.lastCell.bottomLeft());
            } else {
                cell.setTop(this.frame.contents.top());
            }
            this.lastCell = cell;
            label.setCenter(cell.center());
            label.setRight(cell.left() - 2);
            this.frame.contents.add(label);
            this.frame.contents.add(button);
        }
    }
    this.lastCell = null;

    this.fixLayout();
    this.frame.contents.adjustBounds();
    this.frame.contents.setLeft(this.frame.left());
    this.updateLength();
};

MapMorph.prototype.updateLength = function (notDone) {
    this.label.text = localize('length: ') + this.map.size;
    if (notDone) {
        this.label.color = new Color(0, 0, 100);
    } else {
        this.label.color = new Color(0, 0, 0);
    }
    this.label.drawNew();
    this.label.setCenter(this.center());
    this.label.setBottom(this.bottom() - 3);
};

MapMorph.prototype.startIndexMenu = function () {
    var i,
        range,
        myself = this,
        items = Math.ceil(this.map.size / this.range),
        menu = new MenuMorph(
            function (idx) {myself.setStartIndex(idx); },
            null,
            myself
        );
    menu.addItem('1...', 1);
    for (i = 1; i < items; i += 1) {
        range = i * 100 + 1;
        menu.addItem(range + '...', range);
    }
    menu.popUpAtHand(this.world());
};

MapMorph.prototype.setStartIndex = function (index) {
    this.start = index;
};

MapMorph.prototype.fixLayout = function () {
    Morph.prototype.trackChanges = false;
    if (this.frame) {
        this.arrangeCells();
        this.frame.silentSetPosition(this.position().add(3));
        this.frame.bounds.corner = this.bounds.corner.subtract(new Point(
            3,
            17
        ));
        this.frame.drawNew();
        this.frame.contents.adjustBounds();
    }

    this.label.setCenter(this.center());
    this.label.setBottom(this.bottom() - 3);
    this.plusButton.setLeft(this.left() + 3);
    this.plusButton.setBottom(this.bottom() - 3);

    Morph.prototype.trackChanges = true;
    this.changed();

    if (this.parent && this.parent.fixLayout) {
        this.parent.fixLayout();
    }
};

MapMorph.prototype.arrangeCells = function () {
    var i, cell, label, button, lastCell,
        end = this.frame.contents.children.length;
    for (i = 0; i < end; i += 3) {
        cell = this.frame.contents.children[i];
        label = this.frame.contents.children[i + 1];
        button = this.frame.contents.children[i + 2];
        if (lastCell) {
            cell.setTop(lastCell.bottom());
        }
        if (label) {
            label.setTop(cell.center().y - label.height() / 2);
            label.setRight(cell.left() - 2);
        }
        if (button) {
            button.setCenter(cell.center());
            button.setLeft(cell.right() + 2);
        }
        lastCell = cell;
    }
    this.frame.contents.adjustBounds();
};

// MapMorph hiding/showing:

MapMorph.prototype.show = function () {
    MapMorph.uber.show.call(this);
    this.frame.contents.adjustBounds();
};

// MapMorph drawing:

MapMorph.prototype.drawNew = function () {
    WatcherMorph.prototype.drawNew.call(this);
    this.fixLayout();
};

// MultiArgPairsMorph input.

SyntaxElementMorph.prototype.labelPart = (function(){
    var oldLabelPart = SyntaxElementMorph.prototype.labelPart;

    return function (spec) {
        var part = oldLabelPart.call(this, spec);
        if(part === undefined){
            switch (spec) {
                case '%exppairs':
                    part = new MultiArgPairsMorph('%s', null, 0);
                    part.addInput();
                    part.isStatic = true;
                    part.canBeEmpty = false;
                    break;
                case '%expN':
                    part = new MultiArgMorph('%n', null, 0);
                    part.addInput();
                    part.isStatic = true;
                    part.canBeEmpty = false;
                    break;
                case '%map':
                    // Draw a 'list' icon to accept variables, this only has an effect on the icon.
                    part = new ArgMorph('list');
                    break;
            }
            return part;
        }else{
            return part;
        }
    };
})();

// Show bubble containing output when the MultiArgPairsMorph input is clicked.

SyntaxElementMorph.prototype.showBubble = (function(){
    var oldShowBubble = SyntaxElementMorph.prototype.showBubble;

    return function (value) {
        var bubble,
            morphToShow,
            isClickable = false,
            wrrld = this.world();

        if ((value === undefined) || !wrrld) {
            return null;
        }
        if (value instanceof Map) {
            morphToShow = new MapMorph(value);
            morphToShow.isDraggable = false;
            isClickable = true;
        } else {
            return oldShowBubble.call(this, value);
        }
        bubble = new SpeechBubbleMorph(
            morphToShow,
            null,
            Math.max(this.rounding - 2, 6),
            0
        );
        bubble.popUp(
            wrrld,
            this.rightCenter().add(new Point(2, 0)),
            isClickable
        );
    };
})();

// Show the result of maps in the output box.

CellMorph.prototype.drawNew = (function() {
    // Draw snap's results.
    var oldDrawNew = CellMorph.prototype.drawNew;

    return function () {
        if (this.contents instanceof Map) {
            this.contentsMorph = new MapMorph(this.contents, this);
            this.contentsMorph.isDraggable = false;
            this.contents = this.contentsMorph;
            oldDrawNew.call(this);
        }else {
            oldDrawNew.call(this);
        }
    };
})();

/**
Counter
*/

SpriteMorph.prototype.reportNewCounter = function(elements) {
    var res = new Map();
    for(var i=0;i<elements.contents.length;i+=2){
        res.set(elements.contents[i], parseInt(elements.contents[i+1]));
    }
    return res;
};

SpriteMorph.prototype.reportCounterCount = function(key, counter) {
    return counter.get(key);
};

(function() {
    var blocks = {
        reportNewCounter: {
            type: 'reporter',
            category: 'lists',
            spec: 'counter %exppairs',
        },
        reportCounterCount: {
            type: 'reporter',
            category: 'lists',
            spec: 'count %s in %map',
        },
    };

    // Add the new blocks.
    for (var blockName in blocks) {
        if(blocks.hasOwnProperty(blockName)) {
            SpriteMorph.prototype.blocks[blockName] = blocks[blockName];
        }
    }
}());

/**
Dict
*/

SpriteMorph.prototype.reportNewDict = function(elements) {
    var res = new Map();
    for(var i=0;i<elements.contents.length;i+=2){
        res.set(elements.contents[i], elements.contents[i+1]);
    }
    return res;
};

SpriteMorph.prototype.reportDictLength = function(dict) {
    return dict.size;
};

SpriteMorph.prototype.getDict = function(key, dict) {
    return dict.get(key);
};

SpriteMorph.prototype.setDict = function(key, dict, val) {
    return dict.set(key, val);
};

(function() {
    var blocks = {
        reportNewDict: {
            type: 'reporter',
            category: 'lists',
            spec: 'dict %exppairs',
        },
        getDict: {
            type: 'reporter',
            category: 'lists',
            spec: 'get %s in dict %map',
        },
        setDict: {
            type: 'command',
            category: 'lists',
            spec: 'set %s in dict %map to %s',
        },
        reportDictLength: {
            type: 'reporter',
            category: 'lists',
            spec: 'length of dict %map',
        },
    };

    // Add the new blocks.
    for (var blockName in blocks) {
        if(blocks.hasOwnProperty(blockName)) {
            SpriteMorph.prototype.blocks[blockName] = blocks[blockName];
        }
    }
}());

/**
Stack, head is the first entry of the list, as in usual stack implementations.
*/

SpriteMorph.prototype.reportNewStack = function(list) {
    return list;
};

SpriteMorph.prototype.reportStackTop = function(list) {
    return list.at(1);
};

SpriteMorph.prototype.reportStackLength = function (list) {
    return list.length();
};

SpriteMorph.prototype.pushStack = function (element, list) {
    list.add(element, 1);
};

SpriteMorph.prototype.popStack = function (list) {
    // Don't return anything, as snap does not support reporting and returning at the same time.
    list.remove(1);
};

SpriteMorph.prototype.isStackEmpty = function (list) {
    return list.length() === 0;
};

(function() {
    var blocks = {
        reportNewStack: {
            type: 'reporter',
            category: 'lists',
            spec: 'stack %exp',
        },
        reportStackTop: {
            type: 'reporter',
            category: 'lists',
            spec: 'top of stack %l',
        },
        reportStackLength: {
            type: 'reporter',
            category: 'lists',
            spec: 'length of stack %l',
        },
        pushStack: {
            type: 'command',
            category: 'lists',
            spec: 'push %s to stack %l',
        },
        popStack: {
            type: 'command',
            category: 'lists',
            spec: 'pop from stack %l',
        },
        isStackEmpty: {
            type: 'predicate',
            category: 'lists',
            spec: 'is stack %l empty',
        },
    };

    // Add the new blocks.
    for (var blockName in blocks) {
        if(blocks.hasOwnProperty(blockName)) {
            SpriteMorph.prototype.blocks[blockName] = blocks[blockName];
        }
    }
}());

/**
Queue, head is the first entry of the list.
*/

SpriteMorph.prototype.reportNewQueue = function(list) {
    return list;
};

SpriteMorph.prototype.reportQueueTop = function(list) {
    return list.at(1);
};

SpriteMorph.prototype.reportQueueLength = function (list) {
    return list.length();
};

SpriteMorph.prototype.pushQueue = function (element, list) {
    list.add(element);
};

SpriteMorph.prototype.popQueue = function (list) {
    // Don't return anything, as snap does not support reporting and returning at the same time.
    list.remove(1);
};

SpriteMorph.prototype.isQueueEmpty = function (list) {
    return list.length() === 0;
};

(function() {
    var blocks = {
        reportNewQueue: {
            type: 'reporter',
            category: 'lists',
            spec: 'queue %exp',
        },
        reportQueueTop: {
            type: 'reporter',
            category: 'lists',
            spec: 'top of queue %l',
        },
        reportQueueLength: {
            type: 'reporter',
            category: 'lists',
            spec: 'length of queue %l',
        },
        pushQueue: {
            type: 'command',
            category: 'lists',
            spec: 'push %s to queue %l',
        },
        popQueue: {
            type: 'command',
            category: 'lists',
            spec: 'pop from queue %l',
        },
        isQueueEmpty: {
            type: 'predicate',
            category: 'lists',
            spec: 'is queue %l empty',
        },
    };

    // Add the new blocks.
    for (var blockName in blocks) {
        if(blocks.hasOwnProperty(blockName)) {
            SpriteMorph.prototype.blocks[blockName] = blocks[blockName];
        }
    }
}());

/**
Integer priority queue implemented by a binary min-heap inside an array, head is the first element of the array.
*/

// modified from http://eloquentjavascript.net/appendix2.html

var BinaryHeap = {
    push: function(heap, element) {
        heap.push(element);
        // bubble up element
        BinaryHeap.bubbleUp(heap, heap.length - 1);
    },

    pop: function(heap) {
        // Store the first element so we can return it later.
        var result = heap[0];
        // Get the element at the end of the array.
        var end = heap.pop();
        // If there are any elements left, put the end element at the
        // start, and let it sink down.
        if (heap.length > 0) {
            heap[0] = end;
            BinaryHeap.sinkDown(heap, 0);
        }
        return result;
    },

    heapify: function(heap) {
        for(var i=Math.floor(heap.length/2);i>=0;i--){
            BinaryHeap.sinkDown(heap, i);
        }
    },

    remove: function(heap, node) {
        var length = heap.length;
        // Find node by searching through the array.
        var i = heap.indexOf(node);
        if ( i == -1)
            return;
        // Use the last element to fill up the hole.
        var end = heap.pop();
        // If the element we popped was the one we needed to remove,
        // we're done.
        if (i == length - 1)
            return;
        // Otherwise, we replace the removed element with the popped
        // one, and allow it to float up or sink down as appropriate.
        heap[i] = end;
        BinaryHeap.bubbleUp(heap, i);
        BinaryHeap.sinkDown(heap, i);
    },

    replace: function(heap, node1, node2){
        if (node1 == node2)
            return;
        // Find node by searching through the array.
        var i = heap.indexOf(node1);
        if ( i == -1)
            return;
        heap[i] = node2;
        // Float up or sink down as appropriate.
        BinaryHeap.bubbleUp(heap, i);
        BinaryHeap.sinkDown(heap, i);
    },

    bubbleUp: function(heap, n) {
        var element = heap[n];
        // When at 0, an element can not go up any further.
        while (n > 0) {
            // Compute the parent element's index, and fetch it.
            var parentN = Math.floor((n + 1) / 2) - 1,
            parent = heap[parentN];
            // If the parent has a lesser score, things are in order and we
            // are done.
            if (element >= parent)
                break;

            // Otherwise, swap the parent with the current element and
            // continue.
            heap[parentN] = element;
            heap[n] = parent;
            n = parentN;
        }
    },

    sinkDown: function(heap, n) {
        // Look up the target element and its score.
        var length = heap.length, element = heap[n];

        while(true) {
            // Compute the indices of the child elements.
            var child2N = (n + 1) * 2, child1N = child2N - 1;
            // New position of element, if any.
            var swap = null;
            var child1, child2;
            if (child1N < length) {
                child1 = heap[child1N];
                if (child1 < element)
                    swap = child1N;
            }
            if (child2N < length) {
                child2 = heap[child2N];
                if (child2 < (swap === null ? element : child1))
                    swap = child2N;
            }

            // No need to swap further, we are done.
            if (swap === null)
                break;

            // Otherwise, swap and continue.
            heap[n] = heap[swap];
            heap[swap] = element;
            n = swap;
        }
    }
};

SpriteMorph.prototype.reportNewPQueue = function(list) {
    //create new list otherwise we'll end up in an infinite loop
    var res = new List();
    var elements = list.asArray();
    //convert all to ints
    for(var i=0;i<elements.length;i++){
        elements[i] = parseInt(elements[i]);
    }
    BinaryHeap.heapify(elements);
    res.contents = elements;
    res.changed();
    return res;
};

SpriteMorph.prototype.reportPQueueTop = function(list) {
    return list.at(1);
};

SpriteMorph.prototype.reportPQueueLength = function (list) {
    return list.length();
};

SpriteMorph.prototype.pushPQueue = function (element, list) {
    element = parseInt(element);
    var elements = list.asArray();
    BinaryHeap.push(elements, element);
    list.contents = elements;
    list.isLinked = false;
    list.changed();
};

SpriteMorph.prototype.popPQueue = function (list) {
    var elements = list.asArray();
    BinaryHeap.pop(elements);
    list.contents = elements;
    list.isLinked = false;
    list.changed();
};

SpriteMorph.prototype.replacePQueue = function (element1, element2, list) {
    element1 = parseInt(element1);
    element2 = parseInt(element2);
    var elements = list.asArray();
    BinaryHeap.replace(elements, element1, element2);
    list.contents = elements;
    list.isLinked = false;
    list.changed();
};

SpriteMorph.prototype.isPQueueEmpty = function (list) {
    return list.length() === 0;
};

(function() {
    var blocks = {
        reportNewPQueue: {
            type: 'reporter',
            category: 'lists',
            spec: 'pqueue %expN',
        },
        reportPQueueTop: {
            type: 'reporter',
            category: 'lists',
            spec: 'top of pqueue %l',
        },
        reportPQueueLength: {
            type: 'reporter',
            category: 'lists',
            spec: 'length of pqueue %l',
        },
        pushPQueue: {
            type: 'command',
            category: 'lists',
            spec: 'push %n to pqueue %l',
        },
        popPQueue: {
            type: 'command',
            category: 'lists',
            spec: 'pop from pqueue %l',
        },
        replacePQueue: {
            type: 'command',
            category: 'lists',
            spec: 'replace %n to %n in pqueue %l',
        },
        isPQueueEmpty: {
            type: 'predicate',
            category: 'lists',
            spec: 'is pqueue %l empty',
        },
    };

    // Add the new blocks.
    for (var blockName in blocks) {
        if(blocks.hasOwnProperty(blockName)) {
            SpriteMorph.prototype.blocks[blockName] = blocks[blockName];
        }
    }
}());

/**
Add the collection categories.
*/

(function() {
    SpriteMorph.prototype.categories.push('collections');
    SpriteMorph.prototype.blockColor.collections = new Color(74, 108, 212);
}());

SpriteMorph.prototype.blockTemplates = (function blockTemplates (oldBlockTemplates) {
    return function (category) {
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
        if (category === 'collections') {
            blocks = blocks.concat(oldBlockTemplates.call(this, category));
            blocks.push(block('reportNewCounter'));
            blocks.push(block('reportCounterCount'));
            blocks.push('-');
            blocks.push(block('reportNewDict'));
            blocks.push(block('getDict'));
            blocks.push(block('setDict'));
            blocks.push(block('reportDictLength'));
            blocks.push('-');
            blocks.push(block('reportNewStack'));
            blocks.push(block('reportStackTop'));
            blocks.push(block('reportStackLength'));
            blocks.push(block('pushStack'));
            blocks.push(block('popStack'));
            blocks.push(block('isStackEmpty'));
            blocks.push('-');
            blocks.push(block('reportNewQueue'));
            blocks.push(block('reportQueueTop'));
            blocks.push(block('reportQueueLength'));
            blocks.push(block('pushQueue'));
            blocks.push(block('popQueue'));
            blocks.push(block('isQueueEmpty'));
            blocks.push('-');
            blocks.push(block('reportNewPQueue'));
            blocks.push(block('reportPQueueTop'));
            blocks.push(block('reportPQueueLength'));
            blocks.push(block('pushPQueue'));
            blocks.push(block('popPQueue'));
            blocks.push(block('replacePQueue'));
            blocks.push(block('isPQueueEmpty'));
        } else {
            return blocks.concat(oldBlockTemplates.call(this, category));
        }
        return blocks;
    };
}(SpriteMorph.prototype.blockTemplates));
