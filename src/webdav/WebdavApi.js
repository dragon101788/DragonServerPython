import { AccountManager } from '/AccountManager.js';
import { getUserToken } from "/DragonServerAPI.js"


export function getParentDir(path){
    const lastSlashIndex = path.substring(0, path.length - 1).lastIndexOf('/');
    const parentDir = path.substring(0, lastSlashIndex + 1);
    return parentDir;
}

// 创建基础类
export class WebdavApi {
    // 使用类静态块实现自动初始化
    static async init() {
        console.log("WebdavApi static initialization");
        const token = await AccountManager.getToken();
        console.log("token:",token);
        if(token === undefined){
            WebdavApi.static_self = new WebdavApi();
        }else{
            WebdavApi.static_self = new WebdavApi({token: token});
        }
        WebdavApi.serverUrl = WebdavApi.static_self.serverUrl;
        
    }
    static static_self = undefined;
    static async getDirectoryContents(path) {
        if(WebdavApi.static_self === undefined){
            await WebdavApi.init();
        }
        return await WebdavApi.static_self.getDirectoryContents(path);
    }
    static async Search(path,search) {
        if(WebdavApi.static_self === undefined){
            await WebdavApi.init();
        }
        return await WebdavApi.static_self.Search(path,search);
    }
    static async downloadFile(path, callback) {
        if(WebdavApi.static_self === undefined){
            await WebdavApi.init();
        }
        return await WebdavApi.static_self.downloadFile(path, callback);
    }
    static async deleteFile(path) {
        if(WebdavApi.static_self === undefined){
            await WebdavApi.init();
        }
        return await WebdavApi.static_self.deleteFile(path);
    }
    static async uploadFile(path, data) {
        if(WebdavApi.static_self === undefined){
            await WebdavApi.init();
        }
        return await WebdavApi.static_self.uploadFile(path, data);
    }
    static async fetchFile(path) {
        if(WebdavApi.static_self === undefined){
            await WebdavApi.init();
        }
        return await WebdavApi.static_self.fetchFile(path);
    }
    static async pushFile(path, data) {
        if(WebdavApi.static_self === undefined){
            await WebdavApi.init();
        }
        return await WebdavApi.static_self.pushFile(path, data);
    }

    constructor(args) {
        if (!args) {
            args = {};
        }
        if (args.serverUrl ) {
            this.serverUrl = args.serverUrl;
        }
        else {
            this.serverUrl = `/WEBDAV`;  
        }

        if (args?.username && args?.password) {
            this.Authorization = 'Basic'+ btoa(`${auth.username}:${auth.password}`);
        }
        else if (args?.token) {
            this.Authorization = `Bearer ${args.token}`;
        }
        else {
            
            this.Authorization = 'guest';
            //throw new Error('No authentication provided');
        }
    }

    async getShareUrl(path,expires = 60*24){
        try {
            const session = await AccountManager.getUserSession()
            const token = await getUserToken(session.username,expires);
            //获取当前是https还是http
            const protocol = window.location.protocol;
            //获取当前域名
            const host = window.location.host;
            //获取当前路径
            const pathname = window.location.pathname;
            //获取当前端口
            const port = window.location.port;
            const arg_json = JSON.stringify({path:path,token:token});
            //const arg_encoder = encodeURIComponent(arg_json);
            const arg_encoder = btoa(encodeURIComponent(arg_json));
            const arg = "shared="+arg_encoder;
            const url = protocol + "//" + host  + pathname + "?" +arg;
            return url;
        }
        catch (error) {
            console.error('PROPFIND error:', error);
            throw new Error('Failed to get directory contents:'+ error.message );
        }
    }
    async getDirectoryContents(path) {
        try {

            const encodedPath = encodeURIComponent(path);
            const response = await fetch(this.serverUrl + encodedPath, {
                method: 'PROPFIND',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/xml',
                    'Depth': '1',
                    'Authorization': this.Authorization
                },
                body: `<?xml version="1.0" encoding="utf-8" ?>
                       <D:propfind xmlns:D="DAV:">
                         <D:allprop/>
                         <D:limits/>
                       </D:propfind>`
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} `);
            }

            const data = await response.text();
            return this.parseDirectoryListing(data);
        } catch (error) {
            console.error('PROPFIND error:', error);
            throw new Error('Failed to get directory contents: ' + error.message );
        }
    }

    async Search(path,search) {
        try {

            const encodedPath = encodeURIComponent(path);
            const response = await fetch(this.serverUrl + encodedPath, {
                method: 'PROPFIND',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/xml',
                    'Depth': 'infinity',
                    'Search': search,
                    'Authorization': this.Authorization
                },
                body: `<?xml version="1.0" encoding="utf-8" ?>
                       <D:propfind xmlns:D="DAV:">
                         <D:allprop/>
                         <D:limits/>
                       </D:propfind>`
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} `);
            }

            const data = await response.text();
            return this.parseDirectoryListing(data);
        } catch (error) {
            console.error('PROPFIND error:', error);
            throw new Error('Failed to get directory contents: ' + error.message );
        }
    }

    parseDirectoryListing(xmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'text/xml');
        const responses = doc.getElementsByTagNameNS('DAV:', 'response');
        const items = [];

        for (let i = 0; i < responses.length; i++) {
            const response = responses[i];
            const href = response.getElementsByTagNameNS('DAV:', 'href')[0].textContent;
            const propstat = response.getElementsByTagNameNS('DAV:', 'propstat')[0];
            const prop = propstat.getElementsByTagNameNS('DAV:', 'prop')[0];

            const resourcetype = prop.getElementsByTagNameNS('DAV:', 'resourcetype')[0];
            const isDirectory = resourcetype.getElementsByTagNameNS('DAV:', 'collection').length > 0;

            // 检查 lockdiscovery 元素判断是否只读
            const lockdiscovery = prop.getElementsByTagNameNS('DAV:', 'lockdiscovery')[0];
            const isReadOnly = lockdiscovery && lockdiscovery.getElementsByTagNameNS('DAV:', 'activelock').length > 0;

            // 获取文件类型和大小
            const getcontenttype = prop.getElementsByTagNameNS('DAV:', 'getcontenttype')[0]?.textContent || '';
            const getcontentlength = prop.getElementsByTagNameNS('DAV:', 'getcontentlength')[0]?.textContent || '0';

            // 获取时间信息
            const creationdate = prop.getElementsByTagNameNS('DAV:', 'creationdate')[0]?.textContent || '';
            const getlastmodified = prop.getElementsByTagNameNS('DAV:', 'getlastmodified')[0]?.textContent || '';
            
            const limits = JSON.parse(prop.getElementsByTagNameNS('DAV:', 'limits')[0]?.textContent || '[]') ;
            items.push({
                path: decodeURIComponent(href),
                name: decodeURIComponent(href.split('/').filter(Boolean).pop() || '/'),
                type: isDirectory ? 'directory' : 'file',
                readonly: isReadOnly,
                // 新增属性
                contentType: getcontenttype,
                size: parseInt(getcontentlength),
                created: creationdate,
                modified: getlastmodified,
                limits: limits
            });
        }

        return items;
    }

    async downloadFile(path, onProgress) {
        try {
            const encodedPath = encodeURIComponent(path);
            const url = this.serverUrl + encodedPath;
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/xml',
                    'Depth': '1',
                    'Authorization': this.Authorization
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const contentLength = response.headers.get('content-length');
            if (!contentLength) {
                // 若没有 content-length 头信息，无法计算进度
                return await response.blob();
            }

            const total = parseInt(contentLength, 10);
            let loaded = 0;

            const reader = response.body.getReader();
            const chunks = [];
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                chunks.push(value);
                loaded += value.length;
                const progress = (loaded / total) * 100;
                if (onProgress) {
                    onProgress(progress);
                }else{
                    console.log(`Downloaded ${progress.toFixed(2)}%`);
                }
            }

            const blob = new Blob(chunks);
            // 创建下载链接
            const url_out = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url_out;
            
            // 从路径中提取文件名
            const fileName = path.split('/').pop();
            a.download = fileName;
            
            // 触发下载
            document.body.appendChild(a);
            a.click();
            
            // 清理
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url_out);
            }, 100);
            return blob;
        } catch (error) {
            console.error('Download error:', error);
            throw new Error('Failed to download file: ' + error.message);
        }
    }
    async fetchFile(path) {
        const encodedPath = encodeURIComponent(path);
        const url = this.serverUrl + encodedPath;
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/xml',
                'Depth': '1',
                'Authorization': this.Authorization
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
    }
    async pushFile(path, data) {
        try {
            const encodedPath = encodeURIComponent(path);
            const url = this.serverUrl + encodedPath;
            const response = await fetch(url, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/xml',
                    'Authorization': this.Authorization
                },
                body: data
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            else{
                return true;
            }
        }
        catch (error) {
            console.error('PUT error:', error);
            throw new Error('Failed to push file:'+ error.message);
        }
    }
    async moveFile(sourcePath, destinationPath) {
        try {
            const encodedSourcePath = encodeURIComponent(sourcePath);
            if (destinationPath.startsWith('/')) {
                destinationPath = destinationPath.substring(1);
            }
            const encodedDestinationPath = encodeURIComponent(destinationPath);
            const url = this.serverUrl + encodedSourcePath;

            const response = await fetch(url, {
                method: 'MOVE',
                credentials: 'include',
                headers: {
                    'Destination': encodedDestinationPath,
                    'Content-Type': 'application/xml',
                    'Authorization': this.Authorization
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            else{
                return true;
            }
        }
        catch (error) {
            console.error('MOVE error:', error);
            throw new Error('Failed to move file:'+ error.message);
        }
    }
    XMLHttpRequest(path, {onload,onerror} = {}){
        const xhr = new XMLHttpRequest();
        const encodedPath = encodeURIComponent(path);
        const url = this.serverUrl + encodedPath;
        xhr.open('GET', url, true);
        xhr.setRequestHeader('Authorization', this.Authorization);
        xhr.responseType = 'blob';

       
        xhr.onload = () => {
            if(onload){
                onload(xhr);
            }else{
                console.log('请求成功！');
            }
        }

        xhr.onerror = () => {
            if(onerror){
                onerror(xhr); 
            }else{
                console.error('请求失败，可能是网络或服务器问题！'); 
            }
        }; 
        

        xhr.send();
    }

    async deleteFile(path) {
        try {
            const encodedPath = encodeURIComponent(path);
            const response = await fetch(this.serverUrl + encodedPath, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/xml',
                    'Depth': '1',
                    'Authorization': this.Authorization
                },
                mode: 'cors'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return true;
        } catch (error) {
            console.error('Delete error:', error);
            throw new Error('Failed to delete file: ' + error.message);
        }
    }

    async uploadFile(path, file, onProgress) {
        try {
            const encodedPath = encodeURIComponent(path);
            const url = this.serverUrl + encodedPath;

            const formData = new FormData();
            formData.append('file', file);

            const uploadRequest = new XMLHttpRequest();
            uploadRequest.open('PUT', url, true);

            const headers = {
                'Content-Type': file.type || 'application/octet-stream',
                'Depth': '1',
                'Authorization': this.Authorization
            };
            Object.keys(headers).forEach(key => {
                uploadRequest.setRequestHeader(key, headers[key]);
            });

            // 添加进度监听
            uploadRequest.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    if (onProgress) {
                        onProgress(percentComplete);
                    } else {
                        console.log(`Uploaded ${percentComplete.toFixed(2)}%`);
                    }
                }
            });

            // 返回一个 Promise 来处理请求结果
            return new Promise((resolve, reject) => {
                uploadRequest.onreadystatechange = () => {
                    if (uploadRequest.readyState === 4) {
                        if (uploadRequest.status >= 200 && uploadRequest.status < 300) {
                            resolve(uploadRequest.responseText);
                        } else {
                            reject(new Error(`HTTP error! status: ${uploadRequest.status}`));
                        }
                    }
                };
                uploadRequest.send(file);
            });
        } catch (error) {
            console.error('Upload error:', error);
            throw new Error('Failed to upload file: ' + error.message);
        }
    }

    async createDirectory(path) {
        try {
            const encodedPath = encodeURIComponent(path);
            const response = await fetch(this.serverUrl + encodedPath, {
                method: 'MKCOL',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/xml',
                    'Depth': '1',
                    'Authorization': this.Authorization
                },
                mode: 'cors'
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
    
            return true;
        } catch (error) {
            console.error('Create directory error:', error);
            throw new Error('Failed to create directory: ' + error.message);
        }
    }
    async mkdir(path) {
        return await this.createDirectory(path); 
    }
}
