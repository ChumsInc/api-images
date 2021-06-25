const debug = require('debug')('chums:lib:product-images:find');
const fs = require('fs').promises;
const path = require('path');
const COMMON_IMAGE_PATH = '/var/www';

exports.findImage = async (req, res) => {
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
    } catch(err) {
        debug("findImage()", err.message);
        res.redirect(302, path.join(dir, '/missing.png'));
    }
};
