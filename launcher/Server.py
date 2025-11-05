"""FastAPI服务模块

提供远程HTTP API接口，用于程序的远程控制和状态查询。
"""

import threading
import sys
import os
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import sys
import jwt
from datetime import datetime, timedelta, timezone
import base64

class ProgramInfo(BaseModel):
    """程序信息数据模型"""
    name: str
    path: str
    args: str = ""
    cwd: str = ""
    startup_with_windows: bool = False
    try_admin: bool = False
    running: bool = False


class ProgramAction(BaseModel):
    """程序操作数据模型"""
    name: str


class ProgramUpdate(BaseModel):
    """程序更新数据模型"""
    name: Optional[str] = None
    path: Optional[str] = None
    args: Optional[str] = None
    cwd: Optional[str] = None
    startup_with_windows: Optional[bool] = None
    try_admin: Optional[bool] = None


def get_executable_path():
    if getattr(sys, 'frozen', False):
        # 如果是打包后的可执行文件
        executable_path = os.path.dirname(sys.executable)
    else:
        # 如果是普通的 Python 脚本
        executable_path = os.path.dirname(os.path.abspath(__file__))
    
    return executable_path

# JWT 密钥，实际应用中应使用更安全的方式存储
SECRET_KEY = "881017"
ALGORITHM = "HS256"


    
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
            if credentials.username != "dragon" or credentials.password != "Dragon101788!":
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

class LauncherServer:
    """启动器FastAPI服务类"""
    
    def __init__(self, app_instance, process_manager):
        """初始化FastAPI服务
        
        Args:
            app_instance: PyQt应用实例
            process_manager: 进程管理器实例
        """
        self.app = app_instance
        self.process_manager = process_manager
        self.fastapi_app = None
        self.server_thread = None
        self.running = False
    
    def log(self, message: str):
            print(message)
    
    def init_fastapi(self):
        """初始化FastAPI应用"""
        
        # 创建FastAPI实例
        self.fastapi_app = FastAPI(title="DragonServer Launcher API")
        
        # 配置CORS
        self.fastapi_app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],  # 在生产环境中应该设置具体的源
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        
        # 根路径 - 返回HTML管理界面
        @self.fastapi_app.get("/")
        async def root(request: Request):
            await verfiy_by_request(request)
            return await index_html(request)
        
        # /index.html路径 - 返回HTML管理界面
        @self.fastapi_app.get("/index.html")
        async def index_html(request: Request):
            await verfiy_by_request(request)
                
            executable_path = get_executable_path()
            html_file_path = os.path.join(executable_path, "index.html")
            if os.path.exists(html_file_path):
                return FileResponse(html_file_path)
            return {"message": "HTML interface not available"}
        
        # 获取所有程序列表
        @self.fastapi_app.get("/api/programs", response_model=List[ProgramInfo])
        async def get_programs(request: Request):
            await verfiy_by_request(request)
                
            programs = []
            for name, program in self.process_manager.programs.items():
                program_info = ProgramInfo(
                    name=program.get('name', '未命名'),
                    path=program.get('path', ''),
                    args=program.get('args', ''),
                    cwd=program.get('cwd', ''),
                    startup_with_windows=program.get('startup_with_windows', False),
                    try_admin=program.get('try_admin', False),
                    running=self.process_manager.is_program_running(name)
                )
                programs.append(program_info)
            return programs
        
        # 获取单个程序信息
        @self.fastapi_app.get("/api/programs/{program_name}", response_model=ProgramInfo)
        async def get_program(request: Request, program_name: str):
            await verfiy_by_request(request)
                
            if(program_name in self.process_manager.programs):
                program = self.process_manager.programs[program_name]
                return ProgramInfo(
                    name=program.get('name', '未命名'),
                    path=program.get('path', ''),
                    args=program.get('args', ''),
                    cwd=program.get('cwd', ''),
                    startup_with_windows=program.get('startup_with_windows', False),
                    try_admin=program.get('try_admin', False),
                    running=self.process_manager.is_program_running(name)
                )
            raise HTTPException(status_code=404, detail="程序未找到")
        
        # 启动程序
        @self.fastapi_app.post("/api/programs/start")
        async def start_program(request: Request, action: ProgramAction):
            await verfiy_by_request(request)
            
            result = self.process_manager.start_process_by_name(action.name)
            if result:
                return {"status": "success", "message": f"程序 '{action.name}' 启动成功"}
            else:
                return {"status": "error", "message": f"程序 '{action.name}' 启动失败"}
        
        # 停止程序
        @self.fastapi_app.post("/api/programs/stop")
        async def stop_program(request: Request, action: ProgramAction):
            await verfiy_by_request(request)
            
            result = self.process_manager.stop_process_by_name(action.name,3)
            if result:
                return {"status": "success", "message": f"程序 '{action.name}' 停止成功"}
            else:
                return {"status": "error", "message": f"程序 '{action.name}' 停止失败或未运行"}
        
        
        
        # 获取服务状态
        @self.fastapi_app.get("/api/status")
        async def get_status(request: Request):
            await verfiy_by_request(request)
                
            status = {
                "service": "running",
                "programs": []
            }
            status["programs"] = self.process_manager.get_program_status()
            return status
        
        # 添加程序
        @self.fastapi_app.post("/api/programs/add")
        async def add_program(request: Request, program: ProgramInfo):
            await verfiy_by_request(request)
                
            try:
                # 将ProgramInfo转换为字典格式
                program_dict = program.dict()
                # 移除running字段，因为它不是配置的一部分
                program_dict.pop('running', None)
                # 调用process_manager的add_program方法
                self.process_manager.add_program(program_dict)
                return {"status": "success", "message": f"程序 '{program.name}' 添加成功"}
            except Exception as e:
                return {"status": "error", "message": f"添加程序失败: {str(e)}"}
        
        # 删除程序
        @self.fastapi_app.post("/api/programs/remove")
        async def remove_program(request: Request, action: ProgramAction):
            await verfiy_by_request(request)
                
            try:
                # 检查程序是否存在
                if action.name not in self.process_manager.programs:
                    return {"status": "error", "message": f"程序 '{action.name}' 不存在"}
                # 调用process_manager的remove_program方法
                self.process_manager.remove_program(action.name)
                return {"status": "success", "message": f"程序 '{action.name}' 删除成功"}
            except Exception as e:
                return {"status": "error", "message": f"删除程序失败: {str(e)}"}
        
        # 更新程序
        @self.fastapi_app.post("/api/programs/update/{program_name}")
        async def update_program(request: Request, program_name: str, updates: ProgramUpdate):
            await verfiy_by_request(request)
                
            try:
                # 检查程序是否存在
                if program_name not in self.process_manager.programs:
                    return {"status": "error", "message": f"程序 '{program_name}' 不存在"}
                
                # 将ProgramUpdate转换为字典格式，并过滤掉None值
                updates_dict = {k: v for k, v in updates.dict().items() if v is not None}
                
                # 调用process_manager的update_program方法
                self.process_manager.update_program(program_name, updates_dict)
                
                # 确定返回的消息中使用的名称
                new_name = updates_dict.get('name', program_name)
                return {"status": "success", "message": f"程序 '{program_name}' 更新成功"}
            except Exception as e:
                return {"status": "error", "message": f"更新程序失败: {str(e)}"}
        
        # 关闭启动器
        @self.fastapi_app.post("/api/exit")
        async def exit_launcher(request: Request):
            await verfiy_by_request(request)
                
            if hasattr(self.app, 'exit_application'):
                threading.Thread(target=self.app.exit_application).start()
                return {"status": "success", "message": "启动器正在关闭..."}
            return {"status": "error", "message": "无法关闭启动器"}
    
    def run_fastapi_server(self):
        """在单独的线程中运行FastAPI服务"""
        try:
            import uvicorn
            
            self.log(f"当前工作目录: {os.getcwd()}")
            self.init_fastapi()
            self.log(f"FastAPI应用: {self.fastapi_app}")
            
            # 在8804端口上运行服务
            config = uvicorn.Config(
                app=self.fastapi_app,
                host="0.0.0.0",
                port=8804,
                log_level="info",
                log_config=None,  # 禁用默认日志配置，避免formatter错误
                access_log=True
            )
            self.log(f"FastAPI配置: {config}")
            
            server = uvicorn.Server(config)
            self.log(f"FastAPI服务器: {server}")
            
            self.log("FastAPI服务已启动，监听端口: 8804")
            self.log("API文档地址: http://localhost:8804/docs")
            
            # 运行服务器
            server.run()
            
        except Exception as e:
            self.log(f"FastAPI服务运行出错: {str(e)}")
    
    def start(self):
        """启动FastAPI服务"""
        if not self.running:
            self.running = True
            self.server_thread = threading.Thread(target=self.run_fastapi_server, daemon=True)
            self.server_thread.start()
            return True
        return False
    
    def stop(self):
        """停止FastAPI服务"""
        if self.running:
            self.running = False
            # FastAPI服务器需要通过其他方式停止，这里仅设置标志
            return True
        return False