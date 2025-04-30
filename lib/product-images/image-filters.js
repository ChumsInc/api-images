import { mysql2Pool } from 'chums-local-modules';
import Debug from 'debug';
const debug = Debug('chums:lib:product-images:image-filters');
export async function loadWarehouse() {
    const sql = `SELECT DISTINCT w.WarehouseCode, w.WarehouseDesc, w.WarehouseStatus
                 FROM c2.im_warehouse w
                          INNER JOIN c2.im_itemwarehouse iw
                                     ON iw.Company = w.Company
                                         AND iw.WarehouseCode = w.WarehouseCode
                          INNER JOIN c2.ci_item i
                                     ON i.Company = iw.Company
                                         AND i.ItemCode = iw.ItemCode
                          INNER JOIN (SELECT DISTINCT item_code AS ItemCode
                                      FROM c2.PM_Images pmi
                                      UNION
                                      SELECT DISTINCT item_code
                                      FROM c2.PM_ImageProducts ip) images
                                     ON images.ItemCode = i.ItemCode
                 WHERE w.Company = 'chums'
                   AND i.ProductType <> 'D'
                   AND i.InactiveItem <> 'Y'

                   AND (iw.QuantityOnSalesOrder <> 0 OR iw.QuantityOnHand <> 0 OR iw.QuantityOnWorkOrder <> 0 OR
                        iw.QuantityRequiredForWO <> 0)
                 ORDER BY w.WarehouseCode, w.WarehouseDesc`;
    try {
        const [rows] = await mysql2Pool.query(sql);
        return rows;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadWarehouse()", err.message);
            return Promise.reject(err);
        }
        debug("loadWarehouse()", err);
        return Promise.reject(new Error('Error in loadWarehouse()'));
    }
}
export async function loadProductLines() {
    const sql = `SELECT DISTINCT pl.ProductLine,
                                 pl.ProductLineDesc,
                                 pl.ProductType,
                                 pl.Valuation,
                                 pl.ExplodeKitItems,
                                 LEFT(pl.ProductLineDesc, 1) <> '#' AS active
                 FROM c2.IM_ProductLine pl
                          INNER JOIN c2.ci_item i
                                     USING (Company, ProductLine)
                          INNER JOIN (SELECT DISTINCT item_code AS ItemCode
                                      FROM c2.PM_Images pmi
                                      UNION
                                      SELECT DISTINCT item_code
                                      FROM c2.PM_ImageProducts ip) images
                                     ON images.ItemCode = i.ItemCode
                 WHERE pl.Company = 'chums'
                   AND i.ProductType <> 'D'
                   AND i.InactiveItem <> 'Y'
                 ORDER BY pl.ProductLine`;
    try {
        const [rows] = await mysql2Pool.query(sql);
        return rows.map(row => ({
            ...row,
            active: row.active === 1,
        }));
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadProductLines()", err.message);
            return Promise.reject(err);
        }
        debug("loadProductLines()", err);
        return Promise.reject(new Error('Error in loadProductLines()'));
    }
}
export async function loadCategory2() {
    try {
        const sql = `SELECT DISTINCT i.Category2,
                                     c.id,
                                     IFNULL(c.code, i.Category2)             AS code,
                                     c.description,
                                     c.active,
                                     c.notes,
                                     JSON_EXTRACT(IFNULL(c.tags, '{}'), '$') AS tags,
                                     c.productLine
                     FROM c2.ci_item i
                              INNER JOIN (SELECT DISTINCT item_code AS ItemCode
                                          FROM c2.PM_Images pmi
                                          UNION
                                          SELECT DISTINCT item_code
                                          FROM c2.PM_ImageProducts ip) images
                                         ON images.ItemCode = i.ItemCode
                              LEFT JOIN c2.SKU_Categories c
                                        ON c.code = i.Category2
                     WHERE Company = 'chums'
                       AND ItemType = '1'
                       AND ProductType <> 'D'
                       AND InactiveItem <> 'Y'
                       AND Category2 IS NOT NULL
                     ORDER BY Category2`;
        const [rows] = await mysql2Pool.query(sql);
        return rows.map(row => ({
            ...row,
            tags: JSON.stringify(row.tags ?? '{}'),
            active: row.active === 1,
        }));
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadCategory2()", err.message);
            return Promise.reject(err);
        }
        debug("loadCategory2()", err);
        return Promise.reject(new Error('Error in loadCategory2()'));
    }
}
export async function loadCategory3() {
    const query = `SELECT DISTINCT i.Category3
                   FROM c2.ci_item i
                            INNER JOIN (SELECT DISTINCT item_code AS ItemCode
                                        FROM c2.PM_Images pmi
                                        UNION
                                        SELECT DISTINCT item_code
                                        FROM c2.PM_ImageProducts ip) images
                                       ON images.ItemCode = i.ItemCode
                   WHERE i.Company = 'chums'
                     AND i.ItemType = '1'
                     AND i.ProductType <> 'D'
                     AND i.InactiveItem <> 'Y'
                     AND i.Category3 IS NOT NULL
                   ORDER BY i.Category3`;
    try {
        const [rows] = await mysql2Pool.query(query);
        return rows;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadCategory3()", err.message);
            return Promise.reject(err);
        }
        debug("loadCategory3()", err);
        return Promise.reject(new Error('Error in loadCategory3()'));
    }
}
export async function loadCategory4() {
    const query = `SELECT DISTINCT i.Category4,
                                   b.id,
                                   b.sku_group_id,
                                   b.sku,
                                   b.description,
                                   b.upc,
                                   b.active,
                                   b.notes,
                                   JSON_EXTRACT(IFNULL(b.tags, '{}'), '$') AS tags
                   FROM c2.ci_item i
                            INNER JOIN (SELECT DISTINCT item_code AS ItemCode
                                        FROM c2.PM_Images pmi
                                        UNION
                                        SELECT DISTINCT item_code
                                        FROM c2.PM_ImageProducts ip) images
                                       ON images.ItemCode = i.ItemCode
                            LEFT JOIN c2.sku_bases b
                                      ON b.sku = i.Category4
                   WHERE Company = 'chums'
                     AND ItemType = '1'
                     AND ProductType <> 'D'
                     AND InactiveItem <> 'Y'
                     AND Category4 IS NOT NULL
                   ORDER BY Category4`;
    try {
        const [rows] = await mysql2Pool.query(query);
        return rows.map(row => ({
            ...row,
            tags: JSON.parse(row.tags ?? '{}'),
            active: row.active === 1,
        }));
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadCategory4()", err.message);
            return Promise.reject(err);
        }
        debug("loadCategory4()", err);
        return Promise.reject(new Error('Error in loadCategory4()'));
    }
}
export async function loadCountryOfOrigin() {
    try {
        const query = `SELECT DISTINCT IFNULL(i.UDF_COUNTRY_ORIGIN, '') AS countryOfOrigin
                       FROM c2.ci_item i
                                INNER JOIN (SELECT DISTINCT item_code AS ItemCode
                                            FROM c2.PM_Images pmi
                                            UNION
                                            SELECT DISTINCT item_code
                                            FROM c2.PM_ImageProducts ip) images
                                           ON images.ItemCode = i.ItemCode
                       WHERE Company = 'chums'
                         AND ItemType = '1'
                         AND ProductType <> 'D'
                         AND InactiveItem <> 'Y'
                       ORDER BY UDF_COUNTRY_ORIGIN`;
        const [rows] = await mysql2Pool.query(query);
        return rows;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadCountryOfOrigin()", err.message);
            return Promise.reject(err);
        }
        debug("loadCountryOfOrigin()", err);
        return Promise.reject(new Error('Error in loadCountryOfOrigin()'));
    }
}
export async function loadPrimaryVendor() {
    try {
        const query = `SELECT DISTINCT i.PrimaryVendorNo,
                                       v.VendorName
                       FROM c2.ci_item i
                                INNER JOIN (SELECT DISTINCT item_code AS ItemCode
                                            FROM c2.PM_Images pmi
                                            UNION
                                            SELECT DISTINCT item_code
                                            FROM c2.PM_ImageProducts ip) images
                                           ON images.ItemCode = i.ItemCode
                                LEFT JOIN c2.AP_Vendor v
                                          ON v.Company = i.Company
                                              AND v.APDivisionNo = i.PrimaryAPDivisionNo
                                              AND v.VendorNo = i.PrimaryVendorNo
                       WHERE i.Company = 'chums'
                         AND i.ItemType = '1'
                         AND i.ProductType <> 'D'
                         AND InactiveItem <> 'Y'
                         AND i.PrimaryVendorNo IS NOT NULL
                       ORDER BY PrimaryVendorNo`;
        const [rows] = await mysql2Pool.query(query);
        return rows;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadPrimaryVendor()", err.message);
            return Promise.reject(err);
        }
        debug("loadPrimaryVendor()", err);
        return Promise.reject(new Error('Error in loadPrimaryVendor()'));
    }
}
/**
 *
 * @return {Promise<ProductStatusRecord[]>}
 */
export async function loadProductStatusList() {
    const query = `SELECT id, code, description
                   FROM c2.IM_ItemStatus
                   ORDER BY code`;
    try {
        const [rows] = await mysql2Pool.query(query);
        return rows;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadProductStatusList()", err.message);
            return Promise.reject(err);
        }
        debug("loadProductStatusList()", err);
        return Promise.reject(new Error('Error in loadProductStatusList()'));
    }
}
export async function getItemFilterOptions(req, res) {
    try {
        const [warehouses, productLines, primaryVendor, countryOfOrigin, categories, collections, baseSKUs, productStatusList,] = await Promise.all([
            loadWarehouse(),
            loadProductLines(),
            loadPrimaryVendor(),
            loadCountryOfOrigin(),
            loadCategory2(),
            loadCategory3(),
            loadCategory4(),
            loadProductStatusList(),
        ]);
        res.json({
            warehouses,
            productLines,
            categories,
            collections,
            baseSKUs,
            primaryVendor,
            countryOfOrigin,
            productStatusList
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getItemFilterOptions()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getItemFilterOptions' });
    }
}
