self.onmessage = function (event) {
    const code = event.data; // The code to be evaluated is passed in event.data

    // Store the original console methods
    const consoleLog = console.log;
    const consoleWarn = console.warn;
    const consoleError = console.error;
    const consoleTime = console.time;
    const consoleTimeLog = console.timeLog;
    const consoleTimeEnd = console.timeEnd;
    const consoleAssert = console.assert;
    const consoleInfo = console.info;
    const consoleClear = console.clear;

    // Object to store start times for console.time
    const timers = {};

    // Override console.log to also post messages back to the main thread
    function JavaScriptObject(obj) {
        let formatted = '{ ';
        for (let key in obj) {
            let value = obj[key];
            if (typeof value === 'string') {
                value = `'${value}'`;
            }
            formatted += `${key}: ${value}, `;
        }
        formatted = formatted.slice(0, -2) + ' }';
        return formatted;
    }

    function JavaScriptArray(arr) {
        let formatted = '[';
        for (let i = 0; i < arr.length; i++) {
            let value = arr[i];
            if (typeof value === 'string') {
                value = `'${value}'`;
            }
            formatted += `${value}, `;
        }
        formatted = formatted.slice(0, -2) + ']';
        return formatted;
    }

    function JavaScriptString(str) {
        return `'${str}'`;
    }

    function JavaScriptNumber(num) {
        return num;
    }

    function JavaScriptBoolean(bool) {
        return bool;
    }

    function JavaScriptBigInt() {
        return `${num}n`;
    }

    console.log = (...args) => {
        consoleLog.apply(console, args);
        args.forEach(arg => {
            let message;
            switch (arg.constructor.name) {
                case 'Array':
                    message = JavaScriptArray(arg);
                    break;
                case 'Object':
                    message = JavaScriptObject(arg);
                    break;
                case 'String':
                    message = JavaScriptString(arg);
                    break;
                case 'BigInt':
                    message = JavaScriptBigInt(arg);
                    break;
                case 'Number':
                    message = JavaScriptNumber(arg);
                    break;
                case 'Boolean':
                    message = JavaScriptBoolean(arg);
                    break;
                default:
                    message = arg;
                    break;
            }
            self.postMessage({ type: 'log', message: message, typeOf: typeof arg });
        });
    };

    // Override console.warn to also post messages back to the main thread
    console.warn = (...args) => {
        consoleWarn.apply(console, args);
        self.postMessage({ type: 'warn', message: args.join(' ') });
    };

    // Override console.error to also post messages back to the main thread
    console.error = (...args) => {
        consoleError.apply(console, args);
        self.postMessage({ type: 'error', message: args.join(' ') });
    };

    // Override console.time to start a timer
    console.time = (label = 'default') => {
        timers[label] = performance.now();
    };

    // Override console.timeLog to log the elapsed time for a timer
    console.timeLog = (label = 'default', ...args) => {
        if (timers[label]) {
            const elapsed = performance.now() - timers[label];
            const message = `${label}: ${+elapsed.toFixed(3)}ms`;
            consoleLog.apply(console, [message, ...args]);
            self.postMessage({ type: 'log', message: [message, ...args].join(' ') });
        } else {
            const errorMessage = `No such label: ${label}`;
            consoleError.apply(console, [errorMessage]);
            self.postMessage({ type: 'error', message: errorMessage });
        }
    };

    // Override console.timeEnd to end the timer and log the elapsed time
    console.timeEnd = (label = 'default', ...args) => {
        if (timers[label]) {
            const elapsed = performance.now() - timers[label];
            const message = `${label}: ${+elapsed.toFixed(3)}ms - timer ended`;
            consoleLog.apply(console, [message, ...args]);
            self.postMessage({ type: 'log', message: [message, ...args].join(' ') });
            delete timers[label]; // Remove the timer
        } else {
            const errorMessage = `No such label: ${label}`;
            consoleError.apply(console, [errorMessage]);
            self.postMessage({ type: 'error', message: errorMessage });
        }
    };

    // Override console.assert to log an error message if the assertion is false
    console.assert = (condition, ...args) => {
        if (!condition) {
            const message = `Assertion failed: ${args.join(' ')}`;
            consoleError.apply(console, [message]);
            self.postMessage({ type: 'error', message });
        }
    };

    // Override console.info to log an informational message
    console.info = (...args) => {
        consoleLog.apply(console, args); // Use console.log's underlying functionality
        self.postMessage({ type: 'info', message: args.join(' ') });
    };

    // Override console.clear to clear the console
    console.clear = () => {
        self.postMessage({ type: 'clear' });
    };

    try {
        self.postMessage({ executionStatus: 'executionStarted' }); // Notify that execution has started

        // Wrap the code in an IIFE to use setTimeout and setInterval
        const result = (function () { eval(`(() => { ${code}; undefined })()`) })();

        // If the result is not undefined, post it back as a log message
        if (result !== undefined) {
            self.postMessage({ type: 'log', message: result, typeOf: typeof result });
        }
    } catch (error) {
        // Determine error type and post the error message back
        const errorType = error instanceof SyntaxError ? "Syntax Error" : "Runtime Error";
        self.postMessage({ type: 'error', message: `${errorType}: ${error.message}` });
    } finally {
        // Restore original console methods
        // console.log = consoleLog;
        // console.warn = consoleWarn;
        // console.error = consoleError;
        // console.time = consoleTime;
        // console.timeLog = consoleTimeLog;
        // console.timeEnd = consoleTimeEnd;
        // console.assert = consoleAssert;
        // console.info = consoleInfo;
        // console.clear = consoleClear;

        self.postMessage({ executionStatus: 'executionEnded' }); // Notify that execution has ended
    }
};