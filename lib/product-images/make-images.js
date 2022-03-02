import Debug from 'debug';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import {BG_TRANSPARENT, BG_WHITE, imgPath} from './settings.js';

const debug = Debug('chums:lib:product-images:make-image');

export async function makeImage(fromPath, imageSize, filename) {
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
    } catch (err) {
        debug("makeImage()", err.message);
        return Promise.reject(err);
    }
}
