const debug = require('debug')('chums:lib:image-store:utils');
const sharp = require('sharp');
const fs = require('fs').promises;
const {BG_WHITE, BG_TRANSPARENT, imgPath, IMAGE_PATHS} = require('./settings');
const {addImagePath, loadProductImages} = require('./db-handler');

const image_name_filter = /^(\w+)_([\w\- ]+)_([\w\-]+).(jpg|gif|png)$/gm;

async function makeImage({fromFilename, toFilename, toWidth, toHeight, fit}) {
    try {
        const imgContent = await fs.readFile(fromFilename);
        const img = await sharp(imgContent);
        const {format, width: origWidth, height: origHeight} = await img.metadata();
        const resized = await img.resize({
            width: toWidth,
            height: toHeight,
            fit: fit || sharp.fit.contain,
            withoutEnlargement: !(Math.min(toWidth, toHeight) > Math.min(origWidth, origHeight)),
            background: format === 'png' ? BG_TRANSPARENT : BG_WHITE
        });

        const buffer = await resized.toBuffer();
        await fs.writeFile(toFilename, buffer);

        const {width: newWidth, height: newHeight, size} = await sharp(buffer).metadata();
        return {width: newWidth, height: newHeight, size};
    } catch(err) {
        debug("makeImage()", err.message);
        return Promise.reject(err);
    }
}
exports.makeImage = makeImage;

async function makeProductImage(fromPath, imageSize, filename) {
    try {
        const productImage = await makeImage({
            fromFilename: `${fromPath}/${filename}`,
            toFilename: imgPath(imageSize, filename),
            width: imageSize,
            height: imageSize,
        });

        return {...productImage, path: imageSize.toString(), filename};
    } catch(err) {
        debug("makeImage()", err.message);
        return Promise.reject(err);
    }
}

exports.makeProductImage = makeProductImage;

async function rebuildProductSize (fromSize, toSize) {
    try {
        const images = await loadProductImages();
        const toResize = images.filter(img => !!img.sizes[fromSize] && !img.sizes[toSize]);
        const imageSize = Number(toSize);
        const resized = await Promise.all(toResize.map(img => makeProductImage(IMAGE_PATHS[fromSize], imageSize, img.filename)));
        return resized;
    } catch(err) {
        debug("rebuildSize()", err.message);
        return Promise.reject(err);
    }
}

exports.listResize = async (req, res) => {
    try {
        const images = await rebuildProductSize(req.params.fromSize, req.params.toSize);
        const filenames = images.map(img => img.filename);
        res.json({filenames});
    } catch(err) {
        debug("listResize()", err.message);
        res.json({error: err.message});
    }
};

async function buildImageData() {
    try {
        const images = await loadProductImages();
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


async function getMetadataFromBuffer(buffer) {
    return await sharp(buffer).metadata();
}

async function getMetadataFromFile(filePathName) {
    const buffer = await fs.readFile(`${pathname}/${filename}`);
    return await getMetadataFromBuffer(buffer);
}

exports.getOriginalSize = getOriginalSize;
/**
 *
 * @param {String} pathname
 * @param {String} filename
 * @return {Promise<{path: string, filename: *, size: *, width: *, height: *}|*>}
 */
async function getOriginalSize(pathname, filename) {
    try {
        const imgContent = await fs.readFile(`${pathname}/${filename}`);
        const img = await sharp(imgContent);
        const {width, height, size} = await getMetadataFromFile(`${pathname}/${filename}`);
        return {path: 'originals', width, height, size, filename};
    } catch(err) {
        debug("getOriginalSize()", err.message);
        return Promise.reject(err);
    }
}


/**
 *
 * @param pathName
 * @param filename
 * @return {Promise<{size: *, width: *, height: *}|{}>}
 */
async function getDimensions(pathName, filename) {
    try {
        const img = await fs.readFile(imgPath(pathName, filename));
        const {width, height, size, ...metadata} =  await getMetadataFromBuffer(img);
        return {filename, pathName, path: `${pathName}/${filename}`, width, height, size, metadata};
    } catch(err) {
        return {};
    }
}
exports.getDimensions = getDimensions;

async function getImageSizesProps(filename, sizePaths) {
    try {
        return await Promise.all(sizePaths.map(size => getDimensions(size, filename)));
    } catch(err) {
        debug("getImageProps()", err.message);
        return err;
    }
}
exports.getImageSizeProps = getImageSizesProps;

async function getImageProps(buffer) {
    try {
        const {width, height, size, format, space} =  await sharp(buffer).metadata();
        return {width, height, size, img_format: format, color_space: space};
    } catch(err) {
        return {};
    }
}
exports.getImageProps = getImageProps;

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
