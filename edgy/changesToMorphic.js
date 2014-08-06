// Since we're not supposed to be altering the original file too much, monkey
// patching is in order.

(function() {
"use strict";

PenMorph.prototype.drawNew = function (facing) {
    this.image = newCanvas(this.extent());
    SymbolMorph.prototype.drawSymbolTurtle(this.image, this.color.toString());
};

WorldMorph.prototype.initEventListeners = (function initEventListeners(oldInitEventListeners) {
    return function() {
        var retval = oldInitEventListeners.call(this);
        window.onbeforeunload = function (evt) {
            var current = ide_.serializer.serialize(ide_.stage);
            var lastSaved = localStorage['-snap-project-' + ide_.projectName];
            if((lastSaved === undefined && current === ide_.emptyStageString) ||
                current === lastSaved)
                return; // No modifications were made, don't warn user about exit.

            var e = evt || window.event,
                msg = "Your project has unsaved changes.";
            // For IE and Firefox
            if (e) {
                e.returnValue = msg;
            }
            // For Safari / chrome
            return msg;
        };
        window.onunload = function() {
            clickstream.log("sessionend");
            localStorage['-snap-clickstream'] = JSON.stringify(clickstream);
        }
        return retval;
    };
}(WorldMorph.prototype.initEventListeners));

}());
