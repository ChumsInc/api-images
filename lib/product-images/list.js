const debug = require('debug')('chums:lib:product-images:list');
const sharp = require('sharp');
const fs = require('fs').promises;
const {addImagePath, loadImages, removeImagePath} = require('./db-handler');
const {IMG_SIZES, IMAGE_PATHNAMES, IMAGE_PATHS, imgPath} = require('./settings');
const {makeImage} = require('./make-images');


/**
 *
 * @param pathName
 * @param filename
 * @return {Promise<{size: *, width: *, height: *}|{}>}
 */
async function getDimensions(pathName, filename) {
    try {
        const img = await fs.readFile(imgPath(pathName, filename));
        const {width, height, size, ...metadata} =  await sharp(img).metadata();
        return {filename, pathName, path: `${pathName}/${filename}`, width, height, size, metadata};
    } catch(err) {
        return {};
    }
}

async function listImages(path) {
    try {
        const entries = await fs.readdir(path, {encoding: 'utf8', withFileTypes: true});
        return entries.filter(entry => entry.isFile()).map(entry => entry.name);
    } catch(err) {
        debug("listImages()", err.message);
        return err;
    }
}

async function exists(path, filename) {

}

async function getImageSizesProps(filename) {
    try {
        return await Promise.all(IMG_SIZES.map(size => getDimensions(size, filename)));
    } catch(err) {
        debug("getImageProps()", err.message);
        return err;
    }
}

async function getImageProps(buffer) {
    try {
        const {width, height, size, format, space} =  await sharp(buffer).metadata();
        return {width, height, size, img_format: format, color_space: space};
    } catch(err) {
        return {};
    }
}

async function saveImageProps(pathname, filename) {
    try {
        const img = await fs.readFile(imgPath(pathname, filename));
        const {width, height, size, img_format, color_space} =  await getImageProps(img);
        if (!size) {
            return {filename, pathname, err: 'Invalid Image'};
        }
        const props = {
            filename,
            pathname,
            dimensions: {width, height, size},
            color_space,
            img_format,
        };
        return await addImagePath(props);
    } catch(err) {
        console.log(err, err.type, err.name, err.message);
        debug("saveImageProps()", err.message);
        return Promise.reject(err);
    }
}
exports.saveImageProps = saveImageProps;

exports.getList = (req, res) => {
    if (!IMAGE_PATHS[req.params.size]) {
        res.json({error: 'invalid size'});
        return;
    }
    listImages(IMAGE_PATHS[req.params.size])
        .then(images => res.json(images))
        .catch(err => res.json({error: err.message}));
};

exports.getAllImages = async (req, res) => {
    try {
        const props = {...req.params, ...req.query};
        const images = await loadImages(props);
        res.json({props, images});
    } catch(err) {
        debug("getAllImages()", err.message);
        res.json({error: err.message})
    }
};

exports.getImageProps = (req, res) => {
    getImageSizesProps(req.params.filename)
        .then(sizes => res.json(sizes))
        .catch(err => res.json({error: err.message}));
};


async function syncDirectory({pathname, rebuild}) {
    try {
        if (!IMAGE_PATHNAMES.includes(pathname)) {
            return res.json({error: 'invalid path'});
        }
        const doRebuild = rebuild === '1';
        let imageList = await loadImages();
        const filenames = await listImages(IMAGE_PATHS[pathname]);
        const newFilenames = filenames
            .filter(filename => doRebuild || imageList.filter(img => img.filename === filename && img.pathnames.includes(pathname)).length === 0);
        const added = await Promise.all(newFilenames.map(filename => saveImageProps(pathname, filename)));

        imageList = await loadImages();
        const toRemove = imageList
            .filter(img => img.pathnames.includes(pathname) && filenames.filter(filename => filename === img.filename).length === 0);
        const removed = await Promise.all(toRemove.map(img => removeImagePath({filename: img.filename, pathname})));

        return {added, removed, filenames};
    } catch(err) {
        debug("syncDirectory()", err.message);
        return Promise.reject(err);
    }
}
exports.syncDirectory = syncDirectory;

exports.getSyncDirectory = async (req, res) => {
    try {
        const {pathname} = req.params;
        const {rebuild = '0'} = req.query;
        const {added, removed, filenames} = syncDirectory({pathname, rebuild});
        res.json({added, removed, filenames});
    } catch(err) {
        debug("syncDirectory()", err.message);
        res.status(500).json({error: err.message})
    }
};

exports.getSyncAllDirectories = async (req, res) => {
    try {
        const {rebuild = '0'} = req.query;
        const results = await Promise.all(IMAGE_PATHNAMES.map(pathname => syncDirectory({pathname, rebuild})));
        res.json(results);
    } catch(err) {
        debug("getSyncAllDirectories()", err.message);
        return Promise.reject(err);
    }
};

async function buildImageSize (fromSize, toSize) {
    try {
        const images = await loadImages();
        const toResize = images.filter(img => !!img.sizes[fromSize] && !img.sizes[toSize]);
        const imageSize = Number(toSize);
        const resized = await Promise.all(toResize.map(img => makeImage(IMAGE_PATHS[fromSize], imageSize, img.filename)));
        const added = await Promise.all(resized.map(img => saveImageProps(toSize, img.filename)));
        return added;
    } catch(err) {
        debug("rebuildSize()", err.message);
        return Promise.reject(err);
    }
}

exports.resizeFromList = async (req, res) => {
    try {
        const images = await buildImageSize(req.params.fromSize, req.params.toSize);
        const filenames = images.map(img => img.filename);
        res.json({filenames});
    } catch(err) {
        debug("listResize()", err.message);
        return Promise.reject(err);
    }
};
