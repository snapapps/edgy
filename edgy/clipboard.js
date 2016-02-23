(function() {
"use strict";

CursorMorph.prototype.init = (function(oldInit) {
    return function(aStringOrTextMorph) {
        oldInit.call(this, aStringOrTextMorph);
        
        // Add hidden text box for copying and pasting
        var myself = this;
        
        // Hidden div allows the browser to focus on the text box
        this.hiddenDiv = document.createElement('div');
        this.hiddenDiv.style.position = "absolute";
        this.hiddenDiv.style.right = "101%"; // placed just out of view
        
        // The text box
        this.hiddenText = document.createElement('textarea');
        this.target.hiddenText = this.hiddenText;
        
        this.hiddenDiv.appendChild(this.hiddenText);
        document.body.appendChild(this.hiddenDiv);
        
        this.hiddenText.value = this.target.selection();
        this.hiddenText.focus();
        this.hiddenText.select();
        
        this.hiddenText.addEventListener(
            "keypress",
            function (event) {
                myself.processKeyPress(event);
                this.value = myself.target.selection();
                this.select();
            },
            false
        );
        
        this.hiddenText.addEventListener(
            "keydown",
            function (event) {
                myself.processKeyDown(event);
                this.value = myself.target.selection();
                this.select();
                
                // Make sure tab prevents default
                if (event.keyIdentifier === 'U+0009' || event.keyIdentifier === 'Tab') {
                    myself.processKeyPress(event);
                    event.preventDefault();
                }
            },
            false
        );
        
        this.hiddenText.addEventListener(
            "input",
            function (event) {
                if (this.value == "") {
                    myself.gotoSlot(myself.target.selectionStartSlot());
                    myself.target.deleteSelection();
                }
            },
            false
        );
    };
}(CursorMorph.prototype.init));

CursorMorph.prototype.destroy = (function(oldDestroy) {
    return function() {
        oldDestroy.call(this);
        if (this.hiddenText)
            document.body.removeChild(this.hiddenDiv);
    };
}(CursorMorph.prototype.destroy));

}());