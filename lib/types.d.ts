import {RowDataPacket} from "mysql2";
import {
    BaseSKU,
    CountryOfOrigin,
    PrimaryVendor,
    ProductCategory,
    ProductCollection,
    ProductLine,
    ProductStatus, Warehouse
} from "chums-types";

export type ImageSizePath = '80'|'125'|'250'|'400'|'800'|'2048'|'originals'|string;

export interface ImageSize {
    width: number,
    height: number,
    size: number,
}

export interface BaseImage {
    filename: string;
    path: string;
    width: number;
    height: number;
    size: number;
}
export interface ProductImageProps {
    filename:string,
    pathnames: ImageSizePath[],
    sizes: ImageSizeList,
    color_space?: ColorSpaceList,
    img_format?: ImageFormatList,
    tags?: string[],
    notes?: string,
    item_code?: string,
    preferred_image?: boolean,
    active?: boolean,
}

export interface ProductImageRecord extends Omit<ProductImageProps, 'active'>{
    active: number|boolean;
    timestamp:string,
    ItemCodeDesc?: string|null,
    InactiveItem?:string|null,
    ProductType?: string|null,
    ProductLine?: string|null,
    Category1?:string|null,
    Category?:string|null,
    ItemCollection?: string|null,
    BaseSKU?:string|null,
    item_codes?: ProductAltItem[],
}

export interface ItemImageRecord {
    ItemCode: string,
    filename?: string,
    pathnames?: string[],
    sizes?: ImageSizeList,
    color_space?: ColorSpaceList,
    img_format?: ImageFormatList,
}

export interface ItemImage {
    ItemCode: string,
    filename: string,
}

export interface ImageSize {
    width: number,
    height: number,
    size: number,
}

export type ImageSizeList = {
    [key in ImageSizePath]?: ImageSize;
};
export type ColorSpaceList = {
    [key in ImageSizePath]?: string;
}
export type ImageFormatList = {
    [key in ImageSizePath]?: string;
}


export interface ProductImage extends ProductImageRecord {
    filename: string,
    pathnames: ImageSizePath[],
    sizes: ImageSizeList,
    color_space: ColorSpaceList,
    img_format: ImageFormatList,
    tags: string[],
    notes: string,
    item_code?: string,
    timestamp:string,
    ItemCode?: string|null,
    ItemCodeDesc?: string|null,
    InactiveItem?:string|null,
    ProductType?: string|null,
    ProductLine?: string|null,
    Category1?:string|null,
    Category?:string|null,
    ItemCollection?: string|null,
    BaseSKU?:string|null,
    item_codes?: ProductAltItem[],
    preferred_image?: boolean,
    active: boolean;
}
export interface ProductImageRow extends RowDataPacket, Omit<ProductImage, 'active'> {
    active: number|boolean;
    pathnames: string;
    sizes: string,
    color_space?: string|null,
    img_format?: string|null,
    tags: string,
    notes: string,
}

export interface ProductAltItem {
    id: number,
    filename: string,
    item_code: string,
    active: boolean,
    ItemCodeDesc: string
    ProductType: string,
    InactiveItem: string
}

export interface ProductAltItemRow extends RowDataPacket, ProductAltItem {
    active: number|boolean;
};

export interface GenericImage extends ImageSize {
    path: string,
    filename: string,
}

export interface ProductLineRecord extends RowDataPacket, ProductLine {
    active: number|boolean;
};
export interface CategoryRecord extends RowDataPacket, ProductCategory {
    active: number|boolean;
};
export type CollectionRecord = ProductCollection & RowDataPacket;
export interface BaseSKURecord extends RowDataPacket, BaseSKU {
    tags: string;
    active: number|boolean;
}
export type CountryOfOriginRecord = CountryOfOrigin & RowDataPacket;
export type PrimaryVendorRecord = PrimaryVendor & RowDataPacket;
export type ProductStatusRecord = ProductStatus & RowDataPacket;
export type WarehouseRecord = Warehouse & RowDataPacket;

export interface ImageLookup {
    ItemCode: string,
    filename: string,
    preferred_image: boolean,
}
export interface ImageLookupRow extends RowDataPacket, ImageLookup {
    active: number|boolean|string;
}

export interface ImageDimensions extends BaseImage {
    pathName: string;
    metadata: Omit<sharp.Metadata>
}
export interface ParsedImageProps {
    width: sharp.Metadata['width'];
    height: sharp.Metadata['height'];
    size: sharp.Metadata['size'];
    color_space: string | undefined;
    img_format: sharp.Metadata['format'];
}
