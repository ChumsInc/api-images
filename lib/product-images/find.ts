import Debug from 'debug';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Request, Response} from "express";

const debug = Debug('chums:lib:product-images:find');

const COMMON_IMAGE_PATH = '/var/www';

export const findImage = async (req: Request, res: Response): Promise<void> => {
    const {size, itemCode} = req.params;
    const dir = '/images/products/:size'
        .replace(':size', size);

    try {
        const re = new RegExp(itemCode, 'i');
        const reExact = new RegExp(`^${itemCode}\.`);

        const files = await fs.readdir(path.join(COMMON_IMAGE_PATH, dir));
        const exactImages = files.filter(img => reExact.test(img));
        if (exactImages.length) {
            res.redirect(301, path.join(dir, exactImages[0]));
            return;
        }
        const images = files.filter(img => re.test(img));
        if (images.length) {
            res.redirect(301, path.join(dir, images[0]));
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
