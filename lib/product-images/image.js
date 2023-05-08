import Debug from 'debug';
import {
    addImageTag,
    applyItemCodeToFilenames,
    delAltItemCode,
    loadAltItemCodes,
    loadImages,
    removeImagePath,
    removeImageTag, saveImage,
    setAltItemCode,
    setImageActive,
    setItemCode,
    setMultipleAltItemCode,
    setPreferredImage,
} from './db-handler.js';
import {constants as fsConstants} from 'node:fs';
import {access, unlink} from 'node:fs/promises';
import {imagePathNames, imgPath} from './settings.js';

const debug = Debug('chums:lib:product-images:image');

/**
 *
 * @param {string} filename
 * @param {string} pathname
 * @return {Promise<string|*>}
 * @private
 */
async function _removeImage({filename, pathname}) {
    try {
        const imgFilePath = imgPath(pathname, filename);
        await access(imgFilePath, fsConstants.W_OK);
        await unlink(imgFilePath);
        await removeImagePath({filename, pathname});
        return imgFilePath;
    } catch (err) {
        debug("_removeImage()", err.message);
        return err;
    }
}

/**
 *
 * @param {string} filename
 * @return {Promise<null|ProductImage[]|*>}
 */
async function removeImage({filename}) {
    try {
        const [image] = await loadImages({filename});
        if (!image) {
            return null;
        }
        for await (const pathname of image.pathnames) {
            await _removeImage({filename, pathname});
        }
        return await loadImages({filename});
    } catch (err) {
        debug("removeImage()", err.message);
        return err;
    }
}

export const postItemCode = async (req, res) => {
    try {
        const {filename, itemCode = ''} = req.params;
        const image = await setItemCode({filename, itemCode});
        res.json({image});
    } catch (err) {
        debug("postItemCode()", err.message);
        res.json({error: err.message});
    }
};

export const postPreferredItemCode = async (req, res) => {
    try {
        const {filename, itemCode} = req.params;
        await setPreferredImage(filename, itemCode);
        const [image] = await loadImages({filename});
        res.json({image});
    } catch (err) {
        debug("postPreferredItemCode()", err.message);
        return Promise.reject(err);
    }
}

export const postItemCodeFilenames = async (req, res) => {
    try {
        const {itemCode} = req.params;
        const {filenames} = req.body;
        if (filenames.length === 0) {
            return res.json({images: []});
        }
        const images = await applyItemCodeToFilenames({itemCode, filenames});
        res.json({images});
    } catch (err) {
        debug("postItemCode()", err.message);
        res.json({error: err.message});
    }
};

export const getAltItemCodes = async (req, res) => {
    try {
        const {filename} = req.params;
        const altItems = await loadAltItemCodes({filename})
        res.json({altItems});
    } catch (err) {
        debug("getAltItemCodes()", err.message);
        return err;
    }
}


export const postAltItemCode = async (req, res) => {
    try {
        const {filename, itemCode = ''} = req.params;
        const image = await setAltItemCode({filename, itemCode});
        res.json({image});
    } catch (err) {
        debug("postItemCode()", err.message);
        res.json({error: err.message});
    }
};


export const postMultipleAltItemCode = async (req, res) => {
    try {
        const {itemCode} = req.params;
        const {filenames = []} = req.body;
        const altItems = await setMultipleAltItemCode({filenames, itemCode});
        res.json({altItems});
    } catch (err) {
        debug("postItemCode()", err.message);
        res.json({error: err.message});
    }
};

export const deleteAltItemCode = async (req, res) => {
    try {
        const {filename, itemCode = ''} = req.params;
        const image = await delAltItemCode({filename, itemCode});
        res.json({image});
    } catch (err) {
        debug("postItemCode()", err.message);
        res.json({error: err.message});
    }
};


export const tagImage = async (req, res) => {
    try {
        const {filename, tag} = req.params;
        const image = await addImageTag({filename, tag});
        res.json({image});
    } catch (err) {
        debug("tagImage()", err.message);
        res.json({error: err.message});
    }
};


export const tagImages = async (req, res) => {
    try {
        const {tag} = req.params;
        const {filenames} = req.body;
        const images = await Promise.all(filenames.map(filename => addImageTag({filename, tag})));
        res.json({images});
    } catch (err) {
        debug("tagImages()", err.message);
        res.json({error: err.message});
    }
};

export const untagImage = async (req, res) => {
    try {
        const {filename, tag} = req.params;
        const image = await removeImageTag({filename, tag});
        res.json({image});
    } catch (err) {
        debug("untagImage()", err.message);
        res.json({error: err.message});
    }
};

export const deleteImageFilename = async (req, res) => {
    try {
        const images = await removeImage(req.params);
        res.json({images});
    } catch (err) {
        debug("deleteImageFilename()", err.message);
        res.json({error: err.message});
    }
};

export const putImageActive = async (req, res) => {
    try {
        const {filename, active} = req.params;
        const image = await setImageActive(filename, active);
        res.json({image});
    } catch (err) {
        if (err instanceof Error) {
            debug("putImageActive()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in putImageActive'});
    }
}

export const putImageProps = async (req, res) => {
    try {
        const {filename} = req.params;
        const [_image] = await loadImages({filename});
        if (!_image) {
            return res.json({error: 'filename not found'});
        }
        const props = {..._image, ...req.body, filename};
        const image = await saveImage(props)
        res.json({image});
    } catch(err) {
        if (err instanceof Error) {
            debug("putImageProps()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in putImageProps'});
    }
}
