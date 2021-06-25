import {getOriginalSize, makeImage} from './utils';
import {CONFIG_LIFESTYLE} from './settings';
import {handleUpload} from './upload';

async function uploadLifestyle(req, res) {
    try {
        const upload = await handleUpload(req, CONFIG_LIFESTYLE.ORIGINAL_PATH);
        const filename = upload.filename;
        const original = await getOriginalSize(filename);
        const image = makeImage({
            fromFilename: CONFIG_LIFESTYLE.imgPath(CONFIG_LIFESTYLE.SIZE_PATHS.original, filename),
            toFilename: CONFIG_LIFESTYLE.imgPath(CONFIG_LIFESTYLE.SIZE_PATHS.thumb, filename),
            toWidth: CONFIG_LIFESTYLE.THUMB_SIZE,
            toHeight: CONFIG_LIFESTYLE.THUMB_SIZE,
            fit: 'inside',
        });
        const images = [image, original];
        const saveResult = await Promise.all(images.map(img => saveImageProps(img.path, img.filename)));
        res.json({
            ...upload,
            images,
            thumb: CONFIG_LIFESTYLE.webPath(CONFIG_LIFESTYLE.THUMB_SIZE, filename),
            saveResult,
        });
    } catch(err) {
        debug("upload()", err.message);
        return res.json({error: err.message, name: err.name});
    }
}

exports.uploadLifestyle = uploadLifestyle;
