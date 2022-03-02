import Debug from 'debug';
import formidable from 'formidable';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import {IMG_SIZES, ORIGINAL_PATH, THUMB_SIZE, UPLOAD_PATH, webPath} from './settings.js';
import {makeImage} from './make-images.js';
import {saveImageProps} from './list.js';

const debug = Debug('chums:lib:product-images:upload');

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
        const form = new formidable.IncomingForm({uploadDir: UPLOAD_PATH, keepExtensions: true});
        const response = {
            progress: [],
            name: '',
        };
        form.on('error', (err) => {
            debug('error', err);
            return reject(new Error(err));
        });

        form.on('aborted', () => {
            debug('aborted');
            return reject(new Error('upload aborted'));
        });

        form.parse(req, async (err, fields, files) => {
            const [file] = Object.values(files);
            if (!file || Array.isArray(file)) {
                debug('file was not found?', file);
                return reject({error: 'file was not found'});
            }
            try {
                await fs.rename(file.filepath, `${ORIGINAL_PATH}/${response.name}`);
                return resolve({response, file, filename: response.name});
            } catch (err) {
                debug("handleUpload form.parse()", err.message);
                return Promise.reject(new Error(err));
            }
        })
    })
}

export const upload = async (req, res) => {
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


