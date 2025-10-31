import account 
from fastapi import APIRouter, Request, Response, WebSocket, WebSocketDisconnect
import os
import time
import psutil
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, Response
from fastapi import APIRouter, FastAPI, Request, HTTPException
from config import PythonConfig
import timestamp
import asyncio
from urllib.parse import parse_qs
import threading  # 导入 threading 模块
from server_config import *

import src.SystemManager.HostedService as HostedService

router = APIRouter()
from ServerManagerPyqt import *


async def send_log_to_clients(message: str):
    """
    将日志信息发送给所有活跃的 WebSocket 客户端。

    :param message: 要发送的日志信息
    """
    for connection, queue in active_connections.copy().items():
        try:
            await queue.put(message)
        except Exception as e:
            print(f"Exception:Error sending message to client : {e} ")
            print(f"remove {connection}")
            if connection in active_connections:
                del active_connections[connection]

manager = ServerManagerUI.get_instance()

# 定义一个全局的事件循环



def log_out(message):
    # 生成日志文件路径，格式为当前目录 + APP_NAME + SERVER_START_TIME + .log
    log_file_path = f"log/{timestamp.SERVER_START_TIME}.log"
    
    fmt_log = manager.format_log(message)
    # 确保目录存在，不存在则创建
    os.makedirs(os.path.dirname(log_file_path), exist_ok=True)
    with open(log_file_path, 'a', encoding='utf-8') as f:
        # 写入带时间戳的日志信息
        f.write(f"{fmt_log}\n")
    account.send_to_all_clients("system_log", fmt_log)
    #asyncio.run_coroutine_threadsafe(account.send_to_all_clients("system_log", fmt_log), main_loop)

manager.register_log_callback(log_out)

# 存储所有活跃的 WebSocket 连接
active_connections: dict[WebSocket, asyncio.Queue] = {}

class SystemMonitor(threading.Thread):  # 继承 threading.Thread
    def get_instance():
        if not hasattr(SystemMonitor, "_instance"):  # 检查是否已经创建了实例
            SystemMonitor._instance = SystemMonitor()  # 创建实例
        return SystemMonitor._instance
    def __init__(self) -> None:
        threading.Thread.__init__(self)  # 调用父类的构造函数
        self.info = {
            "network_download" : [],
            "network_upload" : [],
            "network_speed_sec_count" : 60,
            "cpu_usage": 0,
            "memory_usage": 0,
            "uptime": 0,
            "app_start_time": timestamp.SERVER_START_TIME,
            "app_run_time": 0,
        }
        self.is_running = False
        self.prev_net_io = psutil.net_io_counters()
        self.prev_time = time.time()
        self.reboot = False;
        HostedService.HostedService.loadmap_from_config();
        HostedService.HostedService.start_all();
    
    def server_reboot(self):
        ServerManagerUI.get_instance().reboot_server();
    def run(self):
        self.is_running = True
        app_start = time.time()
        while self.is_running:
            if self.reboot:
                self.reboot = False;
                self.server_reboot();
            # 获取 CPU 使用率
            self.info["cpu_usage"] = psutil.cpu_percent(interval=1)
            # 获取内存使用率
            self.info["memory_usage"] = psutil.virtual_memory().percent
            # 获取系统运行时间
            self.info["uptime"] = time.time() - psutil.boot_time()
            # 获取应用运行时间
            self.info["app_run_time"] = time.time() - app_start

            # 获取网络速度
            current_net_io = psutil.net_io_counters()
            current_time = time.time()
            elapsed_time = current_time - self.prev_time
            upload_speed = round((current_net_io.bytes_sent - self.prev_net_io.bytes_sent) / elapsed_time / (1024 * 1024), 2)
            download_speed = round((current_net_io.bytes_recv - self.prev_net_io.bytes_recv) / elapsed_time / (1024 * 1024), 2)
            self.info["network_download"].append(download_speed)
            self.info["network_upload"].append(upload_speed)
            if len(self.info["network_download"]) > self.info["network_speed_sec_count"]:
                self.info["network_download"].pop(0)
                self.info["network_upload"].pop(0)

            self.prev_net_io = current_net_io
            self.prev_time = current_time
            # 打印系统信息
            account.send_to_all_clients("system_info", self.info)              
            time.sleep(1)  # 每秒更新一次

        self.is_running = False

    def stop(self):
        self.is_running = False

system_monitor = SystemMonitor.get_instance()
system_monitor.start()  # 启动线程



@router.get("/api/get_log")
async def get_log():
    try:
        log_file_path = f"log/{timestamp.SERVER_START_TIME}.log"
        if os.path.exists(log_file_path):
            with open(log_file_path, 'r', encoding='utf-8') as f:
                log_content = f.read()
            return JSONResponse(content={"log": log_content, "message": "Log fetched successfully"})
        else:
            return JSONResponse(content={"log": "", "message": "Log file not found"}, status_code=404)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch log: {str(e)}")
    
@router.post("/api/system_reboot")
async def system_reboot(request: Request):
    """
    执行系统重启操作，仅管理员用户有权限调用。

    :param request: FastAPI 请求对象
    :return: 包含操作结果的 JSON 响应
    :raises HTTPException: 若认证失败或用户无权限，抛出异常
    """
    await account.verfiy_by_request(request);
    role = account.get_profile(request.username).get("role")
    if "SuperAdmin" not in role:
        raise HTTPException(status_code=403, detail="Permission denied")
    try:
        print("系统将会在 5 秒后重启...")
        async def perform_reboot_after_delay():
            await asyncio.sleep(1)
            print("开始执行系统重启...")
            os.system('shutdown /r /t 0')

        # 创建异步任务
        asyncio.create_task(perform_reboot_after_delay())
        
        return JSONResponse(content={"message": "System reboot will be initiated in 5 seconds"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initiate system reboot: {str(e)}")
    
@router.post("/api/server_reboot")
async def server_reboot(request: Request):

    try:
        await account.verfiy_by_request(request);
        role = account.get_profile(request.username).get("role")
        if "SuperAdmin" not in role:
            raise HTTPException(status_code=403, detail="Permission denied")
        
        print("开始重启服务...")
        SystemMonitor.get_instance().reboot = True;

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initiate system reboot: {str(e)}")
    

@router.get("/api/get_system_info")
async def get_system_info(request: Request):
    """
    获取系统的多项指标，包括网络速度、CPU 使用率、内存使用率、系统运行时间和网速统计数据。

    :param request: FastAPI 请求对象
    :return: 包含多项系统指标的 JSON 响应
    :raises HTTPException: 若认证失败或用户无权限，抛出异常
    """
    await account.verfiy_by_request(request);
    role = account.get_profile(request.username).get("role")
    if "SuperAdmin" not in role:
        raise HTTPException(status_code=403, detail="Permission denied")
    try:
        return JSONResponse(content=system_monitor.info)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch system metrics: {str(e)}")


@router.get("/api/get_server_config")
async def get_server_config(request: Request):
    await account.verfiy_by_request(request);
    role = account.get_profile(request.username).get("role")
    if "SuperAdmin" not in role:
        raise HTTPException(status_code=403, detail="Permission denied")
    try:
        return JSONResponse(content=server_config.to_dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch system metrics: {str(e)}")


        
@router.post("/api/update_server_config")
async def update_server_config(request: Request):
    await account.verfiy_by_request(request);
    role = account.get_profile(request.username).get("role")
    if "SuperAdmin" not in role:
        raise HTTPException(status_code=403, detail="Permission denied")
    try:
        data = await request.json()
        #对比两个字典,打印出不同的部分
        print(f"{request.username}保存配置")
        server_config.check_diffrent(data);
        server_config.update(data)
        return JSONResponse(content={"message": "Config updated successfully"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update config: {str(e)}")

@router.get("/api/get_server_status")
async def get_server_status(request: Request):
    await account.verfiy_by_request(request);
    role = account.get_profile(request.username).get("role")
    if "SuperAdmin" not in role:
        raise HTTPException(status_code=403, detail="Permission denied")
    try:
        ret = []; 
        server_list = server_config.get("server_list", [])

        for server_info in server_list:
            # 修改此处代码
            type = server_info["type"]
            if type == "uvicorn":
                port = server_info["config"]["port"]
                host = server_info["config"]["host"]
                ssl = server_info["config"].get("ssl",None)
                status = "Running"
                server = manager.get_servers_by_port(port)
                enabled = server_info.get("enabled")
                if server is not None:
                    status = "Running" if server.thread.is_alive() else "Stopped"
                item = {
                    "type" : type,
                    "enabled" : enabled,
                    "port" : port,
                    "host" : host,
                    "ssl" : ssl,
                    "status" : status
                };
                ret.append(item);
            elif type == "Hosted Service":
                enabled = server_info.get("enabled")
                path = server_info["path"]
                cwd = server_info.get("cwd",None)
                args = server_info.get("args",None)
                server = HostedService.HostedService.map.get(path)
                status = "Running" if server is not None and server.is_alive() else "Stopped"
                item = {
                    "type" : type, 
                    "enabled" : enabled,
                    "path" : path,
                    "cwd" : cwd,
                    "args" : args,
                    "status" : status# 临时写死
                }
                ret.append(item);
        
        return JSONResponse(content=ret);
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch system metrics: {str(e)}")

@router.post("/api/start_server")
async def start_server(request: Request):
    await account.verfiy_by_request(request);
    role = account.get_profile(request.username).get("role")
    if "SuperAdmin" not in role:
        raise HTTPException(status_code=403, detail="Permission denied")
    try:
        data = await request.json();
        type = data["type"];
        if type == "uvicorn":
            server = manager.get_servers_by_port(data["port"]);
            server.start();
        
        elif type == "Hosted Service":
            server = HostedService.HostedService.map.get(data["path"]);
            server.start();
        return JSONResponse(content={"message": "Server started successfully"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start server: {str(e)}")
    
@router.post("/api/stop_server")
async def stop_server(request: Request):
    await account.verfiy_by_request(request);
    role = account.get_profile(request.username).get("role")
    if "SuperAdmin" not in role:
        raise HTTPException(status_code=403, detail="Permission denied")
    try:
        data = await request.json();
        type = data["type"];
        if type == "uvicorn":
            server = manager.get_servers_by_port(data["port"]);
            server.stop();
        elif type == "Hosted Service":
            path = data["path"];
            server = HostedService.HostedService.map.get(path);
            server.stop();
            print(f"{path}强制关闭 返回值({server.return_code})")
        return JSONResponse(content={"message": "Server stopped successfully"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop server: {str(e)}")

@router.get("/api/get_extra_static")
async def get_extra_static(request: Request):
    await account.verfiy_by_request(request);
    role = account.get_profile(request.username).get("role")
    if "SuperAdmin" not in role:
        raise HTTPException(status_code=403, detail="Permission denied")
    try:
        ret = server_config.get("extra_static", [])
        return JSONResponse(content=ret)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch extra static: {str(e)}")

@router.post("/api/set_extra_static")
async def set_extra_static(request: Request):
    await account.verfiy_by_request(request);
    role = account.get_profile(request.username).get("role")
    if "SuperAdmin" not in role:
        raise HTTPException(status_code=403, detail="Permission denied")
    try:
        data = await request.json();
        ret = data
        server_config["extra_static"] = ret
        return JSONResponse(content=ret)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set extra static: {str(e)}")