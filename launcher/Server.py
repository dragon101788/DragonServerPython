"""FastAPI服务模块

提供远程HTTP API接口，用于程序的远程控制和状态查询。
"""

import threading
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


class LauncherServer:
    """启动器FastAPI服务类"""
    
    def __init__(self, app_instance, process_manager, html_file_path=None):
        """初始化FastAPI服务
        
        Args:
            app_instance: PyQt应用实例
            process_manager: 进程管理器实例
            html_file_path: HTML管理界面文件路径
        """
        self.app = app_instance
        self.process_manager = process_manager
        self.html_file_path = html_file_path
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
        # 初始化HTML文件路径
        if self.html_file_path is None:
            # 默认查找路径
            default_path = os.path.join(
                os.path.dirname(__file__), "index.html"
            )
            if os.path.exists(default_path):
                self.html_file_path = default_path
        
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
            if self.html_file_path and os.path.exists(self.html_file_path):
                return HTMLResponse(open(self.html_file_path, 'r', encoding='utf-8').read())
            return {"message": "DragonServer Launcher API", "version": "1.0.0"}
        
        # /index.html路径 - 返回HTML管理界面
        @self.fastapi_app.get("/index.html")
        async def index_html():
            if self.html_file_path and os.path.exists(self.html_file_path):
                return FileResponse(self.html_file_path)
            return {"message": "HTML interface not available"}
        
        # 获取所有程序列表
        @self.fastapi_app.get("/api/programs", response_model=List[ProgramInfo])
        async def get_programs():
            programs = []
            if hasattr(self.app, 'programs'):
                for program in self.app.programs:
                    program_info = ProgramInfo(
                        name=program.get('name', '未命名'),
                        path=program.get('path', ''),
                        args=program.get('args', ''),
                        cwd=program.get('cwd', ''),
                        startup_with_windows=program.get('startup_with_windows', False),
                        try_admin=program.get('try_admin', False),
                        running=self.process_manager.is_program_running(program)
                    )
                    programs.append(program_info)
            return programs
        
        # 获取单个程序信息
        @self.fastapi_app.get("/api/programs/{program_name}", response_model=ProgramInfo)
        async def get_program(program_name: str):
            if hasattr(self.app, 'programs'):
                for program in self.app.programs:
                    if program.get('name') == program_name:
                        return ProgramInfo(
                            name=program.get('name', '未命名'),
                            path=program.get('path', ''),
                            args=program.get('args', ''),
                            cwd=program.get('cwd', ''),
                            startup_with_windows=program.get('startup_with_windows', False),
                            try_admin=program.get('try_admin', False),
                            running=self.process_manager.is_program_running(program)
                        )
            raise HTTPException(status_code=404, detail="程序未找到")
        
        # 启动程序
        @self.fastapi_app.post("/api/programs/start")
        async def start_program(action: ProgramAction):
            if hasattr(self.app, 'programs'):
                for program in self.app.programs:
                    if program.get('name') == action.name:
                        result = self.process_manager.start_program(program)
                        if result:
                            return {"status": "success", "message": f"程序 '{action.name}' 启动成功"}
                        else:
                            return {"status": "error", "message": f"程序 '{action.name}' 启动失败"}
            return {"status": "error", "message": "程序未找到"}
        
        # 停止程序
        @self.fastapi_app.post("/api/programs/stop")
        async def stop_program(action: ProgramAction):
            if hasattr(self.app, 'programs'):
                for program in self.app.programs:
                    if program.get('name') == action.name:
                        result = self.process_manager.stop_program(program)
                        if result:
                            return {"status": "success", "message": f"程序 '{action.name}' 停止成功"}
                        else:
                            return {"status": "error", "message": f"程序 '{action.name}' 停止失败或未运行"}
            return {"status": "error", "message": "程序未找到"}
        
        # 启动所有程序
        @self.fastapi_app.post("/api/programs/start-all")
        async def start_all_programs():
            if hasattr(self.app, 'programs'):
                count = self.process_manager.start_all_programs(self.app.programs)
                return {"status": "success", "message": f"成功启动 {count} 个程序"}
            return {"status": "error", "message": "程序列表为空"}
        
        # 停止所有程序
        @self.fastapi_app.post("/api/programs/stop-all")
        async def stop_all_programs():
            if hasattr(self.app, 'programs'):
                count = self.process_manager.stop_all_running_programs(self.app.programs)
                return {"status": "success", "message": f"成功停止 {count} 个程序"}
            return {"status": "error", "message": "程序列表为空"}
        
        # 获取服务状态
        @self.fastapi_app.get("/api/status")
        async def get_status():
            status = {
                "service": "running",
                "programs": []
            }
            if hasattr(self.app, 'programs'):
                status["programs"] = self.process_manager.get_program_status(self.app.programs)
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
            
            self.init_fastapi()
            
            # 在8804端口上运行服务
            config = uvicorn.Config(
                app=self.fastapi_app,
                host="0.0.0.0",
                port=8804,
                log_level="info"
            )
            server = uvicorn.Server(config)
            
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