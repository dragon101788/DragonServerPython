"""FastAPI服务模块

提供远程HTTP API接口，用于程序的远程控制和状态查询。
"""

import threading
import sys
import os
from typing import Dict, Any, List, Optional, Set
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import sys
import jwt
from datetime import datetime, timedelta, timezone
import base64
import json
import shutil

import account 
import Resource
class ProgramInfo(BaseModel):
    """程序信息数据模型"""
    name: str
    path: str
    args: str = ""
    cwd: str = ""
    startup_with_windows: bool = False
    try_admin: bool = False
    running: bool = False


def responseFile(file_path: str):
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    # 获取文件大小
    file_size = os.path.getsize(file_path)
    
    # 对于大文件（>10MB）使用流式响应
    if file_size > 10 * 1024 * 1024:
        # 定义流式读取生成器函数
        async def file_streamer(file_path, chunk_size=8192):
            with open(file_path, "rb") as file:
                while chunk := file.read(chunk_size):
                    yield chunk
                    # 可以选择在每个chunk之间添加短暂的延迟
                    # await asyncio.sleep(0.001)
        
        # 获取文件的MIME类型
        import mimetypes
        content_type, _ = mimetypes.guess_type(file_path)
        content_type = content_type or "application/octet-stream"
        
        return StreamingResponse(
            file_streamer(file_path),
            media_type=content_type,
            headers={
                "Content-Disposition": f"inline; filename={os.path.basename(file_path)}",
                "Content-Length": str(file_size)
            }
        )
    else:
        # 小文件仍然使用普通的FileResponse
        return FileResponse(file_path)

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
        self.process_manager.register_notify(self.notify_status)
        self.fastapi_app = None
        self.server_thread = None
        self.running = False


    def notify_status(self, **kwargs):
        account.send_to_all_clients("status_update", kwargs)

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
        
        
       
        # 获取所有程序列表
        @self.fastapi_app.get("/api/programs", response_model=List[ProgramInfo])
        async def get_programs(request: Request):
            await account.verfiy_by_request(request)
                
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
            await account.verfiy_by_request(request)
                
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
            await account.verfiy_by_request(request)
            
            result = self.process_manager.start_process_by_name(action.name)
            if result:
                return {"status": "success", "message": f"程序 '{action.name}' 启动成功"}
            else:
                return {"status": "error", "message": f"程序 '{action.name}' 启动失败"}
        
        # 停止程序
        @self.fastapi_app.post("/api/programs/stop")
        async def stop_program(request: Request, action: ProgramAction):
            await account.verfiy_by_request(request)
            
            result = self.process_manager.stop_process_by_name(action.name,3)
            if result:
                return {"status": "success", "message": f"程序 '{action.name}' 停止成功"}
            else:
                return {"status": "error", "message": f"程序 '{action.name}' 停止失败或未运行"}
        
        
        
        # 获取服务状态
        @self.fastapi_app.get("/api/status")
        async def get_status(request: Request):
            await account.verfiy_by_request(request)
                
            status = {
                "service": "running",
                "programs": []
            }
            status["programs"] = self.process_manager.get_program_status()
            return status
        
        # 添加程序
        @self.fastapi_app.post("/api/programs/add")
        async def add_program(request: Request, program: ProgramInfo):
            await account.verfiy_by_request(request)
                
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
            await account.verfiy_by_request(request)
                
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
            await account.verfiy_by_request(request)
                
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
        
        def backup_program(program_name: str):
            program = self.process_manager.programs[program_name];
            program_path = program.get("path")
            print(f"备份程序路径: {program_path}")

            try:
                #备份到history 并命名YYMMDDHH
                os.makedirs(os.path.join(os.path.dirname(program_path), "history"), exist_ok=True)
                basename = os.path.basename(program_path)
                backup_path = os.path.join(os.path.dirname(program_path), f"history/{basename.replace(".exe","") + datetime.now().strftime("%y%m%d%H%M") + ".exe"}")
                shutil.move(program_path, backup_path)
                print(f"程序 '{program_name}' 已备份到: {backup_path}")
            except Exception as e:
                print(f"备份程序 '{program_name}' 失败: {str(e)}")

        # 升级程序 - 上传文件
        @self.fastapi_app.post("/api/programs/upgrade")
        async def upgrade_program(request: Request, file: UploadFile = File(...), program_name: str = Form(...)):
            await account.verfiy_by_request(request)
                
            try:
                # 检查程序是否存在
                if program_name not in self.process_manager.programs:
                    return {"status": "error", "message": f"程序 '{program_name}' 不存在"}
                
                program = self.process_manager.programs[program_name];
                program_path = program.get("path")
                print(f"升级程序路径: {program_path}")

                backup_program(program_name)

                
                # 写入文件
                # 获取文件大小（如果可用）
                file_size = 0
                if hasattr(file, 'size'):
                    file_size = file.size
                
                # 分片读取并写入文件，同时打印进度
                chunk_size = 1024 * 1024  # 1MB 分片
                total_written = 0
                
                with open(program_path, "wb") as buffer:
                    while True:
                        chunk = await file.read(chunk_size)
                        if not chunk:
                            break
                        buffer.write(chunk)
                        total_written += len(chunk)
                        
                        # 打印进度信息
                        if file_size > 0:
                            progress = (total_written / file_size) * 100
                            print(f"上传进度: {progress:.2f}% ({total_written}/{file_size} 字节)")
                            account.send_to_all_clients("upgrade_progress",{"progress": progress, "total_written": total_written, "file_size": file_size})
                        else:
                            print(f"上传进度: {total_written} 字节已上传")
                
                print(f"文件上传完成，总计写入 {total_written} 字节")
                self.log(f"程序 '{program_name}' 升级文件 '{file.filename}' 已上传，保存路径: {program_path}")
                
                return {"status": "success", "message": f"程序 '{program_name}' 升级文件 '{file.filename}' 上传成功"}
            except Exception as e:
                self.log(f"升级程序失败: {str(e)}")
                return {"status": "error", "message": f"升级程序失败: {str(e)}"}

        self.fastapi_app.include_router(account.account_router)

        @self.fastapi_app.get("/{path:path}")
        async def AccessFiles(request: Request, path: str = ""):
            try:
                if not path:
                    path = "index.html"
                
                
                if path.endswith(".py"):
                    raise Exception("禁止访问.py文件")

                cur_path = os.path.dirname(os.path.abspath(__file__))
                if os.path.exists(os.path.join(cur_path, path)):
                    return responseFile(os.path.join(cur_path, path))
                elif os.path.exists(os.path.join(Resource.path.executable, path)):
                    return responseFile(os.path.join(Resource.path.executable, path))
                elif os.path.exists(os.path.join(Resource.path.src, path)):
                    return responseFile(os.path.join(Resource.path.src, path))
                elif os.path.exists(os.path.join(Resource.path.templates, path)):
                    return templates.TemplateResponse(path, {"request": request})
                    
                
                raise Exception("文件%s不存在"%path)
            except Exception as e:
                
                return {"status": "error", "message": f"文件访问失败: {str(e)}"}
                return templates.TemplateResponse("error.html", {"request": request ,"reason" : e.__str__() ,"status_code" : "404"}, status_code=404)



    def websocket_log_callback(self, message: str):
        """通过WebSocket广播日志消息给所有连接的客户端"""
        account.history_log.append(message)
        # 只保留最近的100条日志
        account.history_log = account.history_log[-100:]

        return account.send_to_all_clients("system_log",message)
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
            self.log("WebSocket日志端点: ws://localhost:8804/ws/logs")
            
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