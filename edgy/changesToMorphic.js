// Since we're not supposed to be altering the original file too much, monkey
// patching is in order.

(function() {
"use strict";

PenMorph.prototype.drawNew = function (facing) {
    this.image = newCanvas(this.extent());
    SymbolMorph.prototype.drawSymbolTurtle(this.image, this.color.toString());
};

}());
