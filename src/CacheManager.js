async function getServerVersion() {
    const request = new XMLHttpRequest();
    request.open('GET', '/api/version', false); // 第三个参数 false 表示同步请求
    request.send(null);

    if (request.status === 200) {
        const data = JSON.parse(request.responseText);
        return data.version;
    } else {
        console.error('Error fetching server version:', request.statusText);
        return null;
    }
}

class IndexedDBCacheManager {
    constructor(dbName = 'user_cache_db', storeName = 'user_cache') {
        this.dbName = dbName;
        this.storeName = storeName;
        this.defaultExpireTime = 24*60*60*1000; // 默认缓存24小时*
        this.db = null;
        this._initDB();
        this.checkAndClearOldCache();
    }

    
    
    // 新增：检查并清除旧版本缓存
    async checkAndClearOldCache() {
        const versionKey = '__cache_version__';
        const server_version =  await getServerVersion();
        const currentVersion = await this.getCache(versionKey);
        
        if (currentVersion !== server_version) {
            await this.clearAllCache();
            await this.setCache(versionKey, server_version);
        }
    }

    // 初始化 IndexedDB
    _initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'key' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB 初始化失败：', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // 获取缓存数据
    // 新增：路径解析工具方法
    _parsePath(path) {
        return path.split('/').filter(Boolean);
    }

    // 改进：获取缓存，支持获取子树
    async getCache(path) {
        if (!this.db) await this._initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            
            // 自动判断是否为子树请求
            const isSubtreeRequest = path.endsWith('/');
            
            if (!isSubtreeRequest) {
                // 原有逻辑：获取单个节点
                const request = store.get(path);
                request.onsuccess = (event) => {
                    const cacheData = event.target.result;
                    if (!cacheData) {
                        resolve(null);
                        return;
                    }
                    if (Date.now() > cacheData.expireTime) {
                        this.removeCache(path);
                        resolve(null);
                    } else {
                        resolve(cacheData.data);
                    }
                };
                request.onerror = (event) => {
                    console.error('获取缓存失败：', event.target.error);
                    reject(event.target.error);
                };
            } else {
                // 自动处理子树请求
                const request = store.openCursor();
                const result = [];
                const pathParts = this._parsePath(path);
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const keyParts = this._parsePath(cursor.key);
                        if (keyParts.slice(0, pathParts.length).join('/') === pathParts.join('/')) {
                            if (Date.now() <= cursor.value.expireTime) {
                                result.push(cursor.value.data);
                            }
                        }
                        cursor.continue();
                    } else {
                        resolve(result);
                    }
                };
                
                request.onerror = (event) => {
                    console.error('获取子树缓存失败：', event.target.error);
                    reject(event.target.error);
                };
            }
        });
    }

    // 改进：删除缓存，支持删除子树
    async removeCache(path) {
        if (!this.db) await this._initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            // 自动判断是否为子树请求
            const isSubtreeRequest = path.endsWith('/');
            
            if (!isSubtreeRequest) {
                // 原有逻辑：删除单个节点
                const request = store.delete(path);
                request.onsuccess = () => resolve();
                request.onerror = (event) => {
                    console.error('删除缓存失败：', event.target.error);
                    reject(event.target.error);
                };
            } else {
                // 自动处理子树删除
                const request = store.openCursor();
                const pathParts = this._parsePath(path);
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const keyParts = this._parsePath(cursor.key);
                        if (keyParts.slice(0, pathParts.length).join('/') === pathParts.join('/')) {
                            cursor.delete();
                        }
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };
                
                request.onerror = (event) => {
                    console.error('删除子树缓存失败：', event.target.error);
                    reject(event.target.error);
                };
            }
        });
    }
   

    // 设置缓存
    async setCache(path, data, expireTime = this.defaultExpireTime) {
        if (!this.db) await this._initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const cacheData = {
                key: path,
                data,
                expireTime: Date.now() + expireTime,
            };

            const request = store.put(cacheData);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = (event) => {
                console.error('设置缓存失败：', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // 清理所有过期缓存
    async cleanExpiredCache() {
        if (!this.db) await this._initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.openCursor();

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    if (Date.now() > cursor.value.expireTime) {
                        cursor.delete(); // 删除过期缓存
                    }
                    cursor.continue();
                } else {
                    resolve();
                }
            };

            request.onerror = (event) => {
                console.error('清理缓存失败：', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // 清理所有缓存
    async clearAllCache() {
        if (!this.db) await this._initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = (event) => {
                console.error('清理所有缓存失败：', event.target.error);
                reject(event.target.error);
            };
        });
    }
}

export { IndexedDBCacheManager };


let cacheManager = new IndexedDBCacheManager('user_cache_db',  'user_cache');
export { cacheManager };