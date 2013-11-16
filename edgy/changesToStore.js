// Since we're not supposed to be altering the original file too much, monkey
// patching is in order.

(function() {
"use strict";

SnapSerializer.prototype.loadObject = (function loadObject (oldLoadObject) {
    return function (object, model)
    {
        var graphLoaded = false;
        model.children.forEach(function (child) {
            if (child.tag === 'graph') {
                object.graphFromJSON(child.contents);
                graphLoaded = true;
            }
            if (child.tag == 'nodeattrs') {
                child.children.forEach(function (attr) {
                    object.nodeAttributes.push(attr.attributes.name);
                });
            }
            if (child.tag == 'edgeattrs') {
                child.children.forEach(function (attr) {
                    object.edgeAttributes.push(attr.attributes.name);
                });
            }
        });
        if(graphLoaded) {
            object.setActiveGraph();
        }
        return oldLoadObject.call(this, object, model);
    };
}(SnapSerializer.prototype.loadObject));

}());
