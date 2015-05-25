
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
        } else if (value instanceof PriorityQueue) {
            morphToShow = new PriorityQueueMorph(value);
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

// Show the result of maps and priority queues in the output box.

CellMorph.prototype.drawNew = (function() {
    // Draw snap's results.
    var oldDrawNew = CellMorph.prototype.drawNew;

    return function () {
        var fontSize = SyntaxElementMorph.prototype.fontSize,
            isSameList = (this.contentsMorph instanceof ListWatcherMorph
                && this.contentsMorph.list === this.contents);
        
        if (this.isBig) {
            fontSize = fontSize * 1.5;
        }
        
        // re-build my contents
        if (this.contentsMorph && !isSameList) {
            this.contentsMorph.destroy();
        }
        
        if (this.contents instanceof Map || this.contents instanceof PriorityQueue) {
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
                else if (this.contents instanceof PriorityQueue) {
                    this.contents = new PriorityQueueMorph(this.contents, this);
                    this.contents.isDraggable = false;
                }
            }
        }
        
        oldDrawNew.call(this);
    };
})();

(function() {
CellMorph.prototype.isCircular = (function(oldIsCircular) {
    return function(collection) {
        if (!this.parentCell) { return false; }
        if (collection instanceof Map || collection instanceof PriorityQueue) {
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
    var val = dict.get(key);
    // Avoid infinite loop due to Snap! handling of undefined in reporters.
    if(val === undefined)
        throw new Error("No entry " + key + " in dict.")
    return val;
};

SpriteMorph.prototype.setDict = function(key, dict, val) {
    dict.lastChanged = Date.now();
    return dict.set(key, val);
};

SpriteMorph.prototype.keysInDict = function(dict) {
    return new List(Array.from(dict.keys()));
};

SpriteMorph.prototype.keyInDict = function(dict, key) {
    var val = dict.get(key);
    return !(val === undefined);
};

SpriteMorph.prototype.removeFromDict = function(key, dict) {
    dict.lastChanged = Date.now();
    return dict.delete(key);
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
        removeFromDict: {
            type: 'command',
            category: 'lists',
            spec: 'remove %s from dict %map',
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
        },
        keysInDict: {
            type: 'reporter',
            category: 'lists',
            spec: 'keys in dict %map',
        }
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
Priority queue
*/

// Inherits from binary heap
var PriorityQueue;

function PriorityQueue(items, predicate) {
    this.predicate = predicate || function(a, b) { return a > b; };
    this.items = [null].concat(items || [null]);
    this.count = items.length;
    this.lastChanged = Date.now();
    for (var i = Math.floor(this.count / 2); i > 0; i--) {
        this.downHeap(i);
    }
}

PriorityQueue.prototype = new BinaryHeap();
PriorityQueue.prototype.constructor = PriorityQueue;

PriorityQueue.prototype.upHeap = function(i) {
    BinaryHeap.prototype.upHeap.call(this, i);
    this.lastChanged = Date.now();
}

PriorityQueue.prototype.downHeap = function(i) {
    BinaryHeap.prototype.downHeap.call(this, i);
    this.lastChanged = Date.now();
}

PriorityQueue.prototype.top = function() {
    if (this.isEmpty()) {
        throw new Error("Priority queue is empty");
    }
    
    return BinaryHeap.prototype.top.call(this).element;
}

PriorityQueue.prototype.pop = function() {
    if (this.isEmpty()) {
        throw new Error("Priority queue is empty");
    }
    
    BinaryHeap.prototype.pop.call(this);
}

PriorityQueue.prototype.isEmpty = function() {
    return this.length() === 0;
}

PriorityQueue.prototype.toString = function() {
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

PriorityQueue.prototype.toArray = function() {
    var array = [];
    for (var i = 1; i <= this.count; i++) {
        array.push(this.items[i].element);
    }
    return array;
};

function Entry(element, priority) {
    this.element = element;
    this.priority = priority;
}

Entry.prototype.toString = function() {
    return this.element.toString();
}

var PriorityQueueMorph;

// PriorityQueueMorph watches a pqueue
function PriorityQueueMorph(pqueue, parentCell) {
    this.init(pqueue, parentCell);
}

// Inherits from BoxMorph
PriorityQueueMorph.prototype = new BoxMorph();
PriorityQueueMorph.prototype.constructor = PriorityQueueMorph;
PriorityQueueMorph.uber = BoxMorph.prototype;

// Default settings
PriorityQueueMorph.prototype.cellColor =
    SpriteMorph.prototype.blockColor.lists;

PriorityQueueMorph.prototype.init = function(pqueue, parentCell) {
    var myself = this;
    this.pqueue = pqueue || new PriorityQueue();
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
        localize('top: '),
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

    PriorityQueueMorph.uber.init.call(
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

PriorityQueueMorph.prototype.update = function(anyway) {
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

PriorityQueueMorph.prototype.updateLength = function(notDone) {
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

PriorityQueueMorph.prototype.fixLayout = function () {
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

PriorityQueueMorph.prototype.drawNew = function () {
    WatcherMorph.prototype.drawNew.call(this);
    this.fixLayout();
};

// Monkey patch WatcherMorph so it knows about our PriorityQueueMorph
(function() {
WatcherMorph.prototype.update = (function(oldUpdate) {
    return function() {
        var result = oldUpdate.call(this);
        if (this.cellMorph.contentsMorph instanceof PriorityQueueMorph) {
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
    return new PriorityQueue(
        entries,
        function(a, b) {
            return a.priority > b.priority;
        }
    );
};

SpriteMorph.prototype.reportNewMinPQueue = function(elements) {
    var entries = [];
    for (var i = 0; i < elements.contents.length; i += 2) {
        entries.push(new Entry(elements.contents[i], parseFloat(elements.contents[i + 1])));
    }
    return new PriorityQueue(
        entries,
        function(a, b) {
            return a.priority < b.priority;
        }
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

        pqueue.upHeap(index + 1);
        pqueue.downHeap(index + 1);
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
        },
        reportNewMinPQueue: {
            type: 'reporter',
            category: 'lists',
            spec: 'min pqueue %exppairs',
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
            spec: 'push %s to pqueue %l with priority %s',
        },
        popPQueue: {
            type: 'command',
            category: 'lists',
            spec: 'pop from pqueue %l',
        },
        updatePQueue: {
            type: 'command',
            category: 'lists',
            spec: 'update %s in pqueue %l to priority %s',
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
        } else {
            return blocks.concat(oldBlockTemplates.call(this, category));
        }
        return blocks;
    };
}(SpriteMorph.prototype.blockTemplates));
