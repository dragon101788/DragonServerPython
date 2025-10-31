// SocketServer.js
import { AccountManager } from '/AccountManager.js';
import { cacheManager } from '/cacheManager.js';


function generateTimestamp(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(6, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}`;
}
export { generateTimestamp }

function generateSessionId(sender, receiver) {
    const sortedNames = [sender, receiver].sort();
    return `${sortedNames[0]}_${sortedNames[1]}`;
}
export { generateSessionId }

class SocketServer {
    constructor(username, token) {
        this.username = username;
        this.token = token;
        this.ws = null;
        this.regrecv_tab = new Map(); // 存储所有聊天组件
        this.callback_tab = new Map(); // 存储所有聊天组件
        this.initWebSocket();

    }

    addCallbackListener(name, handler) {
        this.callback_tab.set(name, handler);
    }
    // 初始化 WebSocket 连接
    initWebSocket() {
        this.ws = new WebSocket(`/chatroom/websocket/${this.username}`);
        // 处理 WebSocket 消息


        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const callback = this.callback_tab.get(data.callback);
                if (typeof callback === 'function') {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error('执行回调函数时发生错误:', error);
                    }
                }
                else {
                    console.error('未找到回调函数:', data.callback);
                }
            }
            catch (error) {
                console.error('解析 JSON 数据时发生错误:', error);

            }

        };

        this.ws.onerror = (event) => {
            console.error('WebSocket 发生错误:', event);
            console.error('事件类型:', event.type);
            console.error('事件目标:', event.target);

            accountManager.switchToLogin();
        };

        // 处理 WebSocket 连接关闭
        this.ws.onclose = (event) => {
            console.log('WebSocket 连接已关闭:', event.code, event.reason);

            accountManager.switchToLogin();
        };

        // 连接成功时的处理
        this.ws.onopen = () => {
            console.log('WebSocket 连接成功');
        };
    }

    // 关闭 WebSocket 连接
    close() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

export { SocketServer };

async function getHistoryMessageCache(username, contact) {
    return await cacheManager.getCache(`${username}/message_history/${contact}/`);
}
export { getHistoryMessageCache };

async function setHistoryMessageCache(username, contact, message) {
    cacheManager.setCache(`${username}/message_history/${contact}/${message.timestamp}`, message);
}
export { setHistoryMessageCache };

async function setHistoryMessageCaches(username, contact, messages) {
    messages.forEach(message => {
        setHistoryMessageCache(username, contact, message);
    });
}
export { setHistoryMessageCaches };

async function clearHistoryMessageCaches(username) {
    return await cacheManager.removeCache(`${username}/message_history/`);
}
export { clearHistoryMessageCaches };

async function loadMessageHistory(username, startTime = null, endTime = null) {
    if (!username) return null;
    await get_profile(username).then(profile => {
        console.log(`刷新${profile.nickname}缓存`)
    })
    try {
        // 使用ISO格式时间字符串
        //先从cache取
        const session = AccountManager.getUserSession();
        const cachedmessage = await getHistoryMessageCache(session.username, username);

        //获取message中最后一条的时间戳
        let last_message_timestamp = 0;
        if (cachedmessage.length > 0) {
            last_message_timestamp = cachedmessage[cachedmessage.length - 1].timestamp;
        }


        //默认拉取从最后一条消息开始的历史消息
        const start_timestamp = startTime ? generateTimestamp(startTime) : last_message_timestamp;
        const end_timestamp = endTime ? generateTimestamp(endTime) : generateTimestamp(new Date());

        const response = await fetch(`/chatroom/api/message_history?receiver=${username}&start=${start_timestamp}&end=${end_timestamp}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                
                'Content-Type': 'application/json'
            }
        });
        if (response.ok) {
            //成功之后保存到cache
            const historymessage = await response.json();
            setHistoryMessageCaches(session.username, username, historymessage);

            //返回cachedmessage+history总和
            return [...cachedmessage, ...historymessage];
        }
    }
    catch (error) {
        console.error('Error fetching message history:', error);
        throw error;
    }
}
export { loadMessageHistory };

async function clearHissory(sender, receiver) {
    try {//@chatroom_app.post("/api/clear_history")
        const response = await fetch(`/chatroom/api/clear_history`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                
            },
            body: JSON.stringify({
                sender: sender,
                receiver: receiver,
            })
        });
        if (response.ok) {
            console.log('历史消息已清除');
        }
    }
    catch (error) {
        console.error('清除历史消息失败：', error);
    }
}
export { clearHissory };

async function sendMessage(session_id, content, contact) {
    try {
        if (!content) return;
        const response = await fetch('/chatroom/api/send_message', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                
            },
            body: JSON.stringify({
                chatSelector: session_id,
                chatdata: contact,
                content: content
            })
        });


        if (response.ok) {
            return await response.json();
        }
    }
    catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }

}
export { sendMessage };

// 获取用户资料（带缓存）
async function get_profile(username) {
    if (!username) {
        throw new Error('username 是必填参数');
    }

    // 用户资料缓存路径
    const profileCachePath = `${username}/profile`;

    // 先检查缓存
    const cachedProfile = await cacheManager.getCache(profileCachePath);
    if (cachedProfile) {
        return cachedProfile;
    }

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

        // 缓存用户资料
        await cacheManager.setCache(profileCachePath, data);

        return data;
    } catch (error) {
        console.error('获取用户资料失败：', error);
        throw error;
    }
}
export { get_profile };


async function all_user_flush_cache(username = null) {

    try {

        const session = await AccountManager.getUserSession();;
        if (!username) {
            username = session.username;
        }
        const response = await fetch('/chatroom/api/all_user_flush_cache', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'username': username,
                'Content-Type': 'application/json',
                
            }
        });

        if (response.ok) {
            // 清除用户资料缓存
            const profileCachePath = `${username}/profile`;
            await cacheManager.removeCache(profileCachePath);

            return await response.json();
        } else {
            const data = await response.json();
            throw (`保存失败 ${data.detail}`);
        }
    } catch (error) {
        console.error('保存个人信息失败：', error);
        throw error;
    }
}
export { all_user_flush_cache };

async function saveProfile(profileData, username = null) {

    try {

        const session = await AccountManager.getUserSession();;
        if (!username) {

            username = session.username;
        }
        const response = await fetch('/api/update_profile', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'username': username,
                'Content-Type': 'application/json',
                
            },
            body: JSON.stringify(profileData)
        });

        if (response.ok) {
            // 清除用户资料缓存
            const profileCachePath = `${username}/profile`;
            await cacheManager.removeCache(profileCachePath);

            return await response.json();
        } else {
            const data = await response.json();
            throw (`保存失败 ${data.detail}`);
        }
    } catch (error) {
        console.error('保存个人信息失败：', error);
        throw error;
    }
}
export { saveProfile };

async function changePassword(newPassword, username = null) {

    try {

        const session = await AccountManager.getUserSession();
        if (!username) {
            username = session.username;
        }
        const response = await fetch('/api/change_password', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'username': username,
                'Content-Type': 'application/json',
                
            },
            body: JSON.stringify({
                new_password: newPassword,
            })
        });

        if (response.ok) {
            return await response.json();
        } else {
            const data = await response.json();
            throw (`修改密码失败 ${data.detail}`);
        }
    } catch (error) {
        console.error('修改密码失败：', error);
        throw error;
    }
}
export { changePassword };


async function uploadAvatar(file, username = null) {
    const formData = new FormData();
    formData.append('avatar', file);

    try {

        const session = await AccountManager.getUserSession();;
        if (!username) {
            username = await session.username;;
        }
        const response = await fetch('/api/upload_avatar', {
            method: 'POST',
            credentials: 'include',
            headers: {
                
                'username': username,
            },
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            const avatarCachePath = `${username}/avatar`;
            await cacheManager.removeCache(avatarCachePath);
            return data;

        }
        else {
            const data = await response.json();
            throw (`上传头像失败 ${data.detail}`);
        }

    } catch (error) {
        console.error('上传头像失败：', error);
        throw ('上传头像失败');
    }
}
export { uploadAvatar };

async function _blobToBase64(blob) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            resolve(reader.result);
        };
        reader.readAsDataURL(blob);
    });
}
export { _blobToBase64 };
async function _base64ToBlob(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: 'image/png' });
}
export { _base64ToBlob };
async function getAvatar(username) {
    const avatarCachePath = `${username}/avatar`;
    const cachedAvatarDataURL = await cacheManager.getCache(avatarCachePath);
    if (cachedAvatarDataURL) {
        return cachedAvatarDataURL;
    }

    try {
        const response = await fetch(`/api/get_avatar/${username}`, {
            method: 'GET',
            credentials: 'include',
        })

        if (response.ok) {
            if (response.status === 200) {
                let blob = await response.blob();
                const dataURL = await _blobToBase64(blob);
                await cacheManager.setCache(avatarCachePath, dataURL);
                return dataURL;
            }
            else {
                throw (`获取头像失败 ${response.status} ${response.statusText} ${response.reason}`);
            }
        } else {
            const data = await response;
            throw data;
        }
    } catch (error) {
        throw error;
    }
}
export { getAvatar };


async function loadContacts(username = null) {
    try {

        const session = await AccountManager.getUserSession()
        if (!username) {
            username = session.username;;
        }
        const response = await fetch(`/chatroom/api/Contact_list?username=${username}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            return await response.json();
        }
        else {
            const data = await response.json();
            throw (`加载联系人列表失败 ${data.detail}`);

        }
    } catch (error) {
        console.error('加载联系人列表失败：', error);
        throw error;
    }
}
export { loadContacts };

async function delContact(username) {
    try {
        const response = await fetch('/chatroom/api/Contact_del', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                
            },
            body: JSON.stringify({ username: username })
        })
        if (response.ok) {
            return await response.json();
        }
        else {
            const data = await response.json();
            throw (`删除联系人失败 ${data.detail}`);
        }
    }
    catch (error) {
        console.error('删除联系人失败：', error);
        throw error;
    }
}
export { delContact };

async function addContact(username) {

    try {
        const response = await fetch('/chatroom/api/add_Contact', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                
            },
            body: JSON.stringify({ Contact_username: username })
        });

        if (response.ok) {
            return await response.json();
        } else {
            const data = await response.json();
            throw data.detail;
        }
    } catch (error) {
        throw (`添加联系人失败 ${error}`)
    }
}
export { addContact };

async function fetchTextFromUrl(path, method = "GET") {
    try {
        const response = await fetch(path, {
            method: method,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                
            }
        });
        if (response.ok) {
            return await response.text();
        }
        else {
            throw (`获取页面失败 ${response.status}`);
        }
    }
    catch (error) {
        const data = await response.json();
        throw data.detail;
    }
}
export { fetchTextFromUrl };


async function createGroup(nickname, members) {


    try {
        const response = await fetch('/chatroom/api/create_group', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                
            },
            body: JSON.stringify({
                nickname: nickname,
                members: members
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('群组创建成功:', result);
    } catch (error) {
        console.error('创建群组时出错:', error);
    }
}
export { createGroup };

async function kickGroupMember(groupName, memberToKick) {
    try {

        // 发送请求到服务器
        const response = await fetch('/chatroom/api/group_kick', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                
            },
            body: JSON.stringify({
                group_name: groupName,
                member: memberToKick
            })
        });

        // 处理响应
        if (response.ok) {
            return await response.json();
        } else {
            throw await response.json();
        }
    } catch (error) {
        console.error('踢出成员时发生错误:', error);
        alert('踢出成员时发生错误，请检查控制台');
    }
}
export { kickGroupMember }

async function addGroupMember(groupName, memberToAdd) {
    try {
        // 发送请求到服务器
        const response = await fetch('/chatroom/api/group_add', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                
            },
            body: JSON.stringify({
                group_name: groupName,
                member: memberToAdd
            })
        });

        // 处理响应
        if (response.ok) {
            return await response.json();
        } else {
            throw await response.json();
        }
    } catch (error) {
        console.error('添加成员时发生错误:', error);
        alert('添加成员时发生错误，请检查控制台');
    }
}
export { addGroupMember }

// 封装 get_user_token API 请求
async function getUserToken(username = null, expires = 60 * 24) {
    try {

        const session = await AccountManager.getUserSession();
        if (!username) {
            username = session.username;
        }

        // 发起 POST 请求
        const response = await fetch('/api/get-user-token', {
            method: 'POST',
            headers: {
                'username': username,
                'Content-Type': 'application/json',
                
            },
            body: JSON.stringify({
                username: username,
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

export { getUserToken }


async function new_user(username, password = null, nickname = null) {
    try {
        if (!password) {
            password = username;
        }
        if (!nickname) {
            nickname = username;
        }
        const response = await fetch('/api/register', {
            method: 'POST',
            credentials: 'include',
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
            const data = await response.json();
        }
    } catch (error) {
        console.error('注册失败：', error);
        throw error;
    }
}
export { new_user }

async function deleteUser(username) {
    try {
        if (!username) {
            throw new Error('用户名不能为空');
        }
        const response = await fetch('/api/delete_user', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                
            },
            body: JSON.stringify({
                "username": username
            })
        });

        if (response.ok) {
            const data = await response.json();
            const profileCachePath = `${username}/profile`;
            await cacheManager.removeCache(profileCachePath);
            return data;
        } else {
            const errorData = await response.json();
            throw new Error(`删除用户失败: ${errorData.detail}`);
        }
    } catch (error) {
        console.error('删除用户失败：', error);
        throw error;
    }
}
export { deleteUser }