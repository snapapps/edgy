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

}());
