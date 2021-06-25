const debug = require('debug')('chums:lib:product-images:utils');
const sharp = require('sharp');
const fs = require('fs').promises;
const {BG_WHITE, BG_TRANSPARENT, imgPath, IMAGE_PATHS} = require('./settings');
const {loadImages} = require('./db-handler');
const {syncDirectory} = require('./list');
const {makeImage} = require('./make-images');

const image_name_filter = /^(\w+)_([\w\- ]+)_([\w\-]+).(jpg|gif|png)$/gm;

async function rebuildSize ({fromSize, toSize, test = false}) {
    try {
        const images = await loadImages();
        const toResize = images.filter(img => !!img.sizes[fromSize] && !img.sizes[toSize]);
        if (test) {
            return toResize;
        }
        const imageSize = Number(toSize);
        return await Promise.all(toResize.map(img => makeImage(IMAGE_PATHS[fromSize], imageSize, img.filename)));
    } catch(err) {
        debug("rebuildSize()", err.message);
        return Promise.reject(err);
    }
}

exports.listResize = async (req, res) => {
    try {
        const {fromSize, toSize} = req.params;
        const test = req.query.test === '1';
        const images = await rebuildSize({fromSize, toSize, test});
        const filenames = images.map(img => img.filename);
        const {added, removed} = await syncDirectory({pathname: toSize});
        res.json({filenames, added: added.map(img => img.filename), removed: removed.map(img => img.filename)});
    } catch(err) {
        debug("listResize()", err.message);
        res.json({error: err.message});
    }
};

async function buildImageData() {
    try {
        const images = await loadImages();
        return images
            .map(img => img.filename)
            .filter(filename => image_name_filter.test(filename))
            .map(filename => /^([\w]+)_([\w\- ]+)_([\w\-]+)(_*([\w\-]*)).(jpg|gif|png)$/gm.exec(filename))
            .map(result => ({filename: result[0], itemCode: result[1], name: result[2], color: result[3]}));
    } catch(err) {
        debug("buildImageData()", err.message);
        return err;
    }
}

exports.listBuildData = async (req, res) => {
    try {
       const images =  await buildImageData();
       res.json({images});
    } catch(err) {
        debug("parseFileName()", err.message);
        res.json({error: err.message});
    }
};

