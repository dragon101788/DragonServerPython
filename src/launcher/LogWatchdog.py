from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import Resource
import os
import time


# 获取日志目录路径
log_dir = os.path.join(Resource.get_executable_path(), "log")

# 确保日志目录存在
def ensure_log_directory_exists():
    if not os.path.exists(log_dir):
        try:
            os.makedirs(log_dir)
            print(f"Created log directory: {log_dir}")
        except Exception as e:
            print(f"Failed to create log directory: {e}")
            return False
    return True

# 监控log目录
class LogFileHandler(FileSystemEventHandler):
    def __init__(self):
        super().__init__()
        self.log_files = {}
        self.observer = Observer()
        self.is_running = False
    
    def start_watching(self):
        """开始监控日志目录"""
        if not ensure_log_directory_exists():
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
    
    def stop_watching(self):
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



# 如果作为主程序运行
if __name__ == "__main__":
    watchdog = create_log_watchdog()
    if watchdog:
        try:
            # 保持程序运行
            print("Log watchdog is running. Press Ctrl+C to stop.")
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("Shutting down log watchdog...")
        finally:
            watchdog.stop_watching()
    else:
        print("Failed to create log watchdog")

# 导出实例供其他模块使用
log_watchdog = LogFileHandler()
