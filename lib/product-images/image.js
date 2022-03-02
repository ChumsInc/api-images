import Debug from 'debug';
import {
    setItemCode,
    addImageTag,
    removeImageTag,
    removeImagePath,
    loadImages,
    loadAltItemCodes,
    setAltItemCode,
    setMultipleAltItemCode,
    delAltItemCode,
    applyItemCodeToFilenames, setPreferredImage
} from './db-handler.js';
const debug = Debug('chums:lib:product-images:image');
import {constants as fsConstants} from 'node:fs';
import {access, unlink} from 'node:fs/promises';
import {imgPath, IMAGE_PATHNAMES} from './settings.js';

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

async function removeImage({filename}) {
    try {
        const images = [];
        for (let i = 0, len = IMAGE_PATHNAMES.length; i < len; i++) {
            const pathname = IMAGE_PATHNAMES[i];
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
        const image = await loadImages({filename});
        res.json({image});
    } catch(err) {
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
        const altItems = await setAltItemCode({filename, itemCode});
        res.json({altItems});
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
        const altItems = await delAltItemCode({filename, itemCode});
        res.json({altItems});
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
        const result = await removeImage(req.params);
        res.json({result});
    } catch (err) {
        debug("deleteImageFilename()", err.message);
        res.json({error: err.message});
    }
};
