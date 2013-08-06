var express = require('express');
var path = require('path');
var confParser = require('./lib/configParser');
var middlewares = require('./lib/middleware');
var http = require('http');
var app = module.exports = express();

try {
    var config = require(path.resolve(__dirname, './config/server.json'));
    config.es = confParser.parseSync(path.resolve(__dirname, './config/elasticsearch.cfg'));
    config.mongo = confParser.parseSync(path.resolve(__dirname, './config/mongo.cfg'));
} catch (Exception) {
    process.stdout.write('Missing configuration file\n' + Exception + '\n');
    process.exit(1);
}

app.set('app.config', config);
app.set('port', config.app.port);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// Check for request type, return 406 if content is not acceptable
app.use(middlewares.setRequestType(app));

// Set response appropriate content type
app.use(middlewares.setContentType(app));

// Lowercase query parameters
app.use(middlewares.lowercase(app));

// Formalize sort query parameter
app.use(middlewares.formalizeSortParameter(app));

// Formalize limit query parameter
app.use(middlewares.formalizeLimitParameter(app));

// Set service connection strings
app.use(middlewares.setConnectionStrings(app));

// Enable CORS request
app.use(middlewares.enableCORS(app));

// Set X-Geoname-* Response headers
app.use(middlewares.setGeonamesResponseHeaders(app));

app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);

// Set root controller, template are in views directory
app.get('/', function(req, res) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.render('index');
});

// Add city route
require('./routes/city')(app);

// Log errors
app.use(function(err, req, res, next) {
    console.error(err.stack);
    next(err);
});

// Fallback to internal server error
app.use(function(err, req, res, next) {
    res.status(500); return;
});

var handle_errors = function(err) {
    if (err) { next(err); return; }
};

// Start app
http.createServer(app).listen(app.get('port'), handle_errors);
console.log('Server listening on port ' + app.get('port'));

var httpsConfig = app.get('app.config').app.https || {"enable":false};
if (httpsConfig.enable) {
    var https = require('https');
    var fs = require('fs');
    https.createServer({
        key: fs.readFileSync(httpsConfig.key),
        cert: fs.readFileSync(httpsConfig.cert)
    }, app).listen(httpsConfig.port, handle_errors);
    console.log('Server listening on port ' + httpsConfig.port);
}
