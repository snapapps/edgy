// Since we're not supposed to be altering the original file too much, monkey
// patching is in order.

var DEFAULT_MAX_VISIBLE_NODES = 150;
var edgyLayoutAlgorithm = cola.d3adaptor;

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

IDE_Morph.prototype.createStage = (function createStage (oldCreateStage) {
    return function () {
        var retval = oldCreateStage.call(this);
        this.emptyStageString = this.serializer.serialize(this.stage);
        return retval;
    }
}(IDE_Morph.prototype.createStage));

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

function getStageHTML(ide, codePre, codePost) {
    // It is not possible to have a closing <script> tag in inline JS.
    // Escape all forward slashes.
    var data = JSON.stringify(ide.serializer.serialize(ide.stage)).replace(/\//g, "\\/"),
        docClone = d3.select(document.documentElement.cloneNode(true));

    docClone.select("#graph-display").remove();
    docClone.select("#replace-me-pre").text(codePre || "");
    docClone.select("#replace-me-post").text("ide_.rawOpenProjectString(" + data + ");" + (codePost || ""));
    return docClone.node().outerHTML;
}

IDE_Morph.prototype.exportToHTML = function () {
    saveAs(new Blob([getStageHTML(this)], {type: 'text/html'}),
           (this.projectName || 'project') + '.html');
}

function getAllScripts() {
    var filenames = [];
    d3.selectAll("script")[0].forEach(function(script) {
        var src = d3.select(script).attr("src");
        if(src) {
            filenames.push(src)
        }
    });
    return filenames;
}
// Taken from JSZip.
function loadFile(filename, success, error) {
    try {
        var xhr = new XMLHttpRequest();

        xhr.open('GET', filename + "?_=" + ( new Date() ).getTime(), true);

        // recent browsers
        if ("responseType" in xhr) {
            xhr.responseType = "arraybuffer";
        }

        // older browser
        if(xhr.overrideMimeType) {
            xhr.overrideMimeType("text/plain; charset=x-user-defined");
        }

        xhr.onreadystatechange = function(e) {
            // use `xhr` and not `this`... thanks IE
            if (xhr.readyState === 4) {
                if (xhr.status === 200 || window.location.protocol === "file:") {
                    try {
                        if (xhr.response) {
                            JSZip.utils.transformTo("string", xhr.response);
                            success(xhr.response);
                        } else {
                            success(xhr.responseText);
                        }
                    } catch(e) {
                        error(e);
                    }
                } else {
                    error("Ajax error for " + filename + " : " + this.status);
                }
            }
        };

        xhr.send();
    } catch (e) {
        error(e);
    }
};

IDE_Morph.prototype.exportToZIP = function () {
    var zip = new JSZip(),
        myself = this;

    var stageHtml = getStageHTML(this, "ide_.setFlatDesign();", "ide_.toggleAppMode(true);");
    zip.file("index.html", stageHtml);

    var baseFilenames = [
        "scriptsPaneTexture.gif",
        "agpl.txt",
        "click.wav",
        "snap_logo_sm.png",
        "k5_logo.png"
    ];
    var filenames = getAllScripts().concat(baseFilenames),
        numLoaded = 0, hadError = false;

    filenames.forEach(function(filename) {
        loadFile(filename, function(data) {
            zip.file(filename, data);
            numLoaded++;
            if(numLoaded === filenames.length) {
                saveAs(zip.generate({type:"blob"}), (myself.projectName || 'project') + '.zip');
            }
        }, function(error) {
            if(!hadError) {
                hadError = true;
                var dlg = new DialogBoxMorph();
                dlg.inform('Error', [
                    'There was an error getting a file:\n', error.message,
                    '\nThis could because of the browser you are using.',
                    'You will need to do\nthis manually by clicking',
                    '"Get just HTML" or selecting "Export to HTML"\nin',
                    'the file menu, and zipping that together with all of',
                    'Snap\'s files.'].join(" "),
                    myself.world());
                dlg.addButton(
                    function () {
                        dlg.destroy();
                        saveAs(new Blob([stageHtml], {type: 'text/html'}),
                               (this.projectName || 'project') + '.html');
                    },
                    'Get just HTML'
                );
                dlg.fixLayout();
                dlg.drawNew();
            }
        });
    });
}

IDE_Morph.prototype.toggleUseWebCola = function () {
    if (edgyLayoutAlgorithm == d3.layout.force)
    {
        edgyLayoutAlgorithm = cola.d3adaptor;
    }
    else
    {
        edgyLayoutAlgorithm = d3.layout.force;
    }
    redrawGraph();
}

IDE_Morph.prototype.toggleUseManualLayout = function () {
    if(this.useManualLayout) {
        jsnx.forEach(this.currentSprite.G.nodes_iter(true), function(node) {
            node[1].__d3datum__.fixed = false;
        });
        this.useManualLayout = false;
        this.currentSprite.resumeLayout();
    } else {
        this.useManualLayout = true;
    }
}

IDE_Morph.prototype.toggleWebColaDownwardEdgeConstraint = function () {
    this.useDownwardEdgeConstraint = !this.useDownwardEdgeConstraint;
    redrawGraph();
}

}());
