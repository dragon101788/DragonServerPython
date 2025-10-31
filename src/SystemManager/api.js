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

export async function getLog() {
    const session = AccountManager.getUserSession();

    const url = '/api/get_log';
    const options = {
        credentials: 'include'
    };
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP 请求失败，状态码: ${response.status}`);
        }
        const data = await response.json();
        return data.log;
    } catch (error) {
        console.error('网络请求出错:', error);
        throw error;
    }
}



/**
 * 获取服务器配置信息，仅超级管理员用户有权限调用。默认配置如下：
{
    "log_level" : 1,   #日志级别，数字越大,日志越详细，默认1
    "SystemMonitorSpeed" : 1, #系统监控速度，单位秒，默认1秒

    "server_list" : [ #服务列表，每个服务都是一个字典
        {
            "type" : "uvicorn",#服务类型uvicorn
            "app" : "WebServer:app",#app的路径，格式为 module:app，例如 WebServer:app，WebServer是模块名，app是应用实例名
            "config" :{   
                "host" : "0.0.0.0",#主机地址，默认0.0.0.0
                "port" : 8443, #端口号，默认8443
                "ssl" : "search_file",#启用ssl证书，search_file是搜索文件，默认不启用
                "backlog" : 100,  #连接队列长度，默认100
            },
        },
        {
            "type" : "uvicorn",#服务类型uvicorn
            "app" : "WebServer:app",
            "config" :{
                "host" : "0.0.0.0",
                "port" : 8800,
                "backlog" : 100,  
            },
        },
        {
            "type" : "uvicorn",#服务类型uvicorn
            "app" : "src.webdav.WebdavService:app",
            "config" :{
                "host" : "0.0.0.0",
                "port" : 8901,
                "ssl" : "search_file",
                "backlog" : 100,
            }, 
        },
        {
            "type" : "uvicorn",#服务类型uvicorn
            "app" : "src.webdav.WebdavService:app",
            "config" :{
                "host" : "0.0.0.0",
                "port" : 8980,
                "backlog" : 100,
            },
        },
        {
            "type" : "Hosted Service",#服务类型Hosted Service 
            "path" : "D:/aaa.exe",
            "cwd"  : None, #工作目录，默认None
            "args" : None, #启动参数，默认None
        }
    ]
}
 */
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

/*
返回值：
[
{
    "type" : "uvicorn",#服务类型uvicorn
    "enabled" : true, #是否启用，true为启用，false为禁用
    "port" : 8443, #端口号，默认8443
    "status" : "Running", #服务状态，Running为运行中，Stopped为已停止
},
{
    "type" : "Hosted Service",#服务类型Hosted Service
    "enabled" : true, #是否启用，true为启用，false为禁用
    "status" : "Running", #服务状态，Running为运行中，Stopped为已停止
    "path" : "D:/aaa.exe", #服务路径，默认None
    "cwd"  : None, #工作目录，默认None
    "args" : None, #启动参数，默认None
}
]
*/
export async function get_server_status() {
    try {
        // 获取用户会话，确保 token 有效
        const session = await AccountManager.getUserSession();

        const url = '/api/get_server_status';
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