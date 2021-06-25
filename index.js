const dotenv  = require('dotenv').config();
if (dotenv.error) {
    console.log('*** error loading .env', dotenv.error);
    return;
}

const debug = require('debug')('chums:index');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const http = require('http');
const compression = require('compression');
const path = require('path');
const libRouter = require('./lib');
const {wsServer, onUpgrade} = require('./lib/websockets');


const app = express();
app.use((req, res, next) => {
    req.wsServer = wsServer;
    next();
})
app.set('trust proxy', 'loopback');
app.use(compression());
app.use(helmet());
// app.use(function (req, res, next) {
//     res.setHeader('Cross-Origin-Resource-Policy', 'same-site')
//     next()
// })
app.set('json spaces', 2);
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, '/views'));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(libRouter.router);

const {PORT, NODE_ENV} = process.env;
const server = http.createServer(app);
server.on('upgrade', onUpgrade);

server.listen(PORT);
debug(`server started on port: ${PORT}; mode: ${NODE_ENV}`);
