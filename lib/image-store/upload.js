const debug = require('debug')('chums:lib:image-store:upload');
const formidable = require('formidable');
const sharp = require('sharp');
const fs = require('fs').promises;
const {ROOT_PATH, UPLOAD_PATH, ORIGINAL_PATH, IMG_SIZES, THUMB_SIZE, BG_WHITE, BG_TRANSPARENT, imgPath, webPath,
    CONFIG_PRODUCTS, CONFIG_LIFESTYLE} = require('./settings');
const {makeProductImage, makeImage, getOriginalSize} = require('./utils');
const {saveImageProps} = require('./list');


exports.handleUpload = handleUpload;
/**
 *
 * @param {Object} req Express request object
 * @param {String} toPath
 * @return {Promise<*>}
 */
function handleUpload(req, toPath) {
    return new Promise((resolve, reject) => {
        const form = new formidable.IncomingForm();
        const response = {
            progress: [],
            name: '',
        };
        form.uploadDir = UPLOAD_PATH;
        form.keepExtensions = true;

        form
            .on('file', (name) => {
                response.name = name;
            })
            .on('error', (err) => {
                debug('error', err);
                return reject(new Error(err));
            })
            .on('aborted', () => {
                debug('aborted');
                return reject(new Error('upload aborted'));
            })
            .parse(req, (err, fields, files) => {
                const [file] = Object.keys(files).map(key => files[key]);
                if (!file) {
                    debug('file was not found?', file);
                    return reject({error: 'file was not found'});
                }
                fs.rename(file.path, `${toPath}/${response.name}`)
                    .then(() => {
                        debug(`moved to ${toPath}/${response.name}`);
                        return resolve({response, file, filename: response.name});
                    })
                    .catch(err => {
                        return reject(new Error(err));
                    })
            })

    })
}

/**
 *
 * @param req
 * @param res
 * @return {Promise<*>}
 */
async function uploadProduct(req, res) {
    try {
        const upload = await handleUpload(req, CONFIG_PRODUCTS.ORIGINAL_PATH);
        const filename = upload.filename;
        const original = await getOriginalSize(CONFIG_PRODUCTS.ORIGINAL_PATH, filename);
        const images = await Promise.all(CONFIG_PRODUCTS.SIZES.map(size => makeProductImage(CONFIG_PRODUCTS.ORIGINAL_PATH, size, filename)));
        images.unshift(original);
        const saveResult = await Promise.all(images.map(img => saveImageProps(img.path, img.filename)));
        res.json({
            ...upload,
            images,
            thumb: webPath(CONFIG_PRODUCTS.THUMB_SIZE, filename),
            saveResult,
        });
    } catch(err) {
        debug("upload()", err.message);
        return res.json({error: err.message, name: err.name});
    }
}

exports.uploadProduct = uploadProduct;

async function uploadLifestyle(req, res) {
    try {
        const upload = await handleUpload(req, CONFIG_LIFESTYLE.ORIGINAL_PATH);
        const filename = upload.filename;
        const original = await getOriginalSize(filename);
        const image = makeImage({
            fromFilename: CONFIG_LIFESTYLE.imgPath(CONFIG_LIFESTYLE.SIZE_PATHS.original, filename),
            toFilename: CONFIG_LIFESTYLE.imgPath(CONFIG_LIFESTYLE.SIZE_PATHS.thumb, filename),
            toWidth: CONFIG_LIFESTYLE.THUMB_SIZE,
            toHeight: CONFIG_LIFESTYLE.THUMB_SIZE,
            fit: 'inside',
        });
        const images = [image, original];
        const saveResult = await Promise.all(images.map(img => saveImageProps(img.path, img.filename)));
        res.json({
            ...upload,
            images,
            thumb: webPath(THUMB_SIZE, filename),
            saveResult,
        });
    } catch(err) {
        debug("upload()", err.message);
        return res.json({error: err.message, name: err.name});
    }
}

