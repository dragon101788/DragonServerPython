#chatroom.py
import os
import json
from fastapi import APIRouter, HTTPException, Depends, FastAPI, WebSocket, WebSocketDisconnect
from fastapi.security import OAuth2PasswordBearer
from fastapi import  HTTPException, status
from fastapi import APIRouter,Request, HTTPException, Depends, FastAPI, File, UploadFile
from fastapi.staticfiles import StaticFiles
import fastapi
from pydantic import BaseModel
from urllib.parse import parse_qs
import jwt
import timestamp
import textwrap
import os
import asyncio
import src.account as account
import requests
from fastapi.responses import JSONResponse, StreamingResponse
import Resource
import ChatAI
import time
import io
from fastapi.responses import FileResponse
from PIL import Image
import src.config as config


api_config = config.PythonConfig("config/chatAPI.py",default_config={
    "apiBase": "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    "apiKey": "5d3230ea-6b77-42cf-bc0b-2a686fcba565",
    "model": "doubao-1-5-pro-256k-250115"
})
group_profile = config.PythonConfig("config/group_profile.py",default_config={
    "password": "default_group",
    "nickname": "default_group",
    "description": "我是一个群组",
    "type": "group",
    "WebSession" : "/chatroom/GroupSessionWeb.html"
});

# 创建路由器
chatroom_app = FastAPI()


# 定义消息历史记录目录
MESSAGE_HISTORY_DIR = "MessageHistory"



# 存储在线用户的 fastapi.WebSocket 连接
active_connections: dict[str, fastapi.WebSocket] = {}





@chatroom_app.websocket("/websocket/{client_id}")
async def websocket_endpoint(websocket: fastapi.WebSocket, client_id: str):
    try:
        print(f"收到 websocket 连接请求: client_id={client_id}")

        # 从 WebSocket URL 中获取 token
        query_string = websocket.scope.get('query_string', b'').decode()
        print(f"Query string: {query_string}")
        

        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]

        if not token:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # 验证 token 并获取用户名
        try:
            payload = await account.verfiy_by_token(token)
            username = payload.get("username")

            # 验证 client_id 是否匹配 token 中的用户名
            if not username or username != client_id:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
        except jwt.ExpiredSignatureError:
            print("Token has expired")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION,reason="Token has expired")
            return
        except jwt.InvalidTokenError as e:
            print(f"Invalid token: {e}")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION,reason=f"Invalid token: {e}")
            return
        except jwt.PyJWTError as e:
            print(f"JWT error: {e}")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION,reason=f"JWT token: {e}")
            return



        if active_connections.get(client_id) :
            wws = active_connections.get(client_id)
            await wws.send_text(json.dumps({"callback": "logout","reason":"用户在其他终端登录"}))
            #await wws.close(code=status.WS_1006_ABNORMAL_CLOSURE,reason=f"用户在其他终端登录")
        # 接受 WebSocket 连接
        await websocket.accept()
        active_connections[client_id] = websocket
        print("客户端[%s]连接"%(client_id));
        try:
            while True:
                #这边是前端js通过websocket发送的数据接收的地方
                data = await websocket.receive_text()
                message_data = json.loads(data)
                print("websocket recv %s"%data)
                receiver = message_data.get("receiver")
                if receiver in active_connections:
                    await active_connections[receiver].send_text(data)
        except WebSocketDisconnect as e:
            print("客户端[%s]断开"%(client_id));
            del active_connections[client_id];
        except Exception as e:
            print(f"Error in websocket: {str(e)}")

    except Exception as e:
        print(f"Error in websocket connection: {str(e)}")
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        del active_connections[client_id];



def generate_session_id(sender: str, receiver: str) -> str:
    """
    生成发送者和接收者之间的会话 ID。
    该会话 ID 由发送者和接收者的用户名按字典序排序后连接而成。

    :param sender: 发送者的用户名
    :param receiver: 接收者的用户名
    :return: 会话 ID
    """
    sorted_names = sorted([sender, receiver])
    return f"{sorted_names[0]}_{sorted_names[1]}"

async def all_user_flush_cache(username: str):
    if username in active_connections:
        await active_connections[username].send_text(json.dumps({"callback": "remove-cached", "cached":f"{username}/"}));
        await active_connections[username].send_text(json.dumps({"callback": "flush"}));
    
    ContactList = load_contact_list(username)
    for Contact in ContactList:
        profile = account.get_profile(Contact);
        sesseion_type = profile.get("type","user");
        if sesseion_type == "user":
            if Contact in active_connections:
                await active_connections[Contact].send_text(json.dumps({"callback": "remove-cached", "cached":f"{username}/"}));
                await active_connections[Contact].send_text(json.dumps({"callback": "flush"}));
        else:
            for item in load_contact_list(Contact):
                if item in active_connections:
                    await active_connections[item].send_text(json.dumps({"callback": "remove-cached", "cached":f"{username}/"}));
                    await active_connections[item].send_text(json.dumps({"callback": "flush"}));
@chatroom_app.post("/api/all_user_flush_cache")
async def api_all_user_flush_cache(request :Request, data: dict):
    await account.verfiy_by_request(request);
    if "username" in data:
        request.username = data["username"];
    username = request.username;
    try:
        await all_user_flush_cache(username);
        return {"message": "更新成功"}
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"无法更新用户资料:{e}")
# 添加好友接口
@chatroom_app.post("/api/add_Contact")
async def add_Contact(request :Request, data: dict = None):
    await account.verfiy_by_request(request)
    username = request.username
    Contact_username = data.get("Contact_username")
    if not Contact_username:
        raise HTTPException(status_code=400, detail="好友用户名不能为空")

    if username == Contact_username:
        raise HTTPException(status_code=400, detail="不能添加自己为好友")
    
    # 检查好友是否存在
    Contact_dir = os.path.join(account.ACCOUNT_DIR, Contact_username)
    if not os.path.exists(Contact_dir):
        raise HTTPException(status_code=404, detail="好友不存在")

    # 构建用户好友列表文件路径
    # 读取用户的好友列表
    try:
        user_Contact_list = load_contact_list(username)
        contact_Contact_list = load_contact_list(Contact_username)
        # 检查好友是否已经在列表中
        if Contact_username in user_Contact_list:
            raise HTTPException(status_code=409, detail="该好友已在列表中")
        if username in contact_Contact_list:
            raise HTTPException(status_code=409, detail="你已经在对方的好友列表中")
        
        # 添加好友到双方列表
        user_Contact_list.append(Contact_username)
        contact_Contact_list.append(username)

        save_contact_list(username,user_Contact_list)
        save_contact_list(Contact_username,contact_Contact_list)
    
        await all_user_flush_cache(username)
    
        return {"message": "添加好友成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取好友列表失败{e}") 

    
# 删除好友接口
@chatroom_app.post("/api/Contact_del")
async def del_Contact(request :Request, data: dict = None):
    await account.verfiy_by_request(request)
    username = request.username
    Contact_username = data.get("username")
    if not Contact_username:
        raise HTTPException(status_code=400, detail="好友用户名不能为空")

    if username == Contact_username:
        raise HTTPException(status_code=400, detail="不能删除自己")

    # 检查好友是否存在
    Contact_dir = os.path.join(account.ACCOUNT_DIR, Contact_username)
    if not os.path.exists(Contact_dir):
        raise HTTPException(status_code=404, detail="好友不存在")

    try:
        # 读取用户的好友列表
        user_Contact_list = load_contact_list(username)
        contact_Contact_list = load_contact_list(Contact_username)

        # 检查好友是否在列表中
        if Contact_username not in user_Contact_list:
            raise HTTPException(status_code=404, detail="该好友不在列表中")
        if username not in contact_Contact_list:
            raise HTTPException(status_code=404, detail="你不在对方的好友列表中")

        # 从双方列表中删除好友
        user_Contact_list.remove(Contact_username)
        contact_Contact_list.remove(username)

        # 保存更新后的好友列表
        save_contact_list(username, user_Contact_list)
        save_contact_list(Contact_username, contact_Contact_list)

        await all_user_flush_cache(username)

        return {"message": "删除好友成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除好友失败: {e}")


def load_contact_list(username):
    # 构建用户好友列表文件路径
    contact_path = os.path.join(account.ACCOUNT_DIR, username, "Contacts.json")
    if os.path.exists(contact_path):
        with open(contact_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    else:
        return [];

def getWebSession(username):
    # 从文件读取tab_html内容
    contact_path = os.path.join(account.ACCOUNT_DIR, username, "SessionWeb.html")
    if os.path.exists(contact_path):
        with open(contact_path, "r", encoding="utf-8") as f:
                return textwrap.dedent(f.read())
    else:
        try:
            with open(os.path.join(Resource.path.chatroom, "NormalSessionWeb.html" ), "r", encoding="utf-8") as f:
                return textwrap.dedent(f.read())
        except FileNotFoundError:
            return None
    
def save_contact_list(username,Contact_list):
    # 构建用户好友列表文件路径
    contact_path = os.path.join(account.ACCOUNT_DIR, username, "Contacts.json")
    with open(contact_path, 'w', encoding='utf-8') as f:
        json.dump(Contact_list, f, ensure_ascii=False);

# 获取好友列表接口
@chatroom_app.get("/api/Contact_list")
async def api_get_Contact_list(request :Request, username: str = None):
    await account.verfiy_by_request(request)
    # 如果未传入username，则使用request中的username
    if not username:
        username = request.username
    # 读取用户的好友列表
    try:
        return load_contact_list(username)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取好友列表失败{e}")

    


def generate_messages(content: str, sender: str, receiver: str):
    # 生成当前用户的消息

    
    messages = []

    receiver_data = account.get_profile(receiver)
    messages.append ({
        "role": "system",
        "content": """
            你的名字是(%s)
            你的自我介绍是(%s) 
            """%(
                receiver_data.get("nickname", "智能聊天机器人"),
                receiver_data.get("description", "通用人工智能服务")
            )
    })

    
    
    sender_data = account.get_profile(sender)
    messages.append ({
        "role": "system",
        "content": """
            与你聊天的人也就是我，
            我的名字是(%s)
            我的自我介绍是(%s)
        """%(
            sender_data.get("nickname", "一个普通人类"),
            sender_data.get("description", "懒惰的人类")
            )
    })
           

    # 构建消息目录路径
    conversation_id = generate_session_id(sender, receiver)
    message_dir = os.path.join(MESSAGE_HISTORY_DIR, conversation_id, "messages")

    # 检查消息目录是否存在
    if os.path.exists(message_dir):
        # 获取所有消息文件
        message_files = os.listdir(message_dir)

        # 按时间戳排序
        message_files.sort()

        # 读取消息历史记录
        for file in message_files:
            file_path = os.path.join(message_dir, file)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    message_data = json.load(f)
                    content = ""
                    if message_data["sender"] == sender:
                        role = "user"  
                        #content = "%s:%s"%(sender_data.get("nickname","我"),message_data["content"])
                        content = message_data["content"]
                    else:
                        role = "assistant"
                        #content = "%s:%s"%(receiver_data.get("nickname","人工智能"),message_data["content"])
                        content = message_data["content"]
                    history_message = {
                        "role": role,
                        "content": content
                    }
                    messages.append( history_message)
            except Exception as e:
                print(f"Error : {e}")
                continue
                continue
            
    receiver_system_prompt = receiver_data.get("system_prompt",{})
    for item in receiver_system_prompt:
        pos = item.get('pos',0);
        msg = {
            "role": item.get('role',"system"),
            "content": item.get('content',"")
        }
        messages.insert(pos,msg)
    return messages



async def revert_offline_messages(content :str ,username :str ,chatdata :dict,times_tamp = None):
    # 定义 DeepSeek API 的相关信息
    # API_BASE = "https://api.deepseek.com/v1/chat/completions"
    # API_KEY = "YOUR_DEEPSEEK_API_KEY"
    # MODEL = "deepseek-chat"
   
    if not times_tamp:
        times_tamp = timestamp.generate()

    current_user_profile = account.get_profile(username)
    message_data = {
        "callback": "chat-session-message",
        "session_id": generate_session_id(username,chatdata.get("username")),
        "sender": chatdata.get("username"),
        "receiver": username,
        "content": "",
        "timestamp": times_tamp
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_config.apiKey}",
    }
    payload = {
        "messages": generate_messages(content,username,chatdata.get("username")),
        "model": api_config.model,
        "stream": True
    }

    try:
        response = requests.post(api_config.apiBase, headers=headers, json=payload, stream=True)
        report_content = ""
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith('data: '):
                    data_str = line_str[6:]
                    if data_str == "[DONE]":
                        save_message(report_content,message_data["sender"],current_user_profile,times_tamp)
                        break
                    data_str = json.loads(data_str)
                    report_content += data_str["choices"][0]["delta"]["content"]
                    message_data["content"] = report_content;
                    await active_connections[message_data["receiver"]].send_text(json.dumps(message_data))
                    #print(f"B data: {report_content}\n\n") 
                    await asyncio.sleep(0)  #代码会在每次发送消息后立即让出控制权给事件循环，让其他协程有机会执行。
        
    except Exception as e:
        error_data = json.dumps({"error": str(e)})
        print(f"send_offline_messages error: {error_data}\n\n") 

async def send_online_messages( content: dict,username : str,chatdata :dict ,time_stamp = None):
    if not time_stamp:
        time_stamp = timestamp.generate()

    message_data = {
        "callback": "chat-session-message",
        "session_id": generate_session_id(username,chatdata.get("username")),
        "sender": username,
        "receiver": chatdata.get("username"),
        "content": content,
        "timestamp": time_stamp
    }
    await active_connections[message_data["receiver"]].send_text(json.dumps(message_data))

async def send_group_messages( content: dict,username : str,group_name :str,sendsocket  ,time_stamp = None):
    if not time_stamp:
        time_stamp = timestamp.generate()

    message_data = {
        "callback": "chat-session-message",
        "session_id": group_name,
        "sender": username,
        "receiver": group_name,
        "content": content,
        "timestamp": time_stamp
    }
    await sendsocket.send_text(json.dumps(message_data))

async def local_echo_message(content: str,username:str,chatdata:str,time_stamp = None):
    if not time_stamp:
        time_stamp = timestamp.generate()
     # 构建消息数据
    message_data = {
        "callback": "chat-session-message",
        "session_id": generate_session_id(username,chatdata.get("username")),
        "sender": username,
        "receiver": chatdata.get("username"),
        "content": content,
        "timestamp": time_stamp
    }
    await active_connections[message_data["sender"]].send_text(json.dumps(message_data))
# 发送消息接口
@chatroom_app.post("/api/send_message")
async def send_message(request :Request, data: dict):
    await account.verfiy_by_request(request)
    username = request.username
    chatdata = data.get("chatdata")
    if not chatdata:
        raise HTTPException(status_code=400, detail="chatdata不能为空")
    
    content = data.get("content")
    if not content:
        raise HTTPException(status_code=400, detail="content不能为空")
    
    time_stamp = timestamp.generate()
    receiver = chatdata.get("username")
    session_type = chatdata.get("type","user")

    receiver_dir = os.path.join(account.ACCOUNT_DIR, receiver)
    if not os.path.exists(receiver_dir):
        raise HTTPException(status_code=404, detail="接收者不存在")
    
    save_message(content,username,chatdata,time_stamp)
    
    if session_type == "user":
        await local_echo_message(content,username,chatdata,time_stamp)
        ###如果接收者在线，通过 WebSocket 发送消息
        if receiver in active_connections:
            asyncio.create_task(send_online_messages(content,username,chatdata,time_stamp))
        else:
            asyncio.create_task(revert_offline_messages(content,username,chatdata))
    elif session_type == "group":
        for Contact in load_contact_list(receiver):
            if Contact in active_connections:
                asyncio.create_task( send_group_messages(content,username,receiver,active_connections[Contact],time_stamp))

    return {"message": "消息发送成功" , "timestamp" :time_stamp}

    

# 生成会话 ID 的函数


def save_message(content: str, sender: str, chatdata: dict, time_stamp = None):
    if not time_stamp:
        time_stamp = timestamp.generate()

    receiver = chatdata.get("username")
    recviver_type = chatdata.get("type","user");
    # 构建消息数据
    message_data = {
        "sender": sender,
        "receiver": receiver,
        "content": content,
        "timestamp": time_stamp
    }

    save_dir = ""
    if recviver_type == "user":
        save_dir = generate_session_id(sender, receiver)
    elif recviver_type == "group":
        save_dir = receiver
        
    message_dir = os.path.join(MESSAGE_HISTORY_DIR, save_dir, "messages")
    if not os.path.exists(message_dir):
        os.makedirs(message_dir)
    message_file = os.path.join(message_dir, f"{time_stamp}.json")

    # 保存消息到中心化目录
    try:
        with open(message_file, 'w', encoding='utf-8') as f:
            json.dump(message_data, f,ensure_ascii=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存消息失败: {str(e)}")

    return {"message": "消息历史记录添加成功"}
# 获取消息历史记录接口
@chatroom_app.get("/api/message_history")
async def get_message_history(request :Request, receiver: str, start = None, end = None):
    await account.verfiy_by_request(request)
    try:
        sender = request.username

        profile = account.get_profile(receiver)
        session_type = profile.get("type","user")
        session_path = ""
        if session_type == "user":
            session_path = generate_session_id(sender, receiver)
        elif session_type == "group":
            session_path = receiver
        
        message_dir = os.path.join(MESSAGE_HISTORY_DIR, session_path, "messages")
        if not os.path.exists(message_dir):
            return []

        # 获取所有消息文件
        message_files = os.listdir(message_dir)

        messages = []
        for file in message_files:
            # 直接从文件名中提取时间戳
            timestamp_str = file.split('.')[0]  # 去掉.json后缀

            # 比较时间戳
            if (start is None or timestamp_str > start) and \
            (end is None or timestamp_str <= end):
                file_path = os.path.join(message_dir, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        message_data = json.load(f)
                        messages.append(message_data)
                except Exception as e:
                    continue

        # 按时间戳排序
        messages.sort(key=lambda x: x["timestamp"])
        return messages
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取消息历史记录失败: {str(e)}")

@chatroom_app.post("/api/clear_history")
async def clear_message_history(request :Request, data: dict):
    await account.verfiy_by_request(request)
    sender = request.username
    receiver = data.get("receiver")
    if not receiver:
        raise HTTPException(status_code=400, detail="receiver不能为空")

    # 构建消息目录路径
    conversation_id = generate_session_id(sender, receiver)
    message_dir = os.path.join(MESSAGE_HISTORY_DIR, conversation_id, "messages")

    if os.path.exists(message_dir):
        try:
            # 删除消息目录下的所有文件
            for file in os.listdir(message_dir):
                file_path = os.path.join(message_dir, file)
                if os.path.isfile(file_path):
                    os.remove(file_path)
            return {"message": "消息历史记录已清除"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"清除消息历史记录失败: {str(e)}")
    else:
        return {"message": "消息历史记录不存在，无需清除"}

    
@chatroom_app.post("/api/create_group")
async def api_create_group(request :Request,data : dict):
    await account.verfiy_by_request(request)
    username = request.username
    # 生成随机的群聊名称
    group_name = "group_" + timestamp.generate()

    nickname = data.get("nickname")
    members = data.get("members")

    # 检查成员是否都存在
    for member in members:
        member_dir = os.path.join(account.ACCOUNT_DIR, member)
        if not os.path.exists(member_dir):
            raise HTTPException(status_code=404, detail=f"成员 {member} 不存在")

    # 构建用户目录路径
    group_dir = os.path.join(account.ACCOUNT_DIR, group_name)

    # 检查用户目录是否已存在
    if os.path.exists(group_dir):
        raise HTTPException(status_code=409, detail="用户名已存在")

    # 创建用户目录
    os.makedirs(group_dir)

    # 构建账户信息文件路径
    account_file = os.path.join(group_dir, "profile.json")

    account_info = group_profile.instance()
    account_info["nickname"] = nickname
    account_info["admin"] = username
    with open(account_file, 'w', encoding='utf-8') as f:
        json.dump(account_info, f, ensure_ascii=False)

    contact_file = os.path.join(group_dir, "Contacts.json")
    with open(contact_file, 'w', encoding='utf-8') as f:
        json.dump(members, f, ensure_ascii=False)

    # 为每个成员添加群组到联系人列表
    for member in members:
        member_contacts = load_contact_list(member)
        if group_name not in member_contacts:
            member_contacts.append(group_name)
            save_contact_list(member, member_contacts)

    await all_user_flush_cache(group_name)
    return {"message": "成功创建群" , "group_name" :group_name}

@chatroom_app.post("/api/group_kick")
async def api_group_kick(request:Request,data: dict):
    await account.verfiy_by_request(request)
    username = request.username
    group_name = data.get("group_name")
    member_to_kick = data.get("member")

    if not group_name or not member_to_kick:
        raise HTTPException(status_code=400, detail="群组名称和成员名称不能为空")

    # 获取群组信息
    group_profile = account.get_profile(group_name)
    if not group_profile or group_profile.get("type") != "group":
        raise HTTPException(status_code=404, detail="群组不存在")

    # 检查调用者是否是管理员
    if group_profile.get("admin") != username:
        raise HTTPException(status_code=403, detail="只有管理员可以踢出成员")

    # 获取群组成员列表
    group_members = load_contact_list(group_name)
    if member_to_kick not in group_members:
        raise HTTPException(status_code=404, detail="该成员不在群组中")

    # 从群组中移除成员
    group_members.remove(member_to_kick)
    save_contact_list(group_name, group_members)

    # 从成员的联系人列表中移除群组
    member_contacts = load_contact_list(member_to_kick)
    if group_name in member_contacts:
        member_contacts.remove(group_name)
        save_contact_list(member_to_kick, member_contacts)

    await all_user_flush_cache(group_name)

    return {"message": "成员已成功踢出"}

@chatroom_app.post("/api/group_add")
async def api_group_add(request :Request,data: dict):
    await account.verfiy_by_request(request)
    username = request.username
    group_name = data.get("group_name")
    member_to_add = data.get("member")

    if not group_name or not member_to_add:
        raise HTTPException(status_code=400, detail="群组名称和成员名称不能为空")

    # 获取群组信息
    group_profile = account.get_profile(group_name)
    if not group_profile or group_profile.get("type") != "group":
        raise HTTPException(status_code=404, detail="群组不存在")

    # 检查调用者是否是管理员
    if group_profile.get("admin") != username:
        raise HTTPException(status_code=403, detail="只有管理员可以添加成员")

    # 检查要添加的用户是否存在
    member_dir = os.path.join(account.ACCOUNT_DIR, member_to_add)
    if not os.path.exists(member_dir):
        raise HTTPException(status_code=404, detail="要添加的用户不存在")

    # 获取群组成员列表
    group_members = load_contact_list(group_name)
    if member_to_add in group_members:
        raise HTTPException(status_code=409, detail="该用户已在群组中")

    # 将用户添加到群组
    group_members.append(member_to_add)
    save_contact_list(group_name, group_members)

    # 将群组添加到用户的联系人列表
    member_contacts = load_contact_list(member_to_add)
    if group_name not in member_contacts:
        member_contacts.append(group_name)
        save_contact_list(member_to_add, member_contacts)

    await all_user_flush_cache(group_name)

    return {"message": "用户已成功添加到群组"}





@chatroom_app.get("/index.html")
async def get_chatroom_page():
    return FileResponse(os.path.join(Resource.path.chatroom,"index.html"))


chatroom_app.mount("/", StaticFiles(directory=Resource.path.chatroom))