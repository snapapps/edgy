// Since we're not supposed to be altering the original file too much, monkey
// patching is in order.

(function() {
"use strict";

SyntaxElementMorph.prototype.labelPart = (function(oldLabelPart) {
    return function (spec) {
        var part;

        if (this.selector !== 'reportGetVar') {
            switch (spec) {
                case '%expL':
                    part = new MultiArgMorph('%l', null, 0);
                    part.addInput();
                    part.isStatic = true;
                    part.canBeEmpty = false;
                    break;

                case '%cst2':
                    part = new InputSlotMorph(
                        null,
                        false,
                        'costumesMenu2',
                        true
                    );
                    break;
                case '%nodeAttr':
                        part = new InputSlotMorph(
                        null,
                        false,
                        'getNodeAttributeNames',
                        true
                    );
                    part.isStatic = true;
                    break;
                case '%allNodeAttr':
                    part = new InputSlotMorph(
                        null,
                        false,
                        'getAllNodeAttributeNames',
                        true
                    );
                    part.isStatic = true;
                    break;
                case '%edgeAttr':
                    part = new InputSlotMorph(
                        null,
                        false,
                        'getEdgeAttributeNames',
                        true
                    );
                    part.isStatic = true;
                    break;
                case '%ascdesc':
                    part = new InputSlotMorph(
                        null,
                        false,
                        {ascending: 'ascending', descending: 'descending'},
                        true
                    );
                    part.isStatic = true;
                    break;
            }
        }

        return part || oldLabelPart.call(this, spec);
    };
}(SyntaxElementMorph.prototype.labelPart));

BlockMorph.prototype.init = (function(oldInit) {
    return function (silently) {
        if (window.clickstream) {
            this.blockID = clickstream.nextID("block");
        }
        return oldInit.call(this, silently);
    };
}(BlockMorph.prototype.init));

BlockMorph.prototype.setCategory = (function(oldSetCategory) {
    return function (aString) {
        if (!SpriteMorph.prototype.blockColor[aString]) {
            // Uh oh. The block definition has a nonexistent category specified.
            // Put it under variables by default to avoid crashing horribly.
            aString = "variables";
        }
        oldSetCategory.call(this, aString);
    };
}(BlockMorph.prototype.setCategory));

BlockMorph.prototype.fullCopy = (function(oldFullCopy) {
    return function (forClone) {
        var ans = oldFullCopy.call(this, forClone);

        ans.blockID = clickstream.nextID("block");
        clickstream.log("newBlock", {id: ans.blockID, selector: ans.selector, spec: ans.blockSpec});

        return ans;
    };
}(BlockMorph.prototype.fullCopy));

BlockMorph.prototype.destroy = (function(oldDestroy) {
    return function () {
        oldDestroy.call(this);

        if (this.blockID !== undefined) {
            clickstream.log("destroyBlock", {id: this.blockID});
        }
    };
}(BlockMorph.prototype.destroy));

CommandBlockMorph.prototype.nextBlock = (function(oldNextBlock) {
    return function (block) {
        if (block) {
            clickstream.log("appendBlock", {id: this.blockID, target: block.blockID});
        }

        return oldNextBlock.call(this, block);
    };
}(CommandBlockMorph.prototype.nextBlock));

CommandBlockMorph.prototype.snap = (function(oldSnap) {
    return function (hand) {
        var target = this.closestAttachTarget();
        if (target === null) {
            clickstream.log("dropBlock", {id: this.blockID});
        }

        return oldSnap.call(this, hand);
    };
}(CommandBlockMorph.prototype.snap));

ReporterBlockMorph.prototype.snap = (function(oldSnap) {
    return function (hand) {
        // passing the hand is optional (for when blocks are dragged & dropped)
        var scripts = this.parent,
            nb,
            target;

        this.cachedSlotSpec = null;
        if (!(scripts instanceof ScriptsMorph)) {
            return null;
        }

        scripts.clearDropInfo();
        scripts.lastDroppedBlock = this;

        target = scripts.closestInput(this, hand);

        if (target === null) {
            clickstream.log("dropBlock", {id: this.blockID});
        }
        else {
            if (target.parent instanceof MultiArgMorph) {
                clickstream.log("setBlockInput", {
                    id: target.parent.blockID,
                    num: target.parentThatIsA(BlockMorph).inputs().indexOf(target.parent),
                    subnum: target.parent.inputs().indexOf(target),
                    block: this.blockID
                });
            }
            else {
                clickstream.log("setBlockInput", {
                    id: target.parent.blockID,
                    num: target.parentThatIsA(BlockMorph).inputs().indexOf(target),
                    block: this.blockID
                });
            }
        }

        return oldSnap.call(this, hand);
    };
}(ReporterBlockMorph.prototype.snap));

CommandSlotMorph.prototype.nestedBlock = (function(oldNestedBlock) {
    return function (block) {
        if (block) {
            clickstream.log("nestBlock", {id: this.parent.blockID, target: block.blockID});
        }

        return oldNestedBlock.call(this, block);
    };
}(CommandSlotMorph.prototype.nestedBlock));

InputSlotMorph.prototype.reactToEdit = (function(oldReactToEdit) {
    return function () {
        var cnts = this.contents();
        
        if (this.parent instanceof MultiArgMorph) {
            clickstream.log("setBlockInput", {
                id: this.parent.blockID,
                num: this.parentThatIsA(BlockMorph).inputs().indexOf(this.parent),
                subnum: this.parent.inputs().indexOf(this),
                text: cnts.text
            });
        }
        else {
            clickstream.log("setBlockInput", {
                id: this.parent.blockID,
                num: this.parentThatIsA(BlockMorph).inputs().indexOf(this),
                text: cnts.text
            });
        }

        return oldReactToEdit.call(this);
    }
}(InputSlotMorph.prototype.reactToEdit));



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

BlockMorph.prototype.userMenu = (function(oldUserMenu) {
    return function() {
        var myself = this,
            menu = oldUserMenu.call(this);
        if (!this.isTemplate) {
            menu.addLine();
            menu.addItem(
                "export...",
                function () {
                    var exportSequence = function() {
                        var serializer = new SnapSerializer();
                        var xml = myself.topBlock().toScriptXML(serializer);
                        var blob = new Blob([xml], {type: "text/xml"});
                        saveAs(blob, "blocks.xml");
                    };
                    
                    // Test if a block contains/is a custom block
                    var testDependencies = function(element) {
                        while (element) {
                            if (element.children.some(testDependencies))
                                return true;
                            
                            if (element.definition instanceof CustomBlockDefinition)
                                return true;
                            
                            // Also check the next block in a block sequence
                            element = element.nextBlock ? element.nextBlock() : null;
                        }
                        return false;
                    };

                    var ide = this.parentThatIsA(IDE_Morph);
                    var unmetDependencies = testDependencies(myself.topBlock());
                    if (unmetDependencies && ide) {
                        ide.confirm(
                            "This sequence contains a custom block whose definition will not be exported. Continue?",
                            "Block sequence export",
                            exportSequence
                        );
                    }
                    else {
                        exportSequence();
                    }
                   
                },
                'open a new window\nwith this block sequence as XML'
            );
        }
        return menu;
    };
}(BlockMorph.prototype.userMenu));

}());
