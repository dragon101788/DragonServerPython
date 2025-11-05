"""FastAPI服务模块

提供远程HTTP API接口，用于程序的远程控制和状态查询。
"""

import threading
import sys
import os
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel


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


def get_executable_path():
    if getattr(sys, 'frozen', False):
        # 如果是打包后的可执行文件
        executable_path = os.path.dirname(sys.executable)
    else:
        # 如果是普通的 Python 脚本
        executable_path = os.path.dirname(os.path.abspath(__file__))
    
    return executable_path

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
    
    def _log(self, message: str):
        """记录日志"""
        if hasattr(self.app, 'log_message'):
            self.app.log_message(message)
        else:
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
        async def root():
            return await index_html()
        
        # /index.html路径 - 返回HTML管理界面
        @self.fastapi_app.get("/index.html")
        async def index_html():

            executable_path = get_executable_path()
            html_file_path = os.path.join(executable_path, "index.html")
            if os.path.exists(html_file_path):
                return FileResponse(html_file_path)
            return {"message": "HTML interface not available"}
        
        # 获取所有程序列表
        @self.fastapi_app.get("/api/programs", response_model=List[ProgramInfo])
        async def get_programs():
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
        async def get_program(program_name: str):
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
        async def start_program(action: ProgramAction):
            
            result = self.process_manager.start_process_by_name(action.name)
            if result:
                return {"status": "success", "message": f"程序 '{action.name}' 启动成功"}
            else:
                return {"status": "error", "message": f"程序 '{action.name}' 启动失败"}
        
        # 停止程序
        @self.fastapi_app.post("/api/programs/stop")
        async def stop_program(action: ProgramAction):
            
            result = self.process_manager.stop_process_by_name(action.name,3)
            if result:
                return {"status": "success", "message": f"程序 '{action.name}' 停止成功"}
            else:
                return {"status": "error", "message": f"程序 '{action.name}' 停止失败或未运行"}
        
        # 启动所有程序
        @self.fastapi_app.post("/api/programs/start-all")
        async def start_all_programs():
            count = self.process_manager.start_all_programs()
            return {"status": "success", "message": f"成功启动 {count} 个程序"}
        
        # 停止所有程序
        @self.fastapi_app.post("/api/programs/stop-all")
        async def stop_all_programs():
            count = self.process_manager.stop_all_running_programs()
            return {"status": "success", "message": f"成功停止 {count} 个程序"}
        
        # 获取服务状态
        @self.fastapi_app.get("/api/status")
        async def get_status():
            status = {
                "service": "running",
                "programs": []
            }
            status["programs"] = self.process_manager.get_program_status()
            return status
        
        # 关闭启动器
        @self.fastapi_app.post("/api/exit")
        async def exit_launcher():
            if hasattr(self.app, 'exit_application'):
                threading.Thread(target=self.app.exit_application).start()
                return {"status": "success", "message": "启动器正在关闭..."}
            return {"status": "error", "message": "无法关闭启动器"}
    
    def run_fastapi_server(self):
        """在单独的线程中运行FastAPI服务"""
        try:
            import uvicorn
            
            self._log(f"当前工作目录: {os.getcwd()}")
            self.init_fastapi()
            self._log(f"FastAPI应用: {self.fastapi_app}")
            
            # 在8804端口上运行服务
            config = uvicorn.Config(
                app=self.fastapi_app,
                host="0.0.0.0",
                port=8804,
                log_level="info",
                log_config=None,  # 禁用默认日志配置，避免formatter错误
                access_log=True
            )
            self._log(f"FastAPI配置: {config}")
            
            server = uvicorn.Server(config)
            self._log(f"FastAPI服务器: {server}")
            
            self._log("FastAPI服务已启动，监听端口: 8804")
            self._log("API文档地址: http://localhost:8804/docs")
            
            # 运行服务器
            server.run()
            
        except Exception as e:
            self._log(f"FastAPI服务运行出错: {str(e)}")
    
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