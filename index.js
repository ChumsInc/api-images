import 'dotenv/config';
import Debug from 'debug';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import http from 'node:http';
import compression from 'compression';
import {router} from './lib/index.js';

if (!process.env.PORT) {
    console.log('*** error loading .env - PORT is not set',);
    process.exit(1);
}
const debug = Debug('chums:index');


const app = express();
app.set('trust proxy', 'loopback');
app.use(compression());
app.use(helmet());
app.set('json spaces', 2);
app.set('view engine', 'pug');
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(router);

const {PORT, NODE_ENV} = process.env;
const server = http.createServer(app);


server.listen(PORT);
debug(`server started on port: ${PORT}; mode: ${NODE_ENV}`);
