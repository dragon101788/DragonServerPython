"""进程管理模块

负责程序的启动、停止和状态监控功能。
"""

import os
import psutil
import ctypes
import time
import json
import threading
from src.config import PythonConfig
from typing import Dict, Any, Optional
import Resource



class ProcessManager:
    """进程管理器类，负责程序的启动、停止和状态监控，以及程序配置管理"""
    
    def __init__(self):
        """初始化进程管理器"""
        self.notify_chain = []
        self.process_status_cache = {}
        self.monitor_thread = None
        self.monitor_interval = 5  # 监控间隔（秒）
        self.running = False
        self.programs = PythonConfig("config/launcher.py",default_config={})
        self.start_process_monitor()

    def register_notify(self, callback):
        """注册状态更新回调
        
        Args:
            callback: 状态更新回调函数，参数为(status: str, data: Dict[str, Any])
        """
        self.notify_chain.append(callback)
    
    def notify_status(self, **kwargs):
        """通知所有注册的回调函数状态更新
        
        Args:
            **kwargs: 包含状态相关数据的关键字参数
        """
        for callback in self.notify_chain:
            callback(**kwargs)
    

    def log(self, message: str):
        print(message)
        
    def start_process_monitor(self):
        """启动进程监控后台线程"""
        # 如果线程已存在且正在运行，先停止
        if self.monitor_thread and self.monitor_thread.is_alive():
            self.running = False
            self.monitor_thread.join(timeout=2)
            
        # 设置运行标志并创建新线程
        self.running = True
        self.monitor_thread = threading.Thread(target=self.check_process_status)
        self.monitor_thread.daemon = True  # 设置为守护线程，主线程结束时自动终止
        self.monitor_thread.start()
        self.log("进程监控后台线程已启动")
        
    def check_process_status(self):
        """进程监控循环，持续运行在后台线程中"""
        while self.running:
            try:
                for name in list(self.programs.keys()):
                    is_running = self.is_program_running(name)
                    
                    # 获取之前的状态
                    previous_status = self.process_status_cache.get(name, None)
                    
                    # 如果状态发生变化，发送通知
                    if previous_status is True and is_running is False:
                        self.log(f"检测到进程已结束: {name}")
                        self.notify_status(status="stopped", name=name)
                    elif previous_status is False and is_running is True:
                        self.log(f"检测到进程已启动: {name}")
                        self.notify_status(status="running", name=name)
                    
                    # 更新状态缓存
                    self.process_status_cache[name] = is_running
            except Exception as e:
                self.log(f"进程监控循环出错: {str(e)}")
            
            time.sleep(self.monitor_interval)

        
        self.log("进程监控后台线程已停止")
        
        
                
    def stop_process_monitor(self):
        """停止进程监控线程"""
        self.running = False
        if self.monitor_thread and self.monitor_thread.is_alive():
            self.monitor_thread.join(timeout=2)
    def is_program_running(self, name: str) -> bool:
        """检查程序是否正在运行
        
        Args:
            name: 程序名称
            
        Returns:
            bool: 程序是否在运行
        """
        executable_name = os.path.basename(name)
        proc = self.find_process_by_name(executable_name)
        if proc:
            return True
        else:
            return False
    
    def start_process_by_name(self, name: str) -> bool:
        """使用ShellExecuteW启动指定的程序
        
        Args:
            name: 程序名称
            
        Returns:
            bool: 启动是否成功
        """
        try:
            # 检查程序文件是否存在
            if not os.path.exists(self.programs[name]['path']):
                self.log(f"程序文件不存在: {self.programs[name]['path']}")
                return False
            
            # 检查程序是否已经在运行
            if self.is_program_running(name):
                self.log(f"程序 '{name}' 已经在运行")
                return False
            
            cmd = self.programs[name]['path']
            cwd = self.programs[name].get('cwd', None)
            args = self.programs[name].get('args', '')
            run_as_admin = self.programs[name].get('try_admin', False)
            
            self.log(f"启动程序: {cmd}")
            
            # 使用ShellExecuteW启动程序
            SW_SHOW = 5
            lpOperation = "runas" if run_as_admin else "open"
            lpFile = cmd
            lpParameters = args
            lpDirectory = cwd if cwd else None
            nShowCmd = SW_SHOW
            
            # 调用ShellExecute
            result = ctypes.windll.shell32.ShellExecuteW(
                None,          # 父窗口句柄
                lpOperation,   # 操作类型
                lpFile,        # 程序路径
                lpParameters,  # 命令行参数
                lpDirectory,   # 工作目录
                nShowCmd       # 显示方式
            )
            
            # 检查结果
            if result <= 32:
                self.log(f"ShellExecute失败，错误代码: {result}")
                return False
            
            # 等待程序启动
            admin_text = "(管理员权限)" if run_as_admin else ""
            self.log(f"程序 '{name}' 已启动{admin_text}")
            self.notify_status(status="running", name=name, admin_text=admin_text)
            return True
        except Exception as e:
            self.log(f"启动程序 '{name}' 失败: {str(e)}")
            return False
    
    def find_process_by_name(self,name):
        if name not in self.programs:
            return None
        path = self.programs[name]['path']
        name = self.programs[name]['name']
        args = self.programs[name].get('args', '')
        cmdline = f"{os.path.normpath(path)} {args}".strip()
        cmdline = cmdline.split()
        for proc in psutil.process_iter(['name', 'exe', 'cmdline']):
            try:
                proc_info = proc.info
                if (str.lower(proc_info['name']) == str.lower(name) or 
                    (proc_info['exe'] and os.path.normpath(proc_info['exe']) == os.path.normpath(path))):
                    #return proc
                    proc_info_cmdline = proc_info['cmdline']
                    if proc_info_cmdline and proc_info_cmdline == cmdline:
                        return proc
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        return None
    def stop_process_by_name(self, name: str, retry: int = 1) -> bool:
        """通过进程名终止程序
        
        Args:
            name: 程序名称（作为字典键）
            retry: 重试次数
            
        Returns:
            bool: 是否成功终止进程
        """
        try:
            proc = self.find_process_by_name(name)
            if proc is None:
                self.log(f"未找到进程: {name}")
                self.notify_status(status="stopped", name=name)
                return True
            
            proc_info = proc.info
            
            # 尝试正常终止进程
            try:
                proc.terminate()
                try:
                    proc.wait(timeout=3)
                    self.log(f"已终止进程: {proc_info['name']}")
                    self.notify_status(status="stopped", name=name)
                    return True
                except psutil.TimeoutExpired:
                    self.log(f"进程 '{proc_info['name']}' 超时，尝试强制终止")
                    # 超时后尝试强制终止
                    try:
                        proc.kill()
                        # 再等待一段时间确认进程是否终止
                        time.sleep(1)
                        # 再次检查进程是否存在
                        if not psutil.pid_exists(proc.pid):
                            self.log(f"强制终止进程成功: {proc_info['name']}")
                            self.notify_status(status="stopped", name=name)
                            return True
                        else:
                            self.log(f"强制终止进程后仍然存在: {proc_info['name']}")
                    except psutil.AccessDenied:
                        self.log(f"强制终止进程时遇到访问拒绝: {proc_info['name']}")
                    except psutil.NoSuchProcess:
                        self.log(f"进程 '{proc_info['name']}' 在强制终止前已不存在")
                        self.notify_status(status="stopped", name=name)
                        return True
            except psutil.AccessDenied:
                self.log(f"终止进程时遇到访问拒绝: {proc_info['name']}")
            except psutil.NoSuchProcess:
                self.log(f"进程 '{proc_info['name']}' 在终止前已不存在")
                self.notify_status(status="stopped", name=name)
                return True
            
            # 如果第一次失败且还有重试次数，等待一小段时间后重试
            if retry > 0:
                self.log(f"尝试再次终止进程: {proc_info['name']}")
                time.sleep(0.5)  # 短暂延迟后重试
                return self.stop_process_by_name(name, retry - 1)
                
            self.log(f"无法终止进程: {proc_info['name']}")
            self.notify_status(status="stopped", name=name)
            return False
            
        except Exception as e:
            self.log(f"终止程序 '{name}' 时出错: {str(e)}")
            # 如果发生其他异常且还有重试次数，也进行重试
            if retry > 0:
                self.log(f"发生异常，尝试再次终止进程: {name}")
                time.sleep(0.5)
                return self.stop_process_by_name(name, retry - 1)
            
            self.notify_status(status="stopped", name=name)
            return False
        
    
    def start_all_programs(self) -> int:
        """启动所有程序
        
        Args:
            programs: 程序字典（内部使用）
            
        Returns:
            int: 成功启动的程序数量
        """
        success_count = 0
        for name, program in self.programs.items():
            if not self.is_program_running(name):
                if self.start_process_by_name(name):
                    success_count += 1
                    # 添加短暂延迟，避免同时启动太多进程
                    time.sleep(0.5)
        return success_count
    
    def stop_all_running_programs(self) -> int:
        """停止所有正在运行的程序
        
        Args:
            programs: 程序字典（内部使用）
            
        Returns:
            int: 成功停止的程序数量
        """
        success_count = 0
        for name, program in self.programs.items():
            if self.is_program_running(name):
                if self.stop_process_by_name(name):
                    success_count += 1
                    # 添加短暂延迟，避免同时停止太多进程
                    time.sleep(0.3)
        return success_count
    
    def start_startup_programs(self) -> int:
        """启动所有设置为开机启动的程序
        
        Args:
            programs: 程序字典（内部使用）
            
        Returns:
            int: 成功启动的程序数量
        """
        # 从字典值中筛选开机启动程序
        startup_programs = [p for p in self.programs.values() if p.get('startup_with_windows', False)]
        success_count = 0
        for program in startup_programs:
            name = program.get('name', '未命名')
            if not self.is_program_running(name):
                if self.start_process_by_name(name):
                    success_count += 1
                    # 添加短暂延迟，避免同时启动太多进程
                    time.sleep(0.5)
        return success_count
    
    def get_program_status(self) -> list:
        """获取所有程序的运行状态
        
        Args:
            programs: 程序字典（内部使用）
            
        Returns:
            list: 包含每个程序状态的字典列表
        """
            
        status_list = []
        for program in self.programs.values():
            status_list.append({
                "name": program.get('name', '未命名'),
                "running": self.is_program_running(program),
                "path": program.get('path', ''),
                "startup": program.get('startup_with_windows', False),
                "admin": program.get('try_admin', False)
            })
        return status_list
        
   
    
    def add_program(self, program: Dict[str, Any]):
        """添加新程序
        
        Args:
            program: 程序信息字典
        """
        program_name = program.get('name', f'未命名程序_{len(self.programs)}')
        self.programs[program_name] = program
        self.notify_status(status="added", name=program_name)
    
    def remove_program(self, program_name: str):
        """删除程序
        
        Args:
            program_name: 程序名称（字典键）
        """
        try:
           # 停止可能正在运行的程序
            if self.is_program_running(program_name):
                self.stop_process_by_name(program_name)
            
            del self.programs[program_name]
            self.notify_status(status="removed", name=program_name)
        except Exception as e:
            self.log(f"删除程序时出错: {str(e)}")
        
    
    def update_program(self, program_name: str, updates: Dict[str, Any]):
        """更新程序信息
        
        Args:
            program_name: 程序名称（字典键）
            updates: 要更新的字段字典
        """
        if program_name in self.programs:
            # 如果更新内容中包含新的名称，需要重新构建字典条目
            if 'name' in updates and updates['name'] != program_name:
                new_name = updates['name']
                # 创建程序副本并更新
                program_copy = self.programs[program_name].copy()
                program_copy.update(updates)
                # 删除旧条目并添加新条目
                del self.programs[program_name]
                self.programs[new_name] = program_copy
            else:
                # 直接更新现有条目
                self.programs[program_name].update(updates)
            self.notify_status(status="updated", name=program_name)