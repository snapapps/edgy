SpriteMorph.prototype.reportPower = function(x, y) {
    return Math.pow(x, y);
};

SpriteMorph.prototype.reportMaxValue = function(values) {
    return Math.max.apply(this, values.asArray());
};

SpriteMorph.prototype.reportMinValue = function(values) {
    return Math.min.apply(this, values.asArray());
};

SpriteMorph.prototype.reportInfinity = function() {
    return Infinity;
};

SpriteMorph.prototype.reportPi = function() {
    return Math.PI;
};

SpriteMorph.prototype.reportE = function() {
    return Math.E;
};

SpriteMorph.prototype.isFinite = function(x) {
    return Number.isFinite(x);
};

(function() {

var blocks = {
    reportPower: {
        type: 'reporter',
        category: 'operators',
        spec: '%n to power %n',
    },
    reportMaxValue: {
        type: 'reporter',
        category: 'operators',
        spec: 'max of %l',
    },
    reportMinValue: {
        type: 'reporter',
        category: 'operators',
        spec: 'min of %l',
    },
    reportInfinity: {
        type: 'reporter',
        category: 'operators',
        spec: 'infinity',
    },
    reportPi: {
        type: 'reporter',
        category: 'operators',
        spec: 'pi',
    },
    reportE: {
        type: 'reporter',
        category: 'operators',
        spec: 'e',
    },
    isFinite: {
        type: 'predicate',
        category: 'operators',
        spec: 'is %n finite?',
    },
};

SpriteMorph.prototype.initBlocks = (function (oldInitBlocks) {
    return function() {
        oldInitBlocks.call(this);
        // Add the new blocks.
        for (blockName in blocks) {
            if(blocks.hasOwnProperty(blockName)) {
                SpriteMorph.prototype.blocks[blockName] = blocks[blockName];
            }
        }
    };
}(SpriteMorph.prototype.initBlocks));

SpriteMorph.prototype.blockTemplates = (function blockTemplates (oldBlockTemplates) {
    return function (category) {
        // block() was copied from objects.js
        function block(selector) {
            if (StageMorph.prototype.hiddenPrimitives[selector]) {
                return null;
            }
            var newBlock = SpriteMorph.prototype.blockForSelector(selector, true);
            newBlock.isTemplate = true;
            return newBlock;
        }

        var blocks = [];
        if (category === 'operators') {
            blocks = blocks.concat(oldBlockTemplates.call(this, category));
            blocks.push('-');
            blocks.push(block('reportPower'));
            blocks.push('-');
            blocks.push(block('reportMaxValue'));
            blocks.push(block('reportMinValue'));
            blocks.push('-');
            blocks.push(block('reportInfinity'));
            blocks.push(block('reportPi'));
            blocks.push(block('reportE'));
            blocks.push('-');
            blocks.push(block('isFinite'));
        } else {
            return blocks.concat(oldBlockTemplates.call(this, category));
        }
        return blocks;
    };
}(SpriteMorph.prototype.blockTemplates));

Process.prototype.reportMonadic = (function(oldReportMonadic) {
    return function (fname, n) {
        var x = +n;

        switch (this.inputOption(fname)) {
            case 'ceil':
                return Math.ceil(x);
            case 'cbrt':
                return Math.cbrt(x);
            case 'log10':
                return Math.log10(x);
            case 'log2':
                return Math.log2(x);
            case 'sign':
                return Math.sign(x);
            case 'trunc':
                return Math.trunc(x);
        }
        
        return oldReportMonadic.call(this, fname, n);
    };
}(Process.prototype.reportMonadic));

SyntaxElementMorph.prototype.labelPart = (function(oldLabelPart) {
    return function(spec) {
        var part = oldLabelPart.call(this, spec);
        if (spec == '%fun') {
            part = new InputSlotMorph(
                null,
                false,
                {
                    abs : ['abs'],
                    floor : ['floor'],
                    ceil: ['ceil'],
                    sqrt : ['sqrt'],
                    cbrt : ['cbrt'],
                    sin : ['sin'],
                    cos : ['cos'],
                    tan : ['tan'],
                    asin : ['asin'],
                    acos : ['acos'],
                    atan : ['atan'],
                    ln : ['ln'],
                    'e^' : ['e^'],
                    log10 : ['log10'],
                    log2 : ['log2'],
                    sign : ['sign'],
                    trunc : ['trunc']
                },
                true
            );
            part.setContents(['sqrt']);
        }
        return part;
    };
}(SyntaxElementMorph.prototype.labelPart));

SpriteMorph.prototype.initBlocks();

}());