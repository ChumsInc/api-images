import Debug from 'debug';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import {backgroundTransparent, backgroundWhite, imgPath} from './settings.js';
import {BaseImage} from "../types.js";

const debug = Debug('chums:lib:product-images:make-image');

export async function makeImage(fromPath: string, imageSize: number, filename: string): Promise<BaseImage> {
    try {
        const imgContent = await fs.readFile(`${fromPath}/${filename}`);
        const img = sharp(imgContent);
        const {format, width: origWidth, height: origHeight} = await img.metadata();
        const resized = img.resize({
            width: imageSize,
            height: imageSize,
            fit: sharp.fit.contain,
            withoutEnlargement: !(imageSize > Math.min(origWidth ?? 0, origHeight ?? 0)),
            background: format === 'png' ? backgroundTransparent : backgroundWhite
        });

        const buffer = await resized.toBuffer();
        debug('makeImage()', imgPath(imageSize, filename));
        await fs.writeFile(imgPath(imageSize, filename), buffer);

        const {width, height, size} = await sharp(buffer).metadata();
        return {path: imageSize.toString(), width: width ?? 0, height: height ?? 0, size: size ?? 0, filename};
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("makeImage()", err.message);
            return Promise.reject(err);
        }
        debug("makeImage()", err);
        return Promise.reject(new Error('Error in makeImage()'));
    }
}
