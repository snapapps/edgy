(function() {
"use strict";

window.ClickstreamLogger = Class.extend({
    init: function(user) {
        this.user = user;
        this.logVersion = "0.1";
        this.events = [];
        this.timeBase = new Date().getTime();

        var ids = {};
        this.nextID = function(what) {
            if(ids[what] === undefined) {
                ids[what] = 0;
            }

            return ids[what]++;
        }
    },
    log: function(type, data) {
        var dt = new Date().getTime() - this.timeBase;
        this.events.push({
            time: dt,
            type: type,
            data: data
        });
    }
});

}());
