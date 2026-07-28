// catches all errors, hides stack traces from clients, logs full error

function logError(req, errorMessage) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ${req.method} ${req.originalUrl} —`, errorMessage);
}


// Map Postgres error codes to safe client-facing responses.
const PG_ERROR_RESPONSES = {
    '23505': { status: 409, message: 'That value is already in use.' },
    '23503': { status: 400, message: 'A referenced record does not exist.' },
    '23502': { status: 400, message: 'A required field is missing.' },
    '23514': { status: 400, message: 'A value did not meet a database constraint.' },
    '22P02': { status: 400, message: 'A value in the request was not valid.' },
    '22003': { status: 400, message: 'A number in the request is out of range.' }, 
};

// central error handler, turns errors into safe json responses
function errorHandler(err, req, res, next) {
    logError(req, err.message);

    const mapped = err.code ? PG_ERROR_RESPONSES[err.code] : undefined;
    const status = mapped ? mapped.status : (err.status || 500);

    // only show the real error message when it is marked safe to expose
    let responseMessage;
    if (mapped) {
        responseMessage = mapped.message;
    } else if (status < 500 && err.expose) {
        responseMessage = err.message;
    } else {
        responseMessage = 'Something went wrong on the server.';
    }

    res.status(status).json({ error: responseMessage });
}

// wraps async routes so thrown errors reach errorHandler
function wrapAsyncRoute(routeHandler) {
    function routeWrapper(req, res, next) {
        Promise.resolve(routeHandler(req, res, next)).catch(next);
    }

    return routeWrapper;
}

module.exports = { errorHandler, asyncRoute: wrapAsyncRoute };