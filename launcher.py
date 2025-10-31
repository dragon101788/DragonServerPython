
#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
启动器
使用pyqt ,帮我写个启动器
支持设置开机自启动(设置Software\Microsoft\Windows\CurrentVersion\Run)
启动器负责开机启动其他的程序.(列表项,支持添加,删除,禁用,启用)
系统是windows平台
"""

import sys
import os
import json
import winreg
import time
import psutil

import ctypes
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
    QPushButton, QTableWidget, QTableWidgetItem, QFileDialog, 
    QCheckBox, QMessageBox, QHeaderView, QMenu, QAction, QInputDialog, QTextEdit,
    QAbstractItemView, QLabel, QLineEdit, QFrame, QSizePolicy, QStackedWidget, QSystemTrayIcon
)
from PyQt5.QtGui import QIcon, QFont
from PyQt5.QtCore import Qt, pyqtSignal, QDateTime, QTimer
import Resource

class LauncherApp(QMainWindow):
    """启动器主应用类"""
    log_signal = pyqtSignal(str)
    
    def __init__(self):
        super().__init__()
        self.programs = []
        self.config_file = os.path.join(Resource.get_executable_path(), "startup.json")
        self.init_ui()
        self.load_config()
        self.check_auto_startup()
        
        # 连接信号槽
        self.log_signal.connect(self.log_message)
        
        # 创建定时器用于定期检查进程状态
        self.process_check_timer = QTimer(self)
        self.process_check_timer.timeout.connect(self.check_process_status)
        self.process_check_timer.start(2000)  # 每2秒检查一次
        
        # 初始化系统托盘图标
        self.init_tray_icon()
        
        # 默认隐藏主窗口，只显示托盘图标
        self.hide()
    
    def init_ui(self):
        """初始化用户界面"""
        self.setWindowTitle("DragonServer 启动器")
        self.setGeometry(100, 100, 1000, 700)
        
        # 设置窗口图标
        icon_path = Resource.real_path_math("icon.ico")
        if os.path.exists(icon_path):
            self.setWindowIcon(QIcon(icon_path))
            
        # 设置中文字体
        font = QFont()
        font.setFamily("SimHei")
        self.setFont(font)
        
        # 创建中心部件
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # 主布局
        main_layout = QVBoxLayout(central_widget)
        
        # 工具栏
        toolbar_layout = QHBoxLayout()
        
        # 退出启动器按钮
        self.exit_btn = QPushButton("退出启动器")
        self.exit_btn.clicked.connect(self.exit_application)
        toolbar_layout.addWidget(self.exit_btn)
        
        main_layout.addLayout(toolbar_layout)
        
        # 创建水平布局用于左右分割
        horizontal_layout = QHBoxLayout()
        main_layout.addLayout(horizontal_layout)
        
        # 左侧：程序列表和添加按钮
        left_side_widget = QWidget()
        left_side_layout = QVBoxLayout(left_side_widget)
        # 设置左侧部件的拉伸因子，使它能占据适当比例的空间
        horizontal_layout.addWidget(left_side_widget, 1)  # 左侧占1份
        
        # 程序列表表格
        self.program_table = QTableWidget()
        self.program_table.setColumnCount(3)  # 名称、开机启动和状态三列
        self.program_table.setHorizontalHeaderLabels(["名称", "自启", "状态"])
        self.program_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.program_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeToContents)
        self.program_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeToContents)
        self.program_table.setContextMenuPolicy(Qt.CustomContextMenu)
        self.program_table.customContextMenuRequested.connect(self.show_context_menu)
        # 设置选择整行
        self.program_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.program_table.setSelectionMode(QAbstractItemView.SingleSelection)
        # 设置程序列表宽度 - 只保留最小宽度，移除最大宽度限制，让它能随布局自动调整
        self.program_table.setMinimumWidth(250)
        self.program_table.cellChanged.connect(self.on_program_cell_changed)
        left_side_layout.addWidget(self.program_table)
        
        # 添加程序按钮 - 移到列表下方
        self.add_btn = QPushButton("添加程序")
        self.add_btn.clicked.connect(self.add_program)
        left_side_layout.addWidget(self.add_btn)
        
        # 右侧：任务属性配置和日志
        right_side_widget = QWidget()
        right_side_layout = QVBoxLayout(right_side_widget)
        # 设置右侧部件的拉伸因子，使它能占据适当比例的空间
        horizontal_layout.addWidget(right_side_widget, 3)  # 右侧占3份
        
        # 创建QStackedWidget用于显示不同程序的属性面板
        self.properties_stacked_widget = QStackedWidget()
        
        # 创建默认的空属性面板
        self.empty_property_panel = QWidget()
        empty_layout = QVBoxLayout(self.empty_property_panel)
        empty_label = QLabel("请选择一个程序以查看其属性")
        empty_label.setAlignment(Qt.AlignCenter)
        empty_layout.addWidget(empty_label)
        self.properties_stacked_widget.addWidget(self.empty_property_panel)
        
        # 添加到右侧布局
        right_side_layout.addWidget(self.properties_stacked_widget)
        
        # 添加分割线
        separator = QFrame()
        separator.setFrameShape(QFrame.HLine)
        separator.setFrameShadow(QFrame.Sunken)
        right_side_layout.addWidget(separator)
        
        # 右下角：日志显示区域
        log_title = QLabel("日志输出")
        font = QFont()
        font.setBold(True)
        log_title.setFont(font)
        right_side_layout.addWidget(log_title)
        
        self.log_textedit = QTextEdit()
        self.log_textedit.setReadOnly(True)
        self.log_textedit.setMinimumHeight(200)
        right_side_layout.addWidget(self.log_textedit)
        
        # 状态栏
        self.statusBar().showMessage("就绪")
        
        # 开机自启动复选框 - 移至状态栏右侧
        self.auto_startup_checkbox = QCheckBox()
        self.auto_startup_checkbox.stateChanged.connect(self.toggle_auto_startup)
        status_label = QLabel("启动器开机自启动：")
        
        # 创建水平布局用于状态栏
        status_widget = QWidget()
        status_layout = QHBoxLayout(status_widget)
        status_layout.addWidget(status_label)
        status_layout.addWidget(self.auto_startup_checkbox)
        status_layout.setContentsMargins(0, 0, 0, 0)
        status_widget.setLayout(status_layout)
        
        # 将小部件添加到状态栏的右侧
        self.statusBar().addPermanentWidget(status_widget)
        
        # 用于存储每个程序的属性面板和控件
        self.program_panels = []
        
        # 连接信号槽，当选择的行变化时更新属性面板
        self.program_table.currentCellChanged.connect(self.on_program_selected)

    def load_config(self):
        """从配置文件加载程序列表"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    self.programs = json.load(f)
                self.update_program_table()
                # 清除现有的属性面板
                self.clear_property_panels()
        except Exception as e:
            QMessageBox.critical(self, "错误", f"加载配置文件失败: {str(e)}")
    
    def clear_property_panels(self):
        """清除所有现有的属性面板（除了默认的空面板）"""
        # 保存对空面板的引用
        empty_panel = self.properties_stacked_widget.widget(0)
        
        # 清除堆栈窗口
        while self.properties_stacked_widget.count() > 0:
            widget = self.properties_stacked_widget.widget(0)
            self.properties_stacked_widget.removeWidget(widget)
            # 只删除非空面板
            if widget != empty_panel:
                widget.deleteLater()
        
        # 重新添加空面板（如果需要）
        if self.properties_stacked_widget.count() == 0:
            self.properties_stacked_widget.addWidget(empty_panel)
        
        # 清空面板信息列表
        self.program_panels = []
        
        # 切换到空面板
        self.properties_stacked_widget.setCurrentIndex(0)
    
    def save_config(self):
        """保存程序列表到配置文件"""
        try:
            self.log_message(f"保存路径:{self.config_file}")
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.programs, f, ensure_ascii=False, indent=4)
            return True
        except Exception as e:
            QMessageBox.critical(self, "错误", f"保存配置文件失败: {str(e)}")
            return False
    
    def update_program_table(self):
        """更新程序列表表格"""
        self.program_table.setRowCount(0)
        
        for program in self.programs:
            row_position = self.program_table.rowCount()
            self.program_table.insertRow(row_position)
            
            # 程序名称
            self.program_table.setItem(row_position, 0, QTableWidgetItem(program.get('name', '未命名')))
            
            # 开机启动复选框
            startup_checkbox = QCheckBox()
            startup_checkbox.setChecked(program.get('startup_with_windows', False))
            startup_checkbox.stateChanged.connect(
                lambda state, idx=row_position: self.toggle_program_startup(idx, state)
            )
            self.program_table.setCellWidget(row_position, 1, startup_checkbox)
            
            # 运行状态
            status_item = QTableWidgetItem()
            status_item.setTextAlignment(Qt.AlignCenter)
            if self.is_program_running(program):
                status_item.setText("运行中")
                status_item.setForeground(Qt.green)
            else:
                status_item.setText("未运行")
            self.program_table.setItem(row_position, 2, status_item)
    
    def is_program_running(self, program):
        """检查程序是否正在运行"""
        executable_name = os.path.basename(program['path'])
        try:
            for proc in psutil.process_iter(['name', 'exe']):
                try:
                    proc_info = proc.info
                    if (proc_info['name'] == executable_name or 
                        (proc_info['exe'] and os.path.basename(proc_info['exe']) == executable_name)):
                        return True
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
        except Exception as e:
            self.log_signal.emit(f"检查程序 '{program['name']}' 状态时出错: {str(e)}")
        return False
    
    def add_program(self):
        """添加新程序"""
        file_path, _ = QFileDialog.getOpenFileName(self, "选择程序", "", "可执行文件 (*.exe);;所有文件 (*.*)")
        
        if file_path:
            # 自动使用文件名作为程序名称
            name = os.path.basename(file_path)
            
            # 获取工作目录
            cwd = os.path.dirname(file_path)
            
            
            # 添加到程序列表
            self.programs.append({
                'name': name,
                'path': file_path,
                'cwd': cwd,
                'args':  '',
                'startup_with_windows': False,
                'try_admin': False
            })
            
            # 更新表格并保存配置
            self.update_program_table()
            self.save_config()
    
    
    def remove_program(self):
        """删除选中的程序"""
        selected_row = self.program_table.currentRow()
        if selected_row < 0 or selected_row >= len(self.programs):
            QMessageBox.warning(self, "警告", "请先选择一个程序")
            return
        
        # 确认删除
        reply = QMessageBox.question(
            self, "确认删除", f"确定要删除程序 '{self.programs[selected_row]['name']}' 吗?",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            # 停止可能正在运行的程序
            program = self.programs[selected_row]
            if self.is_program_running(program):
                self.stop_program(program)
            
            # 删除程序
            self.programs.pop(selected_row)
            
            # 如果删除的程序有对应的属性面板，也需要删除
            if selected_row < len(self.program_panels):
                # 保存当前选中的索引
                current_index = self.properties_stacked_widget.currentIndex()
                
                # 获取要删除的面板
                panel_info = self.program_panels.pop(selected_row)
                panel = panel_info.get('panel')
                
                # 从堆栈窗口中移除面板
                self.properties_stacked_widget.removeWidget(panel)
                panel.deleteLater()
                
                # 如果删除的是当前显示的面板，切换到空面板
                if current_index == selected_row + 1:
                    self.properties_stacked_widget.setCurrentIndex(0)
            
            # 更新表格并保存配置
            self.update_program_table()
            self.save_config()
    
    def start_selected_program(self):
        """启动选中的程序"""
        selected_row = self.program_table.currentRow()
        if selected_row < 0 or selected_row >= len(self.programs):
            QMessageBox.warning(self, "警告", "请先选择一个程序")
            return
        
        program = self.programs[selected_row]
        
        # 检查程序是否已经在运行
        if self.is_program_running(program):
            QMessageBox.information(self, "提示", f"程序 '{program['name']}' 已经在运行")
            return
        
        # 启动程序
        self.start_program(program)
    
    def start_program(self, program):
        """使用ShellExecuteW启动指定的程序"""
        try:
            # 检查程序文件是否存在
            if not os.path.exists(program['path']):
                QMessageBox.critical(self, "错误", f"程序文件不存在: {program['path']}")
                return
            
            # 检查程序是否已经在运行
            if self.is_program_running(program):
                self.log_signal.emit(f"程序 '{program['name']}' 已经在运行")
                return
            
            cmd = program['path']
            cwd = program.get('cwd', None)
            args = program.get('args', '')
            run_as_admin = program.get('try_admin', False)
            
            self.log_signal.emit(f"启动程序: {cmd}")
            
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
                self.log_signal.emit(f"ShellExecute失败，错误代码: {result}")
                return
            
            # 等待程序启动
            admin_text = "(管理员权限)" if run_as_admin else ""
            self.log_signal.emit(f"程序 '{program['name']}' 已启动{admin_text}")
            
            self.statusBar().showMessage(f"正在启动程序: {program['name']}")
            # 更新属性面板中的运行状态
            self.update_program_status()
        except Exception as e:
            self.log_signal.emit(f"启动程序 '{program['name']}' 失败: {str(e)}")
            QMessageBox.critical(self, "错误", f"启动程序失败: {str(e)}")
    
    def stop_selected_program(self):
        """停止选中的程序"""
        selected_row = self.program_table.currentRow()
        if selected_row < 0 or selected_row >= len(self.programs):
            QMessageBox.warning(self, "警告", "请先选择一个程序")
            return
        
        program = self.programs[selected_row]
        
        if self.is_program_running(program):
            self.stop_program(program)
        else:
            QMessageBox.information(self, "提示", f"程序 '{program['name']}' 未在运行")
    
    def stop_program(self, program):
        """停止指定的程序"""
        program_name = program['name']
        run_as_admin = program.get('try_admin', False)
        
        # 通过进程名终止
        self._terminate_process_by_name(program)
        
        self.statusBar().showMessage(f"已停止程序: {program_name}")
        self.update_program_status()
    
    def _terminate_process_by_name(self, program):
        """通过进程名终止程序"""
        executable_name = os.path.basename(program['path'])
        program_name = program['name']
        
        try:
            for proc in psutil.process_iter(['name', 'exe']):
                try:
                    proc_info = proc.info
                    if (proc_info['name'] == executable_name or 
                        (proc_info['exe'] and os.path.basename(proc_info['exe']) == executable_name)):
                        proc.terminate()
                        try:
                            proc.wait(timeout=3)
                            self.log_signal.emit(f"已终止进程: {proc_info['name']}")
                        except psutil.TimeoutExpired:
                            proc.kill()
                            self.log_signal.emit(f"强制终止进程: {proc_info['name']}")
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
        except Exception as e:
            self.log_signal.emit(f"终止程序 '{program_name}' 时出错: {str(e)}")
    
    def check_process_status(self):
        """定期检查进程状态"""
        # 直接更新程序状态显示
        self.update_program_status()

    def toggle_program_startup(self, index, state):
        """切换程序的开机启动状态"""
        if 0 <= index < len(self.programs):
            self.programs[index]['startup_with_windows'] = state != 0
            
            # 同步更新属性面板中的复选框状态（如果存在）
            if index < len(self.program_panels):
                panel_info = self.program_panels[index]
                startup_checkbox = panel_info.get('startup_checkbox')
                if startup_checkbox:
                    startup_checkbox.blockSignals(True)
                    startup_checkbox.setChecked(state != 0)
                    startup_checkbox.blockSignals(False)
                
            self.save_config()
            self.log_message(f"已{'启用' if state != 0 else '禁用'}程序 '{self.programs[index]['name']}' 的开机启动")
    

    
    def show_context_menu(self, position):
        """显示右键菜单"""
        menu = QMenu()
        
        # 添加菜单项
        start_action = QAction("启动", self)
        start_action.triggered.connect(self.start_selected_program)
        menu.addAction(start_action)
        
        stop_action = QAction("停止", self)
        stop_action.triggered.connect(self.stop_selected_program)
        menu.addAction(stop_action)
        
        menu.addSeparator()
        
        
        remove_action = QAction("删除", self)
        remove_action.triggered.connect(self.remove_program)
        menu.addAction(remove_action)
        
        # 显示菜单
        menu.exec_(self.program_table.mapToGlobal(position))
    
    def log_message(self, message):
        """记录日志信息"""
        # 获取当前时间
        current_time = QDateTime.currentDateTime().toString("yyyy-MM-dd hh:mm:ss")
        # 格式化日志消息
        log_entry = f"[{current_time}] {message}"
        # 将日志添加到QTextEdit
        self.log_textedit.append(log_entry)
        # 滚动到底部以显示最新日志
        self.log_textedit.moveCursor(self.log_textedit.textCursor().End)
        # 同时在状态栏显示
        self.statusBar().showMessage(message)
        # 控制台输出
        print(f"[{current_time}] {message}")
    
    def on_program_finished(self, program_name, return_code):
        """处理程序结束事件（兼容性保留）"""
        # 这个方法现在主要是为了保持兼容性
        # 实际的进程结束检测由check_process_status方法通过定时器定期执行
        self.log_message(f"程序 '{program_name}' 已结束")
        # 更新属性面板中的运行状态
        self.update_program_status()
    
    def create_program_property_panel(self, program_index):
        """为指定索引的程序创建属性面板"""
        if program_index >= len(self.programs):
            return
            
        program = self.programs[program_index]
        panel = QWidget()
        layout = QVBoxLayout(panel)
        
        
        # 创建表单布局用于属性输入
        form_layout = QVBoxLayout()
        
        # 名称属性
        name_layout = QHBoxLayout()
        name_label = QLabel("名称:")
        name_edit = QLineEdit()
        name_edit.setText(program.get('name', '未命名'))
        name_edit.setReadOnly(True)
        name_layout.addWidget(name_label)
        name_layout.addWidget(name_edit)
        form_layout.addLayout(name_layout)
        
        # 路径属性
        path_layout = QHBoxLayout()
        path_label = QLabel("路径:")
        path_edit = QLineEdit()
        path_edit.setText(program.get('path', ''))
        path_edit.setReadOnly(True)
        path_layout.addWidget(path_label)
        path_layout.addWidget(path_edit)
        form_layout.addLayout(path_layout)
        
        # 参数属性
        args_layout = QHBoxLayout()
        args_label = QLabel("参数:")
        args_edit = QLineEdit()
        args_edit.setText(program.get('args', ''))
        args_edit.setReadOnly(True)
        args_layout.addWidget(args_label)
        args_layout.addWidget(args_edit)
        form_layout.addLayout(args_layout)
        
        # 工作目录属性
        cwd_layout = QHBoxLayout()
        cwd_label = QLabel("工作目录:")
        cwd_edit = QLineEdit()
        cwd_edit.setText(program.get('cwd', ''))
        cwd_edit.setReadOnly(True)
        cwd_layout.addWidget(cwd_label)
        cwd_layout.addWidget(cwd_edit)
        form_layout.addLayout(cwd_layout)
        
        # 开机启动属性
        startup_layout = QHBoxLayout()
        startup_label = QLabel("开机启动:")
        startup_checkbox = QCheckBox()
        startup_checkbox.setChecked(program.get('startup_with_windows', False))
        # 连接信号到对应的槽函数，并传递程序索引
        startup_checkbox.stateChanged.connect(
            lambda state, idx=program_index: self.on_startup_checkbox_changed(idx, state)
        )
        startup_layout.addWidget(startup_label)
        startup_layout.addWidget(startup_checkbox)
        form_layout.addLayout(startup_layout)
        
        # 管理员权限属性
        admin_layout = QHBoxLayout()
        admin_label = QLabel("管理员权限:")
        admin_checkbox = QCheckBox()
        admin_checkbox.setChecked(program.get('try_admin', False))
        # 连接信号到对应的槽函数，并传递程序索引
        admin_checkbox.stateChanged.connect(
            lambda state, idx=program_index: self.on_admin_checkbox_changed(idx, state)
        )
        admin_layout.addWidget(admin_label)
        admin_layout.addWidget(admin_checkbox)
        form_layout.addLayout(admin_layout)
        
        # 运行状态属性
        status_layout = QHBoxLayout()
        status_label = QLabel("运行状态:")
        status_value_label = QLabel()
        if self.is_program_running(program):
            status_value_label.setText('运行中')
            status_value_label.setStyleSheet('color: green;')
        else:
            status_value_label.setText('未运行')
        status_layout.addWidget(status_label)
        status_layout.addWidget(status_value_label)
        form_layout.addLayout(status_layout)
        
        # 将表单布局添加到属性面板
        layout.addLayout(form_layout)
        
        # 保存面板和控件引用
        self.program_panels.append({
            'panel': panel,
            'name_edit': name_edit,
            'path_edit': path_edit,
            'args_edit': args_edit,
            'cwd_edit': cwd_edit,
            'startup_checkbox': startup_checkbox,
            'admin_checkbox': admin_checkbox,
            'status_label': status_value_label
        })
        
        # 添加到堆栈窗口
        self.properties_stacked_widget.addWidget(panel)
        
    def on_program_selected(self, current_row, current_col, previous_row, previous_col):
        """当选择的程序行变化时切换到对应的属性面板"""
        if current_row >= 0 and current_row < len(self.programs):
            # 确保为当前程序创建了属性面板
            if current_row >= len(self.program_panels):
                # 为缺失的面板创建属性面板
                for i in range(len(self.program_panels), len(self.programs)):
                    self.create_program_property_panel(i)
            
            # 切换到对应的属性面板
            # 注意索引+1，因为第一个面板是默认的空面板
            self.properties_stacked_widget.setCurrentIndex(current_row + 1)
            
            # 更新运行状态
            self.update_program_status()
        else:
            # 切换到默认的空面板
            self.properties_stacked_widget.setCurrentIndex(0)
            
    def on_program_cell_changed(self, row, column):
        """当程序表格单元格内容变化时更新程序信息"""
        if row >= 0 and row < len(self.programs):
            program = self.programs[row]
            if column == 0:  # 名称
                program['name'] = self.program_table.item(row, 0).text()
                self.save_config()
                # 更新属性面板
                self.on_program_selected(row, column, -1, -1)
                
                # 如果该程序已有属性面板，更新面板标题
                if row < len(self.program_panels):
                    panel_info = self.program_panels[row]
                    panel = panel_info.get('panel')
                    if panel and hasattr(panel, 'layout'):
                        # 获取布局中的第一个控件（标题标签）
                        layout = panel.layout()
                        if layout and layout.count() > 0:
                            title_widget = layout.itemAt(0).widget()
                            if isinstance(title_widget, QLabel):
                                title_widget.setText(f"任务属性配置 - {program.get('name', '未命名')}")
                
    def update_program_status(self):
        """更新所有程序的运行状态显示"""
        # 更新表格中的所有状态显示
        for i, program in enumerate(self.programs):
            status_item = self.program_table.item(i, 2)
            if status_item:
                if self.is_program_running(program):
                    status_item.setText("运行中")
                    status_item.setForeground(Qt.green)
                else:
                    status_item.setText("未运行")
                    status_item.setForeground(Qt.black)
        
        # 更新所有属性面板中的状态显示
        for i, panel_info in enumerate(self.program_panels):
            if i < len(self.programs):
                program = self.programs[i]
                status_label = panel_info.get('status_label')
                if status_label:
                    if self.is_program_running(program):
                        status_label.setText('运行中')
                        status_label.setStyleSheet('color: green;')
                    else:
                        status_label.setText('未运行')
                        status_label.setStyleSheet('')
                
    def on_startup_checkbox_changed(self, program_index, state):
        """处理开机启动复选框状态变化"""
        if program_index >= 0 and program_index < len(self.programs):
            self.programs[program_index]['startup_with_windows'] = state != 0
            
            # 同步更新表格中的复选框状态
            checkbox = self.program_table.cellWidget(program_index, 1)
            if checkbox and isinstance(checkbox, QCheckBox):
                checkbox.blockSignals(True)
                checkbox.setChecked(state != 0)
                checkbox.blockSignals(False)
            
            # 同步更新其他面板中的复选框状态（如果存在）
            if program_index < len(self.program_panels):
                panel_info = self.program_panels[program_index]
                startup_checkbox = panel_info.get('startup_checkbox')
                if startup_checkbox:
                    startup_checkbox.blockSignals(True)
                    startup_checkbox.setChecked(state != 0)
                    startup_checkbox.blockSignals(False)
            
            self.save_config()
            self.log_message(f"已{'启用' if state != 0 else '禁用'}程序 '{self.programs[program_index]['name']}' 的开机启动")
            
    def on_admin_checkbox_changed(self, program_index, state):
        """处理管理员权限复选框状态变化"""
        if program_index >= 0 and program_index < len(self.programs):
            self.programs[program_index]['try_admin'] = state != 0
            
            # 同步更新其他面板中的复选框状态（如果存在）
            if program_index < len(self.program_panels):
                panel_info = self.program_panels[program_index]
                admin_checkbox = panel_info.get('admin_checkbox')
                if admin_checkbox:
                    admin_checkbox.blockSignals(True)
                    admin_checkbox.setChecked(state != 0)
                    admin_checkbox.blockSignals(False)
            
            self.save_config()
            self.log_message(f"已{'启用' if state != 0 else '禁用'}程序 '{self.programs[program_index]['name']}' 的管理员权限")
    
    def check_auto_startup(self):
        """检查启动器是否已设置为开机自启动"""
        try:
            key = winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Run",
                0,
                winreg.KEY_READ
            )
            
            # 尝试获取当前程序的开机自启动值
            value, _ = winreg.QueryValueEx(key, "DragonServerLauncher")
            winreg.CloseKey(key)
            
            # 检查注册表中的值是否包含当前程序路径
            if getattr(sys, 'frozen', False):
                # 已打包为exe文件
                exe_path = sys.executable
                is_auto_startup = exe_path in value or f'"{exe_path}"' in value
            else:
                # 以Python脚本运行
                python_exe = sys.executable
                script_path = os.path.abspath(sys.argv[0])
                
                is_auto_startup = (
                    (python_exe in value and script_path in value) or
                    (f'"{python_exe}"' in value and f'"{script_path}"' in value) or
                    (python_exe in value and f'"{script_path}"' in value) or
                    (f'"{python_exe}"' in value and script_path in value)
                )
            
            self.auto_startup_checkbox.setChecked(is_auto_startup)
            return is_auto_startup
        except (WindowsError, FileNotFoundError, OSError):
            # 如果注册表键不存在或发生其他错误，则返回False
            self.auto_startup_checkbox.setChecked(False)
            return False
    
    def toggle_auto_startup(self, state):
        """切换启动器的开机自启动状态"""
        is_enabled = state != 0
        self.set_auto_startup(is_enabled)
        
        status = "已启用" if is_enabled else "已禁用"
        self.log_message(f"启动器开机自启动{status}")
    
    def set_auto_startup(self, enable):
        """设置或取消设置启动器的开机自启动"""
        try:
            key = winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Run",
                0,
                winreg.KEY_SET_VALUE
            )
            
            if enable:
                # 设置开机自启动
                if getattr(sys, 'frozen', False):
                    # 已打包为exe文件
                    exe_path = sys.executable
                    # 用引号包裹路径，确保Windows能正确识别包含空格的路径
                    cmd_line = f'"{exe_path}"' if ' ' in exe_path or len(exe_path) > 0 else exe_path
                else:
                    # 以Python脚本运行
                    python_exe = sys.executable
                    script_path = os.path.abspath(sys.argv[0])
                    
                    # 处理路径中可能包含的空格，用引号包裹
                    if ' ' in python_exe:
                        python_exe = f'"{python_exe}"' if ' ' in python_exe else python_exe
                    if ' ' in script_path:
                        script_path = f'"{script_path}"' if ' ' in script_path else script_path
                    
                    # 构建命令行字符串
                    cmd_line = f"{python_exe} {script_path}"
                
                # 将完整的命令行写入注册表
                winreg.SetValueEx(key, "DragonServerLauncher", 0, winreg.REG_SZ, cmd_line)
            else:
                # 取消开机自启动
                try:
                    winreg.DeleteValue(key, "DragonServerLauncher")
                except FileNotFoundError:
                    # 如果值不存在，忽略错误
                    pass
            
            winreg.CloseKey(key)
        except Exception as e:
            QMessageBox.critical(self, "错误", f"设置开机自启动失败: {str(e)}")
    
    def start_all_startup_programs(self):
        """启动所有设置为开机启动的程序"""
        for program in self.programs:
            if program.get('startup_with_windows', False):
                self.start_program(program)
    
    def init_tray_icon(self):
        """初始化系统托盘图标"""
        # 创建系统托盘图标
        self.tray_icon = QSystemTrayIcon(self)
        
        # 尝试从本地文件加载图标
        icon_path = Resource.find_file_by_suffix(".ico")
        
        if os.path.exists(icon_path):
            self.tray_icon.setIcon(QIcon(icon_path))
        
        # 设置托盘图标提示
        self.tray_icon.setToolTip("DragonServer 启动器")
        
        # 创建托盘菜单
        self.tray_menu = QMenu()
        
        # 显示窗口菜单项
        show_action = QAction("显示窗口", self)
        show_action.triggered.connect(self.show_window)
        self.tray_menu.addAction(show_action)
        
        # 启动所有程序菜单项
        start_all_action = QAction("启动所有程序", self)
        start_all_action.triggered.connect(self.start_all_startup_programs)
        self.tray_menu.addAction(start_all_action)
        
        # 分隔线
        self.tray_menu.addSeparator()
        
        # 退出菜单项
        exit_action = QAction("退出", self)
        exit_action.triggered.connect(self.exit_application)
        self.tray_menu.addAction(exit_action)
        
        # 设置托盘菜单
        self.tray_icon.setContextMenu(self.tray_menu)
        
        # 连接托盘图标激活信号
        self.tray_icon.activated.connect(self.on_tray_icon_activated)
        
        # 显示托盘图标
        self.tray_icon.show()
        
        # 记录日志
        self.log_message("程序已最小化到系统托盘")
        
    def show_window(self):
        """显示主窗口"""
        self.show()
        self.raise_()
        self.activateWindow()
        
    def on_tray_icon_activated(self, reason):
        """处理托盘图标激活事件"""
        # 双击托盘图标显示窗口
        if reason == QSystemTrayIcon.DoubleClick:
            self.show_window()
    
    def exit_application(self):
        """退出应用程序"""
        # 停止所有正在运行的程序
        for program in self.programs:
            if self.is_program_running(program):
                self.stop_program(program)
        
        # 停止定时器
        self.process_check_timer.stop()
        
        # 隐藏托盘图标
        self.tray_icon.hide()
        
        # 退出应用程序
        sys.exit(0)
        
    def closeEvent(self, event):
        """处理窗口关闭事件"""
        # 忽略关闭事件，最小化到托盘
        event.ignore()
        self.hide()
        self.log_message("窗口已最小化到系统托盘")

if __name__ == "__main__":
    # 确保中文显示正常
    font = QFont("SimHei")
    
    app = QApplication(sys.argv)
    app.setFont(font)
    
    # 设置应用程序图标
    icon_path = Resource.find_file_by_suffix(".ico")
    if os.path.exists(icon_path):
        app.setWindowIcon(QIcon(icon_path))
    
    launcher = LauncherApp()
    
    # 启动所有设置为开机启动的程序
    launcher.start_all_startup_programs()
    
    sys.exit(app.exec_())