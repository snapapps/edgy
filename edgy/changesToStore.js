// Since we're not supposed to be altering the original file too much, monkey
// patching is in order.

(function() {
"use strict";

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
