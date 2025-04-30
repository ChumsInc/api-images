import Debug from 'debug';
import {imagePaths} from './settings.js';
import {loadImages} from './db-handler.js';
import {syncDirectory} from './list.js';
import {makeImage} from './make-images.js';
import {BaseImage, ProductImage} from "../types.js";
import {Request, Response} from "express";

const debug = Debug('chums:lib:product-images:utils');

const image_name_filter = /^(\w+)_([\w\- ]+)_([\w\-]+).(jpg|gif|png)$/gm;

async function rebuildSize({fromSize, toSize, test = false}:{
    fromSize:string|number;
    toSize:string|number;
    test?:boolean;
}):Promise<(BaseImage|null)[]|ProductImage[]> {
    try {
        const images = await loadImages();
        const toResize = images.filter(img => !!img.sizes[fromSize] && !img.sizes[toSize]);
        if (test) {
            return toResize
        }
        const imageSize = Number(toSize);
        return await Promise.all(toResize.map(img => makeImage(imagePaths[fromSize], imageSize, img.filename)));
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("rebuildSize()", err.message);
            return Promise.reject(err);
        }
        debug("rebuildSize()", err);
        return Promise.reject(new Error('Error in rebuildSize()'));
    }
}

export const listResize = async (req:Request, res:Response):Promise<void> => {
    try {
        const fromSize = req.params.fromSize ?? req.query.fromSize as string;
        const toSize = req.params.toSize ?? req.query.toSize as string;
        if (!fromSize || !toSize) {
            res.json({error: 'invalid size', fromSize, toSize});
            return;
        }
        const test = req.query.test === '1';
        const images = await rebuildSize({fromSize, toSize, test});
        if (test) {
            res.json({images});
            return;
        }
        const filenames = images.filter(img => !!img).map(img => img.filename);
        const {added, removed} = await syncDirectory({pathname: toSize});
        res.json({filenames, added: added.map(img => img.filename), removed: removed.map(img => img.filename)});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("listResize()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in listResize'});
    }
};

export interface BuildImageResponse {
    filename:string;
    itemCode:string;
    name:string;
    color:string;
}
async function buildImageData():Promise<BuildImageResponse[]> {
    try {
        const images = await loadImages();
        return images
            .map(img => img.filename)
            .filter(filename => image_name_filter.test(filename))
            .map(filename => /^([\w]+)_([\w\- ]+)_([\w\-]+)(_*([\w\-]*)).(jpg|gif|png)$/gm.exec(filename))
            .filter(result => !!result)
            .map(result => ({filename: result[0], itemCode: result[1], name: result[2], color: result[3]}));
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("buildImageData()", err.message);
            return Promise.reject(err);
        }
        debug("buildImageData()", err);
        return Promise.reject(new Error('Error in buildImageData()'));
    }
}

export const listBuildData = async (req:Request, res:Response):Promise<void> => {
    try {
        const images = await buildImageData();
        res.json({images});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("listBuildData()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in listBuildData'});
    }
};

