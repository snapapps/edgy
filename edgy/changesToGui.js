// Since we're not supposed to be altering the original file too much, monkey
// patching is in order.

(function() {
"use strict";

IDE_Morph.prototype.init = (function init (oldInit) {
	return function(isAutoFill) {
		var retval = oldInit.call(this, isAutoFill);
		this.currentCategory = 'network';
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

}());
