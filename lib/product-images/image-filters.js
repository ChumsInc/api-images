import {getDBCompany, mysql2Pool} from 'chums-local-modules';
import Debug from 'debug';

const debug = Debug('chums:lib:product-images');

async function loadWarehouse({company, search}) {
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
                 WHERE w.Company = :company
                   AND i.ProductType <> 'D'
                   AND i.InactiveItem <> 'Y'

                   AND (iw.QuantityOnSalesOrder <> 0 OR iw.QuantityOnHand <> 0 OR iw.QuantityOnWorkOrder <> 0 OR
                        iw.QuantityRequiredForWO <> 0)
                 ORDER BY w.WarehouseCode, w.WarehouseDesc`;
    const args = {company: getDBCompany(company)};
    try {
        const [rows] = await mysql2Pool.query(sql, args);
        return rows;
    } catch (err) {
        debug('loadWarehouse()', err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {string} company
 * @param {string} search
 * @return {Promise<ProductLineRecord[]>}
 */
async function loadProductLines({company, search}) {
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
                 WHERE pl.Company = :Company
                   AND i.ProductType <> 'D'
                   AND i.InactiveItem <> 'Y'
                 ORDER BY pl.ProductLine`;
    const args = {Company: getDBCompany(company), search: `\\b${search || ''}`};
    try {
        const [rows] = await mysql2Pool.query(sql, args);
        return rows.map(row => ({
            ...row,
            active: row.active === 1,
        }))
    } catch (err) {
        debug('loadProductLines()', err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {string} company
 * @param {string} search
 * @return {Promise<CategoryRecord[]>}
 */
async function loadCategory2({company, search}) {
    const sql = `SELECT DISTINCT i.Category2,
                                 c.id,
                                 IFNULL(c.code, i.Category2) AS code,
                                 c.description,
                                 c.active,
                                 c.notes,
                                 c.tags,
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
                 WHERE Company = :company
                   AND ItemType = '1'
                   AND ProductType <> 'D'
                   AND InactiveItem <> 'Y'
                   AND Category2 IS NOT NULL
                 ORDER BY Category2`;
    const args = {company: getDBCompany(company), search: `\\b${search || ''}`};
    try {
        const [rows] = await mysql2Pool.query(sql, args);
        return rows.map(row => ({
            ...row,
            tags: JSON.stringify(row.tags ?? '{}'),
            active: row.active === 1,
        }))
    } catch (err) {
        debug('loadCategory2()', err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {string} company
 * @param {string} search
 * @return {Promise<CollectionRecord[]>}
 */
async function loadCategory3({company, search}) {
    const query = `SELECT DISTINCT i.Category3
                   FROM c2.ci_item i
                            INNER JOIN (SELECT DISTINCT item_code AS ItemCode
                                        FROM c2.PM_Images pmi
                                        UNION
                                        SELECT DISTINCT item_code
                                        FROM c2.PM_ImageProducts ip) images
                                       ON images.ItemCode = i.ItemCode
                   WHERE i.Company = :company
                     AND i.ItemType = '1'
                     AND i.ProductType <> 'D'
                     AND i.InactiveItem <> 'Y'
                     AND i.Category3 IS NOT NULL
                   ORDER BY i.Category3`;
    const data = {company: getDBCompany(company), search: `\\b${search || ''}`};
    try {
        const [rows] = await mysql2Pool.query(query, data);
        return rows;
    } catch (err) {
        debug('loadCategory3()', err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {string} company
 * @param {string} search
 * @return {Promise<BaseSKURecord[]>}
 */
async function loadCategory4({company, search}) {
    const query = `SELECT DISTINCT i.Category4,
                                   b.id,
                                   b.sku_group_id,
                                   b.sku,
                                   b.description,
                                   b.upc,
                                   b.active,
                                   b.notes,
                                   b.tags
                   FROM c2.ci_item i
                            INNER JOIN (SELECT DISTINCT item_code AS ItemCode
                                        FROM c2.PM_Images pmi
                                        UNION
                                        SELECT DISTINCT item_code
                                        FROM c2.PM_ImageProducts ip) images
                                       ON images.ItemCode = i.ItemCode
                            LEFT JOIN c2.sku_bases b
                                      ON b.sku = i.Category4
                   WHERE Company = :company
                     AND ItemType = '1'
                     AND ProductType <> 'D'
                     AND InactiveItem <> 'Y'
                     AND Category4 IS NOT NULL
                   ORDER BY Category4`;
    const data = {company: getDBCompany(company), search: `\\b${search || ''}`};
    try {
        const [rows] = await mysql2Pool.query(query, data);
        return rows.map(row => ({
            ...row,
            tags: JSON.parse(row.tags ?? '{}'),
            active: row.active === 1,
        }))
    } catch (err) {
        debug('loadCategory4()', err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {string} company
 * @param {string} search
 * @return {Promise<CountryOfOriginRecord[]>}
 */
async function loadCountryOfOrigin({company, search}) {
    try {
        const query = `SELECT DISTINCT i.UDF_COUNTRY_ORIGIN AS countryOfOrigin
                       FROM c2.ci_item i
                                INNER JOIN (SELECT DISTINCT item_code AS ItemCode
                                            FROM c2.PM_Images pmi
                                            UNION
                                            SELECT DISTINCT item_code
                                            FROM c2.PM_ImageProducts ip) images
                                           ON images.ItemCode = i.ItemCode
                       WHERE Company = :company
                         AND ItemType = '1'
                         AND ProductType <> 'D'
                         AND InactiveItem <> 'Y'
                       ORDER BY UDF_COUNTRY_ORIGIN`;
        const data = {company: getDBCompany(company), search: `\\b${search || ''}`};
        const [rows] = await mysql2Pool.query(query, data);
        return rows;
    } catch (err) {
        debug("loadCountryOfOrigin()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {string} company
 * @param {string} search
 * @return {Promise<PrimaryVendorRecord[]>}
 */
async function loadPrimaryVendor({company, search}) {
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
                       WHERE i.Company = :company
                         AND i.ItemType = '1'
                         AND i.ProductType <> 'D'
                         AND InactiveItem <> 'Y'
                         AND i.PrimaryVendorNo IS NOT NULL
                       ORDER BY PrimaryVendorNo`;
        const data = {company: getDBCompany(company), search: `\\b${search || ''}`};
        const [rows] = await mysql2Pool.query(query, data);
        return rows;
    } catch (err) {
        debug("loadPrimaryVendor()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @return {Promise<ProductStatusRecord[]>}
 */
async function loadProductStatusList() {
    const query = `SELECT id, code, description
                   FROM c2.IM_ItemStatus
                   ORDER BY code`;
    try {
        const [rows] = await mysql2Pool.query(query);
        return rows;
    } catch (err) {
        debug('loadStatusList()', err.message);
        return Promise.reject(err);
    }
}

export async function getItemFilterOptions(req, res) {
    try {
        const [
            warehouses,
            productLines,
            primaryVendor,
            countryOfOrigin,
            categories,
            collections,
            baseSKUs,
            productStatusList,
        ] = await Promise.all([
            loadWarehouse(req.params),
            loadProductLines(req.params),
            loadPrimaryVendor(req.params),
            loadCountryOfOrigin(req.params),
            loadCategory2(req.params),
            loadCategory3(req.params),
            loadCategory4(req.params),
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
    } catch (err) {
        debug("getItemFilterOptions()", err.message);
        res.json({error: err.message});
    }
}




