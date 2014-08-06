(function() {
"use strict";

window.ClickstreamLogger = Class.extend({
    init: function(data) {
        this.user = data.user || null;
        // TODO: handle version changes gracefully.
        this.logVersion = "0.1";
        this.events = data.events || [];
        this.timeBase = data.timeBase || new Date().getTime();

        this._ids = {};
    },
    nextID: function(what) {
        if(this._ids[what] === undefined) {
            this._ids[what] = 0;
        }

        return this._ids[what]++;
    },
    log: function(type, data) {
        var dt = new Date().getTime() - this.timeBase;
        data = data || {};
        this.events.push({
            time: dt,
            type: type,
            data: data
        });
    },
    toJSON: function() {
        return {
            user: this.user,
            logVersion: this.logVersion,
            events: this.events,
            timeBase: this.timeBase
        };
    }
});

}());
