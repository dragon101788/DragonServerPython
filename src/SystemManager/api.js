// 使用默认导入语法
import { AccountManager } from '/AccountManager.js';

/**
 * 执行系统重启操作，仅管理员用户有权限调用。
 * @returns {Promise<string>} 包含操作结果的消息字符串
 */
export async function rebootSystem() {
    try {
        // 获取用户会话，确保 token 有效
        const session = await AccountManager.getUserSession();

        const url = '/api/system_reboot';
        const options = {
            method: 'POST',
            credentials: 'include'
        };
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP 请求失败，状态码: ${response.status}`);
        }
        const data = await response.json();
        return data.message;
    } catch (error) {
        console.error('网络请求出错:', error);
        throw error;
    }
}




/**
 * 执行服务重启操作，仅超级管理员用户有权限调用。
 * @returns {Promise<string>} 包含操作结果的消息字符串
 */
export async function rebootServer() {
    try {
        // 获取用户会话，确保 token 有效
        const session = await AccountManager.getUserSession();

        const url = '/api/server_reboot';
        const options = {
            method: 'POST',
            credentials: 'include'
        };
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP 请求失败，状态码: ${response.status}`);
        }
        return '服务重启请求已发送';
    } catch (error) {
        console.error('网络请求出错:', error);
        throw error;
    }
}




/**
 * 获取系统的多项指标，包括网络速度、CPU 使用率、内存使用率、系统运行时间和网速统计数据。
 * 仅管理员用户有权限调用。
 * @returns {Promise<Object>} 包含多项系统指标的对象
 */
export async function getSystemInfo() {
    try {
        // 获取用户会话，确保 token 有效
        const session = await AccountManager.getUserSession();

        const url = '/api/get_system_info';
        const options = {
            credentials: 'include'
        };
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP 请求失败，状态码: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('网络请求出错:', error);
        throw error;
    }
}

export function connectToLogWebSocket(onMessage, onClose) {
    try{
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${window.location.host}/api/ws_log`;
        const ws = new WebSocket(url);
    
        ws.onmessage = (event) => {
            onMessage(event.data);
        };
    
        ws.onclose = () => {
            if (onClose) {
                onClose();
            }
        };
        
        return ws;
    }
    catch(e) {
        console.log(e);
    }

}



export async function get_server_config() {
    try {
        // 获取用户会话，确保 token 有效
        const session = await AccountManager.getUserSession();

        const url = '/api/get_server_config';
        const options = {
            credentials: 'include'
        };
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP 请求失败，状态码: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('网络请求出错:', error);
        throw error;
    }
}

export async function update_server_config(configData) {
    try {
        // 获取用户会话，确保 token 有效
        const session = await AccountManager.getUserSession();

        const url = '/api/update_server_config';
        const options = {
            method: 'POST',
            credentials: 'include',
            body: JSON.stringify(configData)
        };
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP 请求失败，状态码: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('网络请求出错:', error);
        throw error;
    }
}


export async function start_server(server_info) {
    try {
        // 获取用户会话，确保 token 有效
        const session = await AccountManager.getUserSession();

        const url = '/api/start_server';
        const options = {
            method: 'POST',
            credentials: 'include',
            body: JSON.stringify(server_info)
        }
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP 请求失败，状态码: ${response.status}`);
        }
        return await response.json();
    }
    catch (error) {
        console.error('网络请求出错:', error);
        throw error;
    }
}

export async function stop_server(server_info) {
    try {
        // 获取用户会话，确保 token 有效
        const session = await AccountManager.getUserSession();

        const url = '/api/stop_server';
        const options = {
            method: 'POST',
            credentials: 'include',
            body: JSON.stringify(server_info)
        }
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP 请求失败，状态码: ${response.status}`);
        }
        return await response.json();
    }
    catch (error) {
        console.error('网络请求出错:', error);
        throw error;
    }
}