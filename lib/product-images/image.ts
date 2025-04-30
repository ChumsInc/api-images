import Debug from 'debug';
import {
    addImageTag,
    applyItemCodeToFilenames,
    delAltItemCode,
    loadAltItemCodes,
    loadImages,
    removeImagePath,
    removeImageTag, saveImage,
    setAltItemCode,
    setImageActive,
    setItemCode,
    setMultipleAltItemCode,
    setPreferredImage,
} from './db-handler.js';
import {constants as fsConstants} from 'node:fs';
import {access, unlink} from 'node:fs/promises';
import {imagePathNames, imgPath} from './settings.js';
import {ProductImage} from "../types.js";
import {Request, Response} from "express";

const debug = Debug('chums:lib:product-images:image');

async function _removeImage({filename, pathname}:{
    filename: string;
    pathname: string;
}):Promise<string> {
    try {
        const imgFilePath = imgPath(pathname, filename);
        await access(imgFilePath, fsConstants.W_OK);
        await unlink(imgFilePath);
        await removeImagePath({filename, pathname});
        return imgFilePath;
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("_removeImage()", err.message);
            return Promise.reject(err);
        }
        debug("_removeImage()", err);
        return Promise.reject(new Error('Error in _removeImage()'));
    }
}

async function removeImage(filename:string):Promise<ProductImage[]> {
    try {
        const [image] = await loadImages({filename});
        if (!image) {
            return [];
        }
        for await (const pathname of image.pathnames) {
            await _removeImage({filename, pathname});
        }
        return await loadImages({filename});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("removeImage()", err.message);
            return Promise.reject(err);
        }
        debug("removeImage()", err);
        return Promise.reject(new Error('Error in removeImage()'));
    }
}

export const postItemCode = async (req:Request, res:Response):Promise<void> => {
    try {
        const {filename, itemCode = ''} = req.params;
        const image = await setItemCode({filename, itemCode});
        res.json({image});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("postItemCode()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in postItemCode'});
    }
};

export const postPreferredItemCode = async (req:Request, res:Response):Promise<void> => {
    try {
        const {filename, itemCode} = req.params;
        await setPreferredImage(filename, itemCode);
        const [image] = await loadImages({filename});
        res.json({image});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("postPreferredItemCode()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in postPreferredItemCode'});
    }
}

export const postItemCodeFilenames = async (req:Request, res:Response):Promise<void> => {
    try {
        const {itemCode} = req.params;
        const filenames = req.body?.filenames ?? [];
        if (filenames.length === 0) {
            res.json({images: []});
            return;
        }
        const images = await applyItemCodeToFilenames({itemCode, filenames});
        res.json({images});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("postItemCodeFilenames()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in postItemCodeFilenames'});
    }
}

export const getAltItemCodes = async (req:Request, res:Response):Promise<void> => {
    try {
        const {filename} = req.params;
        const altItems = await loadAltItemCodes(filename)
        res.json({altItems});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getAltItemCodes()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getAltItemCodes'});
    }
}


export const postAltItemCode = async (req:Request, res:Response):Promise<void> => {
    try {
        const {filename, itemCode = ''} = req.params;
        const image = await setAltItemCode({filename, itemCode});
        res.json({image});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("postAltItemCode()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in postAltItemCode'});
    }
};


export const postMultipleAltItemCode = async (req:Request, res:Response):Promise<void> => {
    try {
        const {itemCode} = req.params;
        const filenames = req.body?.filenames ?? [];
        const altItems = await setMultipleAltItemCode({filenames, itemCode});
        res.json({altItems});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("postMultipleAltItemCode()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in postMultipleAltItemCode'});
    }
};

export const deleteAltItemCode = async (req:Request, res:Response):Promise<void> => {
    try {
        const {filename, itemCode = ''} = req.params;
        const image = await delAltItemCode({filename, itemCode});
        res.json({image});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("deleteAltItemCode()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in deleteAltItemCode'});
    }
};


export const tagImage = async (req:Request, res:Response):Promise<void> => {
    try {
        const {filename, tag} = req.params;
        const image = await addImageTag({filename, tag});
        res.json({image});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("tagImage()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in tagImage'});
    }
};


export const tagImages = async (req:Request, res:Response):Promise<void> => {
    try {
        const {tag} = req.params;
        const filenames:string[] = req.body?.filenames ?? [];
        const images = await Promise.all(filenames.map(filename => addImageTag({filename, tag})));
        res.json({images});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("tagImages()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in tagImages'});
    }
};

export const untagImage = async (req:Request, res:Response):Promise<void> => {
    try {
        const {filename, tag} = req.params;
        const image = await removeImageTag({filename, tag});
        res.json({image});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("untagImage()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in untagImage'});
    }
};

export const deleteImageFilename = async (req:Request, res:Response):Promise<void> => {
    try {
        const images = await removeImage(req.params.filename);
        res.json({images});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("deleteImageFilename()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in deleteImageFilename'});
    }
};

export const putImageActive = async (req:Request, res:Response):Promise<void> => {
    try {
        const {filename, active} = req.params;
        const image = await setImageActive(filename, active);
        res.json({image});
    } catch (err) {
        if (err instanceof Error) {
            debug("putImageActive()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in putImageActive'});
    }
}

export const putImageProps = async (req:Request, res:Response):Promise<void> => {
    try {
        const {filename} = req.params;
        if (!req.body) {
            res.json({error: 'body content required'});
            return;
        }
        const [_image] = await loadImages({filename});
        if (!_image) {
            res.json({error: 'filename not found'});
            return
        }
        const props = {..._image, ...req.body, filename};
        const image = await saveImage(props)
        res.json({image});
    } catch(err) {
        if (err instanceof Error) {
            debug("putImageProps()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in putImageProps'});
    }
}
