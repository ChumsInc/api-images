const debug = require('debug')('chums:lib');
const router = require('express').Router();
const {validateUser, validateRole} = require('chums-local-modules');
const handler = require('./product-images/upload');
const list = require('./product-images/list');
const find = require('./product-images/find');
const utils = require('./product-images/utils');
const image = require('./product-images/image');


function logPath(req, res, next) {
    const user = res.locals.profile?.user?.email || res.locals.profile?.user?.id || '-';
    const {ip, method, originalUrl} = req;
    const referer = req.get('referer') || '';
    debug(ip, user, method, originalUrl, referer);
    next();
}


// public paths
router.get('/products/find/:size(80|250|400|800)/:itemCode', logPath, find.findImage);
router.get('/products/list/all', logPath, list.getAllImages);


router.use(logPath, validateUser);
// below are routes that require validation
router.get('/products/list/:size', list.getList);
router.get('/products/props/:filename', list.getImageProps);
router.get('/products/query/:filename', list.getAllImages);
router.get('/products/test', utils.listBuildData);

router.use(validateRole(['admin', 'web_admin', 'production', 'web', 'cs']))
router.get('/products/resize/:fromSize(originals|\\d+)/:toSize(\\d+)', utils.listResize);
router.get('/products/sync/all', list.getSyncAllDirectories);
router.get('/products/sync/:pathname', list.getSyncDirectory);
router.get('/products/alt-item/:filename', image.getAltItemCodes);

router.post('/products/alt-item/:itemCode', image.postMultipleAltItemCode);
router.post('/products/alt-item/:filename/:itemCode', image.postAltItemCode);
router.post('/products/set-item/:filename/:itemCode?', image.postItemCode);
router.post('/products/set-item-code/:itemCode', image.postItemCodeFilenames);
router.post('/products/upload', handler.upload);

router.post('/products/tag/:filename/:tag', image.tagImage);
router.post('/products/tag/:tag', image.tagImages);

router.delete('/products/alt-item/:filename/:itemCode', image.deleteAltItemCode);
router.delete('/products/tag/:filename/:tag', image.untagImage);
router.delete('/products/delete/:filename', validateRole(['admin', 'web_admin']), image.deleteImageFilename);


exports.router = router;
