// Since we're not supposed to be altering the original file too much, monkey
// patching is in order.

(function() {
"use strict";

SnapSerializer.prototype.loadInput = (function(oldLoadInput) {
    return function (model, input, block) {
        var myself = this;
        if (model.tag === 'pairs') {
            while (input.inputs().length > 0) {
                input.removeInput();
            }
            model.children.forEach(function (item, i) {
                if (i % 2 == 0) {
                    input.addInput();
                }
                myself.loadInput(
                    item,
                    input.children[input.children.length - 3 + (i % 2)],
                    input
                );
            });
            input.fixLayout();
        }
        else {
            return oldLoadInput.call(this, model, input, block);
        }
    };
}(SnapSerializer.prototype.loadInput));

SnapSerializer.prototype.loadValue = (function(oldLoadValue) {
    return function (model) {
        var myself = this;
        switch (model.tag) {
            case 'map':
                var res = new Map();
                var keys = model.childrenNamed('key').map(function (item) {
                    var value = item.children[0];
                    if (!value) {
                        return 0;
                    }
                    return myself.loadValue(value);
                });
                var values = model.childrenNamed('value').map(function (item) {
                    var value = item.children[0];
                    if (!value) {
                        return 0;
                    }
                    return myself.loadValue(value);
                });
                for (var i = 0; i < keys.length; i++) {
                    res.set(keys[i], values[i]);
                }
                return res;
            case 'pqueue':
                var type = model.attributes.type;
                var elements = model.childrenNamed('element').map(function (item) {
                    var value = item.children[0];
                    if (!value) {
                        return 0;
                    }
                    return myself.loadValue(value);
                });
                var priorities = model.childrenNamed('priority').map(function (item) {
                    var value = item.children[0];
                    if (!value) {
                        return 0;
                    }
                    return myself.loadValue(value);
                });
                var entries = [];
                for (var i = 0; i < elements.length; i++) {
                    entries.push(new Entry(elements[i], priorities[i]));
                }
                return new PQueue(entries, type);
        }

        return oldLoadValue.call(this, model);
    };
}(SnapSerializer.prototype.loadValue));

SnapSerializer.prototype.loadObject = (function loadObject (oldLoadObject) {
    return function (object, model)
    {
        var retval = oldLoadObject.call(this, object, model);

        if(object.graphFromJSON) {
            object.loadCostumesAsPatterns();
        }

        var graphLoaded = false;
        model.children.forEach(function (child) {
            if (child.tag === 'graph') {
                object.graphFromJSON(child.contents);
                graphLoaded = true;
            }
            if (child.tag == 'nodeattrs') {
                child.children.forEach(function (attr) {
                    object.addNodeAttribute(attr.attributes.name);
                });
            }
            if (child.tag == 'edgeattrs') {
                child.children.forEach(function (attr) {
                    object.addEdgeAttribute(attr.attributes.name);
                });
            }
        });

        if(graphLoaded) {
            object.setActiveGraph();
        }

        return retval;
    };
}(SnapSerializer.prototype.loadObject));

Map.prototype.toXML = function (serializer, mediaContext) {
    var xml = '';
    this.forEach(function(value, key) {
        var k = serializer.format(
            '<key>%</key>',
            typeof key === 'object' ?
                    serializer.store(key, mediaContext)
                    : typeof key === 'boolean' ?
                            serializer.format('<bool>$</bool>', key)
                            : serializer.format('<l>$</l>', key)
        );
        
        var v = serializer.format(
            '<value>%</value>',
            typeof value === 'object' ?
                    serializer.store(value, mediaContext)
                    : typeof value === 'boolean' ?
                            serializer.format('<bool>$</bool>', value)
                            : serializer.format('<l>$</l>', value)
        );
        
        xml += k + v;
    });
    
    return serializer.format('<map>%</map>', xml);
};

}());
