import Debug from 'debug';
import fs from 'node:fs/promises';
import path from 'node:path';
import {loadImages, loadImagesByItemList} from "../product-images/db-handler.js";
import {Request, Response} from "express";
import {ItemImage} from "../types.js";

const debug = Debug('chums:lib:product-images:findImage');

const COMMON_IMAGE_PATH = '/var/www';

const validSizes:string[] = ['80','250','400','800'];

export const findImageFile = async (size: string | number, itemCode: string): Promise<string | null> => {
    try {
        const dir = '/images/products/:size'
            .replace(':size', `${size}`);

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
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("findImageFile()", err.message);
            return Promise.reject(err);
        }
        debug("findImageFile()", err);
        return Promise.reject(new Error('Error in findImageFile()'));
    }
}

export const findImage = async (req: Request, res: Response) => {
    const {size, itemCode} = req.params;
    if (!validSizes.includes(size)) {
        return res.json({error: 'Invalid image size'});
    }
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
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("findImage()", err.message);
        }
        res.redirect(302, path.join(dir, '/missing.png'));
    }
};

async function findImageList(itemCodes: string[], size: string): Promise<ItemImage[]> {
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
            } else if ((item.pathnames?.length ?? 0) > 0) {
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
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("findImageList()", err.message);
            return Promise.reject(err);
        }
        debug("findImageList()", err);
        return Promise.reject(new Error('Error in findImageList()'));
    }
}

export const getImageList = async (req: Request, res: Response) => {
    try {
        const {size} = req.params;
        if (!size || !validSizes.includes(size)) {
            return res.json({error: 'Invalid image size'});
        }
        if (!req.query.item || typeof req.query.item !== 'string' || req.query.item.length === 0) {
            return res.json({error: 'item query parameter required'});
        }
        const itemCodes = req.query.item.split(',');
        const imageList = await findImageList(itemCodes, size);
        res.json({imageList});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getImageList()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getImageList'});
    }
}
