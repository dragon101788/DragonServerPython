import json
import src.account as account 
from fastapi import APIRouter, Request, Response, WebSocket, WebSocketDisconnect
import os
import time
import psutil
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, Response
from fastapi import APIRouter, FastAPI, Request, HTTPException
from src.config import PythonConfig
import timestamp
import asyncio
from urllib.parse import parse_qs
import threading  # 导入 threading 模块
from src.server_config import *    



router = APIRouter()


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


# 定义一个全局的事件循环




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
            #print(f"system info: {self.info}")
            print("...")
        self.is_running = False

    def stop(self):
        self.is_running = False

system_monitor = SystemMonitor.get_instance()
system_monitor.start()  # 启动线程


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
