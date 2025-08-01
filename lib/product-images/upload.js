import Debug from 'debug';
import { IncomingForm } from 'formidable';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import { imageSizes, originalsPath, thumbSize, uploadPath, webPath } from './settings.js';
import { makeImage } from './make-images.js';
import { saveImageProps } from './list.js';
import { loadImages } from "./db-handler.js";
const debug = Debug('chums:lib:product-images:upload');
async function getOriginalSize(filename) {
    try {
        const imgContent = await fs.readFile(`${originalsPath}/${filename}`);
        const img = sharp(imgContent);
        const { width, height, size } = await img.metadata();
        return { path: 'originals', width: width ?? 0, height: height ?? 0, size: size ?? 0, filename };
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getOriginalSize()", err.message);
            return Promise.reject(err);
        }
        debug("getOriginalSize()", err);
        return Promise.reject(new Error('Error in getOriginalSize()'));
    }
}
function handleUpload(req) {
    return new Promise((resolve, reject) => {
        const form = new IncomingForm({ uploadDir: uploadPath, keepExtensions: true });
        const response = {
            progress: [],
            name: '',
        };
        form.on('file', (formName, file) => {
            response.name = formName;
        });
        form.on('error', (err) => {
            debug('error', err);
            return reject(new Error(err));
        });
        form.on('aborted', () => {
            debug('aborted');
            return reject(new Error('upload aborted'));
        });
        form.once('end', () => {
            debug('handleUpload() upload complete');
        });
        form.parse(req, async (err, fields, files) => {
            if (err) {
                return reject(new Error(err));
            }
            const fileValues = Object.values(files);
            if (!fileValues.length) {
                return Promise.reject(new Error('No files found'));
            }
            let [file] = fileValues;
            if (Array.isArray(file)) {
                let [nextFile] = file;
                file = nextFile;
            }
            if (!file || Array.isArray(file)) {
                debug('file was not found?', file);
                return reject({ error: 'file was not found' });
            }
            try {
                await fs.rename(file.filepath, `${originalsPath}/${response.name}`);
                return resolve({ response, file, filename: response.name });
            }
            catch (err) {
                if (err instanceof Error) {
                    debug("()", err.message);
                    return Promise.reject(err);
                }
                debug("()", err);
                return Promise.reject(new Error('Error in ()'));
            }
        });
    });
}
export const uploadProductImages = async (req, res) => {
    try {
        const upload = await handleUpload(req);
        const filename = upload.filename;
        const original = await getOriginalSize(filename);
        const images = await Promise.all(imageSizes.map(size => makeImage(originalsPath, size, filename)));
        images.unshift(original);
        await saveImageProps(original.path, original.filename);
        for await (const img of images) {
            await saveImageProps(img.path, img.filename);
        }
        const [saveResult] = await loadImages({ filename });
        res.json({
            ...upload,
            images,
            thumb: webPath(thumbSize, filename),
            saveResult,
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("uploadProductImages()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in uploadProductImages' });
    }
};
