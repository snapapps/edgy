
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
MultiArgPairsMorph.prototype.toXML = function (serializer) {
    return serializer.format(
        '<pairs>%</pairs>',
        serializer.store(this.inputs())
    );
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
    this.parentCell = parentCell || null; // for circularity detection
    this.lastUpdated = Date.now();
    
    // elements declarations
    this.label = new StringMorph(
        localize('length: ') + this.map.size,
        SyntaxElementMorph.prototype.fontSize,
        null,
        false,
        false,
        false,
        MorphicPreferences.isFlat ? new Point() : new Point(1, 1),
        new Color(255, 255, 255)
    );
    
    this.frame = new ScrollFrameMorph(null, 10);
    this.frame.alpha = 0;
    this.frame.acceptsDrops = false;
    this.frame.contents.acceptsDrops = false;
    
    this.column = new AlignmentMorph("column");
    this.column.alignment = "left";
    this.frame.contents.add(this.column);
    
    this.handle = new HandleMorph(
        this,
        90,
        70,
        3,
        3
    );
    this.handle.setExtent(new Point(13, 13));

    MapMorph.uber.init.call(
        this,
        SyntaxElementMorph.prototype.rounding,
        1.000001, // shadow bug in Chrome,
        new Color(120, 120, 120)
    );

    this.color = new Color(220, 220, 220);
    this.isDraggable = true;
    this.setExtent(new Point(90, 70).multiplyBy(
        SyntaxElementMorph.prototype.scale
    ));
    this.add(this.label);
    this.add(this.frame);
    this.add(this.handle);
    this.handle.drawNew();
    this.update(true);
    this.fixLayout();
};

MapMorph.prototype.update = function (anyway) {
    this.column.children.forEach(function(child) {
        var key = child.children[1];
        var value = child.children[2];
        
        if (key && key.contentsMorph.update) {
            key.contentsMorph.update();
        }
        
        if (value && value.contentsMorph.update) {
            value.contentsMorph.update();
        }
    });
    
    if (this.lastUpdated > this.map.lastChanged && !anyway) {
        return null;
    }
    
    this.updateLength(true);
    
    var myself = this;
    // Rebuild contents
    var i = 0;
    this.map.forEach(function(value, key) {
        var row = myself.column.children[i];
        if (row) {
            // Row already exists
            var keyCell = row.children[1];
            var valueCell = row.children[2];
            
            if (keyCell.contents != key) {
                keyCell.contents = key;
                keyCell.drawNew();
            }
            
            if (valueCell.contents != value) {
                valueCell.contents = value;
                valueCell.drawNew();
            }
            
            row.drawNew();
            row.fixLayout();
        }
        else {
            // Row doesn't exist
            var row = new AlignmentMorph("row", 2);
            row.add(new StringMorph(
                i + 1,
                SyntaxElementMorph.prototype.fontSize,
                null,
                false,
                false,
                false,
                MorphicPreferences.isFlat ? new Point() : new Point(1, 1),
                new Color(255, 255, 255)
            ));
            row.add(new CellMorph(key, myself.cellColor, null, myself.parentCell));
            row.add(new CellMorph(value, myself.cellColor, null, myself.parentCell));
            myself.column.add(row);
            row.drawNew();
            var oldFixLayout = row.fixLayout;
            row.fixLayout = function() {
                oldFixLayout.call(this);
                myself.fixLayout(true);
            };
        }
        i++;
    });
    
    // Delete excess rows
    while (this.map.size < this.column.children.length) {
        this.column.children[this.map.size].destroy();
    }

    this.column.drawNew();
    this.column.fixLayout();
    
    this.lastUpdated = Date.now();
    
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

MapMorph.prototype.fixLayout = function (inside) {
    Morph.prototype.trackChanges = false;
    
    if (this.column) {
        if (!inside) {
            this.column.children.forEach(function(child) {
                child.drawNew();
                child.fixLayout();
            });
        }
        
        this.column.drawNew();
        this.column.fixLayout();
        this.column.silentSetPosition(this.frame.position());
    }
    
    if (this.frame) {
        this.frame.silentSetPosition(this.position().add(3));
        this.frame.bounds.corner = this.bounds.corner.subtract(new Point(3, 17));
        this.frame.drawNew();
        
        this.frame.contents.setTop(this.frame.top());
        this.frame.contents.setLeft(this.frame.left());
        this.frame.contents.adjustBounds();
    }
    
    this.label.setCenter(this.center());
    this.label.setBottom(this.bottom() - 3);
    
    Morph.prototype.trackChanges = true;
    this.changed();

    if (this.parent && this.parent.fixLayout) {
        this.parent.fixLayout();
    }
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

// Monkey patch WatcherMorph so it knows about our MapMorph
(function() {
WatcherMorph.prototype.update = (function(oldUpdate) {
    return function() {
        var result = oldUpdate.call(this);
        if (this.cellMorph.contentsMorph instanceof MapMorph) {
            this.cellMorph.contentsMorph.update();
        }
        return result;
    };
}(WatcherMorph.prototype.update));
})();

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
        } else if (value instanceof PQueue) {
            morphToShow = new PQueueMorph(value);
            morphToShow.isDraggable = false;
            isClickable = true;
        } else if (value instanceof DisjointSet) {
            morphToShow = new DisjointSetMorph(value);
            morphToShow.isDraggable = false;
            isClickable = true;
        }
        else {
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

// Show the result of maps and priority queues in the output box.
CellMorph.prototype.drawNew = (function(toggle, type) {
    // Draw snap's results.
    var oldDrawNew = CellMorph.prototype.drawNew;

    return function () {
        if (this.contents instanceof Map || this.contents instanceof PQueue || this.contents instanceof DisjointSet) {
            if (this.isCircular()) {
                this.contents = new TextMorph(
                    '(...)',
                    fontSize,
                    null,
                    false, // bold
                    true, // italic
                    'center'
                );
                this.contents.setColor(new Color(255, 255, 255));
            }
            else {
                if (this.contents instanceof Map) {
                    this.contents = new MapMorph(this.contents, this);
                    this.contents.isDraggable = false;
                }
                else if (this.contents instanceof PQueue) {
                    this.contents = new PQueueMorph(this.contents, this);
                    this.contents.isDraggable = false;
                }
                else if (this.contents instanceof DisjointSet) {
                    this.contents = new DisjointSetMorph(this.contents, this);
                    this.contents.isDraggable = false;
                }
            }
        }
        
        oldDrawNew.call(this, toggle, type);
    };
})();

(function() {
CellMorph.prototype.isCircular = (function(oldIsCircular) {
    return function(collection) {
        if (!this.parentCell) { return false; }
        if (collection instanceof Map || collection instanceof PQueue) {
            return this.contents === collection || this.parentCell.isCircular(collection);
        }
        return oldIsCircular.call(this, collection);
    };
}(CellMorph.prototype.isCircular));
})();

// Make list update pqueues and maps inside
(function() {
ListWatcherMorph.prototype.update = (function(oldUpdate) {
    return function(anyway) {
        this.frame.contents.children.forEach(function (m) {
            if (m instanceof CellMorph && 
                !(m.contentsMorph instanceof ListWatcherMorph) && 
                m.contentsMorph.update) {
                
                m.contentsMorph.update();
            }
        });
        return oldUpdate.call(this, anyway);
    };
}(ListWatcherMorph.prototype.update));
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
            defaults: ['item', 3]
        },
        reportCounterCount: {
            type: 'reporter',
            category: 'lists',
            spec: 'count %s in %map',
            defaults: ['item']
        },
    };

    SpriteMorph.prototype.initBlocks = (function (oldInitBlocks) {
        return function() {
            oldInitBlocks.call(this);
            // Add the new blocks.
            for (blockName in blocks) {
                if(blocks.hasOwnProperty(blockName)) {
                    SpriteMorph.prototype.blocks[blockName] = blocks[blockName];
                }
            }
        };
    }(SpriteMorph.prototype.initBlocks));
}());

/**
Dict
*/

SpriteMorph.prototype.reportNewDict = function(elements) {
    var res = new Map();
    for(var i=0;i<elements.contents.length;i+=2){
        var key = elements.contents[i];
        
        // Fix for #378
        var k = parseInt(key);
        if (k.toString() == key) {
            key = k;
        }
        
        res.set(key, elements.contents[i+1]);
    }
    return res;
};

SpriteMorph.prototype.reportDictLength = function(dict) {
    return dict.size;
};

SpriteMorph.prototype.getDict = function(key, dict) {
    // Fix for #378
    var k = parseInt(key);
    if (k.toString() == key) {
        key = k;
    }
    
    var val = dict.get(key);
    // Avoid infinite loop due to Snap! handling of undefined in reporters.
    if(val === undefined)
        throw new Error("No entry " + key + " in dict.")
    return val;
};

SpriteMorph.prototype.setDict = function(key, dict, val) {
    dict.lastChanged = Date.now();
    
    // Fix for #378
    var k = parseInt(key);
    if (k.toString() == key) {
        key = k;
    }
    
    return dict.set(key, val);
};

SpriteMorph.prototype.keysInDict = function(dict) {
    return new List(Array.from(dict.keys()));
};

SpriteMorph.prototype.keyInDict = function(dict, key) {
    // Fix for #378
    var k = parseInt(key);
    if (k.toString() == key) {
        key = k;
    }
    
    var val = dict.get(key);
    return !(val === undefined);
};

SpriteMorph.prototype.removeFromDict = function(key, dict) {
    dict.lastChanged = Date.now();
    
    // Fix for #378
    var k = parseInt(key);
    if (k.toString() == key) {
        key = k;
    }
    
    return dict.delete(key);
};

(function() {
    var blocks = {
        reportNewDict: {
            type: 'reporter',
            category: 'lists',
            spec: 'dict %exppairs',
            defaults: ['key', 'value']
        },
        getDict: {
            type: 'reporter',
            category: 'lists',
            spec: 'get %s in dict %map',
            defaults: ['key']
        },
        setDict: {
            type: 'command',
            category: 'lists',
            spec: 'set %s in dict %map to %s',
            defaults: ['key', null, 'value']
        },
        removeFromDict: {
            type: 'command',
            category: 'lists',
            spec: 'remove %s from dict %map',
            defaults: ['key']
        },
        reportDictLength: {
            type: 'reporter',
            category: 'lists',
            spec: 'length of dict %map',
        },
        keyInDict: {
            type: 'predicate',
            category: 'lists',
            spec: 'dict %map contains key %s',
            defaults: [null, 'key']
        },
        keysInDict: {
            type: 'reporter',
            category: 'lists',
            spec: 'keys in dict %map',
        }
    };

    SpriteMorph.prototype.initBlocks = (function (oldInitBlocks) {
        return function() {
            oldInitBlocks.call(this);
            // Add the new blocks.
            for (blockName in blocks) {
                if(blocks.hasOwnProperty(blockName)) {
                    SpriteMorph.prototype.blocks[blockName] = blocks[blockName];
                }
            }
        };
    }(SpriteMorph.prototype.initBlocks));
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
            defaults: ['item']
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

    SpriteMorph.prototype.initBlocks = (function (oldInitBlocks) {
        return function() {
            oldInitBlocks.call(this);
            // Add the new blocks.
            for (blockName in blocks) {
                if(blocks.hasOwnProperty(blockName)) {
                    SpriteMorph.prototype.blocks[blockName] = blocks[blockName];
                }
            }
        };
    }(SpriteMorph.prototype.initBlocks));
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
            spec: 'head of queue %l',
        },
        reportQueueLength: {
            type: 'reporter',
            category: 'lists',
            spec: 'length of queue %l',
        },
        pushQueue: {
            type: 'command',
            category: 'lists',
            spec: 'enqueue %s to queue %l',
            defaults: ['item']
        },
        popQueue: {
            type: 'command',
            category: 'lists',
            spec: 'dequeue from queue %l',
        },
        isQueueEmpty: {
            type: 'predicate',
            category: 'lists',
            spec: 'is queue %l empty',
        },
    };

    SpriteMorph.prototype.initBlocks = (function (oldInitBlocks) {
        return function() {
            oldInitBlocks.call(this);
            // Add the new blocks.
            for (blockName in blocks) {
                if(blocks.hasOwnProperty(blockName)) {
                    SpriteMorph.prototype.blocks[blockName] = blocks[blockName];
                }
            }
        };
    }(SpriteMorph.prototype.initBlocks));
}());

/**
Priority queue
*/

// Inherits from binary heap
var PQueue;

function PQueue(items, type) {
    this.type = type || 'max';
    this.predicate = this.type == 'max' ? 
        function(a, b) { return a.priority > b.priority; } :
            function(a, b) { return a.priority < b.priority; };
    this.items = [null].concat(items || [null]);
    this.count = items.length;
    this.build();
    
    this.lastChanged = Date.now();
}

PQueue.prototype = new BinaryHeap();
PQueue.prototype.constructor = PQueue;

PQueue.prototype.upHeap = function(i) {
    BinaryHeap.prototype.upHeap.call(this, i);
    this.lastChanged = Date.now();
}

PQueue.prototype.downHeap = function(i) {
    BinaryHeap.prototype.downHeap.call(this, i);
    this.lastChanged = Date.now();
}

PQueue.prototype.build = function() {
    for (var i = Math.floor(this.count / 2); i > 0; i--) {
        this.downHeap(i);
    }
}

PQueue.prototype.top = function() {
    if (this.isEmpty()) {
        throw new Error("Priority queue is empty");
    }
    
    return BinaryHeap.prototype.top.call(this).element;
}

PQueue.prototype.pop = function() {
    if (this.isEmpty()) {
        throw new Error("Priority queue is empty");
    }
    
    BinaryHeap.prototype.pop.call(this);
}

PQueue.prototype.isEmpty = function() {
    return this.length() === 0;
}

PQueue.prototype.contains = function(item) {
    for (var i = 1; i <= this.count; i++) {
        if (item == this.items[i].element)
            return true;
    }
    return false;
};

PQueue.prototype.toString = function() {
    if (this.length() > 0) {
        if (this.top() === this) {
            return "Priority Queue: Top(...)";
        }
        else {
            return "Priority Queue: Top(" + this.top().toString() + ")";
        }
    }
    return "Priority Queue: Empty";
}

PQueue.prototype.toArray = function() {
    var array = [];
    for (var i = 1; i <= this.count; i++) {
        array.push(this.items[i].element);
    }
    return array;
};

PQueue.prototype.toXML = function (serializer, mediaContext) {
    var xml = '';
    for (var i = 1; i <= this.count; i++) {
        var entry = this.items[i];
        var element = entry.element;
        var priority = entry.priority;
        
        var e = serializer.format(
            '<element>%</element>',
            typeof element === 'object' ?
                    serializer.store(element, mediaContext)
                    : typeof element === 'boolean' ?
                            serializer.format('<bool>$</bool>', element)
                            : serializer.format('<l>$</l>', element)
        );
        
        var p = serializer.format(
            '<priority>%</priority>',
            typeof priority === 'object' ?
                    serializer.store(priority, mediaContext)
                    : typeof priority === 'boolean' ?
                            serializer.format('<bool>$</bool>', priority)
                            : serializer.format('<l>$</l>', priority)
        );
        
        xml += e + p;
    };
    
    return serializer.format('<pqueue type="@">%</pqueue>', this.type || 'max', xml);
};

function Entry(element, priority) {
    this.element = element;
    this.priority = priority;
}

Entry.prototype.toString = function() {
    return this.element.toString();
}

var PQueueMorph;

// PQueueMorph watches a pqueue
function PQueueMorph(pqueue, parentCell) {
    this.init(pqueue, parentCell);
}

// Inherits from BoxMorph
PQueueMorph.prototype = new BoxMorph();
PQueueMorph.prototype.constructor = PQueueMorph;
PQueueMorph.uber = BoxMorph.prototype;

// Default settings
PQueueMorph.prototype.cellColor =
    SpriteMorph.prototype.blockColor.lists;

PQueueMorph.prototype.init = function(pqueue, parentCell) {
    var myself = this;
    this.pqueue = pqueue || new PQueue();
    this.parentCell = parentCell || null;
    this.lengthLabel = new StringMorph(
        localize('length: ') + this.pqueue.length(),
        SyntaxElementMorph.prototype.fontSize,
        null,
        false,
        false,
        false,
        MorphicPreferences.isFlat ? new Point() : new Point(1, 1),
        new Color(255, 255, 255)
    );
    this.topLabel = new StringMorph(
        localize('head: '),
        SyntaxElementMorph.prototype.fontSize,
        null,
        false,
        false,
        false,
        MorphicPreferences.isFlat ? new Point() : new Point(1, 1),
        new Color(255, 255, 255)
    );

    this.cell = new CellMorph(
        this.pqueue.isEmpty() ? "(Empty)" : this.pqueue.top(),
        this.cellColor,
        null,
        this.parentCell
    );

    PQueueMorph.uber.init.call(
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

    this.add(this.lengthLabel);
    this.add(this.topLabel);
    this.add(this.cell);
    this.update();
    this.fixLayout();
}

PQueueMorph.prototype.update = function(anyway) {
    if (this.cell.contentsMorph.update) {
        this.cell.contentsMorph.update();
    }
    
    if (this.lastUpdated > this.pqueue.lastChanged && !anyway) {
        return null;
    }

    var contents = this.pqueue.isEmpty() ? "(Empty)" : this.pqueue.top();
    if (this.cell.contents != contents) {
        this.cell.contents = contents;
        this.cell.drawNew();
    }

    this.updateLength();
    this.fixLayout();

    this.lastUpdated = Date.now();
}

PQueueMorph.prototype.updateLength = function(notDone) {
    this.lengthLabel.text = localize('length: ') + this.pqueue.length();
    if (notDone) {
        this.lengthLabel.color = new Color(0, 0, 100);
    }
    else {
        this.lengthLabel.color = new Color(0, 0, 0);
    }
    this.lengthLabel.drawNew();
    this.lengthLabel.setCenter(this.center());
    this.lengthLabel.setBottom(this.bottom() - 3);
}

PQueueMorph.prototype.fixLayout = function () {
    Morph.prototype.trackChanges = false;

    this.topLabel.setLeft(this.left() + 6);
    this.topLabel.setTop(this.top() + 6);
    this.cell.setLeft(this.topLabel.right() + 3);
    this.cell.setTop(this.top() + 3);
    this.lengthLabel.setCenter(this.center());
    this.lengthLabel.setBottom(this.bottom() - 3);
    this.silentSetExtent(this.cell.extent()
        .add(this.topLabel.extent())
        .add(new Point(12, 12))
    );
    WatcherMorph.prototype.drawNew.call(this);
    Morph.prototype.trackChanges = true;

    this.changed();
    if (this.parent && this.parent.fixLayout) {
        this.parent.fixLayout();
    }
}

PQueueMorph.prototype.drawNew = function () {
    WatcherMorph.prototype.drawNew.call(this);
    this.fixLayout();
};

// Monkey patch WatcherMorph so it knows about our PQueueMorph
(function() {
WatcherMorph.prototype.update = (function(oldUpdate) {
    return function() {
        var result = oldUpdate.call(this);
        if (this.cellMorph.contentsMorph instanceof PQueueMorph) {
            this.cellMorph.contentsMorph.update();
        }
        return result;
    };
}(WatcherMorph.prototype.update));
})();

SpriteMorph.prototype.reportNewMaxPQueue = function(elements) {
    var entries = [];
    for (var i = 0; i < elements.contents.length; i += 2) {
        entries.push(new Entry(elements.contents[i], parseFloat(elements.contents[i + 1])));
    }
    return new PQueue(
        entries,
        'max'
    );
};

SpriteMorph.prototype.reportNewMinPQueue = function(elements) {
    var entries = [];
    for (var i = 0; i < elements.contents.length; i += 2) {
        entries.push(new Entry(elements.contents[i], parseFloat(elements.contents[i + 1])));
    }
    return new PQueue(
        entries,
        'min'
    );
};

SpriteMorph.prototype.reportPQueueTop = function(pqueue) {
    return pqueue.top();
};

SpriteMorph.prototype.reportPQueueLength = function (pqueue) {
    return pqueue.length();
};

SpriteMorph.prototype.pushPQueue = function(element, pqueue, priority) {
    pqueue.push(new Entry(element, parseFloat(priority)));
};

SpriteMorph.prototype.popPQueue = function(pqueue) {
    pqueue.pop();
};

SpriteMorph.prototype.updatePQueue = function(element, pqueue, priority) {
    var index = pqueue.toArray().indexOf(element);
    if (index >= 0) {
        pqueue.items[index + 1].priority = parseFloat(priority);

        pqueue.build();
    }
};

SpriteMorph.prototype.isPQueueEmpty = function(pqueue) {
    return pqueue.isEmpty();
};

(function() {
    var blocks = {
        reportNewMaxPQueue: {
            type: 'reporter',
            category: 'lists',
            spec: 'max pqueue %exppairs',
            defaults: ['item', 1]
        },
        reportNewMinPQueue: {
            type: 'reporter',
            category: 'lists',
            spec: 'min pqueue %exppairs',
            defaults: ['item', 1]
        },
        reportPQueueTop: {
            type: 'reporter',
            category: 'lists',
            spec: 'head of pqueue %l',
        },
        reportPQueueLength: {
            type: 'reporter',
            category: 'lists',
            spec: 'length of pqueue %l',
        },
        pushPQueue: {
            type: 'command',
            category: 'lists',
            spec: 'enqueue %s to pqueue %l with priority %s',
            defaults: ['item', null, 1]
        },
        popPQueue: {
            type: 'command',
            category: 'lists',
            spec: 'dequeue from pqueue %l',
        },
        updatePQueue: {
            type: 'command',
            category: 'lists',
            spec: 'update %s in pqueue %l to priority %s',
            defaults: ['item', null, 1]
        },
        isPQueueEmpty: {
            type: 'predicate',
            category: 'lists',
            spec: 'is pqueue %l empty',
        },
    };

    SpriteMorph.prototype.initBlocks = (function (oldInitBlocks) {
        return function() {
            oldInitBlocks.call(this);
            // Add the new blocks.
            for (blockName in blocks) {
                if(blocks.hasOwnProperty(blockName)) {
                    SpriteMorph.prototype.blocks[blockName] = blocks[blockName];
                }
            }
        };
    }(SpriteMorph.prototype.initBlocks));
}());

/**
 * Disjoint Set
 */

var DisjointSet;

function DisjointSet(objects) {
    var myself = this;
    
    this.objects = new Map();
    this.lastChanged = Date.now();
    
    if (objects) {
        objects.forEach(function(object) {
            myself.objects.set(object, {
                parent: object,
                rank: 0
            })
        });
    }
}

DisjointSet.prototype.changed = function() {
    this.lastChanged = Date.now();
};

DisjointSet.prototype.add = function(object) {
    this.objects.set(object, {
        parent: object,
        rank: 0
    });
    this.changed();
};

DisjointSet.prototype.union = function(x, y) {
    xRoot = this.find(x);
    yRoot = this.find(y);
    if (xRoot == yRoot)
        return;
    
    xValue = this.objects.get(xRoot);
    yValue = this.objects.get(yRoot);
    
    if (xValue.rank < yValue.rank) {
        xValue.parent = yRoot;
    }
    else if (xValue.rank > yValue.rank) {
        yValue.parent = xRoot;
    }
    else {
        yValue.parent = xRoot;
        xValue.rank++;
    }
    this.changed();
};

DisjointSet.prototype.find = function(x) {
    var value = this.objects.get(x);
    if (value.parent != x) {
        value.parent = this.find(value.parent);
    }
    return value.parent;
};

// Watches a DisjointSet
var DisjointSetMorph;

function DisjointSetMorph(set, parentCell) {
    this.init(set, parentCell);
}

// Inherits from ListWatcherMorph

DisjointSetMorph.prototype = new ListWatcherMorph();
DisjointSetMorph.prototype.constructor = DisjointSetMorph;
DisjointSetMorph.uber = ListWatcherMorph.prototype;

DisjointSetMorph.prototype.init = function(set, parentCell) {
    this.set = set;
    
    DisjointSetMorph.uber.init.call(this, null, parentCell);
    
    this.update(true);
};

DisjointSetMorph.prototype.update = function(anyway) {
    if (this.lastUpdated === this.set.lastChanged && !anyway) {
        return null;
    }
    
    var myself = this;
    var sets = new Map();
    var items = this.set.objects.forEach(function(value, key) {
        var find = myself.set.find(key);
        if (!sets.has(find)) {
            sets.set(find, new List());
        }
        sets.get(find).add(key);
    });
    
    this.list = new List(Array.from(sets.values()));
    
    DisjointSetMorph.uber.update.call(this, anyway);
    
    this.lastUpdated = this.set.lastChanged;
};

// Monkey patch WatcherMorph so it knows about our DisjointSetMorph
(function() {
WatcherMorph.prototype.update = (function(oldUpdate) {
    return function() {
        var result = oldUpdate.call(this);
        if (this.cellMorph.contentsMorph instanceof DisjointSetMorph) {
            this.cellMorph.contentsMorph.update();
        }
        return result;
    };
}(WatcherMorph.prototype.update));
})();

SpriteMorph.prototype.reportNewDisjointSet = function(items) {
    return new DisjointSet(items.asArray());
};

SpriteMorph.prototype.addItemToDisjointSet = function(item, set) {
    set.add(item);
};

SpriteMorph.prototype.unionDisjointSet = function(x, y, set) {
    set.union(x, y);
};

SpriteMorph.prototype.findInDisjointSet = function(x, set) {
    return set.find(x);
};

(function() {
    var blocks = {
        reportNewDisjointSet: {
            type: 'reporter',
            category: 'lists',
            spec: 'disjoint set %exp',
            defaults: ['item']
        },
        addItemToDisjointSet: {
            type: 'command',
            category: 'lists',
            spec: 'add %s to disjoint set %l',
            defaults: ['item']
        },
        unionDisjointSet: {
            type: 'command',
            category: 'lists',
            spec: 'union %s and %s in disjoint set %l',
        },
        findInDisjointSet: {
            type: 'reporter',
            category: 'lists',
            spec: 'find %s in disjoint set %l',
        }
    };

    SpriteMorph.prototype.initBlocks = (function (oldInitBlocks) {
        return function() {
            oldInitBlocks.call(this);
            // Add the new blocks.
            for (blockName in blocks) {
                if(blocks.hasOwnProperty(blockName)) {
                    SpriteMorph.prototype.blocks[blockName] = blocks[blockName];
                }
            }
        };
    }(SpriteMorph.prototype.initBlocks));
}());

/**
Add the collection categories.
*/

(function() {
    SpriteMorph.prototype.categories.push('collections');
    SpriteMorph.prototype.blockColor.collections = new Color(217, 77, 17);
    SpriteMorph.prototype.initBlocks();
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
            blocks.push(block('removeFromDict'));
            blocks.push(block('reportDictLength'));
            blocks.push(block('keyInDict'));
            blocks.push(block('keysInDict'));
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
            blocks.push(block('reportNewMaxPQueue'));
            blocks.push(block('reportNewMinPQueue'));
            blocks.push(block('reportPQueueTop'));
            blocks.push(block('reportPQueueLength'));
            blocks.push(block('pushPQueue'));
            blocks.push(block('popPQueue'));
            blocks.push(block('updatePQueue'));
            blocks.push(block('isPQueueEmpty'));
            blocks.push('-');
            blocks.push(block('reportNewDisjointSet'));
            blocks.push(block('addItemToDisjointSet'));
            blocks.push(block('unionDisjointSet'));
            blocks.push(block('findInDisjointSet'));
        } else {
            return blocks.concat(oldBlockTemplates.call(this, category));
        }
        return blocks;
    };
}(SpriteMorph.prototype.blockTemplates));
