import os
import sys
import shutil
import threading
import json
from datetime import datetime
from typing import List, Tuple
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, QPushButton,
    QComboBox, QCheckBox, QRadioButton, QFileDialog, QTreeWidget, QTreeWidgetItem, QTextEdit,
    QMessageBox, QTabWidget, QFrame, QGroupBox, QSplitter
)
from PyQt5.QtCore import Qt, pyqtSignal
from process import thread_process
from process import process

# 获取当前打包时间并生成简洁版本号
build_time = datetime.now()
version = build_time.strftime("%y%m%d%H")
build_date = build_time.strftime("%Y-%m-%d %H:%M:%S")


class PackageTool:
    def __init__(self):
        self.current_dir = os.path.dirname(os.path.abspath(__file__)).replace("\\", "/")
        os.chdir(self.current_dir)
        self.options = []
        self.output_name = "app"
        self.python_path = sys.executable
        self.process_thread = None

    def find_icon(self) -> str:
        """查找可用的图标文件"""
        icon_extensions = ['.ico', '.png', '.icns']
        icon_names = ['favicon', 'icon', 'app_icon']

        for ext in icon_extensions:
            for name in icon_names:
                icon_path = os.path.join(self.current_dir, f"{name}{ext}")
                if os.path.exists(icon_path):
                    return icon_path
        return ""



    def clean_dirs(self):
        try:
            """清理构建文件"""
            dirs_to_clean = ['build', 'dist']
            files_to_clean = ['*.spec']

            for dir_name in dirs_to_clean:
                dir_path = os.path.join(self.current_dir, dir_name)
                if os.path.exists(dir_path):
                    print(f"正在删除 {dir_path} 目录...")
                    shutil.rmtree(dir_path)

            for file_pattern in files_to_clean:
                for file in os.listdir(self.current_dir):
                    if file.endswith('.spec'):
                        file_path = os.path.join(self.current_dir, file)
                        print(f"正在删除 {file_path}...")
                        os.remove(file_path)
        except Exception as e:
            print(f"删除文件或目录时出错: {e}")
    def generate_pack_info(self) -> str:
        """生成 setup.py 脚本内容"""

        # 收集打包信息
        pack_info = {
            "build_date": build_date,
            "main_file": self.main_file,
            "output_name": self.output_name,
            "options": self.options,
            "resources": self.resources,
            "icon_path": self.icon_path,
            "version": version  # 添加简洁版本号
        }

        # 生成 packinfo.json 文件
        pack_info_file = os.path.join(self.current_dir, "packinfo.json")
        with open(pack_info_file, "w", encoding="utf-8") as f:
            json.dump(pack_info, f, ensure_ascii=False, indent=4)

        # 将 packinfo.json 添加到资源列表
        self.resources.append(("packinfo.json", "."))

    def build_exe_callback(self,ret):
        if ret == 0:
            print("\n打包成功!")
            path = os.path.normpath(os.path.join(self.current_dir, "dist"))
            print(f"打包成功! 输出目录: {path}")
            # 使用引号包裹路径，确保路径中包含空格时也能正确打开
            process(f'explorer "{path}"').run()
        else:
            print("打包失败!")

    def stop(self):
        if self.process_thread:
            self.process_thread.stop()
            self.process_thread = None
    def build_exe(self ,callback = None):
        """执行PyInstaller打包命令"""
        
        if callback == None:
            callback = self.build_exe_callback

        self.generate_pack_info()

        # 构建资源参数
        add_data = ' '.join(f'--add-data "{src};{dst}"' for src, dst in self.resources)
        # 构建图标参数
        icon_param = f'--icon="{self.icon_path}" -i "{self.icon_path}"' if self.icon_path else ''

        pyinstaller_exec = f"{self.python_path} -m PyInstaller"

        options_str = ' '.join(self.options)

        # 设置打包命令
        command = (
            f'{pyinstaller_exec} {options_str} '
            f'{icon_param} '
            f'--hidden-import=pystray._win32 '
            f'{add_data} '
            f'--name "{self.output_name}" '
            f'"{os.path.join(self.current_dir, self.main_file)}"'
        )
        

        print("\n开始打包...")
        self.process_thread = thread_process(command,prefix="[PyInstaller] ",callback=callback);
        self.process_thread.start()
        




class PackageToolUI(QMainWindow):
    information_signal = pyqtSignal(str)
    critical_signal = pyqtSignal(str)
    log_message_signal = pyqtSignal(str)

    def redirect_output(self):
        self.log_message_signal.connect(self.append_log_message)

        class StreamRedirect:
            def __init__(self, text_edit, log_signal):
                self.text_edit = text_edit
                self.log_signal = log_signal

            def write(self, text):
                if text == "\n":
                    return
                if text.endswith("\n"):
                    text = text[:-1]
                self.log_signal.emit(text)

            def flush(self):
                pass


        self.original_stdout = sys.stdout
        self.original_stderr = sys.stderr
        sys.stdout = StreamRedirect(self.log_text, self.log_message_signal)
        sys.stderr = StreamRedirect(self.log_text, self.log_message_signal)
    def __init__(self):
        super().__init__()
        
        self.tool = PackageTool()
        self.load_config(".pyinstaller.json")
        self.initUI()
        # 重定向标准输出到日志区
        self.redirect_output();
        # 连接信号和槽
        self.information_signal.connect(self.show_information)
        self.critical_signal.connect(self.show_critical)

    def append_log_message(self, message):
        self.log_text.append(message)
        self.log_text.verticalScrollBar().setValue(self.log_text.verticalScrollBar().maximum())

    def show_information(self,message):
        QMessageBox.information(self, "信息", message)

    def show_critical(self, error_msg):
        QMessageBox.critical(self, "错误", f"打包失败: {error_msg}")

    def initUI(self):
        self.setWindowTitle("pyinstaller打包工具 - by 胡鑫培")
        self.setGeometry(100, 100, 1100, 750)
        self.setMinimumSize(1100, 750)

        central_widget = QWidget()
        self.setCentralWidget(central_widget)

        main_layout = QVBoxLayout()
        central_widget.setLayout(main_layout)

        splitter = QSplitter(Qt.Horizontal)
        main_layout.addWidget(splitter)

        self.create_resource_panel(splitter)
        right_panel = QWidget()
        splitter.addWidget(right_panel)
        right_layout = QVBoxLayout()
        right_panel.setLayout(right_layout)

        self.create_path_frame(right_layout)
        self.create_options_frame(right_layout)
        self.create_log_area(right_layout)
        self.create_buttons(right_layout)

    def save_config(self, config_path):
        """保存当前打包配置到指定文件"""
        self.config = {
            "source_path": self.source_path_edit.text(),  # 直接从控件获取值
            "main_file": self.main_file_combobox.currentText(),  # 直接从控件获取值
            "output_name": self.output_name_edit.text(),  # 直接从控件获取值
            "icon_path": self.icon_edit.text(),  # 直接从控件获取值
            "onefile": self.onefile_check.isChecked(),  # 直接从控件获取值
            "windowed": self.windowed_radio.isChecked(),  # 直接从控件获取值
            "uac_admin": self.uac_admin_check.isChecked(),  # 直接从控件获取值
            "debug": self.debug_check.isChecked(),  # 直接从控件获取值
            "strip": self.strip_check.isChecked(),  # 直接从控件获取值
            "noupx": self.noupx_check.isChecked(),  # 直接从控件获取值
            "clean": self.clean_check.isChecked(),  # 直接从控件获取值
            "clean_spec": self.clean_spec_check.isChecked(),  # 直接从控件获取值
            "version_suffix": self.version_suffix_check.isChecked(),  # 直接从控件获取值
            "python_path": self.python_path_edit.text(),  # 直接从控件获取值
            "resources": []
        }

        # 保存资源列表
        for index in range(self.resource_tree.topLevelItemCount()):
            item = self.resource_tree.topLevelItem(index)
            src = item.text(0)
            dst = item.text(1)
            self.config["resources"].append((src, dst))

        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(self.config, f, ensure_ascii=False, indent=4)
    def load_config(self, config_path):
        """从指定文件加载上次的打包配置"""
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                self.config = json.load(f)
        except Exception as e:
            print(f"加载配置失败: {str(e)}")
            self.config = {}
    def save_config_dialog(self):
        """打开对话框让用户选择保存配置文件的路径"""
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存配置文件", ".pyinstaller.json", "JSON文件 (*.json);;所有文件 (*.*)"
        )
        if file_path:
            try:
                self.save_config(file_path)
                QMessageBox.information(self, "成功", f"配置已保存到: {file_path}")
                print(f"配置已保存到: {file_path}")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"保存配置文件失败: {str(e)}")
                print(f"保存配置失败: {str(e)}")
    
    def load_config_dialog(self):
        """打开对话框让用户选择要加载的配置文件"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "加载配置文件", ".pyinstaller.json", "JSON文件 (*.json);;所有文件 (*.*)"
        )
        if file_path:
            """从指定文件加载配置并更新UI"""
            print(f"加载配置文件: {file_path}")
            self.load_config(file_path)
            self.update_config_to_ui()
    
    def update_config_to_ui(self):
        self.source_path_edit.setText(self.config.get("source_path", ""))
        self.main_file_combobox.setCurrentText(self.config.get("main_file", ""))
        self.output_name_edit.setText(self.config.get("output_name", ""))
        self.icon_edit.setText(self.config.get("icon_path", ""))
        self.onefile_check.setChecked(self.config.get("onefile", False))
        self.windowed_radio.setChecked(self.config.get("windowed", False))
        self.uac_admin_check.setChecked(self.config.get("uac_admin", False))
        self.debug_check.setChecked(self.config.get("debug", False))
        self.strip_check.setChecked(self.config.get("strip", False))
        self.noupx_check.setChecked(self.config.get("noupx", False))
        self.clean_check.setChecked(self.config.get("clean", False))
        self.clean_spec_check.setChecked(self.config.get("clean_spec", False))
        self.version_suffix_check.setChecked(self.config.get("version_suffix", False))
        self.python_path_edit.setText(self.config.get("python_path", ""))
        self.resource_tree.clear()
        for src, dst in self.config.get("resources", []):
            item = QTreeWidgetItem([src, dst])
            self.resource_tree.addTopLevelItem(item)
    def create_resource_panel(self, parent):
        # 创建左侧资源面板
        resource_frame = QWidget()
        parent.addWidget(resource_frame)

        layout = QVBoxLayout()
        resource_frame.setLayout(layout)

        # 标题
        layout.addWidget(QLabel("资源列表"))

        # 创建树状视图
        self.resource_tree = QTreeWidget()
        self.resource_tree.setColumnCount(2)
        self.resource_tree.setHeaderLabels(["源路径", "目标路径"])
        self.resource_tree.setSelectionMode(QTreeWidget.ExtendedSelection)
        layout.addWidget(self.resource_tree)

        # 按钮框架
        btn_frame = QWidget()
        btn_layout = QVBoxLayout()  # 修改为垂直布局
        btn_frame.setLayout(btn_layout)

        # 第一行按钮
        btn_row1 = QWidget()
        btn_row1_layout = QHBoxLayout()
        btn_row1_layout.setContentsMargins(0, 0, 0, 0)  # 设置边距为0
        btn_row1.setLayout(btn_row1_layout)
        btn_row1_layout.addWidget(QPushButton("添加文件", clicked=self.add_resource_file))
        btn_row1_layout.addWidget(QPushButton("添加文件夹", clicked=self.add_resource_folder))
        btn_row1_layout.addWidget(QPushButton("删除", clicked=self.remove_resource))
        btn_row1_layout.addWidget(QPushButton("刷新", clicked=self.refresh_resources))
        
        # 第二行按钮
        btn_row2 = QWidget()
        btn_row2_layout = QHBoxLayout()
        btn_row2_layout.setContentsMargins(0, 0, 0, 0)  # 设置边距为0
        btn_row2.setLayout(btn_row2_layout)
        btn_row2_layout.addWidget(QPushButton("加载配置", clicked=self.load_config_dialog)) #弹出对话框选择配置文件
        btn_row2_layout.addWidget(QPushButton("保存配置", clicked=self.save_config_dialog)) #弹出对话框选择配置文件保存路径

        btn_layout.addWidget(btn_row1)
        btn_layout.addWidget(btn_row2)
        layout.addWidget(btn_frame)


        # 清空现有资源列表
        self.resource_tree.clear()

        # 加载资源列表
        for src, dst in self.config.get("resources", []):
            item = QTreeWidgetItem([src, dst])
            self.resource_tree.addTopLevelItem(item)

    def add_resource_file(self):
        files, _ = QFileDialog.getOpenFileNames(
            self, "选择要添加的资源文件", self.source_path_edit.text()  # 直接从控件获取值
        )
        for file_path in files:
            if file_path:
                rel_path = os.path.relpath(file_path, self.tool.current_dir)
                item = QTreeWidgetItem([rel_path, rel_path])
                self.resource_tree.addTopLevelItem(item)

    def add_resource_folder(self):
        folder = QFileDialog.getExistingDirectory(
            self, "选择要添加的资源文件夹", self.source_path_edit.text()  # 直接从控件获取值
        )
        if folder:
            rel_path = os.path.relpath(folder, self.tool.current_dir)
            item = QTreeWidgetItem([rel_path, rel_path])
            self.resource_tree.addTopLevelItem(item)

    def remove_resource(self):
        for item in self.resource_tree.selectedItems():
            (item.parent() or self.resource_tree.invisibleRootItem()).removeChild(item)

    def refresh_resources(self):
        # 清空现有项
        self.resource_tree.clear()

        # 重新扫描并添加资源
        resources = self.tool.scan_resources()
        for src, dst in resources:
            item = QTreeWidgetItem([src, dst])
            self.resource_tree.addTopLevelItem(item)

    def select_python_path(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择 Python 解释器", self.python_path_edit.text(), "Python 解释器 (*.exe);;所有文件 (*.*)"  # 直接从控件获取值
        )
        if file_path:
            try:
                self.python_path_edit.setText(file_path)
            except Exception as e:
                print(f"选择 Python 解释器失败: {str(e)}")


    def create_path_frame(self, parent):



        # 路径设置框架
        path_frame = QGroupBox("路径设置")
        path_layout = QVBoxLayout()
        path_frame.setLayout(path_layout)
        path_layout.setContentsMargins(0, 0, 0, 0)
        path_layout.setSpacing(0)
        parent.addWidget(path_frame)

        row1 = QWidget()
        row1_layout = QHBoxLayout()
        row1_layout.setContentsMargins(0, 0, 0, 0)
        row1_layout.setSpacing(0)
        row1.setLayout(row1_layout)

        row1_layout.addWidget(QLabel("Python 目录:"))
        self.python_path_edit = QLineEdit()
        # 加载 Python 路径配置
        self.python_path_edit.setText(self.config.get("python_path", sys.executable.replace("\\", "/")))
        row1_layout.addWidget(self.python_path_edit)
        row1_layout.addWidget(QPushButton("浏览", clicked=self.select_python_path))

        # 第一行：源目录和主文件
        row2 = QWidget()
        row2_layout = QHBoxLayout()
        row2_layout.setContentsMargins(0, 0, 0, 0)
        row2_layout.setSpacing(0)
        row2.setLayout(row2_layout)

        # 源目录选择（左半部分）
        source_frame = QWidget()
        source_layout = QHBoxLayout()
        source_frame.setLayout(source_layout)
        source_layout.addWidget(QLabel("源目录:"))
        self.source_path_edit = QLineEdit()
        self.source_path_edit.setText(self.config.get("source_path", self.tool.current_dir))
        source_layout.addWidget(self.source_path_edit)
        source_layout.addWidget(QPushButton("浏览", clicked=self.select_source_dir))

        # 主文件选择（右半部分）
        main_file_frame = QWidget()
        main_file_layout = QHBoxLayout()
        main_file_layout.setContentsMargins(0, 0, 0, 0)  # 调整边距
        main_file_layout.setSpacing(0)

        main_file_frame.setLayout(main_file_layout)
        main_file_layout.addWidget(QLabel("主文件:"))
        self.main_file_combobox = QComboBox()
        self.main_file_combobox.addItems(['main.py', 'app.py', 'server.py', 'run.py'])
        self.main_file_combobox.setCurrentText(self.config.get("main_file", ""))
        main_file_layout.addWidget(self.main_file_combobox)
        main_file_layout.addWidget(QPushButton("浏览", clicked=self.select_main_file))

        row2_layout.addWidget(source_frame)
        row2_layout.addWidget(main_file_frame)

        # 第二行：输出名称和图标文件
        row3 = QWidget()
        row3_layout = QHBoxLayout()
        row3_layout.setContentsMargins(0, 0, 0, 0)
        row3_layout.setSpacing(0)
        row3.setLayout(row3_layout)

        # 输出名称（左半部分）
        output_frame = QWidget()
        output_layout = QHBoxLayout()
        output_layout.setContentsMargins(5, 0, 5, 0)
        output_layout.setSpacing(0)
        output_frame.setLayout(output_layout)
        output_layout.addWidget(QLabel("输出名称:"))
        self.output_name_edit = QLineEdit()
        self.output_name_edit.setText(self.config.get("output_name", self.tool.current_dir.split("/")[-1]))
        output_layout.addWidget(self.output_name_edit)
        # 添加版本后缀复选框
        self.version_suffix_check = QCheckBox("版本后缀")
        # 加载版本后缀配置
        self.version_suffix_check.setChecked(self.config.get("version_suffix", False))
        output_layout.addWidget(self.version_suffix_check)

        # 图标选择（右半部分）
        icon_frame = QWidget()
        icon_layout = QHBoxLayout()
        icon_layout.setContentsMargins(5, 0, 5, 0)
        icon_layout.setSpacing(0)
        icon_frame.setLayout(icon_layout)
        icon_layout.addWidget(QLabel("图标文件:"))
        self.icon_edit = QLineEdit()
        # 加载图标路径配置
        self.icon_edit.setText(self.config.get("icon_path", ""))
        icon_layout.addWidget(self.icon_edit)
        icon_layout.addWidget(QPushButton("浏览", clicked=self.select_icon))
        self.icon_preview = QLabel()
        icon_layout.addWidget(self.icon_preview)

        row3_layout.addWidget(output_frame)
        row3_layout.addWidget(icon_frame)

        path_layout.addWidget(row1)
        path_layout.addWidget(row2)
        path_layout.addWidget(row3)

        parent.addWidget(path_frame)

    def select_icon(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择图标文件", self.source_path_edit.text(),  # 直接从控件获取值
            "图标文件 (*.ico *.png *.icns);;ICO文件 (*.ico);;PNG文件 (*.png);;ICNS文件 (*.icns);;所有文件 (*.*)"
        )
        if file_path:
            self.icon_edit.setText(file_path)
            self.update_icon_preview(file_path)

    def update_icon_preview(self, icon_path):
        try:
            from PyQt5.QtGui import QPixmap
            if os.path.exists(icon_path):
                pixmap = QPixmap(icon_path).scaled(32, 32, Qt.KeepAspectRatio)
                self.icon_preview.setPixmap(pixmap)
        except Exception as e:
            print(f"预览图标失败: {str(e)}")
            self.icon_preview.clear()

    def create_options_frame(self, parent):
        # 选项框架
        options_frame = QGroupBox("打包选项")
        options_layout = QHBoxLayout()
        options_frame.setLayout(options_layout)

        # 创建左右两列框架
        left_frame = QWidget()
        left_layout = QVBoxLayout()
        left_frame.setLayout(left_layout)
        right_frame = QWidget()
        right_layout = QVBoxLayout()
        right_frame.setLayout(right_layout)

        # 基础选项（左列）
        left_layout.addWidget(QLabel("基础选项:"))

        self.onefile_check = QCheckBox("单文件模式 (--onefile)")
        # 加载单文件模式配置
        self.onefile_check.setChecked(self.config.get("onefile", True))
        left_layout.addWidget(self.onefile_check)

        # 修改为带框的两行单选按钮
        console_group = QGroupBox("控制台选项")
        console_layout = QVBoxLayout()
        console_group.setLayout(console_layout)

        self.console_radio = QRadioButton("显示控制台 (--console)")
        self.console_radio.setChecked(not self.config.get("windowed", False))
        console_layout.addWidget(self.console_radio)
        self.windowed_radio = QRadioButton("无控制台窗口 (--windowed)")
        # 加载控制台窗口配置
        self.windowed_radio.setChecked(self.config.get("windowed", False))
        console_layout.addWidget(self.windowed_radio)

        left_layout.addWidget(console_group)

        self.uac_admin_check = QCheckBox("请求管理员权限 (--uac-admin)")
        # 加载管理员权限配置
        self.uac_admin_check.setChecked(self.config.get("uac_admin", False))
        left_layout.addWidget(self.uac_admin_check)
        self.clean_check = QCheckBox("清理旧文件")
        # 加载清理旧文件配置
        self.clean_check.setChecked(self.config.get("clean", True))
        left_layout.addWidget(self.clean_check)

        # 高级选项（右列）
        right_layout.addWidget(QLabel("高级选项:"))

        self.debug_check = QCheckBox("调试模式 (--debug)")
        # 加载调试模式配置
        self.debug_check.setChecked(self.config.get("debug", False))
        right_layout.addWidget(self.debug_check)
        self.strip_check = QCheckBox("减小文件体积 (--strip)")
        # 加载减小文件体积配置
        self.strip_check.setChecked(self.config.get("strip", False))
        right_layout.addWidget(self.strip_check)
        self.noupx_check = QCheckBox("禁用UPX压缩 (--noupx)")
        # 加载禁用UPX压缩配置
        self.noupx_check.setChecked(self.config.get("noupx", False))
        right_layout.addWidget(self.noupx_check)
        self.clean_spec_check = QCheckBox("清理spec文件")
        # 加载清理spec文件配置
        self.clean_spec_check.setChecked(self.config.get("clean_spec", True))
        right_layout.addWidget(self.clean_spec_check)

        options_layout.addWidget(left_frame)
        options_layout.addWidget(right_frame)

        parent.addWidget(options_frame)

    def create_log_area(self, parent):
        # 日志区域
        log_frame = QGroupBox("执行日志")
        log_layout = QVBoxLayout()
        log_frame.setLayout(log_layout)

        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setLineWrapMode(QTextEdit.WidgetWidth)
        log_layout.addWidget(self.log_text)

        parent.addWidget(log_frame)

    def create_buttons(self, parent):
        # 按钮区域
        button_frame = QWidget()
        button_layout = QHBoxLayout()
        button_frame.setLayout(button_layout)

        # 创建开始打包按钮并存储为实例变量
        self.start_package_button = QPushButton("开始打包")
        self.start_package_button.clicked.connect(self.start_package)
        button_layout.addWidget(self.start_package_button)
        
        button_layout.addWidget(QPushButton("清空日志", clicked=self.clear_log))

        parent.addWidget(button_frame)

    def select_source_dir(self):
        directory = QFileDialog.getExistingDirectory(self, "选择源目录", self.source_path_edit.text())
        if directory:
            directory = directory.replace( "\\",   "/")
            self.source_path_edit.setText(directory)
            self.tool.current_dir = directory # 更新当前目录
            # 更新主文件列表
            self.update_main_file_list()

    def select_main_file(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择主文件", self.source_path_edit.text(), "Python files (*.py);;All files (*.*)"
        )
        if file_path:
            try:
                self.main_file_combobox.addItems([file_path])
                self.main_file_combobox.setCurrentText(file_path)
            except Exception as e:
                print(f"选择主文件失败: {str(e)}")

    def update_main_file_list(self):
        # 扫描目录下的所有.py文件
        py_files = [f for f in os.listdir(self.tool.current_dir)
                    if f.endswith('.py') and os.path.isfile(os.path.join(self.tool.current_dir, f))]
        self.main_file_combobox.clear()
        self.main_file_combobox.addItems(py_files)

        # 尝试找到默认主文件
        default_files = ['main.py', 'app.py', 'server.py', 'run.py']
        for default_file in default_files:
            if default_file in py_files:
                self.main_file_combobox.setCurrentText(default_file)
                break
        else:
            if py_files:
                self.main_file_combobox.setCurrentText(py_files[0])

    def clear_log(self):
        self.log_text.clear()

    def start_package(self):
        # 保存当前配置
        self.save_config(".pyinstaller.json")

        # 从树状视图获取资源列表
        self.tool.resources = []

        # 检查必要的输入
        if not self.main_file_combobox.currentText():
            QMessageBox.critical(self, "错误", "请选择主文件！")
            return
        if not self.output_name_edit.text():
            QMessageBox.critical(self, "错误", "请输入输出文件名！")
            return
        
        self.tool.options = []
        if self.onefile_check.isChecked():
            self.tool.options.append("--onefile")

        if self.windowed_radio.isChecked():
            self.tool.options.append("--windowed")
        else:
            self.tool.options.append("--console")

        if self.uac_admin_check.isChecked():
            self.tool.options.append("--uac-admin")
        if self.debug_check.isChecked():
            self.tool.options.append("--debug")
        if self.strip_check.isChecked():
            self.tool.options.append("--strip")
        if self.noupx_check.isChecked():
            self.tool.options.append("--noupx")

        # 使用用户选择的图标
        self.tool.icon_path = self.icon_edit.text()
        if self.tool.icon_path and os.path.exists(self.tool.icon_path):
            print(f"\n使用选择的图标文件: {self.tool.icon_path}")
            # 将图标文件添加到资源列表中，确保它被包含在--add-data中
            self.tool.resources.append((self.tool.icon_path, '.'))
        else:
            self.tool.icon_path = self.tool.find_icon()
            if self.tool.icon_path:
                print(f"\n使用默认图标文件: {self.tool.icon_path}")
                # 将图标文件添加到资源列表中，确保它被包含在--add-data中
                self.tool.resources.append((self.tool.icon_path, '.'))
            else:
                print("\n未找到图标文件，将使用默认图标")

        self.tool.main_file = self.main_file_combobox.currentText()
        if not os.path.exists(os.path.join(self.tool.current_dir, self.tool.main_file)):
            QMessageBox.critical(self, "错误", f"找不到主文件: {self.tool.main_file}")
            return
        print(f"使用主文件: {self.tool.main_file}")

        
        for index in range(self.resource_tree.topLevelItemCount()):
            item = self.resource_tree.topLevelItem(index)
            src = item.text(0)
            dst = item.text(1)
            self.tool.resources.append((src, dst))

        if self.clean_check.isChecked():
            self.tool.clean_dirs()

        self.tool.output_name = self.output_name_edit.text()
        if self.version_suffix_check.isChecked():
            self.tool.output_name += f"{version}"


          
        self.tool.build_exe(self.build_exe_callback);
           
        #设置按钮 为 停止打包
        self.start_package_button.setText("停止打包")
        self.start_package_button.clicked.disconnect(self.start_package)
        self.start_package_button.clicked.connect(self.stop_package)
        
    def stop_package(self):
        self.tool.stop()
        self.start_package_button.setText("开始打包")
        self.start_package_button.clicked.disconnect(self.stop_package)
        self.start_package_button.clicked.connect(self.start_package)
        
    def build_exe_callback(self,ret):
        if ret == 0:
            print("\n打包成功!")
            path = os.path.normpath(os.path.join(self.tool.current_dir, "dist"))
            print(f"打包成功! 输出目录: {path}")
            process(f'explorer "{path}"',show_widnow=True).run()
            
        else:
            print("打包失败!")

        self.start_package_button.setText("开始打包")
        self.start_package_button.clicked.disconnect(self.stop_package)
        self.start_package_button.clicked.connect(self.start_package)



if __name__ == "__main__":
    app = QApplication(sys.argv)
    ui = PackageToolUI()
    ui.show()
    sys.exit(app.exec_())
