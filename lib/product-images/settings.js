const rootPath = '/var/www';
export const basePath = `${rootPath}/images/products`;
export const uploadPath = `${basePath}/temp`;
export const originalsPath = `${basePath}/originals`;
export const imageSizes = [2048, 800, 400, 250, 125, 80];
export const thumbSize = 250;
export const imagePaths = {
    ORIGINAL: originalsPath,
    original: originalsPath,
    originals: originalsPath,
    2048: `${basePath}/2048`,
    800: `${basePath}/800`,
    400: `${basePath}/400`,
    250: `${basePath}/250`,
    125: `${basePath}/125`,
    80: `${basePath}/80`,
    xl: `${basePath}/2048`,
    lg: `${basePath}/800`,
    thumb: `${basePath}/250`,
};
export const imagePathNames = ['originals', ...imageSizes.map(size => String(size))];
export const backgroundWhite = { r: 255, g: 255, b: 255 };
export const backgroundTransparent = { r: 255, g: 255, b: 255, alpha: 0 };
export const imgPath = (pathname, filename) => {
    if (imagePaths[pathname]) {
        return `${imagePaths[pathname]}/${filename}`;
    }
    return `${basePath}/${String(pathname)}/${filename}`;
};
/**
 *
 * @param {string|number} pathname
 * @param {string} filename
 * @return {string}
 */
export const webPath = (pathname, filename) => {
    return `${basePath}/${String(pathname)}/${filename}`.replace(rootPath, '');
};
