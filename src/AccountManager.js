//AccountManager.js
import { LoginDialog, MessageDialog  } from '/BaseModal.js';
// 修改AccountManager类定义，继承EventTarget
export class AccountManager {
    static token = undefined;  // 用于缓存 token
    static payload = undefined; // 用于缓存解码后的 payload
    static ws_connection = undefined; // 用于缓存 WebSocket 连接
    static ws_recv_callback = {}; // 用于缓存 WebSocket 接收消息的回调函数
    static ws_recv_callback_all = []; // 用于缓存 WebSocket 发送消息的回调函数
    static forbidden = []; // 用于缓存 WebSocket 发送消息的回调函数

    //析构函数,释放资源
    static destructor(){
        
        this.clear_cookie('token');
    }
    
    // 账户相关方法
    static async login(username, password) {
        const response = await fetch('/api/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                "username": username,
                "password": password
            })
        });
        if (response.ok) {
            const data = await response.json();
            return data.access_token;
        } else {
            const data = await response.json();
            return undefined;
        }
    }

    static async register(username, password, nickname) {
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    "username": username,
                    "password": password,
                    "nickname": nickname
                })
            });

            if (response.ok) {
                return true;
            } else {
                const data = await response.json();
                return false;
            }
        } catch (error) {
            MessageDialog.open({ message: '注册失败：' + error });
            return false;
        }
    }
    static async getServerVersion() {
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

    static logout() {
        this.token = null;
        this.payload = null;
        localStorage.removeItem('token');
        this.clear_cookie('token');
    }
    static relogin() {
        this.logout();
        this.getUserSession();
    }


    static async showLoginDialog() {
        return await new Promise((resolve) => {
            LoginDialog.open({ LoginGuest: 'guest' }).addEventListener('login', async (event) => {
                const { username, password } = event.detail;
                //拿到抛出事件的对象
                const dialog = event.target;
                const token = await this.login(username, password);
                if (token !== undefined) {
                    LoginDialog.close();
                    resolve(token);
                } else {
                    MessageDialog.open({ message: '登录失败，请检查用户名和密码' });
                }
            });
        });
    }
    // 封装 get_user_token API 请求
    static async  CreateShareToken(expires = 60 * 24) {
        try {

            // 发起 POST 请求
            const response = await fetch('/api/get-user-token', {
                method: 'POST',
                headers: {
                    'username': this.payload.username,
                    'Content-Type': 'application/json',
                    
                },
                body: JSON.stringify({
                    username: this.payload.username,
                    expires: expires,
                })
            });

            // 检查响应状态
            if (!response.ok) {
                throw new Error(`请求失败，状态码: ${response.status}`);
            }

            // 解析响应数据
            const data = await response.json();
            return data.access_token;
        } catch (error) {
            console.error('获取用户令牌失败:', error);
            throw error;
        }
    }
    static async VerifyByUrlParams(){
        const urlParams = new URLSearchParams(window.location.search);
        if(urlParams.has('token')){
            const token = urlParams.get('token');
            if(await AccountManager.verfiyToken(token)===true){
                AccountManager.verfiy_meth = 'urlParam';
                //localStorage.setItem('token', this.token);
                AccountManager.set_cookie('token', token);
                AccountManager.payload = AccountManager.parseJwt(token);
                AccountManager.token = token;
                console.log(`urlParam token 验证成功，username: ${AccountManager.payload.username}`);
                return token;
            }else{
                MessageDialog.open({ message: 'urlParam token 失效' });
            }
        }
        return undefined;
    }
    static async VerifyByCookie(){
        const token = AccountManager.get_cookie('token');
        if(token !== undefined){
            if(await AccountManager.verfiyToken(token)===true){
                AccountManager.verfiy_meth = 'cookie';
                AccountManager.token = token;
                AccountManager.payload = AccountManager.parseJwt(token);
                console.log(`cookie token 验证成功，username: ${AccountManager.payload.username}`);
                return token;
            }else{
                MessageDialog.open({ message: 'cookie token 失效' });
            }
        }
        return undefined;
    }
    static async VerifyByLocalStorage(){
        if(localStorage.getItem('token') !== null){
            const token = localStorage.getItem('token');
            if(await AccountManager.verfiyToken(token)===true){
                AccountManager.verfiy_meth = 'localStorage';
                AccountManager.token = token;
                AccountManager.set_cookie('token', token);
                AccountManager.payload = AccountManager.parseJwt(token);
                console.log(`localStorage token 验证成功，username: ${AccountManager.payload.username}`);
                return token;
            }else{
                MessageDialog.open({ message: 'localStorage token 失效' });
            }
        }
        return undefined;
    }
    static async VerfiyByUserPassword(){
        const token = await AccountManager.showLoginDialog();
        if(token !== undefined){
            AccountManager.verfiy_meth = 'userPassword';
            localStorage.setItem('token', token);
            AccountManager.set_cookie('token', token);

            AccountManager.token = token;
            AccountManager.payload = AccountManager.parseJwt(token);
            console.log(`userPassword token 验证成功，username: ${AccountManager.payload.username}`);
            return token;
        }
        return undefined;
    }
    static async init() {
        if (AccountManager.connection !== undefined && AccountManager.token !== undefined){
            console.log(`has ready init: ${AccountManager.token}`);
            return AccountManager.token;
        }

        const maths = {
            "urlParam": AccountManager.VerifyByUrlParams,
            "cookie": AccountManager.VerifyByCookie,
            "localStorage": AccountManager.VerifyByLocalStorage,
            "userPassword": AccountManager.VerfiyByUserPassword,
        }
        while(!AccountManager.token){
            for (const [key, value] of Object.entries(maths)){
                if(AccountManager.forbidden.includes(key)){
                    continue;
                }
                const token = await value();
                if(token !== undefined){
                    break;
                }
            }
        }

        await this.connectWebsocket();
        return this.token;
    }
    static async connectWebsocket(){
        if (!this.ws_connection){
            this.ws_connection = new WebSocket(`/api/account_websocket`);
            this.ws_connection.onmessage = async (event) => {
                try{
                    const jsonData = JSON.parse(event.data);
                    if (jsonData.tag!== undefined &&this.ws_recv_callback[jsonData.tag] !== undefined && jsonData.body!== undefined) {
                        try{
                            await this.ws_recv_callback[jsonData.tag](jsonData.body);
                        }catch(e){
                            console.warn(`执行 ${jsonData.tag} 异常${e}`);
                            this.ws_recv_callback[jsonData.tag] = undefined;
                        }
                    }
                }catch(e){
                    if (e instanceof SyntaxError) {
                    }else{
                    }
                }
                for (const callback of this.ws_recv_callback_all) {
                    callback(event.data);
                }
                
            };
            // 监听 WebSocket 连接关闭事件
            this.ws_connection.onclose = (event) => {
                console.log('WebSocket connection closed:', event);
                this.ws_connection = undefined; // 重置 WebSocket 连接
                // 可以在这里添加重连逻辑，例如 setTimeout 后重新连接
            };
            // 监听 WebSocket 连接错误事件
            this.ws_connection.onerror = (error) => {
                console.error('WebSocket connection error:', error);
                this.ws_connection = undefined; // 重置 WebSocket 连接
            };
            // 监听 WebSocket 连接打开事件
            this.ws_connection.onopen = (event) => {
                console.log('WebSocket connection opened:', event);
            };
            
        }
        //等待连接成功
        while (this.ws_connection.readyState !== WebSocket.OPEN) {
            await new Promise(resolve => setTimeout(resolve, 100)); // 等待 100 毫秒
        }
    }
    static register_ws_recv_callback(tag, callback) {
        if (tag === "*"){
            this.ws_recv_callback_all.push(callback);
        }else{
            this.ws_recv_callback[tag] = callback;
        }
    }
    static unregister_ws_recv_callback(tag, callback = undefined) {
        if (tag === "*"){
            this.ws_recv_callback_all.splice(this.ws_recv_callback_all.indexOf(callback), 1);
        }else{
            this.ws_recv_callback[tag] = undefined;
        }
    }
    static async send_ws_message(tag, body = undefined) {
        const jsonData = { tag: tag, body: body };
        await this.send_ws_message_raw(JSON.stringify(jsonData));
    }
    static async send_ws_message_raw(msg) {
        await this.connectWebsocket();
        if (this.ws_connection && this.ws_connection.readyState === WebSocket.OPEN) {
            this.ws_connection.send(msg);
        } else {
            console.error('WebSocket connection is not established.');
        }
    }
    
    // 封装WebSocket请求为Promise，简化调用方式
    static async Fetch(tag, body = {}) {
        return new Promise((resolve, reject) => {
            // 生成唯一的回调ID，避免冲突
            const callbackId = `${tag}_${Date.now()}`;
            
            // 设置超时处理
            const timeoutId = setTimeout(() => {
                this.unregister_ws_recv_callback(callbackId);
                reject(new Error(`WebSocket request ${tag} timed out`));
            }, 120000); 
            
            // 注册临时回调函数
            this.register_ws_recv_callback(callbackId, (message) => {
                clearTimeout(timeoutId);
                this.unregister_ws_recv_callback(callbackId);
                resolve(message);
            });
            
            // 发送消息，使用特殊格式确保服务端知道要回复的callbackId
            this.send_ws_message(tag, {
                ...body,
                callbackId: callbackId
            }).catch(error => {
                clearTimeout(timeoutId);
                this.unregister_ws_recv_callback(callbackId);
                reject(error);
            });
        });
    }

    static async Interact(tag, body = {},callback = undefined) {
        return new Promise((resolve, reject) => {
            // 生成唯一的回调ID，避免冲突
            const callbackId = `${tag}_${Date.now()}`;
            // 注册临时回调函数
            this.register_ws_recv_callback(callbackId, (message) => {
                if (callback) {
                    try{
                        const ret = callback(message);
                        if (ret === "done"){
                            this.unregister_ws_recv_callback(callbackId);
                            resolve(message);
                        }
                    }catch(e){
                        this.unregister_ws_recv_callback(callbackId);
                        reject(e);
                        return;
                    }
                }
            })
            
            // 发送消息，使用特殊格式确保服务端知道要回复的callbackId
            this.send_ws_message(tag, {
                ...body,
                callbackId: callbackId
            }).catch(error => {
                this.unregister_ws_recv_callback(callbackId);
                reject(error);
            });
        });
    }
    static parseJwt(token) {
        //return JSON.parse(atob(this.token.split('.')[1]));
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = JSON.parse(atob(base64));
        return decoded; 
    }
    static async verfiyToken(token) {
        if (!token) {
             return false;
        }
        try {
            const payload = this.parseJwt(token);            
            const expirationTime = payload.exp;
            const currentTime = Math.floor(Date.now() / 1000);

            if (expirationTime < currentTime) {
                return false;
            }

            if(payload.server_version){
                const server_version = await this.getServerVersion();
                if (payload.server_version !== server_version) {
                    return false;
                }
            }

            
            return true;
        } catch (error) {
            console.warn(`解析token异常${error}`);
            return false;
        }
        
    }
    
    static set_cookie(name, value) {
        document.cookie = `${name}=${value}; path=/`;
    }
    static get_cookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }
    static clear_cookie(name) {
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
    static async getUserToken() {
         await this.verifyValidity();
        return this.token;
    }
    static async getToken() {
         await this.verifyValidity();
        return this.token;
    }
    
    static async getUserSession() {
        await this.verifyValidity();
        return this.payload;
    }
    static async getUsername() {
         await this.verifyValidity();
        return this.payload.username;
    }
    static async getExpirationTime() {
         await this.verifyValidity();
        return this.payload.exp;
    }
    // 获取用户资料
    static async get_profile() {
        await this.verifyValidity();
        const username = this.payload.username;


        try {
            // 构建API URL
            const url = `/api/profile/${username}`;

            const response = await fetch(url, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('获取用户资料失败');
            }

            const data = await response.json();


            return data;
        } catch (error) {
            console.error('获取用户资料失败：', error);
            throw error;
        }
    }
    static isInitialized() {
        return (this.token && this.payload && this.ws_connection);
    }
    static async verifyValidity() {
        if (this.forbidden.includes(this.verfiy_meth)) {
            this.token = undefined;
            this.payload = undefined;
            this.ws_connection = undefined;
        }
        if (!this.isInitialized()) {
            await this.init();
        }
    }
}
