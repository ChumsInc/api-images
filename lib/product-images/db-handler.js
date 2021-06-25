const {mysql2Pool} = require('chums-local-modules');
const debug = require('debug')('chums:lib:product-images:db-handler');

const defaultImage = {
    pathnames: [], sizes: {}, color_space: {}, img_format: {}, tags: [], notes: '', item_code: '',
    item_codes: [],
};


exports.loadImages = loadImages;

async function loadImages({filename, itemCode,} = {}) {
    try {
        const query = `
            SELECT filename,
                   pathnames,
                   sizes,
                   color_space,
                   img_format,
                   tags,
                   notes,
                   item_code,
                   img.timestamp,
                   item.ItemCodeDesc,
                   item.InactiveItem,
                   item.ProductType,
                   item.ProductLine,
                   item.Category1,
                   item.Category2 AS Category,
                   item.Category3 AS ItemCollection,
                   item.Category4 AS BaseSKU
            FROM c2.PM_Images img
                 LEFT JOIN c2.ci_item item
                           ON img.item_code = item.ItemCode
            WHERE (:filename IS NULL OR filename = :filename)
              AND (:itemCode IS NULL OR item_code REGEXP :itemCode)`;
        const queryAltImages = `
            SELECT ip.id,
                   ip.filename,
                   ip.item_code,
                   ip.active,
                   i.ItemCodeDesc,
                   i.ProductType,
                   i.InactiveItem
            FROM c2.PM_ImageProducts ip
                 INNER JOIN c2.ci_item i
                            ON i.ItemCode = ip.item_code
            WHERE (:filename IS NULL OR filename = :filename)`;
        const data = {filename, itemCode};
        const connection = await mysql2Pool.getConnection();
        const [[images], [altImages]] = await Promise.all([
            connection.query(query, data),
            connection.query(queryAltImages, data),
        ]);
        connection.release();
        images.forEach(image => {
            image.pathnames = JSON.parse(image.pathnames || '[]');
            image.sizes = JSON.parse(image.sizes || '{}');
            image.color_space = JSON.parse(image.color_space || '{}');
            image.img_format = JSON.parse(image.img_format || '{}');
            image.tags = JSON.parse(image.tags || '[]');
            image.item_codes = altImages.filter(img => img.filename === image.filename)
        });
        if (filename) {
            const image = images[0] || {...defaultImage};
            // image.item_codes = await loadAltItemCodes({filename});
            return image;
        }
        return images;
    } catch (err) {
        debug("loadImages()", err.message);
        return err;
    }
}

exports.saveImage = saveImage;

async function saveImage({filename, ...props}) {
    try {
        const query = `INSERT INTO c2.PM_Images (filename, pathnames, sizes, color_space, img_format, tags, notes,
                                                 item_code)
                       VALUES (:filename, :pathnames, :sizes, :color_space, :img_type, :tags, :notes,
                               :item_code)
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
        return await loadImages({filename});
    } catch (err) {
        debug("logImage()", err.message);
        return err;
    }
}

async function removeImage(filename) {
    try {
        const query = `DELETE FROM c2.PM_Images WHERE filename = :filename`;
        const data = {filename};
        const connection = await mysql2Pool.getConnection();
        await connection.query(query, data);
        connection.release();
    } catch (err) {
        debug("removeImage()", err.message);
        return Promise.reject(err);
    }
}

exports.setItemCode = setItemCode;

async function setItemCode({filename, itemCode}) {
    try {
        const query = `UPDATE c2.PM_Images SET item_code = :itemCode WHERE filename = :filename`;
        const data = {filename, itemCode};
        const connection = await mysql2Pool.getConnection();
        await connection.query(query, data);
        connection.release();
        return await loadImages({filename});
    } catch (err) {
        debug("setItemCode()", err.message);
        return err;
    }
}

async function applyItemCodeToFilenames({itemCode, filenames}) {
    try {
        const query = `UPDATE c2.PM_Images SET item_code = :itemCode WHERE filename IN (:filenames)`;
        const data = {filenames, itemCode};
        const connection = await mysql2Pool.getConnection();
        await connection.query(query, data);
        connection.release();
        return await loadImages({itemCode});
    } catch(err) {
        debug("applyItemCodeToFilenames()", err.message);
        return err;
    }
}
exports.applyItemCodeToFilenames = applyItemCodeToFilenames;

exports.loadAltItemCodes = loadAltItemCodes;

async function loadAltItemCodes({filename}) {
    try {
        const sql = `SELECT ip.id,
                            ip.filename,
                            ip.item_code,
                            ip.active,
                            i.ItemCodeDesc,
                            i.ProductType,
                            i.InactiveItem
                     FROM c2.PM_ImageProducts ip
                          INNER JOIN c2.ci_item i
                                     ON i.ItemCode = ip.item_code
                     WHERE filename = :filename`;
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
        const connection = await mysql2Pool.getConnection();
        const data = filenames.map(filename => ({filename, itemCode}));
        await Promise.all(data.map(args => connection.query(sql, args)));
        connection.release();
        return loadImages({itemCode: `^${itemCode}$`});
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
        const image = await loadImages({filename});
        if (!image.pathnames.includes(pathname)) {
            image.pathnames.push(pathname);
        }
        image.sizes[pathname] = dimensions;
        image.img_format[pathname] = img_format;
        image.color_space[pathname] = color_space;
        return await saveImage({filename, ...image});
    } catch (err) {
        debug("addImagePath()", err.message);
        return err;
    }
}

exports.removeImagePath = removeImagePath;

async function removeImagePath({filename, pathname}) {
    try {
        const image = await loadImages({filename});
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
        return await saveImage({filename, ...image});
    } catch (err) {
        debug("removeImagePath()", err.message);
        return err;
    }
}

exports.addImageTag = addImageTag;

async function addImageTag({filename, tag}) {
    try {
        const image = await loadImages({filename});
        if (!image.tags.includes(tag)) {
            image.tags.push(tag);
        }
        return await saveImage(image);
    } catch (err) {
        debug("addImageTag()", err.message);
        return err;
    }
}

exports.removeImageTag = removeImageTag;

async function removeImageTag({filename, tag}) {
    try {
        const image = await loadImages({filename});
        image.tags = image.tags.filter(_tag => _tag !== tag);
        return await saveImage(image);
    } catch (err) {
        debug("removeImageTag()", err.message);
        return err;
    }
}
