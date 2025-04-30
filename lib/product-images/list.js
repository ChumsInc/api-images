import Debug from 'debug';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import { addImagePath, loadImages, removeImagePath } from './db-handler.js';
import { imagePathNames, imagePaths, imageSizes, imgPath } from './settings.js';
import { makeImage } from './make-images.js';
const debug = Debug('chums:lib:product-images:list');
/**
 *
 * @param pathName
 * @param filename
 * @return {Promise<{size: *, width: *, height: *}|{}>}
 */
async function getDimensions(pathName, filename) {
    try {
        const img = await fs.readFile(imgPath(pathName, filename));
        const { width, height, size, ...metadata } = await sharp(img).metadata();
        return {
            filename,
            pathName,
            path: `${pathName}/${filename}`,
            width: width ?? 0,
            height: height ?? 0,
            size: size ?? 0,
            metadata
        };
    }
    catch (err) {
        return null;
    }
}
async function listImages(path) {
    try {
        const entries = await fs.readdir(path, { encoding: 'utf8', withFileTypes: true });
        return entries.filter(entry => entry.isFile()).map(entry => entry.name);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("listImages()", err.message);
            return Promise.reject(err);
        }
        debug("listImages()", err);
        return Promise.reject(new Error('Error in listImages()'));
    }
}
async function getImageSizesProps(filename) {
    try {
        return await Promise.all(imageSizes.map(size => getDimensions(`${size}`, filename)));
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getImageSizesProps()", err.message);
            return Promise.reject(err);
        }
        debug("getImageSizesProps()", err);
        return Promise.reject(new Error('Error in getImageSizesProps()'));
    }
}
async function parseImageProps(buffer) {
    try {
        const { width, height, size, format, space } = await sharp(buffer).metadata();
        return { width, height, size, img_format: format, color_space: space };
    }
    catch (err) {
        return null;
    }
}
/**
 *
 * @param {string} pathname
 * @param {string} filename
 * @return {Promise<ProductImage|null>}
 */
export async function saveImageProps(pathname, filename) {
    try {
        const img = await fs.readFile(imgPath(pathname, filename));
        const imgProps = await parseImageProps(img);
        if (!imgProps || !imgProps.size) {
            return Promise.reject(new Error(`Invalid Image: ${pathname}/${filename} - zero size`));
        }
        const { width, height, size, img_format, color_space } = imgProps;
        const props = {
            filename,
            pathname,
            dimensions: { width, height, size },
            color_space,
            img_format,
        };
        return await addImagePath(props);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("saveImageProps()", err.message);
            return Promise.reject(err);
        }
        debug("saveImageProps()", err);
        return Promise.reject(new Error('Error in saveImageProps()'));
    }
}
export const getList = async (req, res) => {
    try {
        if (!imagePaths[req.params.size]) {
            res.json({ error: 'invalid size' });
            return;
        }
        const images = await listImages(imagePaths[req.params.size]);
        res.json(images);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getList()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getList' });
    }
};
export const getAllImages = async (req, res) => {
    try {
        const props = { ...req.params, ...req.query };
        const images = await loadImages(props);
        res.json({ props, images });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getAllImages()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getAllImages' });
    }
};
export const getImageByFilename = async (req, res) => {
    try {
        const [image = null] = await loadImages(req.params);
        res.json({ image });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getImage()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getImage' });
    }
};
export const getImageProps = async (req, res) => {
    try {
        const sizes = await getImageSizesProps(req.params.filename ?? req.query.filename);
        res.json(sizes);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getImageProps()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getImageProps' });
    }
};
export async function syncDirectory({ pathname, rebuild }) {
    try {
        if (!imagePathNames.includes(pathname)) {
            return Promise.reject(new Error(`Invalid pathname: ${pathname}`));
        }
        const doRebuild = rebuild === '1';
        let imageList = await loadImages();
        const filenames = await listImages(imagePaths[pathname]);
        const newFilenames = filenames
            .filter(filename => doRebuild || imageList.filter(img => img.filename === filename && img.pathnames.includes(pathname)).length === 0);
        const added = await Promise.all(newFilenames.map(filename => saveImageProps(pathname, filename)));
        imageList = await loadImages();
        const toRemove = imageList
            .filter(img => img.pathnames.includes(pathname) && filenames.filter(filename => filename === img.filename).length === 0);
        const removed = await Promise.all(toRemove.map(img => removeImagePath({ filename: img.filename, pathname })));
        return {
            added: added.filter(img => !!img),
            removed: removed.filter(img => !!img),
            filenames
        };
    }
    catch (err) {
        if (err instanceof Error) {
            debug("syncDirectory()", err.message);
            return Promise.reject(err);
        }
        debug("syncDirectory()", err);
        return Promise.reject(new Error('Error in syncDirectory()'));
    }
}
export const getSyncDirectory = async (req, res) => {
    try {
        const { pathname } = req.params;
        const rebuild = req.query.rebuild ?? '0';
        const { added, removed, filenames } = await syncDirectory({ pathname, rebuild });
        res.json({ added, removed, filenames });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getSyncDirectory()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getSyncDirectory' });
    }
};
export const getSyncAllDirectories = async (req, res) => {
    try {
        const rebuild = req.query.rebuild ?? '0';
        const results = await Promise.all(imagePathNames.map(pathname => syncDirectory({ pathname, rebuild })));
        res.json(results);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getSyncAllDirectories()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getSyncAllDirectories' });
    }
};
async function buildImageSize(fromSize, toSize) {
    try {
        const images = await loadImages();
        const toResize = images.filter(img => !!img.sizes[fromSize] && !img.sizes[toSize]);
        const imageSize = Number(toSize);
        const resized = await Promise.all(toResize.map(img => makeImage(imagePaths[fromSize], imageSize, img.filename)));
        return await Promise.all(resized.filter(img => !!img).map(img => saveImageProps(`${toSize}`, img.filename)));
    }
    catch (err) {
        if (err instanceof Error) {
            debug("buildImageSize()", err.message);
            return Promise.reject(err);
        }
        debug("buildImageSize()", err);
        return Promise.reject(new Error('Error in buildImageSize()'));
    }
}
export const resizeFromList = async (req, res) => {
    try {
        const images = await buildImageSize(req.params.fromSize, req.params.toSize);
        const filenames = images.filter(img => !!img).map(img => img.filename);
        res.json({ filenames });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("resizeFromList()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in resizeFromList' });
    }
};
