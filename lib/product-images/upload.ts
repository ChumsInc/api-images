import Debug from 'debug';
import formidable, {IncomingForm, File} from 'formidable';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import {imageSizes, originalsPath, thumbSize, uploadPath, webPath} from './settings.js';
import {makeImage} from './make-images.js';
import {saveImageProps} from './list.js';
import {loadImages, saveImage} from "./db-handler.js";
import {BaseImage} from "../types.js";
import {Request, Response} from "express";

const debug = Debug('chums:lib:product-images:upload');

async function getOriginalSize(filename:string):Promise<BaseImage> {
    try {
        const imgContent = await fs.readFile(`${originalsPath}/${filename}`);
        const img = sharp(imgContent);
        const {width, height, size} = await img.metadata();
        return {path: 'originals', width: width ?? 0, height: height ?? 0, size: size ?? 0, filename};
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getOriginalSize()", err.message);
            return Promise.reject(err);
        }
        debug("getOriginalSize()", err);
        return Promise.reject(new Error('Error in getOriginalSize()'));
    }
}
export interface UploadResponse {
    response: {
        progress: number[];
        name: string;
    };
    file: File;
    filename: string;
}
function handleUpload(req:Request):Promise<UploadResponse> {
    return new Promise((resolve, reject) => {
        const form = new IncomingForm({uploadDir: uploadPath, keepExtensions: true});
        const response = {
            progress: [],
            name: '',
        };
        form.on('file', (formName, file) => {
            response.name  = formName;
        })
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
        })

        form.parse(req, async (err, fields, files) => {
            if (err) {
                return reject(new Error(err));
            }
            const fileValues = Object.values(files) as File[];
            if (!fileValues.length) {
                return Promise.reject(new Error('No files found'));
            }
            let [file] = fileValues;
            if (Array.isArray(file)) {
                let [nextFile] = file as File[];
                file = nextFile;
            }
            if (!file || Array.isArray(file)) {
                debug('file was not found?', file);
                return reject({error: 'file was not found'});
            }
            try {
                await fs.rename(file.filepath, `${originalsPath}/${response.name}`);
                return resolve({response, file, filename: response.name});
            } catch(err:unknown) {
                if (err instanceof Error) {
                    debug("()", err.message);
                    return Promise.reject(err);
                }
                debug("()", err);
                return Promise.reject(new Error('Error in ()'));
            }
        })
    })
}

export const uploadProductImages = async (req:Request, res:Response):Promise<void> => {
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
        const [saveResult] = await loadImages({filename});
        res.json({
            ...upload,
            images,
            thumb: webPath(thumbSize, filename),
            saveResult,
        });
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("uploadProductImages()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in uploadProductImages'});
    }
};


