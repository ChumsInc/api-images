'use strict';

const router = require('express').Router();
const upload = require('./upload');
const list = require('./list');
const find = require('./find');
const user = require('../user');
const utils = require('./utils');
const image = require('./image');

const imageAdminRoles_Delete = (req, res, next) => {
    res.locals.adminRoles = ['admin', 'web_admin'];
    next();
}

const imageAdminRoles_Edit = (req, res, next) => {
    res.locals.adminRoles = ['admin', 'web_admin', 'production', 'web', 'cs'];
    next();
}

router.get('/find/:size(80|250|400|800)/:itemCode', find.findImage);
router.get('/list/all', list.getAllImages);

router.use(user.checkLoggedIn);
router.get('/list/:size', list.getList);
router.get('/props/:filename', list.getImageProps);
router.get('/query/:filename', list.getAllImages);
router.get('/test', utils.listBuildData);

router.use(imageAdminRoles_Edit, user.validateAdmin)
router.get('/resize/:fromSize(\\d+)/:toSize(\\d+)', utils.listResize);
router.get('/sync/all', list.getSyncAllDirectories);
router.get('/sync/:pathname', list.getSyncDirectory);
router.post('/upload', upload.uploadProduct);
router.post('/set-item/:filename/:itemCode?', image.postItemCode);
router.get('/alt-item/:filename', image.getAltItemCodes);
router.post('/alt-item/:itemCode', image.postMultipleAltItemCode);
router.post('/alt-item/:filename/:itemCode', image.postAltItemCode);
router.delete('/alt-item/:filename/:itemCode', image.deleteAltItemCode);
router.post('/tag/:filename/:tag', image.tagImage);
router.post('/tag/:tag', image.tagImages);
router.delete('/tag/:filename/:tag', image.untagImage);

router.delete('/delete/:filename', imageAdminRoles_Delete, user.validateAdmin, image.deleteImageFilename);

exports.router = router;
