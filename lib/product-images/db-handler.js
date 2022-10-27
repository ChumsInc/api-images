import Debug from 'debug';
import {mysql2Pool} from 'chums-local-modules';

const debug = Debug('chums:lib:product-images:db-handler');

const defaultImage = {
    pathnames: [], sizes: {}, color_space: {}, img_format: {}, tags: [], notes: '', item_code: '',
    item_codes: [],
};

/**
 *
 * @param {string[]} itemCodes
 * @return {Promise<ItemImageRecord[]>}
 */
export async function loadImagesByItemList(itemCodes = []) {
    try {
        if (itemCodes.length === 0) {
            return [];
        }
        const sql = `SELECT i.ItemCode,
                            filename,
                            pathnames
                     FROM c2.ci_item i
                          LEFT JOIN c2.PM_Images img
                                    ON img.item_code = i.ItemCode AND img.preferred_image = 1
                     WHERE i.Company = 'chums'
                       AND i.ItemCode IN (:itemCodes)`;
        const sql2 = `SELECT i.ItemCode,
                             filename,
                             pathnames
                      FROM c2.ci_item i
                           INNER JOIN c2.PM_Images img
                                      ON img.item_code = i.ItemCode AND IFNULL(img.preferred_image, 0) = 0
                      WHERE i.Company = 'chums'
                        AND i.ItemCode = :itemCode

                      UNION

                      SELECT i.ItemCode,
                             pmi.filename,
                             pmi.pathnames
                      FROM c2.ci_item i
                           INNER JOIN c2.PM_ImageProducts img
                                      ON img.item_code = i.ItemCode
                           INNER JOIN c2.PM_Images pmi
                                      ON pmi.filename = img.filename
                      WHERE i.Company = 'chums'
                        AND i.ItemCode = :itemCode
                      LIMIT 1`;
        const args = {itemCodes};
        const [rows] = await mysql2Pool.query(sql, args);
        for await (const row of rows) {
            row.pathnames = JSON.parse(row.pathnames || '[]');
            if (!row.filename) {
                const [images] = await mysql2Pool.query(sql2, {itemCode: row.ItemCode});
                if (images.length > 0) {
                    const {filename, pathnames} = images[0];
                    row.filename = filename;
                    row.pathnames = JSON.parse(pathnames);
                }
            }
        }
        return rows;
    } catch (err) {
        debug("loadImagesByItemList()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {string} [filename]
 * @param {string} [itemCode]
 * @param {string} [baseSKU]
 * @param {string} [category]
 * @param {string} [collection]
 * @param {string} [productLine]
 * @param {'1'|'0'} [active]
 * @param {'1'|'0'} [preferred]
 * @return {Promise<ImageRecord|ImageRecord[]>}
 */
export async function loadImages({
                                     filename,
                                     itemCode,
                                     baseSKU,
                                     category,
                                     collection,
                                     productLine,
                                     active,
                                     preferred
                                 } = {}) {
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
                   item.ItemCode,
                   item.ItemCodeDesc,
                   item.InactiveItem,
                   item.ProductType,
                   item.ProductLine,
                   item.Category1,
                   item.Category2 AS Category,
                   item.Category3 AS ItemCollection,
                   item.Category4 AS BaseSKU,
                   preferred_image,
                   img.active
            FROM c2.PM_Images img
                 LEFT JOIN c2.ci_item item
                           ON img.item_code = item.ItemCode
            WHERE (IFNULL(:filename, '') = '' OR filename = :filename)
              AND (IFNULL(:itemCode, '') = ''
                OR item_code REGEXP :itemCode
                /*
                OR filename = (
                SELECT distinct filename 
                from c2.PM_ImageProducts ip 
                    INNER JOIN c2.ci_item i on i.ItemCode = ip.item_code
                WHERE ip.item_code = :itemCode and i.InactiveItem <> 'Y' and i.ProductType <> 'D'
                and ip.active
                ORDER BY rand()
                LIMIT 1)
                 */
                )
              AND (IFNULL(:baseSKU, '') = '' OR item.Category4 = :baseSKU)
              AND (IFNULL(:category, '') = '' OR item.Category2 = :category)
              AND (IFNULL(:collection, '') = '' OR item.Category3 = :collection)
              AND (IFNULL(:productLine, '') = '' OR item.ProductLine = :productLine)
              AND (IFNULL(:active, '') = '' OR img.active = :active)
              AND (IFNULL(:preferred, '') = '' OR img.preferred_image = :preferred)
            ORDER BY preferred_image DESC, filename;
        `;
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
        const data = {filename, itemCode, baseSKU, category, collection, productLine, active, preferred};

        const [[images], [altImages]] = await Promise.all([
            mysql2Pool.query(query, data),
            mysql2Pool.query(queryAltImages, data),
        ]);

        images.forEach(image => {
            image.pathnames = JSON.parse(image.pathnames || '[]');
            image.sizes = JSON.parse(image.sizes || '{}');
            image.color_space = JSON.parse(image.color_space || '{}');
            image.img_format = JSON.parse(image.img_format || '{}');
            image.tags = JSON.parse(image.tags || '[]');
            image.item_codes = altImages.filter(img => img.filename === image.filename);
            image.preferred_image = !!image.preferred_image;
            image.active = !!image.active;
        });
        if (!!filename) {
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

/**
 *
 * @param {ImageProps} props
 * @return {Promise<ImageRecord|ImageRecord[]|*>}
 */
export async function saveImage(props) {
    try {
        const {filename, pathnames, sizes, color_space, img_format, tags, notes, item_code, preferred, active} = props;
        const query = `INSERT INTO c2.PM_Images (filename, pathnames, sizes, color_space, img_format, tags, notes,
                                                 item_code, active)
                       VALUES (:filename, :pathnames, :sizes, :color_space, :img_type, :tags, :notes,
                               :item_code, :active)
                       ON DUPLICATE KEY UPDATE pathnames   = :pathnames,
                                               sizes       = :sizes,
                                               color_space = :color_space,
                                               img_format  = :img_format,
                                               tags        = :tags,
                                               notes       = :notes,
                                               item_code   = :item_code,
                                               active      = :active`;
        const data = {
            filename,
            pathnames: JSON.stringify(pathnames || []),
            sizes: JSON.stringify(sizes || {}),
            color_space: JSON.stringify(color_space || {}),
            img_format: JSON.stringify(img_format || {}),
            tags: JSON.stringify(tags || []),
            notes: notes || '',
            item_code: item_code || '',
            active: active ?? 1,
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


export async function setImageActive(filename, active) {
    try {
        const sql = `UPDATE c2.PM_Images SET active = :active WHERE filename = :filename`;
        const args = {active, filename};
        await mysql2Pool.query(sql, args);
        return await loadImages({filename});
    } catch (err) {
        if (err instanceof Error) {
            debug("setImageActive()", err.message);
            return Promise.reject(err);
        }
        debug("setImageActive()", err);
        return Promise.reject(new Error('Error in setImageActive()'));
    }
}

/**
 *
 * @param {string} filename
 * @return {Promise<never>}
 */
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

/**
 *
 * @param {string} filename
 * @param {string} itemCode
 * @return {Promise<ImageRecord|ImageRecord[]>}
 */
export async function setItemCode({filename, itemCode}) {
    try {
        const query = `UPDATE c2.PM_Images SET item_code = :itemCode WHERE filename = :filename`;
        const data = {filename, itemCode};
        await mysql2Pool.query(query, data);
        const itemImages = await loadImages({itemCode});
        if (itemImages.length === 1) {
            await setPreferredImage(filename, itemCode);
        }
        return await loadImages({filename});
    } catch (err) {
        debug("setItemCode()", err.message);
        return Promise.reject(new Error(err));
    }
}

/**
 *
 * @param {string} filename
 * @param {string} itemCode
 * @return {Promise<never>}
 */
export async function setPreferredImage(filename, itemCode) {
    try {
        if (!itemCode || !filename) {
            return;
        }
        const sql1 = `UPDATE c2.PM_Images SET preferred_image = 0 WHERE item_code = :itemCode`;
        const sql2 = `UPDATE c2.PM_Images SET preferred_image = 1 WHERE filename = :filename`;
        const args = {filename, itemCode};
        await mysql2Pool.query(sql1, args);
        await mysql2Pool.query(sql2, args);
    } catch (err) {
        debug("setPreferredImage()", err.message);
        return Promise.reject(err);
    }
}

export async function applyItemCodeToFilenames({itemCode, filenames}) {
    try {
        const query = `UPDATE c2.PM_Images SET item_code = :itemCode WHERE filename IN (:filenames)`;
        const data = {filenames, itemCode};
        const connection = await mysql2Pool.getConnection();
        await connection.query(query, data);
        connection.release();
        return await loadImages({itemCode});
    } catch (err) {
        debug("applyItemCodeToFilenames()", err.message);
        return err;
    }
}

export async function loadAltItemCodes({filename}) {
    try {
        const sql = `SELECT ip.id,
                            ip.filename,
                            ip.item_code,
                            ip.active,
                            i.ItemCode,
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


export async function setAltItemCode({filename, itemCode}) {
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

export async function setMultipleAltItemCode({filenames = [], itemCode}) {
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


export async function delAltItemCode({filename, itemCode}) {
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

export async function addImagePath({filename, pathname, dimensions, img_format, color_space}) {
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

export async function removeImagePath({filename, pathname}) {
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

export async function addImageTag({filename, tag}) {
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

export async function removeImageTag({filename, tag}) {
    try {
        const image = await loadImages({filename});
        image.tags = image.tags.filter(_tag => _tag !== tag);
        return await saveImage(image);
    } catch (err) {
        debug("removeImageTag()", err.message);
        return err;
    }
}
