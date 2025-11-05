"""进程管理模块

负责程序的启动、停止和状态监控功能。
"""

import os
import psutil
import ctypes
import time
from typing import Dict, Any, Optional


class ProcessManager:
    """进程管理器类，负责程序的启动、停止和状态监控"""
    
    def __init__(self):
        """初始化进程管理器"""
        self.log_callback = None
    
    def set_log_callback(self, callback):
        """设置日志回调函数"""
        self.log_callback = callback
    
    def _log(self, message: str):
        """记录日志"""
        if self.log_callback:
            self.log_callback(message)
        print(message)
    
    def is_program_running(self, program: Dict[str, Any]) -> bool:
        """检查程序是否正在运行
        
        Args:
            program: 程序信息字典
            
        Returns:
            bool: 程序是否在运行
        """
        executable_name = os.path.basename(program['path'])
        proc = self.find_process_by_name(executable_name)
        if proc:
            return True
        else:
            return False
    
    def start_program(self, program: Dict[str, Any]) -> bool:
        """使用ShellExecuteW启动指定的程序
        
        Args:
            program: 程序信息字典
            
        Returns:
            bool: 启动是否成功
        """
        try:
            # 检查程序文件是否存在
            if not os.path.exists(program['path']):
                self._log(f"程序文件不存在: {program['path']}")
                return False
            
            # 检查程序是否已经在运行
            if self.is_program_running(program):
                self._log(f"程序 '{program['name']}' 已经在运行")
                return False
            
            cmd = program['path']
            cwd = program.get('cwd', None)
            args = program.get('args', '')
            run_as_admin = program.get('try_admin', False)
            
            self._log(f"启动程序: {cmd}")
            
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
                self._log(f"ShellExecute失败，错误代码: {result}")
                return False
            
            # 等待程序启动
            admin_text = "(管理员权限)" if run_as_admin else ""
            self._log(f"程序 '{program['name']}' 已启动{admin_text}")
            
            return True
        except Exception as e:
            self._log(f"启动程序 '{program['name']}' 失败: {str(e)}")
            return False
    
    def stop_program(self, program: Dict[str, Any] ) -> bool:
        """停止指定的程序
        
        Args:
            program: 程序信息字典
            
        Returns:
            bool: 停止是否成功
        """
        
        # 通过进程名终止
        self._terminate_process_by_name(program)
    def find_process_by_name(self,name):
            for proc in psutil.process_iter(['name', 'exe']):
                try:
                    proc_info = proc.info
                    if (str.lower(proc_info['name']) == str.lower(name) or 
                        (proc_info['exe'] and str.lower(os.path.basename(proc_info['exe'])) == str.lower(name))):
                        return proc
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            
            return None
    def _terminate_process_by_name(self, program: Dict[str, Any]) -> bool:
        """通过进程名终止程序
        
        Args:
            program: 程序信息字典
            
        Returns:
            bool: 是否成功终止进程
        """
        executable_name = os.path.basename(program['path'])
        program_name = program['name']
        
        try:
            proc = self.find_process_by_name(executable_name)
            if proc is None:
                self._log(f"未找到进程: {executable_name}")
                return False
            else:
                proc_info = proc.info
                proc.terminate()
                try:
                    proc.wait(timeout=3)
                    self._log(f"已终止进程: {proc_info['name']}")
                except psutil.TimeoutExpired:
                    proc.kill()
                    self._log(f"强制终止进程: {proc_info['name']}")
        except Exception as e:
            self._log(f"终止程序 '{program_name}' 时出错: {str(e)}")
        
    
    def start_all_programs(self, programs: list) -> int:
        """启动所有程序
        
        Args:
            programs: 程序列表
            
        Returns:
            int: 成功启动的程序数量
        """
        success_count = 0
        for program in programs:
            if not self.is_program_running(program):
                if self.start_program(program):
                    success_count += 1
                    # 添加短暂延迟，避免同时启动太多进程
                    time.sleep(0.5)
        return success_count
    
    def stop_all_running_programs(self, programs: list) -> int:
        """停止所有正在运行的程序
        
        Args:
            programs: 程序列表
            
        Returns:
            int: 成功停止的程序数量
        """
        success_count = 0
        for program in programs:
            if self.is_program_running(program):
                if self.stop_program(program):
                    success_count += 1
                    # 添加短暂延迟，避免同时停止太多进程
                    time.sleep(0.3)
        return success_count
    
    def start_startup_programs(self, programs: list) -> int:
        """启动所有设置为开机启动的程序
        
        Args:
            programs: 程序列表
            
        Returns:
            int: 成功启动的程序数量
        """
        startup_programs = [p for p in programs if p.get('startup_with_windows', False)]
        return self.start_all_programs(startup_programs)
    
    def get_program_status(self, programs: list) -> list:
        """获取所有程序的运行状态
        
        Args:
            programs: 程序列表
            
        Returns:
            list: 包含每个程序状态的字典列表
        """
        status_list = []
        for program in programs:
            status_list.append({
                "name": program.get('name', '未命名'),
                "running": self.is_program_running(program),
                "path": program.get('path', ''),
                "startup": program.get('startup_with_windows', False),
                "admin": program.get('try_admin', False)
            })
        return status_list