import Debug from 'debug';
import fs from 'node:fs/promises';
import path from 'node:path';
import {loadImages, loadImagesByItemList} from "../product-images/db-handler.js";

const debug = Debug('chums:lib:product-images:findImage');

const COMMON_IMAGE_PATH = '/var/www';

/**
 *
 * @param {string|number} size
 * @param {string} itemCode
 * @return {Promise<string|null>}
 */
export const findImageFile = async (size, itemCode) => {
    try {
        const dir = '/images/products/:size'
            .replace(':size', size);

        const re = new RegExp(itemCode, 'i');

        const reExact = new RegExp(`^${itemCode}\.`);

        const files = await fs.readdir(path.join(COMMON_IMAGE_PATH, dir));
        const exactImages = files.filter(img => reExact.test(img));
        if (exactImages.length) {
            return exactImages[0];
        }
        const images = files.filter(img => re.test(img));
        if (images.length) {
            return images[0];
        }
        return null;
    } catch(err) {
        debug("findImageFile()", err.message);
        return Promise.reject(err);
    }
}

export const findImage = async (req, res) => {
    const {size, itemCode} = req.params;
    const dir = '/images/products/:size'.replace(':size', size);

    try {
        const preferredImages = await loadImages({itemCode, preferred: '1'});
        if (preferredImages.length) {
            const [image] = preferredImages;
            if (image.sizes[size]) {
                res.redirect(301, path.join(dir, image.filename));
                return
            }
            const _size = image.pathnames[0];
            if (_size) {
                res.redirect(301, path.join(`/images/products/${_size}`, image.filename));
                return;
            }
        }
        const filename = await findImageFile(size, itemCode);
        if (filename) {
            res.redirect(301, path.join(dir, filename));
            return;
        }
        res.redirect(302, path.join(dir, '/missing.png'));
    } catch (err) {
        debug("findImage()", err.message);
        res.redirect(302, path.join(dir, '/missing.png'));
    }
};

/**
 *
 * @param {string[]} itemCodes
 * @param {string} size
 * @return {Promise<ItemImage[]>}
 */
async function findImageList(itemCodes, size) {
    try {
        if (!itemCodes.length) {
            return [];
        }
        const items = await loadImagesByItemList(itemCodes);
        const imageList = [];
        for await (const item of items) {
            const {ItemCode} = item;
            let filename = null;
            if (item.pathnames?.includes(size)) {
                filename = item.filename
            } else if (item.pathnames?.length > 0) {
                filename = item.filename
            } else {
                filename = await findImageFile(size, item.ItemCode);
            }
            if (!filename) {
                filename = 'missing.png';
            }
            imageList.push({ItemCode, filename});
        }
        return imageList;
    } catch(err) {
        debug("findImageList()", err.message);
        return Promise.reject(err);
    }
}

export const getImageList = async (req, res) => {
    try {
        const {size} = req.params;
        const itemCodes = req.query.item.split(',');
        const imageList = await findImageList(itemCodes, size);
        res.json({imageList});
    } catch(err) {
        debug("findImageList()", err.message);
        res.json({error: err.message});
    }
}
