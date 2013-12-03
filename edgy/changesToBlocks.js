// Since we're not supposed to be altering the original file too much, monkey
// patching is in order.

(function() {
"use strict";

SymbolMorph.prototype.drawSymbolTurtle = function (canvas, color) {
    // Draw a K_n graph.
    var ctx = canvas.getContext('2d'),
        n = 5,
        node_r = Math.min(canvas.height, canvas.width) / 10,
        r = Math.min(canvas.height, canvas.width) / 2 - node_r,
        i, j;

    ctx.save()

    ctx.lineWidth = 0.5;
    ctx.fillStyle = color.toString();
    ctx.strokeStyle = color.toString();
    for(i = 0; i < n; ++i)
    {
        ctx.beginPath();
        var x = (r * Math.cos(2*Math.PI * i/n - Math.PI/2)) + canvas.width / 2,
            y = (r * Math.sin(2*Math.PI * i/n - Math.PI/2)) + canvas.height / 2;
        ctx.arc(x, y,
                node_r,
                0, 2 * Math.PI,
                false);
        ctx.fill();
        for(j = 0; j < n; ++j)
        {
            ctx.beginPath();
            var x2 = (r * Math.cos(2*Math.PI * j/n - Math.PI/2)) + canvas.width / 2,
                y2 = (r * Math.sin(2*Math.PI * j/n - Math.PI/2)) + canvas.height / 2;
            ctx.moveTo(x, y);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    }
    ctx.restore();

    return canvas;
};

SymbolMorph.prototype.drawSymbolTurtleOutline = SymbolMorph.prototype.drawSymbolTurtle;

PenMorph.prototype.drawNew = function (facing) {
    this.image = newCanvas(this.extent());
    SymbolMorph.prototype.drawSymbolTurtle(this.image, this.color.toString());
};

}());
