import json
from src.account import UserWebsocket,recv_messages,verfiy_by_request,get_profile
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
from datetime import datetime, timedelta



router = APIRouter()



# 存储所有活跃的 WebSocket 连接
active_connections: dict[WebSocket, asyncio.Queue] = {}

# 流量数据存储文件路径
TRAFFIC_DATA_FILE = "traffic_data.json"

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
        self.info_list = []
        self.is_running = False
        self.prev_net_io = psutil.net_io_counters()
        self.prev_time = time.time()
        self.reboot = False;
        
        # 初始化流量数据
        self.next_record_time = datetime.now().replace(minute=0, second=0, microsecond=0)  # 当前小时的开始时间
        self.current_hour_download = 0
        self.current_hour_upload = 0
    
    
    def save_traffic_data(self, file_path: str,traffic_data: dict):
        """保存流量数据到JSON文件"""
        try:
            if not os.path.exists(os.path.dirname(file_path)):
                os.makedirs(os.path.dirname(file_path))
            if not os.path.exists(file_path):
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(traffic_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Failed to save traffic data: {e}")
    
    def record_hourly_traffic(self):
        """记录每小时流量数据"""
        
        
        current_hour = datetime.now().replace(minute=0, second=0, microsecond=0)
        if current_hour > self.next_record_time :
            file_path = os.path.join("log", current_hour.strftime("traffic_%Y%m%d%H.json"))

            traffic = {
                "download": self.current_hour_download,
                "upload": self.current_hour_upload
            }
            self.save_traffic_data(file_path,traffic)

            # 重置当前小时的流量统计
            self.current_hour_download = 0
            self.current_hour_upload = 0
            self.next_record_time = current_hour + timedelta(hours=1)

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
            
            # 计算当前周期的流量增量
            download_bytes = current_net_io.bytes_recv - self.prev_net_io.bytes_recv
            upload_bytes = current_net_io.bytes_sent - self.prev_net_io.bytes_sent
            
            # 添加到当前小时的总流量
            self.current_hour_download += download_bytes
            self.current_hour_upload += upload_bytes
            
            upload_speed = round(upload_bytes / elapsed_time / (1024 * 1024), 2)
            download_speed = round(download_bytes / elapsed_time / (1024 * 1024), 2)
            
            self.info["network_download"].append(download_speed)
            self.info["network_upload"].append(upload_speed)
            if len(self.info["network_download"]) > self.info["network_speed_sec_count"]:
                self.info["network_download"].pop(0)
                self.info["network_upload"].pop(0)

            self.prev_net_io = current_net_io
            self.prev_time = current_time

            # 检查是否需要记录每小时流量
            self.record_hourly_traffic()

            self.info_list.append(self.info)
            if len(self.info_list) > 60:
                self.info_list.pop(0)
            time.sleep(1)  # 每秒更新一次
        self.is_running = False

    def stop(self):
        self.is_running = False

system_monitor = SystemMonitor.get_instance()
system_monitor.start()  # 启动线程


def server_reboot():
    system_monitor.reboot = True;

@recv_messages("get_system_info")
async def get_system_info_by_client(uws :UserWebsocket,body :dict):
    callbackId = body.get("callbackId","get_system_info")
    uws.put(json.dumps({"tag":callbackId,"body":{
        "type":"system_info_list",
        "data":system_monitor.info_list
    }}))
    while uws.is_connected():
        await asyncio.sleep(1)
        uws.put(json.dumps({"tag":callbackId,"body":{
            "type":"system_info",
            "data":system_monitor.info
        }}))

@recv_messages("get_stage_flow_rate")
async def get_stage_flow_rate(uws: UserWebsocket, body: dict):
    """
    获取指定时间段内的每小时流量数据
    使用示例:
    const flow_data =  await AccountManager.Fetch("get_stage_flow_rate", {
        start: "2025-12-08 15:00:00",
        end: "2025-12-09 15:00:00"
    });
    console.log(flow_data);`
    返回格式如下:
    {time: '2025-12-08 15:00:00', download: 14562, upload: 16462}
    {time: '2025-12-08 16:00:00', download: 2170, upload: 312}
    {time: '2025-12-08 17:00:00', download: 6435, upload: 1944}
    {time: '2025-12-08 18:00:00', download: 10613, upload: 6486}
    .....
    """
    callbackId = body.get("callbackId", "get_Stage_flow_rate")
    start_time_str = body.get("start")
    end_time_str = body.get("end")
    
    try:
        # 解析时间字符串
        start_time = datetime.strptime(start_time_str, "%Y-%m-%d %H:%M:%S")
        end_time = datetime.strptime(end_time_str, "%Y-%m-%d %H:%M:%S")
        
        result = []
        
        # 检查log目录是否存在
        log_dir = os.path.join("log")
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)
        
        # 获取log目录下所有符合traffic_*.json格式的文件
        import glob
        traffic_files = glob.glob(os.path.join(log_dir, "traffic_*.json"))
        
        # 遍历流量数据文件，筛选出时间范围内的数据
        for file_path in traffic_files:
            try:
                # 从文件名中提取时间戳
                filename = os.path.basename(file_path)
                timestamp_str = filename.split("_")[1].split(".")[0]
                
                # 解析时间戳
                file_time = datetime.strptime(timestamp_str, "%Y%m%d%H")
                
                # 检查是否在指定时间范围内
                if start_time <= file_time <= end_time:
                    # 读取文件内容
                    with open(file_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    
                    # 格式化为指定的返回格式
                    result.append({
                        "time": file_time.strftime("%Y-%m-%d %H:%M:%S"),
                        "download": data.get("download", 0),
                        "upload": data.get("upload", 0)
                    })
            except Exception as e:
                # 跳过无效的文件或数据
                continue
        
        # 按时间顺序排序
        result.sort(key=lambda x: x["time"])
        
        # 返回结果
        uws.put(json.dumps({
            "tag": callbackId,
            "body": result
        }))
    except Exception as e:
        uws.put(json.dumps({
            "tag": callbackId,
            "body": {
                "type": "error",
                "message": f"Failed to get stage flow rate: {str(e)}"
            }
        }))

@router.get("/api/get_system_info")
async def get_system_info(request: Request):
    """
    获取系统的多项指标，包括网络速度、CPU 使用率、内存使用率、系统运行时间和网速统计数据。

    :param request: FastAPI 请求对象
    :return: 包含多项系统指标的 JSON 响应
    :raises HTTPException: 若认证失败或用户无权限，抛出异常
    """
    await verfiy_by_request(request);
    role = get_profile(request.username).get("role")
    if "SuperAdmin" not in role:
        raise HTTPException(status_code=403, detail="Permission denied")
    try:
        return JSONResponse(content=system_monitor.info)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch system metrics: {str(e)}")



@router.get("/api/get_extra_static")
async def get_extra_static(request: Request):
    await verfiy_by_request(request);
    role = get_profile(request.username).get("role")
    if "SuperAdmin" not in role:
        raise HTTPException(status_code=403, detail="Permission denied")
    try:
        ret = server_config.get("extra_static", [])
        return JSONResponse(content=ret)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch extra static: {str(e)}")

@router.post("/api/set_extra_static")
async def set_extra_static(request: Request):
    await verfiy_by_request(request);
    role = get_profile(request.username).get("role")
    if "SuperAdmin" not in role:
        raise HTTPException(status_code=403, detail="Permission denied")
    try:
        data = await request.json();
        ret = data
        server_config["extra_static"] = ret
        return JSONResponse(content=ret)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set extra static: {str(e)}")
