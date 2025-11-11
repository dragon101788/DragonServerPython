from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import Resource
import os
import time
import account
import fastapi
import json

# 监控log目录
class LogFileHandler(FileSystemEventHandler):
    def __init__(self ,log_dir):
        super().__init__()

        
        # 获取日志目录路径
        self.log_dir = log_dir
        
        self.log_files = {}
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
        @account.recv_messages("get_log")
        async def get_log(uws :account.UserWebsocket,body :dict):
            print(body)
            uws.put("helloworld")
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
            self.observer.schedule(self, path=log_dir, recursive=False)
            self.observer.start()
            self.is_running = True
            print(f"Started watching log directory: {log_dir}")
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
        print(f"Log file modified: {event.src_path}")

    def on_created(self, event):
        print(f"Log file created: {event.src_path}")
    
    def on_deleted(self, event):
        print(f"Log file deleted: {event.src_path}")
    
    def on_moved(self, event):
        print(f"Log file moved: {event.src_path} to {event.dest_path}")




# 导出实例供其他模块使用
#log_watchdog = LogFileHandler(os.path.join(Resource.get_executable_path(), "log"))
