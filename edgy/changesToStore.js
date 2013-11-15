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
        });
        if(graphLoaded) {
            object.setActiveGraph();
        }
        return oldLoadObject.call(this, object, model);
    };
}(SnapSerializer.prototype.loadObject));

}());
