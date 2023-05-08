import Debug from 'debug';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import {addImagePath, loadImages, removeImagePath} from './db-handler.js';
import {imagePathNames, imagePaths, imageSizes, imgPath} from './settings.js';
import {makeImage} from './make-images.js';

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
        const {width, height, size, ...metadata} = await sharp(img).metadata();
        return {filename, pathName, path: `${pathName}/${filename}`, width, height, size, metadata};
    } catch (err) {
        return {};
    }
}

async function listImages(path) {
    try {
        const entries = await fs.readdir(path, {encoding: 'utf8', withFileTypes: true});
        return entries.filter(entry => entry.isFile()).map(entry => entry.name);
    } catch (err) {
        debug("listImages()", err.message);
        return err;
    }
}

async function exists(path, filename) {

}

async function getImageSizesProps(filename) {
    try {
        return await Promise.all(imageSizes.map(size => getDimensions(size, filename)));
    } catch (err) {
        debug("getImageSizesProps()", err.message);
        return err;
    }
}

async function parseImageProps(buffer) {
    try {
        const {width, height, size, format, space} = await sharp(buffer).metadata();
        return {width, height, size, img_format: format, color_space: space};
    } catch (err) {
        return {};
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
        const {width, height, size, img_format, color_space} = await parseImageProps(img);
        if (!size) {
            return Promise.reject(new Error(`Invalid Image: ${pathname}/${filename} - zero size`));
        }
        const props = {
            filename,
            pathname,
            dimensions: {width, height, size},
            color_space,
            img_format,
        };
        return await addImagePath(props);
    } catch (err) {
        console.log(err, err.type, err.name, err.message);
        debug("saveImageProps()", err.message);
        return Promise.reject(err);
    }
}

export const getList = (req, res) => {
    if (!imagePaths[req.params.size]) {
        res.json({error: 'invalid size'});
        return;
    }
    listImages(imagePaths[req.params.size])
        .then(images => res.json(images))
        .catch(err => res.json({error: err.message}));
};

export const getAllImages = async (req, res) => {
    try {
        const props = {...req.params, ...req.query};
        const images = await loadImages(props);
        res.json({props, images});
    } catch (err) {
        debug("getAllImages()", err.message);
        res.json({error: err.message})
    }
};

export const getImageByFilename = async (req, res) => {
    try {
        const [image = null] = await loadImages(req.params);
        res.json({image});
    } catch(err) {
        if (err instanceof Error) {
            debug("getImage()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getImage'});
    }
}
export const getImageProps = (req, res) => {
    getImageSizesProps(req.params.filename)
        .then(sizes => res.json(sizes))
        .catch(err => res.json({error: err.message}));
};


export async function syncDirectory({pathname, rebuild}) {
    try {
        if (!imagePathNames.includes(pathname)) {
            return res.json({error: 'invalid path'});
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
        const removed = await Promise.all(toRemove.map(img => removeImagePath({filename: img.filename, pathname})));

        return {added, removed, filenames};
    } catch (err) {
        debug("syncDirectory()", err.message);
        return Promise.reject(err);
    }
}


export const getSyncDirectory = async (req, res) => {
    try {
        const {pathname} = req.params;
        const {rebuild = '0'} = req.query;
        const {added, removed, filenames} = syncDirectory({pathname, rebuild});
        res.json({added, removed, filenames});
    } catch (err) {
        debug("syncDirectory()", err.message);
        res.status(500).json({error: err.message})
    }
};

export const getSyncAllDirectories = async (req, res) => {
    try {
        const {rebuild = '0'} = req.query;
        const results = await Promise.all(imagePathNames.map(pathname => syncDirectory({pathname, rebuild})));
        res.json(results);
    } catch (err) {
        debug("getSyncAllDirectories()", err.message);
        return Promise.reject(err);
    }
};

async function buildImageSize(fromSize, toSize) {
    try {
        const images = await loadImages();
        const toResize = images.filter(img => !!img.sizes[fromSize] && !img.sizes[toSize]);
        const imageSize = Number(toSize);
        const resized = await Promise.all(toResize.map(img => makeImage(imagePaths[fromSize], imageSize, img.filename)));
        return await Promise.all(resized.map(img => saveImageProps(toSize, img.filename)));
    } catch (err) {
        debug("buildImageSize()", err.message);
        return Promise.reject(err);
    }
}

export const resizeFromList = async (req, res) => {
    try {
        const images = await buildImageSize(req.params.fromSize, req.params.toSize);
        const filenames = images.map(img => img.filename);
        res.json({filenames});
    } catch (err) {
        debug("resizeFromList()", err.message);
        return Promise.reject(err);
    }
};
