const {setItemCode,
    addImageTag,
    removeImageTag,
    removeImagePath,
    loadImages,
    loadAltItemCodes,
    setAltItemCode,
    setMultipleAltItemCode,
    delAltItemCode,
    applyItemCodeToFilenames
} = require('./db-handler');
const debug = require('debug')('chums:lib:product-images:image');
const fs = require('fs');
const fsPromises = fs.promises;
const {imgPath, IMAGE_PATHNAMES} = require('./settings');

async function _removeImage({filename, pathname}) {
    try {
        const imgFilePath = imgPath(pathname, filename);
        await fsPromises.access(imgFilePath, fs.constants.W_OK);
        await fsPromises.unlink(imgFilePath);
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

const postItemCode = async (req, res) => {
    try {
        const {filename, itemCode = ''} = req.params;
        const image = await setItemCode({filename, itemCode});
        res.json({image});
    } catch (err) {
        debug("postItemCode()", err.message);
        res.json({error: err.message});
    }
};
exports.postItemCode = postItemCode;

const postItemCodeFilenames = async (req, res) => {
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
exports.postItemCodeFilenames = postItemCodeFilenames;

const getAltItemCodes = async (req, res) => {
    try {
        const {filename} = req.params;
        const altItems = await loadAltItemCodes({filename})
        res.json({altItems});
    } catch (err) {
        debug("getAltItemCodes()", err.message);
        return err;
    }
}
exports.getAltItemCodes = getAltItemCodes;

const postAltItemCode = async (req, res) => {
    try {
        const {filename, itemCode = ''} = req.params;
        const altItems = await setAltItemCode({filename, itemCode});
        res.json({altItems});
    } catch (err) {
        debug("postItemCode()", err.message);
        res.json({error: err.message});
    }
};
exports.postAltItemCode = postAltItemCode;

const postMultipleAltItemCode = async (req, res) => {
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
exports.postMultipleAltItemCode = postMultipleAltItemCode;

const deleteAltItemCode = async (req, res) => {
    try {
        const {filename, itemCode = ''} = req.params;
        const altItems = await delAltItemCode({filename, itemCode});
        res.json({altItems});
    } catch (err) {
        debug("postItemCode()", err.message);
        res.json({error: err.message});
    }
};
exports.deleteAltItemCode = deleteAltItemCode;


const tagImage = async (req, res) => {
    try {
        const {filename, tag} = req.params;
        const image = await addImageTag({filename, tag});
        res.json({image});
    } catch (err) {
        debug("tagImage()", err.message);
        res.json({error: err.message});
    }
};
exports.tagImage = tagImage;

const tagImages = async (req, res) => {
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
exports.tagImages = tagImages;

const untagImage = async (req, res) => {
    try {
        const {filename, tag} = req.params;
        const image = await removeImageTag({filename, tag});
        res.json({image});
    } catch (err) {
        debug("untagImage()", err.message);
        res.json({error: err.message});
    }
};
exports.untagImage = untagImage;

const deleteImageFilename = async (req, res) => {
    try {
        const result = await removeImage(req.params);
        res.json({result});
    } catch (err) {
        debug("deleteImageFilename()", err.message);
        res.json({error: err.message});
    }
};
exports.deleteImageFilename = deleteImageFilename;
