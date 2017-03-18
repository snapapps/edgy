// Since we're not supposed to be altering the original file too much, monkey
// patching is in order.

var DEFAULT_MAX_VISIBLE_NODES = 150;
var edgyLayoutAlgorithm = cola.d3adaptor;

(function() {
"use strict";

IDE_Morph.prototype.setProjectName = (function(oldSetProjectName) {
    return function (string) {
        var oldName = this.projectName;
        
        var retVal = oldSetProjectName.call(this, string);

        if (oldName !== this.projectName) {
            clickstream.log("set_project_name", {name: string});
            this.setProjectId();
        }

        return retVal;
    };
}(IDE_Morph.prototype.setProjectName));

IDE_Morph.prototype.setProjectId = function (id) {
    if (id === undefined) {
        this.projectId = uuid.v1();
        clickstream.log("set_project_id", {id: this.projectId});
    }
    else {
        this.projectId = id;
    }
};

IDE_Morph.prototype.droppedText = (function(oldDroppedText) {
    return function (aString, name) {
        if (aString.indexOf('<variables') === 0) {
            return this.openVariablesString(aString);
        }
        return oldDroppedText.call(this, aString, name);
    };
}(IDE_Morph.prototype.droppedText));

IDE_Morph.prototype.applySavedSettings = (function(oldApplySavedSettins) {
    return function () {
        // Principle of least privilege: JavaScript block execution is disabled unless the user requires it for this particular session.
        window.javascriptexecutionlevel = 'blocked';

        oldApplySavedSettins.call(this);
    };
}(IDE_Morph.prototype.applySavedSettings));

IDE_Morph.prototype.saveProjectToDisk = function (plain) {
    var data,
        link = document.createElement('a'),
        href = 'data:text/' + (plain ? 'plain' : 'xml') + ',';

    if (Process.prototype.isCatchingErrors) {
        try {
            data = encodeURIComponent(this.serializer.serialize(this.stage));
            link.setAttribute('href', href + data);
            link.setAttribute('download', this.projectName + '.xml');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            this.showMessage('Saving failed: ' + err);
        }
    } else {
        data = encodeURIComponent(this.serializer.serialize(this.stage));
        link.setAttribute('href', href + data);
        link.setAttribute('download', this.projectName + '.xml');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

IDE_Morph.prototype.javaScriptExecutionLevelMenu = function() {
    var menu = new MenuMorph(this),
        world = this.world(),
        pos = this.controlBar.settingsButton.bottomLeft(),
        myself = this;
    menu.addItem((window.javascriptexecutionlevel === 'full' ? '\u2713 ' : '    ')+'full', function() {
        alert('You have given the current project permission to execute code at the same level as Edgy itself -- code within "JavaScript function" blocks will have access to all Edgy functionality, including modifying local storage and accessing cloud storage credentials. If you do not trust the author of this project, set the "Execution privileges" permission setting to a lower value.');
        window.javascriptexecutionlevel = 'full';
    });
    menu.addItem((window.javascriptexecutionlevel === 'blocked' ? '\u2713 ' : '    ')+'blocked', function() {
        window.javascriptexecutionlevel = 'blocked'; }
    );
    menu.popup(world, pos);
};

IDE_Morph.prototype.init = (function init (oldInit) {
    return function(isAutoFill) {
        var retval = oldInit.call(this, isAutoFill);
        this.currentCategory = 'network';
        this.maxVisibleNodes = DEFAULT_MAX_VISIBLE_NODES;
        this.logoURL = 'edgy_logo.png';
        return retval;
    }
}(IDE_Morph.prototype.init));

IDE_Morph.prototype.resourceURL = (function (oldResourceURL) {
    return function() {
        return 'edgy/' + oldResourceURL.apply(this, arguments);
    }
}(IDE_Morph.prototype.resourceURL));

IDE_Morph.prototype.save = (function save(oldSave) {
    return function() {
        var retval = oldSave.call(this);
        clickstream.log("save");
        return retval;
    };
}(IDE_Morph.prototype.save));

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
        if (this.currentSprite instanceof SpriteMorph) {
            this.currentSprite.setActiveGraph();
        }
        return retval;
    }
}(IDE_Morph.prototype.createStage));

IDE_Morph.prototype.fixLayout = (function(oldFixLayout) {
    return function() {
        oldFixLayout.call(this);
        this.stage.changed();
    }
}(IDE_Morph.prototype.fixLayout));

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
    if (edgyLayoutAlgorithm != d3.layout.force)
    {
        edgyLayoutAlgorithm = d3.layout.force;
    }
    else
    {
        edgyLayoutAlgorithm = cola.d3adaptor;
    }
    redrawGraph();
}

IDE_Morph.prototype.toggleUseTree = function () {
    if (edgyLayoutAlgorithm != d3.layout.tree)
    {
        edgyLayoutAlgorithm = d3.layout.tree;
    }
    else
    {
        edgyLayoutAlgorithm = cola.d3adaptor;
    }
    redrawGraph();
}

IDE_Morph.prototype.toggleUseManualLayout = function () {
    if(this.useManualLayout) {
        jsnx.forEach(currentGraph.nodesIter(true), function(node) {
            node[1].__d3datum__.fixed = false;
            delete node[1].__d3datum__.px;
            delete node[1].__d3datum__.py;
        });
        this.useManualLayout = false;
        this.currentSprite.resumeLayout();
    } else {
        jsnx.forEach(currentGraph.nodesIter(true), function(node) {
            node[1].__d3datum__.px = node[1].__d3datum__.x;
            node[1].__d3datum__.py = node[1].__d3datum__.y;
            node[1].__d3datum__.fixed = true;
        });
        this.useManualLayout = true;
    }
}

IDE_Morph.prototype.toggleWebColaDownwardEdgeConstraint = function () {
    this.useDownwardEdgeConstraint = !this.useDownwardEdgeConstraint;
    redrawGraph();
}

IDE_Morph.prototype.exportGlobalBlocks = function () {
    if (this.stage.globalBlocks.length > 0) {
        new BlockExportDialogMorph(
            this.serializer,
            this.stage // Just pass the entire stage
        ).popUp(this.world());
    } else {
        this.inform(
            'Export blocks',
            'this project doesn\'t have any\n'
                + 'custom global blocks yet'
        );
    }
};

IDE_Morph.prototype.rawOpenBlocksString = (function(oldRawOpenBlocksString) {
    return function(str, name, silently) {
        oldRawOpenBlocksString.call(this, str, name, silently);
        
        var myself = this;
        var model = this.serializer.parse(str);
        
        // Also load attributes
        var nodeAttrs = model.childNamed('nodeattrs');
        var edgeAttrs = model.childNamed('edgeattrs');
        
        if (nodeAttrs) {
            nodeAttrs.children.forEach(function (attr) {
                myself.stage.addNodeAttribute(attr.attributes.name);
            });
        }
        if (edgeAttrs) {
            edgeAttrs.children.forEach(function (attr) {
                myself.stage.addEdgeAttribute(attr.attributes.name);
            });
        }
    };
}(IDE_Morph.prototype.rawOpenBlocksString));

IDE_Morph.prototype.openBlockSequenceString = function (str) {
    var msg,
        myself = this;
    this.nextSteps([
        function () {
            msg = myself.showMessage('Opening block sequence...');
        },
        function () {
            myself.rawOpenBlockSequenceString(str);
        },
        function () {
            msg.destroy();
        }
    ]);
};

IDE_Morph.prototype.rawOpenBlockSequenceString = function (str) {
    var myself = this;
    var xml = this.serializer.parse(str);
    var importSequence = function(model) {
        var script = myself.serializer.loadScript(model);
        script.pickUp(world);
        world.hand.grabOrigin = {
            origin: myself.palette,
            position: myself.palette.center()
        };
    };
    
    if (Process.prototype.isCatchingErrors) {
        try {
            importSequence(xml);
        } catch (err) {
            this.showMessage('Load failed: ' + err);
        }
    } else {
        importSequence(xml);
    }
};

IDE_Morph.prototype.droppedText = (function(oldDroppedText) {
    return function(aString, name) {
        if (aString.indexOf('<script') === 0) {
            return this.openBlockSequenceString(aString);
        }
        return oldDroppedText.call(this, aString, name);
    };
}(IDE_Morph.prototype.droppedText));

// Remove cloud options as per #401
IDE_Morph.prototype.createControlBar = (function(oldCreateControlBar) {
    return function() {
        oldCreateControlBar.call(this);
        
        this.controlBar.cloudButton.destroy();
        
        var myself = this;
        var padding = 5;
        
        this.controlBar.fixLayout = (function(oldFixLayout) {
            return function() {
                oldFixLayout.call(this);
                
                this.settingsButton.setCenter(myself.controlBar.center());
                this.settingsButton.setRight(this.left());

                this.projectButton.setCenter(myself.controlBar.center());
                this.projectButton.setRight(this.settingsButton.left() - padding);
                
                this.updateLabel();
            };
        }(this.controlBar.fixLayout));
    };
}(IDE_Morph.prototype.createControlBar));

}());
