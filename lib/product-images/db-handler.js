import Debug from 'debug';
import { mysql2Pool } from 'chums-local-modules';
const debug = Debug('chums:lib:product-images:db-handler');
const defaultImage = {
    filename: '',
    pathnames: [],
    sizes: {},
    color_space: {},
    img_format: {},
    tags: [],
    notes: '',
    item_code: '',
    item_codes: [],
    preferred_image: false,
    active: true,
    timestamp: '',
};
export async function loadImagesByItemList(itemCodes = []) {
    try {
        if (itemCodes.length === 0) {
            return [];
        }
        const sql1 = `SELECT DISTINCT i.ItemCode,
                                      img.filename,
                                      img.pathnames,
                                      IFNULL(img.preferred_image, 0) AS preferred_image
                      FROM c2.ci_item i
                               INNER JOIN c2.PM_Images img
                                          ON img.item_code = i.ItemCode
                      WHERE i.Company = 'chums'
                        AND i.ItemCode IN (:itemCodes)
                        AND img.active = 1


                      UNION

                      SELECT DISTINCT i.ItemCode,
                                      pmi.filename,
                                      pmi.pathnames,
                                      IFNULL(pmi.preferred_image, 0) AS preferred_image
                      FROM c2.ci_item i
                               INNER JOIN c2.PM_ImageProducts img
                                          ON img.item_code = i.ItemCode
                               INNER JOIN c2.PM_Images pmi
                                          ON pmi.filename = img.filename
                      WHERE i.Company = 'chums'
                        AND i.ItemCode IN (:itemCodes)
                        AND pmi.active = 1`;
        const images = itemCodes.map(itemCode => ({ ItemCode: itemCode, filename: null, pathnames: [] }));
        const [_rows] = await mysql2Pool.query(sql1, { itemCodes });
        return images.map(img => {
            let imageRow;
            [imageRow] = _rows.filter(row => row.ItemCode === img.ItemCode && !!row.preferred_image);
            if (!imageRow) {
                [imageRow] = _rows.filter(row => row.ItemCode === img.ItemCode && !row.preferred_image);
            }
            let pathnames = [];
            try {
                pathnames = JSON.parse(imageRow?.pathnames ?? '[]');
            }
            catch (err) {
                if (err instanceof Error) {
                    console.debug("loadImagesByItemList()", err.message);
                }
            }
            return {
                ...img,
                filename: imageRow?.filename ?? 'missing.png',
                pathnames,
            };
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadImagesByItemList()", err.message);
            return Promise.reject(err);
        }
        debug("loadImagesByItemList()", err);
        return Promise.reject(new Error('Error in loadImagesByItemList()'));
    }
}
export async function loadImages({ filename, itemCode, baseSKU, category, collection, productLine, active, activeImages, preferred } = {}) {
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
                               ON img.item_code = item.ItemCode AND item.company = 'chums'
            WHERE (IFNULL(:filename, '') = '' OR filename = :filename)
              AND (IFNULL(:itemCode, '') = '' OR item_code REGEXP :itemCode)
              AND (IFNULL(:baseSKU, '') = '' OR item.Category4 = :baseSKU)
              AND (IFNULL(:category, '') = '' OR item.Category2 = :category)
              AND (IFNULL(:collection, '') = '' OR item.Category3 = :collection)
              AND (IFNULL(:productLine, '') = '' OR item.ProductLine = :productLine)
              AND (IFNULL(:active, '') = '' OR IFNULL(item.InactiveItem, 'N') = IF(:active = '1', 'N', 'Y'))
              AND (IFNULL(:activeImages, '') = '' OR img.active = 1)
              AND (IFNULL(:preferred, '') = '' OR img.preferred_image = :preferred)
            ORDER BY preferred_image DESC, filename;
        `;
        const data = { filename, itemCode, baseSKU, category, collection, productLine, active, activeImages, preferred };
        const [[images], altItems] = await Promise.all([
            mysql2Pool.query(query, data),
            loadAltItemCodes(filename ?? ''),
        ]);
        return images.map(row => ({
            ...row,
            pathnames: JSON.parse(row.pathnames || '[]'),
            sizes: JSON.parse(row.sizes || '{}'),
            color_space: JSON.parse(row.color_space || '{}'),
            img_format: JSON.parse(row.img_format || '{}'),
            tags: JSON.parse(row.tags || '[]'),
            item_codes: altItems.filter(img => img.filename === row.filename),
            preferred_image: !!row.preferred_image,
            active: !!row.active,
        }));
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadImages()", err.message);
            return Promise.reject(err);
        }
        debug("loadImages()", err);
        return Promise.reject(new Error('Error in loadImages()'));
    }
}
/**
 *
 * @param {ProductImageProps} props
 * @return {Promise<ProductImage>}
 */
export async function saveImage(props) {
    try {
        const { filename, pathnames, sizes, color_space, img_format, tags, notes, item_code, active } = props;
        const query = `INSERT INTO c2.PM_Images (filename, pathnames, sizes, color_space, img_format, tags, notes,
                                                 item_code, active)
                       VALUES (:filename, :pathnames, :sizes, :color_space, :img_type, :tags, :notes,
                               :item_code, :active)
                       ON DUPLICATE KEY UPDATE pathnames = :pathnames,
                                               sizes = :sizes,
                                               color_space = :color_space,
                                               img_format = :img_format,
                                               tags = :tags,
                                               notes = :notes,
                                               item_code = :item_code,
                                               active = :active`;
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
        await mysql2Pool.query(query, data);
        if (props.preferred_image && !!props.item_code) {
            await setPreferredImage(props.filename, props.item_code);
        }
        const [image] = await loadImages({ filename });
        return image;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("saveImage()", err.message);
            return Promise.reject(err);
        }
        debug("saveImage()", err);
        return Promise.reject(new Error('Error in saveImage()'));
    }
}
export async function setImageActive(filename, active) {
    try {
        const sql = `UPDATE c2.PM_Images
                     SET active = :active
                     WHERE filename = :filename`;
        const args = { active: active === '1' ? 1 : 0, filename };
        debug('setImageActive', { args });
        await mysql2Pool.query(sql, args);
        const [image] = await loadImages({ filename });
        return image;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("setImageActive()", err.message);
            return Promise.reject(err);
        }
        debug("setImageActive()", err);
        return Promise.reject(new Error('Error in setImageActive()'));
    }
}
async function removeImage(filename) {
    try {
        const query = `DELETE
                       FROM c2.PM_Images
                       WHERE filename = :filename`;
        const data = { filename };
        await mysql2Pool.query(query, data);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("removeImage()", err.message);
            return Promise.reject(err);
        }
        debug("removeImage()", err);
        return Promise.reject(new Error('Error in removeImage()'));
    }
}
export async function setItemCode({ filename, itemCode }) {
    try {
        const query = `UPDATE c2.PM_Images
                       SET item_code = :itemCode
                       WHERE filename = :filename`;
        const data = { filename, itemCode };
        await mysql2Pool.query(query, data);
        const itemImages = await loadImages({ itemCode });
        if (itemImages.length === 1) {
            await setPreferredImage(filename, itemCode);
        }
        const [image] = await loadImages({ filename });
        return image;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("setItemCode()", err.message);
            return Promise.reject(err);
        }
        debug("setItemCode()", err);
        return Promise.reject(new Error('Error in setItemCode()'));
    }
}
export async function setPreferredImage(filename, itemCode) {
    try {
        if (!itemCode || !filename) {
            return;
        }
        const sql1 = `UPDATE c2.PM_Images
                      SET preferred_image = 0
                      WHERE item_code = :itemCode`;
        const sql2 = `UPDATE c2.PM_Images
                      SET preferred_image = 1
                      WHERE filename = :filename`;
        const args = { filename, itemCode };
        await mysql2Pool.query(sql1, args);
        await mysql2Pool.query(sql2, args);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("setPreferredImage()", err.message);
            return Promise.reject(err);
        }
        debug("setPreferredImage()", err);
        return Promise.reject(new Error('Error in setPreferredImage()'));
    }
}
export async function applyItemCodeToFilenames({ itemCode, filenames }) {
    try {
        if (!filenames.length) {
            return loadImages({ itemCode });
        }
        const query = `UPDATE c2.PM_Images
                       SET item_code = :itemCode
                       WHERE filename IN (:filenames)`;
        const data = { filenames, itemCode };
        await mysql2Pool.query(query, data);
        return await loadImages({ itemCode });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("applyItemCodeToFilenames()", err.message);
            return Promise.reject(err);
        }
        debug("applyItemCodeToFilenames()", err);
        return Promise.reject(new Error('Error in applyItemCodeToFilenames()'));
    }
}
export async function loadAltItemCodes(filename) {
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
                     WHERE (:filename IS NULL OR filename = :filename)`;
        const args = { filename };
        const [rows] = await mysql2Pool.query(sql, args);
        return rows.map(row => ({
            ...row,
            active: !!row.active,
        }));
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadAltItemCodes()", err.message);
            return Promise.reject(err);
        }
        debug("loadAltItemCodes()", err);
        return Promise.reject(new Error('Error in loadAltItemCodes()'));
    }
}
export async function setAltItemCode({ filename, itemCode }) {
    try {
        const sql = `INSERT IGNORE INTO c2.PM_ImageProducts (filename, item_code)
                     VALUES (:filename, :itemCode)`;
        const args = { filename, itemCode };
        await mysql2Pool.query(sql, args);
        const [image] = await loadImages({ filename });
        return image ?? null;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("setAltItemCode()", err.message);
            return Promise.reject(err);
        }
        debug("setAltItemCode()", err);
        return Promise.reject(new Error('Error in setAltItemCode()'));
    }
}
export async function setMultipleAltItemCode({ filenames = [], itemCode }) {
    try {
        const sql = `INSERT IGNORE INTO c2.PM_ImageProducts (filename, item_code)
                     VALUES (:filename, :itemCode)`;
        const connection = await mysql2Pool.getConnection();
        const data = filenames.map(filename => ({ filename, itemCode }));
        await Promise.all(data.map(args => connection.query(sql, args)));
        connection.release();
        return loadImages({ itemCode: `^${itemCode}$` });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("setMultipleAltItemCode()", err.message);
            return Promise.reject(err);
        }
        debug("setMultipleAltItemCode()", err);
        return Promise.reject(new Error('Error in setMultipleAltItemCode()'));
    }
}
export async function delAltItemCode({ filename, itemCode }) {
    try {
        const sql = `DELETE
                     FROM c2.PM_ImageProducts
                     WHERE filename = :filename
                       AND item_code = :itemCode`;
        const args = { filename, itemCode };
        await mysql2Pool.query(sql, args);
        const [image] = await loadImages({ filename });
        return image;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("delAltItemCode()", err.message);
            return Promise.reject(err);
        }
        debug("delAltItemCode()", err);
        return Promise.reject(new Error('Error in delAltItemCode()'));
    }
}
export async function addImagePath({ filename, pathname, dimensions, img_format, color_space }) {
    try {
        const [img] = await loadImages({ filename });
        const image = img ?? { ...defaultImage, filename };
        if (!image.pathnames.includes(pathname)) {
            image.pathnames.push(pathname);
        }
        image.sizes[pathname] = dimensions;
        image.img_format[pathname] = img_format;
        image.color_space[pathname] = color_space ?? '';
        return await saveImage({ ...image, filename });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("addImagePath()", err.message);
            return Promise.reject(err);
        }
        debug("addImagePath()", err);
        return Promise.reject(new Error('Error in addImagePath()'));
    }
}
export async function removeImagePath({ filename, pathname }) {
    try {
        const [image] = await loadImages({ filename });
        if (!image) {
            return null;
        }
        if (!image.pathnames.includes(pathname)) {
            return image;
        }
        image.pathnames = image.pathnames.filter(path => path !== pathname);
        if (image.pathnames.length === 0) {
            await removeImage(filename);
            return null;
        }
        delete image.sizes[pathname];
        delete image.img_format[pathname];
        delete image.color_space[pathname];
        return await saveImage({ ...image, filename });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("removeImagePath()", err.message);
            return Promise.reject(err);
        }
        debug("removeImagePath()", err);
        return Promise.reject(new Error('Error in removeImagePath()'));
    }
}
export async function addImageTag({ filename, tag }) {
    try {
        const [image] = await loadImages({ filename });
        if (!image) {
            return null;
        }
        if (!image.tags.includes(tag)) {
            image.tags.push(tag);
        }
        return await saveImage(image);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("addImageTag()", err.message);
            return Promise.reject(err);
        }
        debug("addImageTag()", err);
        return Promise.reject(new Error('Error in addImageTag()'));
    }
}
export async function removeImageTag({ filename, tag }) {
    try {
        const [image] = await loadImages({ filename });
        if (!image) {
            return null;
        }
        image.tags = image.tags.filter(_tag => _tag !== tag);
        return await saveImage(image);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("removeImageTag()", err.message);
            return Promise.reject(err);
        }
        debug("removeImageTag()", err);
        return Promise.reject(new Error('Error in removeImageTag()'));
    }
}
