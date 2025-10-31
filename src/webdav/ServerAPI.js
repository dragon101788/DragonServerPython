import { AccountManager } from '/AccountManager.js';
// 获取 WebDAV 用户列表
async function get_dav_users() {
    try {

        const response = await fetch('/api/get_dav_users', {
            method: 'GET',
            headers: {
                
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            return await response.json();
        } else {
            const data = await response.json();
            throw new Error(`获取 WebDAV 用户列表失败: ${data.detail || response.statusText}`);
        }
    } catch (error) {
        console.error('获取 WebDAV 用户列表时出错:', error);
        throw error;
    }
}
export { get_dav_users };

async function create_user_dav_config(username) {
    try {
        const response = await fetch('/api/create_user_dav_config', {
            method: 'POST',
            headers: {
                
                'Content-Type': 'application/json'
            },
            // 携带凭证，用于处理认证
            credentials: 'include',
            body: JSON.stringify({ username })
        }); 
        if (response.ok) {
            const ret =  await response.json(); 
            console.log(ret.message); 
        }
        else {
            const data = await response.json();
            throw new Error(`创建 WebDAV 用户配置失败: ${data.detail || response.statusText}`); 
        }
    } 
    catch (error) {
        console.error('创建 WebDAV 用户配置时出错:', error);
        throw error; 
    }
}
export { create_user_dav_config };

async function get_webdav_config(username=null) {
    try {
        let url = `/api/get_webdav_config`;
        // 如果 username 存在，添加查询参数
        if (username) {
            url += `?username=${encodeURIComponent(username)}`;
        }
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                
                'Content-Type': 'application/json',
            },
            // 携带凭证，用于处理认证
            credentials: 'include',
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || '获取 WebDAV 配置失败');
        }

        return response.json();
    } catch (error) {
        console.error('获取 WebDAV 配置出错:', error);
        throw error;
    }
}
export { get_webdav_config };

async function set_webdav_config(newConfig,username=null) {
    try {
        let url = `/api/set_webdav_config`;
        // 如果 username 存在，添加查询参数
        if (username) {
            url += `?username=${encodeURIComponent(username)}`;
        }
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                
                'Content-Type': 'application/json',
            },
            // 携带凭证，用于处理认证
            credentials: 'include',
            body: JSON.stringify(newConfig),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || '设置 WebDAV 配置失败');
        }

        return response.json();
    } catch (error) {
        console.error('设置 WebDAV 配置出错:', error);
        throw error;
    }
}
export { set_webdav_config };