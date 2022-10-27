import Debug from 'debug';
import {Router} from 'express';
import {validateRole, validateUser} from 'chums-local-modules/dist/validate-user.js';
import {uploadProductImages} from './product-images/upload.js';
import * as list from './product-images/list.js';
import * as utils from './product-images/utils.js';
import * as image from './product-images/image.js';
import {findImage, getImageList} from "./utils/findImage.js";

const debug = Debug('chums:lib');
export const router = Router();


function logPath(req, res, next) {
    const user = res.locals.profile?.user?.email || res.locals.profile?.user?.id || '-';
    const {ip, method, originalUrl} = req;
    const referer = req.get('referer') || '';
    debug(ip, user, method, originalUrl, referer);
    next();
}


// public paths
router.get('/products/find/:size(80|250|400|800)/:itemCode', logPath, findImage);
router.get('/products/list/all', logPath, list.getAllImages);


router.use(logPath, validateUser);
// below are routes that require validation
router.get('/products/find/:size(80|250|400|800)', getImageList);
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
router.post('/products/set-preferred-item/:filename/:itemCode', image.postPreferredItemCode);
router.post('/products/set-item-code/:itemCode', image.postItemCodeFilenames);
router.post('/products/upload', uploadProductImages);

router.post('/products/tag/:filename/:tag', image.tagImage);
router.post('/products/tag/:tag', image.tagImages);

router.put('/products/:filename/:active(1|0)', image.putImageActive);

router.delete('/products/alt-item/:filename/:itemCode', image.deleteAltItemCode);
router.delete('/products/tag/:filename/:tag', image.untagImage);
router.delete('/products/delete/:filename', validateRole(['admin', 'web_admin']), image.deleteImageFilename);
