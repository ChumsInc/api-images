const ROOT_PATH = '/var/www';
const BASE_PATH = ROOT_PATH + '/images/products';
const UPLOAD_PATH = BASE_PATH + '/temp';
const ORIGINAL_PATH = BASE_PATH + '/originals';
const IMG_SIZES = [2048, 800, 400, 250, 125, 80];
const THUMB_SIZE = 250;
const IMAGE_PATHS = {
    ORIGINAL: ORIGINAL_PATH,
    original: ORIGINAL_PATH,
    originals: ORIGINAL_PATH,
    2048: BASE_PATH + '/2048',
    800: BASE_PATH + '/800',
    400: BASE_PATH + '/400',
    250: BASE_PATH + '/250',
    125: BASE_PATH + '/125',
    80: BASE_PATH + '/80',
    xl: BASE_PATH + '/2048',
    lg: BASE_PATH + '/800',
    thumb: BASE_PATH + '/250',
};
const IMAGE_PATHNAMES = ['originals', ...IMG_SIZES.map(size => String(size))];

const BG_WHITE = {r: 255, g: 255, b: 255};
const BG_TRANSPARENT = {r: 255, g: 255, b: 255, alpha: 0};


/**
 *
 * @param {string|number} pathname
 * @param {string} filename
 * @return {string}
 */
const imgPath = (pathname, filename) => {
    if (IMAGE_PATHS[pathname]) {
        return `${IMAGE_PATHS[pathname]}/${filename}`;
    }
    return `${BASE_PATH}/${String(pathname)}/${filename}`;
};

/**
 *
 * @param {string|number} pathname
 * @param {string} filename
 * @return {string}
 */
const webPath = (pathname, filename) => `${BASE_PATH}/${String(pathname)}/${filename}`.replace(ROOT_PATH, '');

exports.BASE_PATH = BASE_PATH;
exports.UPLOAD_PATH = UPLOAD_PATH;
exports.ORIGINAL_PATH = ORIGINAL_PATH;
exports.IMG_SIZES = IMG_SIZES;
exports.THUMB_SIZE = THUMB_SIZE;
exports.IMAGE_PATHS = IMAGE_PATHS;
exports.IMAGE_PATHNAMES = IMAGE_PATHNAMES;
exports.BG_WHITE = BG_WHITE;
exports.BG_TRANSPARENT = BG_TRANSPARENT;
exports.imgPath = imgPath;
exports.webPath = webPath;
