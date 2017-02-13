(function() {
"use strict";

ThreadManager.prototype.startProcess = (function(oldStartProcess) {
    return function (
        block,
        isThreadSafe,
        exportResult,
        callback,
        isClicked,
        rightAway
    ) {
        return oldStartProcess.call(this, block, isThreadSafe, exportResult, callback, isClicked, rightAway);
        clickstream.log("startProcess", {blockId: block.topBlock().blockID});
    };
}(ThreadManager.prototype.startProcess));


ThreadManager.prototype.stopAll = (function(oldStopAll) {
    return function (excpt) {
        clickstream.log("stopAll");
        return oldStopAll.call(this, excpt);
    };
}(ThreadManager.prototype.stopAll));

ThreadManager.prototype.resumeAll = (function(oldResumeAll) {
    return function (stage) {
        clickstream.log("resumeAll");
        return oldResumeAll.call(this, stage);
    };
}(ThreadManager.prototype.resumeAll));

Process.prototype.reportJSFunction = (function(oldReportJSFunction) {
    return function (parmNames, body) {
        if (window.javascriptexecutionlevel === 'full') {
            return oldReportJSFunction.call(this, parmNames, body);
        }
        else {
            throw new Error([
                'The current script attempted to execute JavaScript code at a higher privilege level than is currently allowed.',
                'Code execution was terminated.',
                'If you trust the code within the JavaScript blocks and wish to execute it, set the "Execution level" setting to the appropriate level.'
            ].join('\n'));
        }
    };
}(Process.prototype.reportJSFunction));

Process.prototype.evaluate = (function(oldEvaluate) {
    return function (
        context,
        args,
        isCommand
    ) {
        if (context instanceof Function && window.javascriptexecutionlevel !== 'full') {
            throw new Error([
                'The current script attempted to execute JavaScript code at a higher privilege level than is currently allowed.',
                'Code execution was terminated.',
                'If you trust the code within the JavaScript blocks and wish to execute it, set the "Execution level" setting to the appropriate level.'
            ].join('\n'));
        }
        else {
            return oldEvaluate.call(this, context, args, isCommand);
        }
    };
}(Process.prototype.evaluate));


Process.prototype.doConcatToList = function (l, list) {
    list.becomeArray();
    l.becomeArray();
    list.contents = list.contents.concat(l.contents);
};

Process.prototype.getRandomFromList = function (l) {
    var idx = Math.floor(Math.random() * l.length()) + 1;
    // Handle any accidental mis-rounding; should be rare: "on the order of one
    // in 2^62" according to
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random)
    return l.at(Math.min(idx, l.length()));
}

function snapClone(o, memo) {
    memo = memo || new Map();

    if(memo.has(o)) {
        return memo.get(o);
    }

    if(o instanceof List) {
        var c = new List(o.asArray().map(function(x) {
            return snapClone(x, memo);
        }));
        memo.set(o, c);
        return c;
    } else if(o instanceof Map) {
        var l = [];
        o.forEach(function(v, k) {
            l.push([snapClone(k, memo), snapClone(v, memo)]);
        });
        var c = new Map(l);
        memo.set(o, c);
        return c;
    } else if(typeof o == "number" || typeof o == "string" || typeof o == "boolean") {
        return o;
    } else {
        throw new Error("Encountered object of unknown type.");
    }
}

Process.prototype.getClone = function (l) {
    return snapClone(l);
}

Process.prototype.doListJoin = function (a, b) {
    a.becomeArray();
    b.becomeArray();
    return new List(a.contents.concat(b.contents));
};

}());