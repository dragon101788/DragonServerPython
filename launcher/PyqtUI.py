"""PyQt5界面模块

提供启动器的图形用户界面，负责用户交互和界面渲染。
"""

import statistics
import sys
import os
from tkinter import NO
import winreg
import time
import ctypes
from typing import Dict, Any, Optional
from PyQt5.QtCore import QSystemSemaphore, QSharedMemory

from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QTableWidget, QTableWidgetItem, QPushButton,
    QVBoxLayout, QHBoxLayout, QWidget, QFileDialog, QInputDialog, QMessageBox,
    QStatusBar, QAction, QMenu, QSplitter, QTextEdit, QListWidget, QListWidgetItem,
    QGroupBox, QLabel, QLineEdit, QCheckBox, QComboBox, QFrame, QHeaderView, QSystemTrayIcon
)
from PyQt5.QtGui import QContextMenuEvent
from PyQt5.QtCore import Qt, QThread, pyqtSignal
from PyQt5.QtGui import QIcon, QFont

from Process import ProcessManager
from Server import LauncherServer

def get_executable_path():
    if getattr(sys, 'frozen', False):
        # 如果是打包后的可执行文件
        executable_path = os.path.dirname(sys.executable)
    else:
        # 如果是普通的 Python 脚本
        executable_path = os.path.dirname(os.path.abspath(__file__))
    
    return executable_path
class LauncherApp(QMainWindow):
    """启动器主应用类"""
    def redirect_output(self, stdout_put, stderr_put=None):
        
        if self.original_stdout is not None and self.original_stderr is not None:
            return
        # 创建自定义的日志处理类
        class LogHandler:
            def __init__(self,callback):
                self.callback = callback

            def write(self, text):
                if text == "\n":
                    return
                if text.endswith("\n"):
                    text = text[:-1]
                
                self.callback(text)
            def flush(self):
                pass
        
        if stderr_put is None:
            stderr_put = stdout_put
        self.original_stdout = sys.stdout
        self.original_stderr = sys.stderr
        sys.stdout = LogHandler(stdout_put)
        sys.stderr = LogHandler(stderr_put)

    def __init__(self):
        """初始化启动器应用"""
        # 检查是否已有实例在运行
        self.semaphore = QSystemSemaphore("DragonServerLauncherSemaphore", 1)
        self.semaphore.acquire()
        
        self.shared_memory = QSharedMemory("DragonServerLauncherSharedMemory")
        self.original_stdout = None
        self.original_stderr = None
        # 尝试创建共享内存，如果失败表示已有实例在运行
        if self.shared_memory.attach():  # 如果能附加到共享内存，说明已有实例
            self.semaphore.release()
            QMessageBox.information(None, "提示", "DragonServer启动器已经在运行中！")
            sys.exit(0)
        
        # 创建共享内存，标记程序正在运行
        self.shared_memory.create(1)
        self.semaphore.release()
        
        super().__init__()
        
        # 初始化组件
        self.process_manager = ProcessManager()
        
        self.server = None
        
        # 配置相关 - 现在由ProcessManager管理
        
        # UI相关
        self.program_table = None
        self.status_text = None
        self.log_text = None
        self.property_panel = None
        self.property_panels = {}
        self.property_panel_container = None
        self.property_panel_layout = None
        self.tray_icon = None
        
        # 初始化UI
        self.init_ui()
        
        self.redirect_output(self.log_message)
        # 初始化系统托盘
        self.init_tray_icon()
        
        # 配置已由ProcessManager在初始化时加载
        
        # 初始化FastAPI服务
        self.server = LauncherServer(self, self.process_manager)
        self.server.start()
        
        # 启动开机自启程序
        self.start_all_startup_programs()
        
        self.process_manager.register_status_callback(self.update_program_status)
        # 默认启动到托盘，隐藏主窗口
        self.hide()
    
    def init_ui(self):
        """初始化用户界面"""
        # 设置窗口标题和大小
        self.setWindowTitle("DragonServer 启动器")
        self.setGeometry(100, 100, 900, 600)
        
        # 设置字体
        font = QFont("SimHei")
        self.setFont(font)
        
        # 创建中心窗口部件
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # 主布局
        main_layout = QVBoxLayout(central_widget)
        
        # 确保在更改布局时停止当前运行的程序
        self.process_manager.stop_all_running_programs()
        
        # 创建工具栏
        toolbar = QWidget()
        toolbar_layout = QHBoxLayout(toolbar)
        
        # 添加程序按钮
        add_button = QPushButton("添加程序")
        add_button.clicked.connect(self.add_program)
        toolbar_layout.addWidget(add_button)
        
        # 添加分隔符
        toolbar_layout.addStretch()
        
        # 退出按钮
        exit_button = QPushButton("退出")
        exit_button.clicked.connect(self.exit_application)
        toolbar_layout.addWidget(exit_button)
        
        # 启动器自启动复选框
        self.startup_checkbox = QCheckBox("开机自启动")
        self.startup_checkbox.setChecked(self.check_auto_startup())
        self.startup_checkbox.stateChanged.connect(self.toggle_auto_startup)
        toolbar_layout.addWidget(self.startup_checkbox)
        
        main_layout.addWidget(toolbar)
        
        horizontal_layout = QHBoxLayout()
        main_layout.addLayout(horizontal_layout)
        
        # 创建左侧程序列表
        left_widget = QWidget()
        left_layout = QVBoxLayout(left_widget)

        
        # 创建程序列表表格
        self.program_table = QTableWidget()
        self.program_table.setColumnCount(3)  # 名称、开机启动和状态三列
        self.program_table.setHorizontalHeaderLabels(["名称", "自启", "状态"])
        self.program_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.program_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeToContents)
        self.program_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeToContents)
        self.program_table.setContextMenuPolicy(Qt.CustomContextMenu)
        self.program_table.customContextMenuRequested.connect(self.show_context_menu)
        # 设置选择整行
        self.program_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.program_table.setSelectionMode(QTableWidget.SingleSelection)
        # 设置程序列表宽度 - 只保留最小宽度
        self.program_table.setMinimumWidth(250)
        self.program_table.currentCellChanged.connect(self.on_program_selected)
        
        horizontal_layout.addWidget(self.program_table,1)
        
        
        # 创建右侧区域
        right_widget = QWidget()
        right_layout = QVBoxLayout(right_widget)
        
        horizontal_layout.addWidget(right_widget,3)
        
        # 属性面板区域
        self.property_panel_container = QGroupBox("程序详情")
        self.property_panel_layout = QVBoxLayout(self.property_panel_container)
        no_selection_label = QLabel("请在左侧选择一个程序查看详情")
        no_selection_label.setAlignment(Qt.AlignCenter)
        no_selection_label.setStyleSheet("color: gray; font-style: italic;")
        self.property_panel_layout.addWidget(no_selection_label)
        
        right_layout.addWidget(self.property_panel_container)
        
        # 添加分割线
        separator = QFrame()
        separator.setFrameShape(QFrame.HLine)
        separator.setFrameShadow(QFrame.Sunken)
        right_layout.addWidget(separator)

        # # 日志显示区域
        # log_group = QGroupBox("运行日志")
        # log_layout = QVBoxLayout(log_group)
        # self.log_text = QTextEdit()
        # self.log_text.setReadOnly(True)
        # self.log_text.setLineWrapMode(QTextEdit.NoWrap)
        # log_layout.addWidget(self.log_text)
        # right_layout.addWidget(log_group)

        # 右下角：日志显示区域
        log_title = QLabel("日志输出")
        font = QFont()
        font.setBold(True)
        log_title.setFont(font)
        right_layout.addWidget(log_title)
        
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setMinimumHeight(200)
        right_layout.addWidget(self.log_text)
        
        
        
        
        # 创建状态栏
        self.statusBar = QStatusBar()
        self.status_text = QLabel("就绪")
        self.statusBar.addWidget(self.status_text)
        self.setStatusBar(self.statusBar)
        
        # 显示窗口
        self.show()
    
    # load_config方法已移至ProcessManager类
        
        # 更新程序表格
        self.update_program_table()
    
    # save_config方法已移至ProcessManager类
    
    def update_program_table(self):
        """更新程序列表表格"""
        self.program_table.setRowCount(0)
        
        for name, program in self.process_manager.programs.items():
            row_position = self.program_table.rowCount()
            self.program_table.insertRow(row_position)
            
            # 程序名称
            self.program_table.setItem(row_position, 0, QTableWidgetItem(name))
            
            # 开机启动复选框
            startup_checkbox = QCheckBox()
            startup_checkbox.setChecked(program.get('startup_with_windows', False))
            startup_checkbox.stateChanged.connect(
                lambda state, name=name: self.toggle_program_startup(name, state != 0)
            )
            self.program_table.setCellWidget(row_position, 1, startup_checkbox)
            
            # 运行状态
            status_item = QTableWidgetItem()
            status_item.setTextAlignment(Qt.AlignCenter)
            if self.process_manager.is_program_running(name):
                status_item.setText("运行中")
                status_item.setForeground(Qt.green)
            else:
                status_item.setText("未运行")
            self.program_table.setItem(row_position, 2, status_item)
    
    def add_program(self):
        """添加新程序"""
        # 打开文件对话框选择程序
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择程序", "", "可执行文件 (*.exe);;所有文件 (*)"
        )
        
        if not file_path:
            return
        
        # 获取程序名称
        program_name = os.path.splitext(os.path.basename(file_path))[0]
        name, ok = QInputDialog.getText(self, "程序名称", "请输入程序名称:", text=program_name)
        
        if not ok or not name:
            return
        
        # 创建程序配置
        program = {
            'name': name,
            'path': file_path,
            'args': '',
            'cwd': os.path.dirname(file_path),
            'startup_with_windows': False,
            'try_admin': False
        }
        
        # 添加到程序列表
        self.process_manager.add_program(program)
        
        # 更新表格
        self.update_program_table()
        
        print(f"添加程序: {name}")
    
    def remove_program(self):
        """删除选中的程序"""
        selected_row = self.program_table.currentRow()
        name = self.program_table.item(selected_row, 0).text()
        
        if selected_row < 0:
            QMessageBox.warning(self, "警告", "请先选择要删除的程序")
            return
        
        # 确认删除
        program_name = self.process_manager.programs[name].get('name', '未命名')
        reply = QMessageBox.question(
            self, "确认删除", f"确定要删除程序 '{program_name}' 吗?",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            # 停止可能正在运行的程序
            if self.process_manager.is_program_running(name):
                self.process_manager.stop_process_by_name(name)
            
            # 删除程序
            print(f"删除程序: {program_name}")
            self.process_manager.remove_program(name)
            
            # 从属性面板字典中移除
            if program_name in self.property_panels:
                del self.property_panels[program_name]
            
            # 更新表格
            self.update_program_table()
            
            # 清除属性面板
            self.clear_property_panels()
    
    def start_selected_program(self):
        """启动选中的程序"""
        selected_row = self.program_table.currentRow()
        name = self.program_table.item(selected_row, 0).text()
        
        self.process_manager.start_process_by_name(name)
        self.update_program_status()
    
        
            
    def stop_selected_program(self):
        """停止选中的程序"""
        selected_row = self.program_table.currentRow()
        name = self.program_table.item(selected_row, 0).text()
    
        # 停止程序
        self.process_manager.stop_process_by_name(name)
        time.sleep(0.5)
        self.update_program_status()
    
    def update_program_status(self):
        """更新程序状态"""
        selected_row = self.program_table.currentRow()
        for row in range(self.program_table.rowCount()):
            # 检查行索引是否有效
            if row < 0 or row >= self.program_table.rowCount():
                return
            
            name = self.program_table.item(row, 0).text()
            # 更新状态单元格
            status_item = self.program_table.item(row, 2)
            if status_item:
                if self.process_manager.is_program_running(name):
                    status_item.setText("运行中")
                    status_item.setForeground(Qt.green)
                else:
                    status_item.setText("未运行")
                    status_item.setForeground(Qt.black)
        
            if row == selected_row:
                self.create_program_property_panel(name)
            
    
    def log_message(self, message: str):
        """记录日志信息"""
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] {message}"
        
        # 添加到日志文本框
        self.log_text.append(log_entry)
        # 滚动到底部
        self.log_text.verticalScrollBar().setValue(self.log_text.verticalScrollBar().maximum())
        
        # 更新状态栏
        self.status_text.setText(message)
    
    def check_process_status(self):
        """检查所有进程状态"""
        # 重新加载整个列表以更新所有状态
        self.update_program_table()
        
        # 如果有选中的程序，更新其属性面板
        selected_items = self.program_table.selectedItems()
        if len(selected_items) == 1:
            index = selected_items[0].data(Qt.UserRole)
            self.create_program_property_panel(index)
    
    def toggle_program_startup(self, name: str, enabled: bool):
        """切换程序的开机自启动状态"""
        if name in self.process_manager.programs:
            self.process_manager.update_program(name, {'startup_with_windows': enabled})
            
            # 同步更新表格中的复选框状态
            if program_index < self.program_table.rowCount():
                checkbox_widget = self.program_table.cellWidget(program_index, 1)
                if isinstance(checkbox_widget, QCheckBox):
                    checkbox_widget.blockSignals(True)
                    checkbox_widget.setChecked(enabled)
                    checkbox_widget.blockSignals(False)
            
            status = "启用" if enabled else "禁用"
            print(f"{status}程序 '{self.process_manager.programs[name]['name']}' 的开机自启动")
    
    def show_context_menu(self, position):
        """显示右键菜单"""
        menu = QMenu()
        
        # 启动程序菜单项
        start_action = QAction("启动程序")
        start_action.triggered.connect(self.start_selected_program)
        menu.addAction(start_action)
        
        # 停止程序菜单项
        stop_action = QAction("停止程序")
        stop_action.triggered.connect(self.stop_selected_program)
        menu.addAction(stop_action)
        
        # 分隔符
        menu.addSeparator()
        
        # 删除程序菜单项
        delete_action = QAction("删除程序")
        delete_action.triggered.connect(self.remove_program)
        menu.addAction(delete_action)
        
        # 显示菜单
        menu.exec_(self.program_table.mapToGlobal(position))
    
    def create_program_property_panel(self, name: str):
        
        
        # 清除旧的属性面板
        self.clear_property_panels()
        
        # 更新面板标题
        self.property_panel_container.setTitle(f"程序详情: {name}")
        
        # 创建新的属性面板内容
        panel_widget = QWidget()
        panel_layout = QVBoxLayout(panel_widget)
        
        # 名称
        name_layout = QHBoxLayout()
        name_layout.addWidget(QLabel("名称:"))
        name_edit = QLineEdit(name)
        name_edit.setReadOnly(True)
        name_layout.addWidget(name_edit)
        panel_layout.addLayout(name_layout)
        
        # 路径
        path_layout = QHBoxLayout()
        path_layout.addWidget(QLabel("路径:"))
        path_edit = QLineEdit(self.process_manager.programs[name].get('path', ''))
        path_edit.setReadOnly(True)
        path_edit.setMinimumWidth(300)
        path_layout.addWidget(path_edit)
        panel_layout.addLayout(path_layout)
        
        # 参数
        args_layout = QHBoxLayout()
        args_layout.addWidget(QLabel("参数:"))
        args_edit = QLineEdit(self.process_manager.programs[name].get('args', ''))
        args_edit.setReadOnly(True)
        args_layout.addWidget(args_edit)
        panel_layout.addLayout(args_layout)
        
        # 工作目录
        cwd_layout = QHBoxLayout()
        cwd_layout.addWidget(QLabel("工作目录:"))
        cwd_edit = QLineEdit(self.process_manager.programs[name].get('cwd', ''))
        cwd_edit.setReadOnly(True)
        cwd_edit.setMinimumWidth(300)
        cwd_layout.addWidget(cwd_edit)
        panel_layout.addLayout(cwd_layout)
        
        # 开机自启
        startup_checkbox = QCheckBox("开机自启动")
        startup_checkbox.setChecked(self.process_manager.programs[name].get('startup_with_windows', False))
        startup_checkbox.stateChanged.connect(
            lambda state: self.toggle_program_startup(name, state != 0)
        )
        panel_layout.addWidget(startup_checkbox)
        
        # 管理员权限
        admin_checkbox = QCheckBox("以管理员权限运行")
        admin_checkbox.setChecked(self.process_manager.programs[name].get('try_admin', False))
        admin_checkbox.stateChanged.connect(
            lambda state: self.toggle_program_admin(name, state != 0)
        )
        panel_layout.addWidget(admin_checkbox)
        
        # 运行状态
        status_layout = QHBoxLayout()
        status_layout.addWidget(QLabel("运行状态:"))
        status_text = "运行中" if self.process_manager.is_program_running(name) else "已停止"
        status_label = QLabel(status_text)
        status_label.setStyleSheet(f"color: {'green' if status_text == '运行中' else 'black'};")
        status_layout.addWidget(status_label)
        panel_layout.addLayout(status_layout)
        
        # 添加控制按钮
        control_layout = QHBoxLayout()
        
        start_btn = QPushButton("启动程序")
        start_btn.clicked.connect(lambda: self.start_program_by_name(name))
        control_layout.addWidget(start_btn)
        
        stop_btn = QPushButton("停止程序")
        stop_btn.clicked.connect(lambda: self.stop_program_by_name(name))
        control_layout.addWidget(stop_btn)
        
        panel_layout.addLayout(control_layout)
        
        # 添加伸展空间
        panel_layout.addStretch()
        
        # 添加到属性面板容器
        self.property_panel_layout.addWidget(panel_widget)
        
        # 保存面板引用
        self.property_panels[name] = panel_widget
    
    def clear_property_panels(self):
        """清除所有属性面板"""
        # 清空属性面板布局
        while self.property_panel_layout.count() > 0:
            item = self.property_panel_layout.takeAt(0)
            widget = item.widget()
            if widget:
                widget.hide()
                widget.deleteLater()
        
        # 重置标题并显示提示信息
        self.property_panel_container.setTitle("程序详情")
        no_selection_label = QLabel("请在左侧选择一个程序查看详情")
        no_selection_label.setAlignment(Qt.AlignCenter)
        no_selection_label.setStyleSheet("color: gray; font-style: italic;")
        self.property_panel_layout.addWidget(no_selection_label)
        
        # 清空属性面板字典
        self.property_panels.clear()
    
    def on_program_selected(self):
        """当选中程序时"""
        selected_row = self.program_table.currentRow()
        
        # 如果选中了有效行，显示属性面板
        if selected_row >= 0:
            name = self.program_table.item(selected_row, 0).text()
            self.create_program_property_panel(name)
        else:
            self.clear_property_panels()
    
    def on_program_cell_changed(self, row: int, column: int):
        """当表格单元格内容改变时"""
        # 由于我们现在使用的是列表而不是表格，这个方法可能不再需要
        pass
    
    def start_program_by_name(self, name: str):
        """通过名称启动程序"""
        self.process_manager.start_process_by_name(name)
        self.update_program_status()
    
    def stop_program_by_name(self, name: str):
        """通过名称停止程序"""
        self.process_manager.stop_process_by_name(name)
        time.sleep(0.5)
        self.update_program_status()
    
    def toggle_program_startup(self, name: str, enabled: bool):
        """切换程序开机自启动"""
        self.process_manager.update_program(name, {'startup_with_windows': enabled})
        self.update_program_table()
        
        self.create_program_property_panel(name)
        status = "启用" if enabled else "禁用"
        print(f"{status}程序 '{self.process_manager.programs[name]['name']}' 的开机自启动")
    
    def on_admin_checkbox_changed(self, name: str, state: int):
        """当管理员权限复选框状态改变时"""
        if name in self.process_manager.programs:
            self.process_manager.update_program(name, {'try_admin': state == Qt.Checked})
            self.update_program_table()
            
            self.create_program_property_panel(name)
            status = "启用" if state == Qt.Checked else "禁用"
            print(f"{status}程序 '{self.process_manager.programs[name]['name']}' 的管理员权限")
    
    def check_auto_startup(self) -> bool:
        """检查启动器自身是否设置为开机自启动"""
        try:
            key = winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                "Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                0,
                winreg.KEY_READ
            )
            value, _ = winreg.QueryValueEx(key, "DragonServer Launcher")
            winreg.CloseKey(key)
            return value == sys.executable
        except Exception:
            return False
    
    def toggle_auto_startup(self, state: int):
        """切换启动器自身的开机自启动状态"""
        enabled = state == Qt.Checked
        self.set_auto_startup(enabled)
    
    def set_auto_startup(self, enabled: bool):
        """设置启动器自身的开机自启动"""
        try:
            key = winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                "Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                0,
                winreg.KEY_SET_VALUE
            )
            
            if enabled:
                winreg.SetValueEx(key, "DragonServer Launcher", 0, winreg.REG_SZ, sys.executable)
                print("已设置启动器开机自启动")
            else:
                try:
                    winreg.DeleteValue(key, "DragonServer Launcher")
                    print("已取消启动器开机自启动")
                except FileNotFoundError:
                    pass
            
            winreg.CloseKey(key)
        except Exception as e:
            print(f"设置开机自启动时出错: {str(e)}")
    
    def start_all_startup_programs(self):
        """启动所有设置为开机自启动的程序"""
        # 使用ProcessManager类的programs属性和正确的方法签名
        count = self.process_manager.start_startup_programs()
        if count > 0:
            print(f"已自动启动 {count} 个开机自启程序")
    
    def init_tray_icon(self):
        """初始化系统托盘图标"""
        # 创建系统托盘图标
        self.tray_icon = QSystemTrayIcon(self)
        
        # 设置托盘图标（如果没有图标文件，可以使用默认图标）
        icon_path = os.path.join(get_executable_path(), 'icon.ico')
        if os.path.exists(icon_path):
            self.tray_icon.setIcon(QIcon(icon_path))
        else:
            # 使用应用程序默认图标
            self.tray_icon.setIcon(self.windowIcon())
        
        # 设置托盘图标标题
        self.tray_icon.setToolTip("DragonServer 启动器")
        
        # 创建托盘菜单
        tray_menu = QMenu(self)
        
        # 显示主窗口操作
        show_action = QAction("显示窗口", self)
        show_action.triggered.connect(self.show_window)
        tray_menu.addAction(show_action)
        
        # 分割线
        tray_menu.addSeparator()
        
        # 退出操作
        exit_action = QAction("退出", self)
        exit_action.triggered.connect(self.exit_application)
        tray_menu.addAction(exit_action)
        
        # 设置托盘菜单
        self.tray_icon.setContextMenu(tray_menu)
        
        # 双击托盘图标显示窗口
        self.tray_icon.activated.connect(self.on_tray_icon_activated)
        
        # 显示托盘图标
        self.tray_icon.show()
        
        # 提示信息
        self.tray_icon.showMessage(
            "DragonServer 启动器",
            "启动器已启动，点击托盘图标查看菜单",
            QSystemTrayIcon.Information,
            3000
        )
    
    def show_window(self):
        """显示主窗口"""
        self.show()
        self.raise_()
        self.activateWindow()
        
    def on_tray_icon_activated(self, reason):
        """托盘图标激活事件处理"""
        if reason == QSystemTrayIcon.Trigger or reason == QSystemTrayIcon.DoubleClick:
            self.show_window()
    
    def closeEvent(self, event):
        """窗口关闭事件处理"""
        # 如果系统托盘可用，隐藏窗口而不是关闭
        if self.tray_icon and self.tray_icon.isVisible():
            # 最小化到托盘
            event.ignore()
            self.hide()
            self.tray_icon.showMessage(
                "DragonServer 启动器",
                "启动器已最小化到系统托盘",
                QSystemTrayIcon.Information,
                2000
            )
        else:
            # 如果托盘不可用，直接询问是否退出
            reply = QMessageBox.question(
                self, "确认退出", "确定要退出启动器吗？",
                QMessageBox.Yes | QMessageBox.No, QMessageBox.No
            )
            
            if reply == QMessageBox.Yes:
                event.accept()
                self.exit_application()
            else:
                event.ignore()
    
    def exit_application(self):
        """退出应用程序"""
        print("正在关闭启动器...")
        
        # 停止所有运行的程序
        self.process_manager.stop_all_running_programs()
        
        # 停止FastAPI服务
        if self.server:
            self.server.stop()
        
        # 配置已由ProcessManager在相关操作中自动保存
        
        # 释放共享内存，允许其他实例运行
        self.semaphore.acquire()
        self.shared_memory.detach()
        self.semaphore.release()
        
        # 退出应用
        QApplication.quit()