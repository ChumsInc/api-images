const {mysql2Pool} = require('chums-base');
const debug = require('debug')('chums:lib:image-store:db-handler');

const defaultImage = {pathnames: [], sizes: {}, color_space: {}, img_format: {}, tags: [], notes: '', item_code: ''};


exports.loadLifestyleImages = loadLifestyleImages;

async function loadLifestyleImages({filename, tag} = {}) {
    try {
        const query = `SELECT filename,
                              pathnames,
                              sizes,
                              color_space,
                              img_format,
                              tags,
                              notes,
                              item_code
                       FROM c2.PM_LifestyleImages img
                            LEFT JOIN c2.ci_item item
                                      ON img.item_code = item.ItemCode
                       WHERE (:filename IS NULL OR filename = :filename)
                         AND (:tag IS NULL OR tags REGEXP :tag)`;
        const data = {filename, tag: `\\b${tag}\\b`};
        const [images] = await mysql2Pool.query(query, data);
        images.forEach(image => {
            image.pathnames = JSON.parse(image.pathnames || '[]');
            image.sizes = JSON.parse(image.sizes || '{}');
            image.color_space = JSON.parse(image.color_space || '{}');
            image.img_format = JSON.parse(image.img_format || '{}');
            image.tags = JSON.parse(image.tags || '[]');
        });
        if (filename) {
            return images[0] || {...defaultImage};
        }
        return images;
    } catch (err) {
        debug("loadImages()", err.message);
        return err;
    }
}

exports.saveLifestyleImage = saveLifestyleImage;

async function saveLifestyleImage({filename, ...props}) {
    try {
        const query = `INSERT INTO c2.PM_LifestyleImages (filename, pathnames, sizes, color_space, img_format, tags,
                                                          notes, item_code)
                       VALUES (:filename, :pathnames, :sizes, :color_space, :img_type, :tags, 
                               :notes, :item_code)
                       ON DUPLICATE KEY UPDATE pathnames   = :pathnames,
                                               sizes       = :sizes,
                                               color_space = :color_space,
                                               img_format  = :img_format,
                                               tags        = :tags,
                                               notes       = :notes,
                                               item_code   = :item_code`;
        const data = {
            filename,
            pathnames: JSON.stringify(props.pathnames || []),
            sizes: JSON.stringify(props.sizes || {}),
            color_space: JSON.stringify(props.color_space || {}),
            img_format: JSON.stringify(props.img_format || {}),
            tags: JSON.stringify(props.tags || []),
            notes: props.notes || '',
            item_code: props.item_code || '',
        };
        const connection = await mysql2Pool.getConnection();
        await connection.query(query, data);
        connection.release();
        return await loadLifestyleImages({filename});
    } catch (err) {
        debug("logImage()", err.message);
        return err;
    }
}

async function removeLifestyleImage(filename) {
    try {
        const query = `DELETE FROM c2.PM_LifestyleImages WHERE filename = :filename`;
        const data = {filename};
        const connection = await mysql2Pool.getConnection();
        await connection.query(query, data);
        connection.release();
    } catch (err) {
        debug("removeImage()", err.message);
        return Promise.reject(err);
    }
}
exports.removeLifestyleImage = removeLifestyleImage;

exports.setItemCode = setItemCode;

async function setItemCode({filename, itemCode}) {
    try {
        const query = `UPDATE c2.PM_LifestyleImages SET item_code = :itemCode WHERE filename = :filename`;
        const data = {filename, itemCode};
        const connection = await mysql2Pool.getConnection();
        await connection.query(query, data);
        connection.release();
        return await loadLifestyleImages({filename});
    } catch (err) {
        debug("setItemCode()", err.message);
        return err;
    }
}

exports.loadAltItemCodes = loadAltItemCodes;

async function loadAltItemCodes({filename}) {
    try {
        const sql = `SELECT filename, item_code, active FROM c2.PM_ImageProducts WHERE filename = :filename`;
        const args = {filename};
        const [rows] = await mysql2Pool.query(sql, args);
        return rows;
    } catch (err) {
        debug("loadAltItemCodes()", err.message);
        return err;
    }
}

exports.setAltItemCode = setAltItemCode;

async function setAltItemCode({filename, itemCode}) {
    try {
        const sql = `INSERT IGNORE INTO c2.PM_ImageProducts (filename, item_code) VALUES (:filename, :itemCode)`;
        const args = {filename, itemCode};
        await mysql2Pool.query(sql, args);
        return await loadAltItemCodes({filename});
    } catch (err) {
        debug("setAltItemCode()", err.message);
        return err;
    }
}

exports.setMultipleAltItemCode = setMultipleAltItemCode;

async function setMultipleAltItemCode({filenames = [], itemCode}) {
    try {
        const sql = `INSERT IGNORE INTO c2.PM_ImageProducts (filename, item_code) VALUES (:filename, :itemCode)`;
        const sqlList = `SELECT filename, item_code, active FROM c2.PM_ImageProducts WHERE item_code = :itemCode`;
        const connection = await mysql2Pool.getConnection();
        const data = filenames.forEach(filename => ({filename, itemCode}))
        await Promise.all(data.forEach(args => connection.query(sql, args)));
        const [rows] = await connection.query(sqlList, {itemCode});
        connection.release();
        return rows;
    } catch (err) {
        debug("setAltItemCode()", err.message);
        return err;
    }
}

exports.addImagePath = addImagePath;

exports.delAltItemCode = delAltItemCode;

async function delAltItemCode({filename, itemCode}) {
    try {
        const sql = `DELETE FROM c2.PM_ImageProducts WHERE filename = :filename AND item_code = :itemCode`;
        const args = {filename, itemCode};
        await mysql2Pool.query(sql, args);
        return await loadAltItemCodes({filename});
    } catch (err) {
        debug("delAltItemCode()", err.message);
        return err;
    }
}

async function addImagePath({filename, pathname, dimensions, img_format, color_space}) {
    try {
        const image = await loadLifestyleImages({filename});
        if (!image.pathnames.includes(pathname)) {
            image.pathnames.push(pathname);
        }
        image.sizes[pathname] = dimensions;
        image.img_format[pathname] = img_format;
        image.color_space[pathname] = color_space;
        return await saveLifestyleImage({filename, ...image});
    } catch (err) {
        debug("addImagePath()", err.message);
        return err;
    }
}

exports.removeImagePath = removeImagePath;

async function removeImagePath({filename, pathname}) {
    try {
        const image = await loadLifestyleImages({filename});
        if (!image.pathnames.includes(pathname)) {
            return;
        }
        image.pathnames = image.pathnames.filter(path => path !== pathname);
        if (image.pathnames.length === 0) {
            return removeImage(filename);
        }
        delete image.sizes[pathname];
        delete image.img_format[pathname];
        delete image.color_space[pathname];
        return await saveLifestyleImage({filename, ...image});
    } catch (err) {
        debug("removeImagePath()", err.message);
        return err;
    }
}

exports.addImageTag = addImageTag;

async function addImageTag({filename, tag}) {
    try {
        const image = await loadLifestyleImages({filename});
        if (!image.tags.includes(tag)) {
            image.tags.push(tag);
        }
        return await saveLifestyleImage(image);
    } catch (err) {
        debug("addImageTag()", err.message);
        return err;
    }
}

exports.removeImageTag = removeImageTag;

async function removeImageTag({filename, tag}) {
    try {
        const image = await loadLifestyleImages({filename});
        image.tags = image.tags.filter(_tag => _tag !== tag);
        return await saveLifestyleImage(image);
    } catch (err) {
        debug("removeImageTag()", err.message);
        return err;
    }
}
