import { InputDialog } from '/BaseModal.js';
import { WebdavApi } from '/webdav/WebdavApi.js';

export function searchFileDialog(path) {
    return new Promise(async (resolve, reject) => {
        try {
            InputDialog.open({
                title: "搜索文件",
                message: `模糊搜索文件名称`,
                defaultValue: ""
            }).addEventListener('confirm', async (e) => {
                try {
                    const name = e.detail.value;
                    const result = await WebdavApi.Search(path, `${name}`);
                    resolve(result);
                } catch (error) {
                    console.error('Search file error:', error);
                    alert('Failed to search file: ' + error.message);
                    reject(error);
                }
            })
        } catch (error) {
            console.error('Search dialog error:', error);
            alert('Failed to open search dialog: ' + error.message);
            reject(error);
        }
    });
}