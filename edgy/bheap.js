// Binary heap adapted from
//     'http://www.bebetterdeveloper.com/data-structure-binary-heap'
// and 'http://eloquentjavascript.net/1st_edition/appendix2.html'

function BinaryHeap(predicate) {
    this.predicate = predicate || function(a, b) { return a > b; };
    this.items = [null];
    this.count = 0;
}

BinaryHeap.prototype.toString = function() {
    if (this.length() > 0) {
        return "Binary Heap: Top(" + this.top().toString() + ")";
    }
    return "Binary Heap: Empty";
}

BinaryHeap.prototype.toArray = function() {
    var array = [];
    for (var i = 1; i <= this.count; i++) {
        array.push(this.items[i]);
    }
    return array;
};

BinaryHeap.prototype.push = function(item) {
    this.items[++this.count] = item;
    
    /* ensure binary heap invariant */
    this.upHeap(this.count);

    /* expand array if necessary */
    if (this.count === this.items.length - 1) {
        this.resize(this.count * 2 + 1);
    }
};

BinaryHeap.prototype.top = function() {
    return this.items[1];
}

BinaryHeap.prototype.pop = function() {
    if (this.count === 0) return;

    this.items[1] = this.items[this.count];
    this.items[this.count--] = null;

    /* ensure binary heap invariant */
    this.downHeap(1);
    
    /* shrink array if necessary */
    if (this.count === this.items.length / 4) {
        this.resize(this.count * 2 + 1);
    }
};

BinaryHeap.prototype.upHeap = function(i) {
    var child = i;
    var parent = child >> 1;
    while (child > 1 && this.predicate(this.items[child], this.items[parent])) {
        var tmp = this.items[child];
        this.items[child] = this.items[parent];
        this.items[parent] = tmp;
        
        child = parent;
        parent = child >> 1;
    }
};

BinaryHeap.prototype.downHeap = function(i) {
    var parent = i;
    var child = parent << 1;
    while (child <= this.count) {
        if (child < this.count) {
            child = this.predicate(this.items[child], this.items[child + 1]) ? child : child + 1;
        }
        
        if (this.predicate(this.items[parent], this.items[child])) break;

        var tmp = this.items[parent];
        this.items[parent] = this.items[child];
        this.items[child] = tmp;

        parent = child;
        child = parent << 1;
    }
};

BinaryHeap.prototype.length = function() {
    return this.count;
};

BinaryHeap.prototype.resize = function(capacity) {
    var items = new Array(capacity);
    for (var i = 0; i <= this.count; i++) {
        items[i] = this.items[i];
    }
    this.items = items;
};