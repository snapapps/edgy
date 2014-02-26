// Since we're not supposed to be altering the original file too much, monkey
// patching is in order.

var DEFAULT_MAX_VISIBLE_NODES = 150;

(function() {
"use strict";

IDE_Morph.prototype.init = (function init (oldInit) {
	return function(isAutoFill) {
		var retval = oldInit.call(this, isAutoFill);
		this.currentCategory = 'network';
		this.maxVisibleNodes = DEFAULT_MAX_VISIBLE_NODES;
		return retval;
	}
}(IDE_Morph.prototype.init));

IDE_Morph.prototype.createCorralBar = (function createCorralBar (oldCreateCorralBar) {
	return function () {
		var retval = oldCreateCorralBar.call(this);
		this.corralBar.children[0].hint = "add a new graph"
		return retval;
	}
}(IDE_Morph.prototype.createCorralBar));

IDE_Morph.prototype.setMaxVisibleNodes = function () {
    var myself = this;

    new DialogBoxMorph(
        null,
        function (num) {
            myself.maxVisibleNodes = num;
            // HACK: should refactor most of graph visualization code into
            // IDE_Morph instead of calling sprite methods.
            myself.currentSprite.maxVisibleNodesChanged(num);
        }
    ).prompt(
        'Set maximum visible nodes',
        this.maxVisibleNodes.toString(),
        this.world(),
        null, // pic
        {
            'minimal (20)': 20,
            'normal (150); default': DEFAULT_MAX_VISIBLE_NODES,
            'large (400)': 400,
            'huge (800)': 800,
            'maximum (1000); might lock up browser': 1000,
        },
        false, // read only?
        true, // numeric
        20, // slider min
        1000, // slider max
        null // slider action
    );
};

function getStageHTML(ide) {
    // It is not possible to have a closing <script> tag in inline JS.
    // Escape all forward slashes.
    var data = JSON.stringify(ide.serializer.serialize(ide.stage)).replace(/\//g, "\\/"),
        docClone = d3.select(document.documentElement.cloneNode(true));

    docClone.select("#graph-display").remove();
    docClone.select("#replace-me").text("ide_.rawOpenProjectString(" + data + ");");
    return docClone.node().outerHTML;
}

IDE_Morph.prototype.exportToHTML = function () {
    saveAs(new Blob([getStageHTML(this)], {type: 'text/html'}),
           (this.projectName || 'project') + '.html');
}

}());
