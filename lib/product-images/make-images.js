const debug = require('debug')('chums:lib:product-images:make-image');
const {BG_WHITE, BG_TRANSPARENT, imgPath, IMAGE_PATHS} = require('./settings');
const sharp = require('sharp');
const fs = require('fs').promises;

async function makeImage(fromPath, imageSize, filename) {
    try {
        const imgContent = await fs.readFile(`${fromPath}/${filename}`);
        const img = await sharp(imgContent);
        const {format, width: origWidth, height: origHeight} = await img.metadata();
        const resized = await img.resize({
            width: imageSize,
            height: imageSize,
            fit: sharp.fit.contain,
            withoutEnlargement: !(imageSize > Math.min(origWidth, origHeight)),
            background: format === 'png' ? BG_TRANSPARENT : BG_WHITE
        });

        const buffer = await resized.toBuffer();
        debug('makeImage()', imgPath(imageSize, filename));
        await fs.writeFile(imgPath(imageSize, filename), buffer);

        const {width, height, size} = await sharp(buffer).metadata();
        return {path: imageSize.toString(), width, height, size, filename};
    } catch(err) {
        debug("makeImage()", err.message);
        return Promise.reject(err);
    }
}

exports.makeImage = makeImage;
