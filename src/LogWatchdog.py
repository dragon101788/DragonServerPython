from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import Resource
import os
import time
import account
import fastapi
import json
import asyncio

# 监控log目录
class LogFileHandler(FileSystemEventHandler):
    def __init__(self ,log_dir):
        super().__init__()

        
        # 获取日志目录路径
        self.log_dir = log_dir
        self.log_receiver = {}
        self.observer = Observer()
        self.is_running = False
        self.setup_router()

    def setup_router(self):
        @account.recv_messages("list_log")
        async def list_log(uws :account.UserWebsocket,body :dict):
            print(body)
            log_files = os.listdir(self.log_dir)
            uws.put(json.dumps({"tag":body.get("callbackId","list_log"),"body":{
                "log_files":log_files
            }}))
        @account.recv_messages("deal_with_log1")
        async def deal_with_log(uws :account.UserWebsocket,body :dict):
            log_file = body.get("log_file")
            log_file_path = os.path.join(self.log_dir,log_file)
            if os.path.isdir(log_file_path):
                # 找到日期最新的日志文件
                log_files = os.listdir(log_file_path)
                log_files.sort(key=lambda x: os.path.getmtime(os.path.join(log_file_path, x)))
                log_file = log_files[-1]
                log_file_path = os.path.join(log_file_path, log_file)

                log_file = open(log_file_path, "r", encoding="utf-8")

                uws.put(json.dumps({"tag":body.get("callbackId","deal_with_log"),"body":log_file.read().splitlines()}))
                self.log_receiver[log_file_path] = {
                   "socket": uws    ,
                   "callbackId":body.get("callbackId","deal_with_log") ,
                   "offset" : 0,
                }

                log_file.close()
    # 确保日志目录存在
    def ensure_log_directory_exists(self):
        if not os.path.exists(self.log_dir):
            try:
                os.makedirs(self.log_dir)
                print(f"Created log directory: {self.log_dir}")
            except Exception as e:
                print(f"Failed to create log directory: {e}")
                return False
        return True

    
    def start(self):
        """开始监控日志目录"""
        if not self.ensure_log_directory_exists():
            print("Cannot start watching: log directory does not exist and could not be created")
            return False
        
        try:
            self.observer.schedule(self, path=self.log_dir , recursive=True)
            self.observer.start()
            self.is_running = True
            print(f"Started watching log directory: {self.log_dir}")
            return True
        except Exception as e:
            print(f"Failed to start observer: {e}")
            return False
    
    def stop(self):
        """停止监控"""
        if self.is_running:
            self.observer.stop()
            self.observer.join()
            self.is_running = False
            print("Stopped watching log directory")
    
    def on_opened(self, event):
        print(f"Log file opened: {event.src_path}")
    
    def on_closed(self, event):
        print(f"Log file closed: {event.src_path}")

    def on_modified(self, event):
        if event.src_path in self.log_receiver:
            uws = self.log_receiver[event.src_path]["socket"]
            if not uws.is_connected():
                del self.log_receiver[event.src_path]
                return
            callbackId = self.log_receiver[event.src_path]["callbackId"]
            offset = self.log_receiver[event.src_path]["offset"]
            log_file = open(event.src_path, "r", encoding="utf-8")
            log_file.seek(offset)
            lines = log_file.read().splitlines()
            if lines:
                uws.put(json.dumps({"tag":callbackId,"body":lines})) 
                self.log_receiver[event.src_path]["offset"] = log_file.tell()   
            log_file.close()

    def on_created(self, event):
        print(f"Log file created: {event.src_path}")
    
    def on_deleted(self, event):
        print(f"Log file deleted: {event.src_path}")
    
    def on_moved(self, event):
        print(f"Log file moved: {event.src_path} to {event.dest_path}")




# 导出实例供其他模块使用
#log_watchdog = LogFileHandler(os.path.join(Resource.get_executable_path(), "log"))


# 独立的LogReceiver类，移到模块级别
class LogReceiver(FileSystemEventHandler):
    def __init__(self, log_file_path, uws, callbackId):
        super().__init__()
        self.uws = uws
        self.callbackId = callbackId
        self.offset = 0
        self.observer = Observer()
        self.log_file_path = log_file_path
        self.log_dir = os.path.dirname(log_file_path)
        self.running = False
    
    def __del__(self):
        self.stop()
    
    def stop(self):
        if self.running:
            self.observer.stop()
            self.observer.join()
            self.running = False
            print(f"Stopped watching log file: {self.log_file_path}")
    
    def start(self):
        try:
            # 监控文件所在的目录，而不是文件本身
            self.observer.schedule(self, path=self.log_dir, recursive=False)
            self.observer.start()
            self.running = True
            print(f"Started watching log file directory: {self.log_dir} for file: {os.path.basename(self.log_file_path)}")
            return True
        except Exception as e:
            print(f"Failed to start log file observer: {e}")
            return False
    
    def on_modified(self, event):
        # 检查是否是我们关注的文件被修改
        if event.src_path == self.log_file_path and not event.is_directory:
            try:
                with open(self.log_file_path, "r", encoding="utf-8") as log_file:
                    log_file.seek(self.offset)
                    lines = log_file.read().splitlines()
                    if lines and self.uws.is_connected():
                        self.uws.put(json.dumps({"tag": self.callbackId, "body": lines}))
                        self.offset = log_file.tell()
            except Exception as e:
                print(f"Error reading log file: {e}")

# 存储活动的log receivers，以便管理
_active_log_receivers = []

@account.recv_messages("deal_with_log")
async def deal_with_log(uws :account.UserWebsocket,body :dict):
    try:
        log_file = body.get("log_file")
        log_file_path = os.path.join(Resource.get_executable_path(), "log", log_file)
        callbackId = body.get("callbackId", "deal_with_log")
        
        # 如果是目录，找到最新的日志文件
        if os.path.isdir(log_file_path):
            log_files = os.listdir(log_file_path)
            if not log_files:
                uws.put(json.dumps({"tag": callbackId, "body": ["No log files found in directory"]}))
                return
                
            log_files.sort(key=lambda x: os.path.getmtime(os.path.join(log_file_path, x)))
            log_file = log_files[-1]
            log_file_path = os.path.join(log_file_path, log_file)
        
        # 检查文件是否存在
        if not os.path.isfile(log_file_path):
            uws.put(json.dumps({"tag": callbackId, "body": [f"Log file not found: {log_file_path}"]}))
            return
        
        # 读取初始日志内容
        with open(log_file_path, "r", encoding="utf-8") as f:
            initial_content = f.read().splitlines()
            uws.put(json.dumps({"tag": callbackId, "body": initial_content}))
        
        # 创建并启动日志监控器
        log_receiver = LogReceiver(log_file_path, uws, callbackId)
        if log_receiver.start():
            # 添加到活动监控器列表
            _active_log_receivers.append(log_receiver)
            print(f"Log monitoring started for: {log_file_path}")
            
            # 使用异步方式监控连接状态，而不是阻塞循环
            async def monitor_connection():
                try:
                    while uws.is_connected():
                        await asyncio.sleep(1)
                except Exception as e:
                    print(f"Error in connection monitor: {e}")
                finally:
                    # 连接断开时停止监控
                    log_receiver.stop()
                    if log_receiver in _active_log_receivers:
                        _active_log_receivers.remove(log_receiver)
                    print(f"Log monitoring stopped for: {log_file_path}")
            
            # 创建后台任务监控连接
            asyncio.create_task(monitor_connection())
        else:
            uws.put(json.dumps({"tag": callbackId, "body": ["Failed to start log monitoring"]}))
    
    except Exception as e:
        print(f"Error in deal_with_log: {e}")
        callbackId = body.get("callbackId", "deal_with_log")
        uws.put(json.dumps({"tag": callbackId, "body": [f"Error: {str(e)}"]}))

        
