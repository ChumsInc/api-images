import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import Debug from 'debug';
const debug = Debug('chums:lib:about');
async function loadAPIVersion() {
    try {
        let version = '0.0.0';
        const path = resolve(process.cwd(), './package.json');
        const contents = await readFile(path);
        if (contents) {
            const json = JSON.parse(contents.toString());
            version = json?.version ?? 'unknown version';
        }
        return version;
    }
    catch (err) {
        if (err instanceof Error) {
            console.debug("loadAPIVersion()", err.message);
            return Promise.reject(err);
        }
        console.debug("loadAPIVersion()", err);
        return Promise.reject(new Error('Error in loadAPIVersion()'));
    }
}
export const aboutAPI = async (req, res) => {
    try {
        const version = await loadAPIVersion();
        res.json({
            site: '/api/images',
            version,
            node: process.version,
            uptime: process.uptime(),
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("aboutAPI()", err.message);
            return Promise.reject(err);
        }
        debug("aboutAPI()", err);
        return Promise.reject(new Error('Error in aboutAPI()'));
    }
};
