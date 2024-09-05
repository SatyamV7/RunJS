self.onmessage = function (event) {
    const { code, ESM, TS } = event.data;

    performance.mark('executionStarted'); // Mark the start of execution

    let transpiledCode;

    function ESMTranspile(code) {
        // Babel imports for ES6 features
        importScripts('../libs/babel/babel.min.js');
        // Transpile the code using Babel
        return Babel.transform(code, {
            presets: ['env', 'es2015'],
            plugins: ['transform-modules-umd']
        }).code;
    }

    function TSTranspile(code) {
        // Babel imports for TypeScript features
        importScripts('../libs/babel/babel.min.js');
        // Transpile the code using Babel
        return Babel.transform(code, {
            filename: 'script.ts',
            presets: ['typescript'],
            plugins: ['transform-modules-umd']
        }).code;
    }

    if (ESM === true) transpiledCode = ESMTranspile(code);
    else if (TS === true) transpiledCode = TSTranspile(code);
    else transpiledCode = code;

    // Store the original console methods
    const consoleLog = console.log;
    const consoleWarn = console.warn;
    const consoleError = console.error;
    // const consoleTime = console.time;
    // const consoleTimeLog = console.timeLog;
    // const consoleTimeEnd = console.timeEnd;
    // const consoleAssert = console.assert;
    // const consoleInfo = console.info;
    // const consoleClear = console.clear;
    // const consoleCount = console.count;
    // const consoleCountReset = console.countReset;
    // const consoleDebug = console.debug;

    // Object to store start times for console.time
    const timers = {};

    // Object to store counts for console.count
    const counts = {};

    // Counter to store group level for console.group
    let level = 0;

    // Formatting functions for different types
    function JavaScriptObject(obj) {
        let formatted = '{ ';
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                let value = obj[key];
                if (typeof value === 'string') {
                    value = `'${JavaScriptString(value)}'`;
                } else if (typeof value === 'object' && value !== null) {
                    value = JavaScriptObject(value);
                }
                formatted += `${key}: ${value}, `;
            }
        }
        formatted = formatted.slice(0, -2) + ' }';
        return formatted;
    }

    function JavaScriptArray(arr) {
        let formatted = '[';
        for (let i = 0; i < arr.length; i++) {
            let value = arr[i];
            if (typeof value === 'string') {
                value = `'${JavaScriptString(value)}'`;
            } else if (Array.isArray(value)) {
                value = JavaScriptArray(value);
            }
            formatted += `${value}, `;
        }
        formatted = formatted.slice(0, -2) + ']';
        return formatted;
    }

    function JavaScriptString(str) {
        // Handle \\ first
        str = str.replace(/\\\\/g, '\u005C'); // Backslash

        // Handle common character escapes
        str = str.replace(/\\'/g, '\'')
            .replace(/\\"/g, '\u0022')  // Double Quote
            .replace(/\\n/g, '\u000A')  // Line Feed
            .replace(/\\r/g, '\u000D')  // Carriage Return
            .replace(/\\t/g, '\u0009')  // Horizontal Tab
            .replace(/\\b/g, '\u0008')  // Backspace
            .replace(/\\f/g, '\u000C'); // Form Feed

        // Handle \uXXXX Unicode escapes
        str = str.replace(/\\u([0-9A-Fa-f]{4})/g, (match, p1) => {
            return String.fromCharCode(parseInt(p1, 16));
        });

        // Handle \u{XXXXX} Unicode escapes
        str = str.replace(/\\u\{([0-9A-Fa-f]+)\}/g, (match, p1) => {
            return String.fromCodePoint(parseInt(p1, 16));
        });

        // Handle \xXX hexadecimal escapes (if needed)
        str = str.replace(/\\x([0-9A-Fa-f]{2})/g, (match, p1) => {
            return String.fromCharCode(parseInt(p1, 16));
        });

        // Handle \XXX octal escapes (if needed)
        str = str.replace(/\\([0-7]{1,3})/g, (match, p1) => {
            return String.fromCharCode(parseInt(p1, 8));
        });

        return str;
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

    // Master message handler to process different types of messages
    function masterConsoleHandler(typeOfMessage, ...args) {
        // if (args.length === 1 && typeof args[0] === 'string') {
        //     // Wrap the string in single quotes
        //     return { type: typeOfMessage, message: `'${args[0]}'`, typeOf: 'string' };
        // } else {
        // Process the arguments as before
        let messages = args.map(arg => {
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
            return message;
        }).join(' ');
        messages = '\u00A0'.repeat(level) + messages.replace(/\u000A/g, '\u000A' + '\u00A0'.repeat(level));
        return { type: typeOfMessage, message: messages, typeOf: typeof args };
        // }
    }

    // Override console.log to also post messages back to the main thread
    console.log = (...args) => {
        consoleLog.apply(console, args);
        self.postMessage(masterConsoleHandler('log', ...args));
    };

    // Override console.warn to also post messages back to the main thread
    console.warn = (...args) => {
        consoleWarn.apply(console, args);
        self.postMessage(masterConsoleHandler('warn', ...args));
    };

    // Override console.error to also post messages back to the main thread
    console.error = (...args) => {
        consoleError.apply(console, args);
        self.postMessage(masterConsoleHandler('error', ...args));
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

    // Override console.count to count the number of times console.count is called with a label
    console.count = (label = 'default') => {
        if (counts[label]) {
            counts[label]++;
        } else {
            counts[label] = 1;
        }
        const message = `${label}: ${counts[label]}`;
        consoleLog.apply(console, [message]);
        self.postMessage({ type: 'log', message });
    };

    // Override console.countReset to reset the count for a label
    console.countReset = (label = 'default') => {
        if (counts[label]) {
            counts[label] = 0;
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
        self.postMessage(masterConsoleHandler('info', ...args));
    };

    // Override console.debug to log a debug message
    console.debug = (...args) => {
        consoleLog.apply(console, args); // Use console.log's underlying functionality
        self.postMessage(masterConsoleHandler('debug', ...args));
    };

    // Override console.group to log indented message
    console.group = () => {
        level++
    };

    // Override console.groupEnd to reduce indentation level
    console.groupEnd = () => {
        level--
    };

    // Override console.groupCollapsed to log indented message
    console.groupCollapsed = () => {
        level++
    };

    // Override console.clear to clear the console
    console.clear = () => {
        self.postMessage({ type: 'clear' });
    };

    try {
        self.postMessage({ executionStatus: 'executionStarted' }); // Notify that execution has started

        // Wrap the code in an IIFE to use setTimeout and setInterval
        const result = (function () { eval(`(() => { ${transpiledCode}; undefined })()`) })();

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
        // console.count = consoleCount;
        // console.countReset = consoleCountReset;

        performance.mark('executionEnded'); // Mark the end of execution
        performance.measure('Execution Time', 'executionStarted', 'executionEnded'); // Measure the execution time
        self.postMessage({ executionStatus: 'executionEnded', executionTime: performance.getEntriesByName('Execution Time')[0].duration }); // Notify that execution has ended and post the execution time
    }
};