(function() {
"use strict";

IDE_Morph.prototype.exportGlobalVariables = function() {
    if (this.globalVariables.allNames().length > 0) {
        new VariableExportDialogMorph(
            this.serializer,
            this.globalVariables
        ).popUp(this.world());
    }
    else {
        this.inform(
            'Export Variables',
            'this project doesn\'t have any\n'
                + 'global variables yet'
        );
    }
}


IDE_Morph.prototype.openVariablesString = function (str) {
    var msg,
        myself = this;
    this.nextSteps([
        function () {
            msg = myself.showMessage('Opening variables...');
        },
        function () {
            myself.rawOpenVariablesString(str);
        },
        function () {
            msg.destroy();
        }
    ]);
};

IDE_Morph.prototype.rawOpenVariablesString = function (str) {
    var xml = this.serializer.parse(str);
    if (Process.prototype.isCatchingErrors) {
        try {
            this.serializer.loadVariables(this.globalVariables, xml);
            this.flushBlocksCache('variables');
            this.refreshPalette();
        } catch (err) {
            this.showMessage('Load failed: ' + err);
        }
    } else {
        this.serializer.loadVariables(this.globalVariables, xml);
        this.flushBlocksCache('variables');
        this.refreshPalette();
    }
};

}());

// VariableExportDialogMorph ////////////////////////////////////////////////////

// VariableExportDialogMorph inherits from DialogBoxMorph:

VariableExportDialogMorph.prototype = new DialogBoxMorph();
VariableExportDialogMorph.prototype.constructor = VariableExportDialogMorph;
VariableExportDialogMorph.uber = DialogBoxMorph.prototype;

// VariableExportDialogMorph constants:

VariableExportDialogMorph.prototype.key = 'variableExport';

// VariableExportDialogMorph instance creation:

function VariableExportDialogMorph(serializer, vars) {
    this.init(serializer, vars);
}

VariableExportDialogMorph.prototype.init = function (serializer, varFrame) {
    var myself = this;

    // additional properties:
    this.serializer = serializer;
    this.varFrame = varFrame;
    this.variables = [];
    this.handle = null;
    
    // initialize inherited properties:
    VariableExportDialogMorph.uber.init.call(
        this,
        null, // target
        function () {myself.exportVariables(); },
        null // environment
    );
 
    // override inherited properites:
    this.labelString = 'Export variables';
    this.createLabel();

    // build contents
    this.buildContents();
};

VariableExportDialogMorph.prototype.buildContents = function () {
    var palette, x, y, block, checkBox, lastCat,
        myself = this,
        padding = 4;

    // create plaette
    palette = new ScrollFrameMorph(
        null,
        null,
        SpriteMorph.prototype.sliderColor
    );
    palette.color = SpriteMorph.prototype.paletteColor;
    palette.padding = padding;
    palette.isDraggable = false;
    palette.acceptsDrops = false;
    palette.contents.acceptsDrops = false;

    // populate palette
    x = palette.left() + padding;
    y = palette.top() + padding;
    
    myself.varFrame.allNames().forEach(function (varName) {
        block = SpriteMorph.prototype.variableBlock(varName);
        block.isDraggable = false;
        block.isTemplate = true;
        
        checkBox = new ToggleMorph(
            'checkbox',
            myself,
            function () {
                var idx = myself.variables.indexOf(varName);
                if (idx > -1) {
                    myself.variables.splice(idx, 1);
                }
                else {
                    myself.variables.push(varName);
                }
            },
            null,
            function () {
                return contains(
                    myself.variables,
                    varName
                );
            },
            null,
            null,
            null,
            block.fullImage()
        );
        checkBox.setPosition(new Point(
            x,
            y + (checkBox.top() - checkBox.toggleElement.top())
        ));
        palette.addContents(checkBox);
        y += checkBox.fullBounds().height() + padding;
        
    });

    palette.scrollX(padding);
    palette.scrollY(padding);
    this.addBody(palette);

    this.addButton('ok', 'OK');
    this.addButton('cancel', 'Cancel');

    this.setExtent(new Point(220, 300));
    this.fixLayout();

};

VariableExportDialogMorph.prototype.popUp = function (wrrld) {
    var world = wrrld || this.target.world();
    if (world) {
        VariableExportDialogMorph.uber.popUp.call(this, world);
        this.handle = new HandleMorph(
            this,
            200,
            220,
            this.corner,
            this.corner
        );
    }
};

// VariableExportDialogMorph menu

VariableExportDialogMorph.prototype.userMenu = function () {
    var menu = new MenuMorph(this, 'select');
    menu.addItem('all', 'selectAll');
    menu.addItem('none', 'selectNone');
    return menu;
};

VariableExportDialogMorph.prototype.selectAll = function () {
    this.body.contents.children.forEach(function (checkBox) {
        if (!checkBox.state) {
            checkBox.trigger();
        }
    });
};

VariableExportDialogMorph.prototype.selectNone = function () {
    this.blocks = [];
    this.body.contents.children.forEach(function (checkBox) {
        checkBox.refresh();
    });
};

// VariableExportDialogMorph ops

VariableExportDialogMorph.prototype.exportVariables = function () {
    var myself = this;
    var serializer = this.serializer;
    
    var str = this.variables.reduce(function (vars, v) {
        var val = myself.varFrame.vars[v].value,
            dta;
        
        if (val === undefined || val === null) {
            dta = serializer.format('<variable name="@"/>', v);
        } else {
            dta = serializer.format(
                '<variable name="@">%</variable>',
                v,
                typeof val === 'object' ? serializer.store(val)
                        : typeof val === 'boolean' ?
                                serializer.format('<bool>$</bool>', val)
                                : serializer.format('<l>$</l>', val)
            );
        }
        return vars + dta;
    }, '');
    
    if (this.variables.length > 0) {
        var ide = this.world().children[0];
        ide.saveXMLAs('<variables app="'
            + this.serializer.app
            + '" version="'
            + this.serializer.version
            + '">'
            + str
            + '</variables>',
            ide.projectName + ' variables'
        );
    } else {
        new DialogBoxMorph().inform(
            'Export variables',
            'no variables were selected',
            this.world()
        );
    }
};

// VariableExportDialogMorph layout

VariableExportDialogMorph.prototype.fixLayout
    = BlockEditorMorph.prototype.fixLayout;

// VariableImportDialogMorph ////////////////////////////////////////////////////

// VariableImportDialogMorph inherits from DialogBoxMorph
// and pseudo-inherits from VariableExportDialogMorph:

/*
VariableImportDialogMorph.prototype = new DialogBoxMorph();
VariableImportDialogMorph.prototype.constructor = VariableImportDialogMorph;
VariableImportDialogMorph.uber = DialogBoxMorph.prototype;

// VariableImportDialogMorph constants:

VariableImportDialogMorph.prototype.key = 'blockImport';

// VariableImportDialogMorph instance creation:

function VariableImportDialogMorph(blocks, target, name) {
    this.init(blocks, target, name);
}

VariableImportDialogMorph.prototype.init = function (blocks, target, name) {
    var myself = this;

    // additional properties:
    this.blocks = blocks.slice(0);
    this.handle = null;

    // initialize inherited properties:
    VariableExportDialogMorph.uber.init.call(
        this,
        target,
        function () {myself.importBlocks(name); },
        null // environment
    );

    // override inherited properites:
    this.labelString = localize('Import blocks')
        + (name ? ': ' : '')
        + name || '';
    this.createLabel();

    // build contents
    this.buildContents();
};

VariableImportDialogMorph.prototype.buildContents
    = VariableExportDialogMorph.prototype.buildContents;

VariableImportDialogMorph.prototype.popUp
    = VariableExportDialogMorph.prototype.popUp;

// VariableImportDialogMorph menu

VariableImportDialogMorph.prototype.userMenu
    = VariableExportDialogMorph.prototype.userMenu;

VariableImportDialogMorph.prototype.selectAll
    = VariableExportDialogMorph.prototype.selectAll;

VariableImportDialogMorph.prototype.selectNone
    = VariableExportDialogMorph.prototype.selectNone;

// VariableImportDialogMorph ops

VariableImportDialogMorph.prototype.importBlocks = function (name) {
    var ide = this.target.parentThatIsA(IDE_Morph);
    if (!ide) {return; }
    if (this.blocks.length > 0) {
        this.blocks.forEach(function (def) {
            def.receiver = ide.stage;
            ide.stage.globalBlocks.push(def);
            ide.stage.replaceDoubleDefinitionsFor(def);
        });
        ide.flushPaletteCache();
        ide.refreshPalette();
        ide.showMessage(
            'Imported Variable Module' + (name ? ': ' + name : '') + '.',
            2
        );
    } else {
        new DialogBoxMorph().inform(
            'Import variables',
            'no variables were selected',
            this.world()
        );
    }
};

// VariableImportDialogMorph layout

VariableImportDialogMorph.prototype.fixLayout
    = BlockEditorMorph.prototype.fixLayout;
*/