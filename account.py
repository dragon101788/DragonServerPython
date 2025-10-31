#account.py
import os
import json
from fastapi import APIRouter,Request , HTTPException, Depends, UploadFile  
from fastapi import APIRouter, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.security import OAuth2PasswordBearer
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
import jwt
import base64
from fastapi.responses import FileResponse, Response
from fastapi import UploadFile, File
from PIL import Image
from datetime import datetime, timedelta
from typing import Optional
import io
import asyncio
from starlette.requests import cookie_parser
import config
import textwrap
from fastapi import Security
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import Resource
import timestamp
import threading 

DEFALUT_ADMIN = "dragon"
DEFALUT_ADMIN_PASSWORD = "881017"

roles = [ "User","Admin","SuperAdmin"]

default_profile = config.PythonConfig("config/default_profile.py",default_config={
        "password": "default_user",
        "nickname": "default_user",
        "description": "我是一个新用户，请尽快设置我的描述",
        "type": "user",
        "role" : [ "User" ],
        "WebSession" : "/chatroom/NormalSessionWeb.html"
    })
overlay_profile = config.PythonConfig("config/overlay_profile.py",default_config={
        'system_prompt': [{
                'role':'system',
                'content': textwrap.dedent("""
                        请以人类的口吻回答问题，不要说明你是AI
                        根据对话推理新的对话内容，不要说无关内容
                        请用中文回答问题
                        """)
            }] 
        }); 

# 创建路由器
account_router = APIRouter()

# 定义账户目录
ACCOUNT_DIR = "account"

# JWT 密钥，实际应用中应使用更安全的方式存储
SECRET_KEY = "881017"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE = 60*24 # 24小时
ACCESS_TOKEN_EXPIRE_ONEDAY = 60*24
ACCESS_TOKEN_EXPIRE_ONEWEEK = ACCESS_TOKEN_EXPIRE_ONEDAY*7
ACCESS_TOKEN_EXPIRE_ONEMONTH = ACCESS_TOKEN_EXPIRE_ONEDAY*30
ACCESS_TOKEN_EXPIRE_ONEYEAR = ACCESS_TOKEN_EXPIRE_ONEDAY*365
ACCESS_TOKEN_EXPIRE_NEVER = ACCESS_TOKEN_EXPIRE_ONEYEAR*100 # 100年

# 验证 JWT Token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/verify")

    
# 生成 JWT Token
def create_access_token(data: dict, expires_delta: Optional[timedelta] = ACCESS_TOKEN_EXPIRE):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_delta)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


# 添加 security 实例
security = HTTPBearer()

async def verfiy_by_token(token):
    try:
        if token.startswith("Bearer "):
            token = token.split(" ")[1]
        if token.startswith("bearer "):
            token = token.split(" ")[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # 检查token是否过期
        if datetime.now(timezone.utc) > datetime.fromtimestamp(payload["exp"], tz=timezone.utc):
            raise HTTPException(
                status_code=401,
                detail="Token已过期",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return payload
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=401,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

def create_user(username :str,password :str,nickname :str = None,role :list = None):

    # 检查用户名和密码是否合法
    if not username or not password:
        raise HTTPException(status_code=400, detail="用户名和密码不能为空")

    # 如果没有提供昵称，使用用户名作为昵称
    if not nickname:
        nickname = username

    

    # 构建用户目录路径
    user_dir = os.path.join(ACCOUNT_DIR, username)

    # 检查用户目录是否已存在
    if not os.path.exists(user_dir):
        # 创建用户目录
        os.makedirs(user_dir)

    # 构建账户信息文件路径
    account_file = os.path.join(user_dir, "profile.json")

    # 创建账户信息文件
    account_info = default_profile.instance();
    # 读取并修改账户信息
    try:
        account_info["password"] = password
        account_info["nickname"] = nickname
        if role is not None:
            account_info["role"] = role
        with open(account_file, 'w', encoding='utf-8') as f:
            json.dump(account_info, f, ensure_ascii=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail="修改账户信息失败")

    return {"message": "注册成功"}

def verfiy_by_userpassword(username :str ,password :str):
     # 检查用户名和密码是否合法
    if not username or not password:
        raise HTTPException(status_code=400, detail="用户名和密码不能为空")

    # 构建用户目录路径
    user_dir = os.path.join(ACCOUNT_DIR, username)

    
    # 构建账户信息文件路径
    account_file = os.path.join(user_dir, "profile.json")

    # 读取账户信息
    try:
        with open(account_file, 'r', encoding='utf-8') as f:
            account_info = json.load(f)
    except Exception as e:
        if username == DEFALUT_ADMIN:
            create_user(DEFALUT_ADMIN,DEFALUT_ADMIN_PASSWORD,role=["Admin" ,"SuperAdmin"]);
            return True;
        elif username == "guest":
            create_user("guest","guest","guest",["User"])
            return True;
        raise HTTPException(status_code=500, detail="读取账户信息失败")
    # 验证密码
    if account_info.get("password") == password:
        # 生成 JWT Token
        return True;
    else:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
      

   
    
async def verfiy_by_request(request):

    

    auth_header = request.headers.get("Authorization")
    
    if auth_header == "guest":
        request.username = "guest"
        return request
    elif auth_header and auth_header.startswith("Basic "):
        try:
        # 解析 Base64 编码的认证信息
            encoded_credentials = auth_header.split(" ")[1]
            decoded_credentials = base64.b64decode(encoded_credentials).decode("utf-8")
            username, password = decoded_credentials.split(":", 1)
            credentials = HTTPBasicCredentials(username=username, password=password)
            if verfiy_by_userpassword(credentials.username, credentials.password) is False:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid username or password",
                    headers={"WWW-Authenticate": 'Basic realm="WebDAV Service"'},
                )
            else:
                request.username = username
                return request
        except (ValueError, UnicodeDecodeError):
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": 'Basic realm="WebDAV Service"'},
            )
    elif auth_header and auth_header.startswith("Bearer "):
        # 解析 Bearer 令牌
        try:
            payload = await verfiy_by_token(auth_header)
            request.username = payload.get("username")
            return request
        except HTTPException as e:
            raise HTTPException(
                status_code=401,
                detail="Invalid token",
                headers={"WWW-Authenticate": 'Bearer realm="WebDAV Service"'},
            )
    
    cookie_token = request.cookies.get("token",None)
    if cookie_token is not None:
        payload = await verfiy_by_token(cookie_token)
        request.username = payload.get("username")
        return request

    cookie = request.headers.get("cookie", None)
    cookie_token = cookie.split("token=")[1].split(";")[0] if cookie else None
    if cookie_token is not None:
        payload = await verfiy_by_token(cookie_token)
        request.username = payload.get("username")
        return request

    url_token = request.query_params.get("token",None)
    if url_token is not None:
        payload = await verfiy_by_token(url_token)
        request.username = payload.get("username")
        return request
    
    raise HTTPException(
        status_code=401,
        detail="Invalid authentication method",
        headers={"WWW-Authenticate": 'Basic realm="WebDAV Service"'},
    )

async def VerfiyHTTPBearer(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials  # 从请求头中获取token
    return await verfiy_by_token(token);


# 定义用户信息模型
class User(BaseModel):
    username: str
    nickname: str

#{"password": "aaa", "nickname": "\u4e8c\u59d0\u5a01\u6b66" ,"description" : "none"}
# 注册接口
@account_router.post("/api/register")
async def register(data: dict):
    # 从请求数据中获取用户名和密码
    username = data.get("username")
    password = data.get("password")
    nickname = data.get("nickname")

    # 构建用户目录路径
    user_dir = os.path.join(ACCOUNT_DIR, username)

    # 检查用户目录是否已存在
    if os.path.exists(user_dir):
        raise HTTPException(status_code=409, detail="用户名已存在")


    return await create_user(username,password,nickname)
    



def get_profile(username):
    profile_path = os.path.join(ACCOUNT_DIR, username, "profile.json")
    profile_data = {}
    if os.path.exists(profile_path):
        with open(profile_path, 'r', encoding='utf-8') as f:
            profile_data = json.load(f)
            profile_data.pop("password", None)# 移除敏感信息
            profile_data["username"] = username # 添加用户名

    else:
        raise Exception("用户资料不存在")
    
    #全局覆盖profile.json,有一些特殊全局配置优先级最高,无论用户最终如何修改，都会覆盖用户最终的配置
    overlay_path = os.path.join(ACCOUNT_DIR, "profile.json")
    if os.path.exists(overlay_path):
        with open(overlay_path, 'r', encoding='utf-8') as f:
            overlay_data = json.load(f)
            profile_data.update(overlay_data)

    
    
    

    profile_data.update(overlay_profile.instance())
    return profile_data
        
        
def save_profile(username, profile_data):
    profile_path = os.path.join(ACCOUNT_DIR, username, "profile.json")
    if not os.path.exists(profile_path):
        raise Exception("用户资料不存在")
    
    # 读取现有配置
    with open(profile_path, 'r', encoding='utf-8') as f:
        current_profile = json.load(f)

    # 更新配置，但保留密码不变
    current_profile.update({
        k: v for k, v in profile_data.items()
        if k != "username"  # 防止修改用户名
        if k != "password"  # 防止修改密码
    })

    # 保存更新后的配置
    with open(profile_path, 'w', encoding='utf-8') as f:
        json.dump(current_profile, f,ensure_ascii=False)

def change_password(username, new_password):
    profile_path = os.path.join(ACCOUNT_DIR, username, "profile.json")
    if not os.path.exists(profile_path):
        raise Exception("用户资料不存在")
    with open(profile_path, 'r', encoding='utf-8') as f:
        current_profile = json.load(f)
    current_profile["password"] = new_password
    with open(profile_path, 'w', encoding='utf-8') as f:
        json.dump(current_profile, f,ensure_ascii=False)

@account_router.get("/api/profile/{username}")
async def api_get_profile(request :Request,username: str):
    try:
        await verfiy_by_request(request);
        return get_profile(username)
    except Exception as e:
        raise HTTPException(status_code=404, detail="用户资料不存在")


@account_router.post("/api/update_profile")
async def api_update_profile(request :Request,data: dict):
    
    await verfiy_by_request(request);
    try:
        save_profile(request.headers.get("username"), data)
        return {"message": "更新成功"}
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"无法更新用户资料:{e}")

    

@account_router.post("/api/change_password")
async def api_change_password(request :Request,data: dict):
    await verfiy_by_request(request);
    new_password = data.get("new_password")
    
    if not new_password:
        raise HTTPException(status_code=400, detail="新密码不能为空")

    # 保存更新后的配置
    try:
        change_password(request.headers.get("username"), new_password)
    except Exception as e:
        raise HTTPException(status_code=500, detail="保存新密码失败")

    return {"message": "密码修改成功"}

# 获取用户头像
@account_router.get("/api/get_avatar/{username}")  # 修改为GET请求并使用路径参数
async def get_avatar(request :Request,username: str):
    try:
        await verfiy_by_request(request);
        avatar_path = os.path.join(ACCOUNT_DIR, username, "avatar.png")

        if not os.path.exists(avatar_path):
            # 返回空响应体并设置正确headers
            return Response(status_code=204, headers={"Content-Length": "0"})

        return FileResponse(avatar_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))# 上传头像
    
def save_avatar(image :Image,username :str):
    # 调整图片大小
    image.thumbnail((256, 256))

    # 确保用户目录存在
    user_dir = os.path.join(ACCOUNT_DIR, username)
    if not os.path.exists(user_dir):
        os.makedirs(user_dir)

    # 保存头像
    avatar_path = os.path.join(user_dir, "avatar.png")
    image.save(avatar_path)
@account_router.post("/api/upload_avatar")
async def upload_avatar(request :Request,avatar: UploadFile = File(...)):
    await verfiy_by_request(request);
    try:
        # 读取并处理图片
        contents = await avatar.read()
        image = Image.open(io.BytesIO(contents))
        save_avatar(image,request.headers.get("username"));
        return {"message": "头像上传成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 验证接口
@account_router.post("/api/verify")
async def verify(data: dict):
    # 从请求数据中获取用户名和密码
    username = data.get("username")
    password = data.get("password")

    if(verfiy_by_userpassword(username,password)):
        access_token = create_access_token(data={
            "username": username,
            })
        return {
            "message": "验证成功",
            "access_token": access_token,
            "token_type": "bearer"
        }


    
@account_router.post("/api/get-user-token")
async def get_user_token(request: Request, data: dict):
    await verfiy_by_request(request);
    
    username = request.headers.get("username")
    if username != request.username:
        profile = get_profile(request.username);
        if "Admin" not in profile.get("role",[]):
            raise HTTPException(status_code=403, detail="只有超级管理员可以获取其他用户的令牌")
        
    if not username:
        raise HTTPException(status_code=400, detail="用户名不能为空")
    
    # 检查用户是否存在
    user_dir = os.path.join(ACCOUNT_DIR, username)
    if not os.path.exists(user_dir):
        raise HTTPException(status_code=404, detail="用户不存在")
    
    expires = ACCESS_TOKEN_EXPIRE_NEVER
    if "expires" in data:
        expires = data["expires"]
    # 生成 JWT Token
    access_token = create_access_token(data={
        "username": username
    }, expires_delta=expires)
    
    return {
        "message": "获取用户令牌成功",
        "access_token": access_token,
        "token_type": "bearer"
    }
    


@account_router.post("/api/delete_user")
async def delete_user(request :Request, data: dict):
    await verfiy_by_request(request)
    profile = get_profile(request.username)
    #判断SuperAdmin 和Admin
    if "Admin" not in profile.get("role",[]):
        raise HTTPException(status_code=403, detail="只有超级管理员可以删除用户")
    # 从请求数据中获取要删除的用户名
    username = data.get("username")
    if not username:
        raise HTTPException(status_code=400, detail="用户名不能为空")

    # 检查用户是否存在
    user_dir = os.path.join(ACCOUNT_DIR, username)
    if not os.path.exists(user_dir):
        raise HTTPException(status_code=404, detail="用户不存在")

    try:
        # 递归删除用户目录及其所有内容
        import shutil
        shutil.rmtree(user_dir)
        return {"message": "用户删除成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除用户失败: {str(e)}")


class UserWebsocket():
    def __init__(self,socket):
        try:
            self.WebSocket = socket;
            self.queue = asyncio.Queue();
            
            # 启动发送和接收消息的异步任务
            self.send_task = asyncio.create_task(self.send_messages_task())
            self.recv_task = asyncio.create_task(self.recv_messages_task())

        except WebSocketDisconnect:
            print(f"{websocket.username} disconnected from WebSocket.")
        except Exception as e:
            print(f"Error handling WebSocket connection: {e}")
        

    def __del__(self):
        
        try:
            self.send_task.cancel()
            self.recv_task.cancel()
            if self.WebSocket is not None:
                    self.WebSocket.close();
        except RuntimeError as e:
            pass
        return None;

        
    async def send_messages_task(self):
        while True:
            message = await self.get()
            try:
                await self.WebSocket.send_text(message)
            except WebSocketDisconnect:
                break
            except Exception as e:
                #print(f"Error sending message to client: {e}")
                break

    async def recv_messages_task(self):
        while True:
            try:
                # 接收客户端发送的消息
                client_message = await self.WebSocket.receive_text()
                try:
                    recv_json = json.loads(client_message)
                    if "tag" in recv_json:
                        tag = recv_json["tag"]
                        if tag in recv_messages_pool and "body" in recv_json:
                            await recv_messages_pool[tag](active_connections[websocket.username],recv_json["body"])
                except json.JSONDecodeError as e:
                    pass
                for recv in recv_all_messages_pool:
                    await recv(active_connections[websocket.username],client_message)
                #print(f"Received message from {websocket.username}: {client_message}")
                # 这里可以添加处理客户端消息的逻辑
            except WebSocketDisconnect:
                break
            except Exception as e:
                print(f"Error receiving message from client: {e}")
                break

    async def wait_finish(self):
        # 等待任务完成
        await asyncio.gather(self.send_task, self.recv_task)
    def get(self):
        return self.queue.get()
    def put(self,message):
        self.queue.put_nowait(message)

active_connections = {}
recv_messages_pool = {} 
recv_all_messages_pool = [];

# 安全获取或创建事件循环
try:
    main_loop = asyncio.get_event_loop()
    if not main_loop.is_running():
        threading.Thread(target=main_loop.run_forever, daemon=True).start()
except RuntimeError:
    # 在没有当前事件循环的线程中创建新的事件循环
    main_loop = asyncio.new_event_loop()
    asyncio.set_event_loop(main_loop)
    threading.Thread(target=main_loop.run_forever, daemon=True).start()

def send_to_all_clients_raw(msg):
    active_connections_copy = active_connections.copy()
    for k,v in active_connections_copy.items():
        v.put(msg)

def send_to_all_clients(tag,body):
    msg = json.dumps({"tag":tag,"body":body})
    send_to_all_clients_raw(msg)

def send_to_clients(username: str, message: str):
    #遍历active_connections，发送消息
    async def send():
        try:
            active_connections[username].put(message);
        except Exception as e:
            print(f"Error sending message to client: {e}")
            active_connections.pop(username)

    asyncio.run_coroutine_threadsafe(send, main_loop)

def recv_messages(tag):
    def decorator(func):
        # 直接将 func 注册到 recv_messages_pool 中
        if tag == "*":
            recv_all_messages_pool.append(func)
        else:
            recv_messages_pool[tag] = func
        return func
    return decorator

@recv_messages("*")
async def test(uws :UserWebsocket,body :dict):
    print(body)
    # uws.put(json.dumps({"tag":"test","body":{
    #     "message":"test",
    #     "username" :"wang"
    # }}))
    uws.put("helloworld")


@account_router.websocket("/api/account_websocket")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket 端点，用于接收日志信息和处理客户端发送的消息。
    """
    await verfiy_by_request(websocket);
    
    await websocket.accept()
    print(f"{websocket.username} connected to WebSocket.")

    # 将 WebSocket 连接及其消息队列添加到活跃连接字典中
    active_connections[websocket.username] = UserWebsocket(websocket)

    await active_connections[websocket.username].wait_finish();


    

# 检查账户目录是否存在，不存在则创建
if not os.path.exists(ACCOUNT_DIR):
    os.makedirs(ACCOUNT_DIR)

    

