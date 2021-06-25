const debug = require('debug')('chums:lib:product-images:upload');
const formidable = require('formidable');
const sharp = require('sharp');
const fs = require('fs').promises;
const {
    UPLOAD_PATH,
    ORIGINAL_PATH,
    IMG_SIZES,
    THUMB_SIZE,
    webPath
} = require('./settings');
const {makeImage} = require('./make-images');
const {saveImageProps} = require('./list');

async function getOriginalSize(filename) {
    try {
        const imgContent = await fs.readFile(`${ORIGINAL_PATH}/${filename}`);
        const img = await sharp(imgContent);
        const {width, height, size} = await img.metadata();
        return {path: 'originals', width, height, size, filename};
    } catch (err) {
        debug("getOriginalSize()", err.message);
        return Promise.reject(err);
    }
}

function handleUpload(req) {
    return new Promise((resolve, reject) => {
        const form = new formidable.IncomingForm();
        const response = {
            progress: [],
            name: '',
        };
        form.uploadDir = UPLOAD_PATH;
        form.keepExtensions = true;

        form.on('file', (name) => {
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
                fs.rename(file.path, `${ORIGINAL_PATH}/${response.name}`)
                    .then(() => {
                        debug(`moved to ${ORIGINAL_PATH}/${response.name}`);
                        return resolve({response, file, filename: response.name});
                    })
                    .catch(err => {
                        return reject(new Error(err));
                    })
            })

    })
}

exports.upload = async (req, res) => {
    try {
        const upload = await handleUpload(req);
        const filename = upload.filename;
        const original = await getOriginalSize(filename);
        const images = await Promise.all(IMG_SIZES.map(size => makeImage(ORIGINAL_PATH, size, filename)));
        images.unshift(original);
        const saveResult = await Promise.all(images.map(img => saveImageProps(img.path, img.filename)));
        res.json({
            ...upload,
            images,
            thumb: webPath(THUMB_SIZE, filename),
            saveResult,
        });
    } catch (err) {
        debug("upload()", err.message);
        return res.json({error: err.message, name: err.name});
    }
};


