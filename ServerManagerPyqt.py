from PyQt5.QtWidgets import QApplication, QWidget, QVBoxLayout ,QAction, QHBoxLayout, QPushButton, QTextEdit, QLabel, QStatusBar, QFileDialog, QMenu, QCheckBox
from PyQt5.QtGui import QIcon, QImage, QPixmap
from PyQt5.QtCore import QTimer, QEvent
from ServerManager import *
from PIL import Image
import pystray
import sys
import datetime
import queue
import os
import threading
import time
import winreg
import psutil

class ServerManagerUI(ServerManager, QApplication):
    _instance = None
    @staticmethod
    def get_instance():
        """
        返回 ServerManagerUI 类的单件实例，如果实例不存在则创建一个新实例。

        :param name: 传递给 ServerManagerUI 构造函数的名称参数
        :return: ServerManagerUI 类的单件实例
        """
        if ServerManagerUI._instance is None:
            ServerManagerUI._instance = ServerManagerUI("龙图腾服务器管理器")
        return ServerManagerUI._instance

    class MainWidget(QWidget):
        def __init__(self, parent_ui):
            super().__init__()
            self.parent_ui = parent_ui
            self.elapsed_seconds = 0
            self.setup_ui()
            
        def closeEvent(self, a0):
            self.hide()
            a0.ignore()

        
        def setup_ui(self):
            self.setWindowTitle(self.parent_ui.name)
            self.setGeometry(100, 100, 800, 600)

            # 控制面板
            control_layout = QHBoxLayout()

            self.start_btn = QPushButton("启动服务", self)
            self.start_btn.clicked.connect(self.parent_ui.start_server)
            control_layout.addWidget(self.start_btn)

            self.stop_btn = QPushButton("停止服务", self)
            self.stop_btn.clicked.connect(self.parent_ui.stop_server)
            self.stop_btn.setEnabled(False)
            control_layout.addWidget(self.stop_btn)

            self.restart_btn = QPushButton("重启服务", self)
            self.restart_btn.clicked.connect(self.parent_ui.restart_server)
            self.restart_btn.setEnabled(False)
            control_layout.addWidget(self.restart_btn)

            # 添加退出按钮
            self.quit_btn = QPushButton("退出程序", self)
            self.quit_btn.clicked.connect(self.parent_ui.quit_application)
            control_layout.addWidget(self.quit_btn)


            
            self.auto_startup_checkbox = QCheckBox("开机自启动", self)
            self.auto_startup_checkbox.setChecked(self.parent_ui.is_auto_startup)
            self.auto_startup_checkbox.stateChanged.connect(self.parent_ui.toggle_auto_startup)
            control_layout.addWidget(self.auto_startup_checkbox)


            
            # 日志区域
            self.log_text = QTextEdit(self)
            self.log_text.setReadOnly(True)

            # 状态栏
            self.status_bar = QStatusBar(self)
            self.status_bar.showMessage("服务状态: 未运行")

            # 主布局
            main_layout = QVBoxLayout()
            main_layout.addLayout(control_layout)
            main_layout.addWidget(self.log_text)
            main_layout.addWidget(self.status_bar)

            self.setLayout(main_layout)

            # 创建右键菜单
            self.log_text.setContextMenuPolicy(3)  # Qt.ActionsContextMenu
            self.log_menu = QMenu(self)

            # 创建 QAction 对象并添加到菜单
            copy_selected_action = QAction("复制选中内容", self)
            copy_selected_action.triggered.connect(self.copy_selected_log)
            self.log_menu.addAction(copy_selected_action)

            copy_all_action = QAction("复制全部内容", self)
            copy_all_action.triggered.connect(self.copy_all_log)
            self.log_menu.addAction(copy_all_action)

            self.log_menu.addSeparator()

            clear_log_action = QAction("清空日志", self)
            clear_log_action.triggered.connect(self.clear_log)
            self.log_menu.addAction(clear_log_action)

            self.log_menu.addSeparator()

            save_log_action = QAction("保存日志", self)
            save_log_action.triggered.connect(self.save_log)
            self.log_menu.addAction(save_log_action)

            self.log_text.setContextMenuPolicy(1)  # Qt.CustomContextMenu
            self.log_text.customContextMenuRequested.connect(self.show_log_menu)

            # 添加键盘快捷键
            copy_action = QAction("复制", self)
            copy_action.triggered.connect(self.copy_selected_log)
            copy_action.setShortcut("Ctrl+C")
            self.log_text.addAction(copy_action)

            select_all_action = QAction("全选", self)
            select_all_action.triggered.connect(self.select_all_log)
            select_all_action.setShortcut("Ctrl+A")
            self.log_text.addAction(select_all_action)

            

        def show_log_menu(self, pos):
            """显示右键菜单"""
            self.log_menu.exec_(self.log_text.mapToGlobal(pos))

        
        def copy_selected_log(self):
            """复制选中的日志内容"""
            selected_text = self.log_text.textCursor().selectedText()
            if selected_text:
                self.parent_ui.clipboard().setText(selected_text)
                self.parent_ui.add_log("已复制选中内容到剪贴板")
            else:
                self.parent_ui.add_log("请先选择要复制的内容")

        def copy_all_log(self):
            """复制所有日志内容"""
            all_text = self.log_text.toPlainText()
            self.parent_ui.clipboard().setText(all_text)
            self.parent_ui.add_log("已复制全部日志到剪贴板")

        def clear_log(self):
            """清空日志"""
            self.log_text.clear()
            self.parent_ui.add_log("日志已清空")

        def select_all_log(self):
            """选择所有日志内容"""
            self.log_text.selectAll()

        def save_log(self):
            """保存日志到文件"""
            try:
                filename, _ = QFileDialog.getSaveFileName(
                    self,
                    "保存日志文件",
                    "",
                    "Log files (*.log);;Text files (*.txt);;All files (*.*)"
                )
                if filename:
                    with open(filename, 'w', encoding='utf-8') as f:
                        log_content = self.log_text.toPlainText()
                        f.write(log_content)
                    self.parent_ui.add_log(f"日志已保存到: {filename}")
            except Exception as e:
                self.parent_ui.add_log(f"保存日志失败: {str(e)}")

        def update_buttons(self, starting: bool):
            self.start_btn.setEnabled(not starting)
            self.stop_btn.setEnabled(starting)
            self.restart_btn.setEnabled(starting)

        def event(self, event):
            if event.type() == QEvent.User:
                while not self.parent_ui.log_queue.empty():
                    log = self.parent_ui.log_queue.get()
                    self.log_text.append(log)
                    # 滚动到日志底部
                    self.log_text.verticalScrollBar().setValue(self.log_text.verticalScrollBar().maximum())
                return True
            return super().event(event)

        def update_running_time(self):
            """更新状态栏中的运行时间"""
            self.elapsed_seconds += 1
            hours, remainder = divmod(self.elapsed_seconds, 3600)
            minutes, seconds = divmod(remainder, 60)
            time_str = f"{hours:02}:{minutes:02}:{seconds:02}"

            # 更新状态栏
            self.status_bar.showMessage(f"服务状态: {'正在运行' if self.parent_ui.is_running else '未运行'} | 版本:{Resource.version.version} | 启动时间: {time_str}")

    def get_parents_name(self):
        """
        递归获取当前进程的所有父进程名称
        返回每一级父进程的名称列表
        """
        try:
            parents = []
            current_process = psutil.Process(os.getpid())
            
            # 递归获取所有父进程
            while True:
                parent_process = current_process.parent()
                if parent_process:
                    parent_name = parent_process.name()
                    parents.append(parent_name)
                    current_process = parent_process
                else:
                    break
                    
            print(f"parents={parents}")
            return parents
        except Exception as e:
            print(f"获取父进程信息时出错: {str(e)}")
            return []
    
    def __init__(self, name):
        # 调用 ServerManager 的 __init__ 方法
        ServerManager.__init__(self, name)
        # 调用 QApplication 的 __init__ 方法
        QApplication.__init__(self, sys.argv)
        self.name = name

        # 先检查开机自启动状态，确保在创建MainWidget前设置好
        self.is_auto_startup = self.check_auto_startup()
        
        self.log_queue = queue.Queue()

        self.main_widget = self.MainWidget(self)

        print(f"Resource.path.templates={Resource.path.templates}")
        print(f"Resource.path.static={Resource.path.static}")

        icon_path = os.path.join(Resource.path.static, "icon.ico")
        try:
            with open(icon_path, 'rb') as f:
                bytes = f.read()
                self.icon = Image.open(os.path.join(Resource.path.static, "icon.ico"))
                # 将 PIL 图像转换为 QImage
                qimage = QImage(self.icon.tobytes(), self.icon.width, self.icon.height, self.icon.width * 4, QImage.Format_RGBA8888)
                # 将 QImage 转换为 QPixmap
                pixmap = QPixmap.fromImage(qimage)
                # 将 QPixmap 转换为 QIcon
                self.main_widget.setWindowIcon(QIcon(pixmap))
            print(f"成功加载图标{icon_path}")
        except Exception as e:
            print(f"警告: 无法加载图标文件，使用默认图标 {e}")
            self.icon = Image.new('RGBA', (32, 32), 'blue')

        self.setup_tray()

        #使用新方法获取所有父进程名称
        parent_names = self.get_parents_name()
        print(f"父进程名称列表: {parent_names}")
        
        # 检查是否有任何父进程包含"launcher"字符串
        if any("launcher" in name.lower() for name in parent_names):
            self.main_widget.auto_startup_checkbox.setDisabled(True)
            self.main_widget.auto_startup_checkbox.setText("启动器启动")
        else:
            self.main_widget.auto_startup_checkbox.setDisabled(False)
        
            
        # 开始更新运行时间
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.main_widget.update_running_time)
        self.timer.start(1000)

    def setup_tray(self):
        # 初始化托盘图标的菜单
        self.auto_startup_item = pystray.MenuItem(
            "开机自启动", 
            self.toggle_auto_startup_tray, 
            checked=lambda item: self.is_auto_startup
        )
        
        self.systray = pystray.Icon(
            "server_manager",
            self.icon,
            self.name,
            menu=pystray.Menu(
                pystray.MenuItem("显示主窗口", self.show_window),
                pystray.MenuItem("隐藏主窗口", self.hide_window),
                self.auto_startup_item,
                pystray.MenuItem("退出", self.quit_application),
            ),
        )

        # 立即在独立线程中启动托盘图标
        threading.Thread(target=self.systray.run, daemon=True).start()

    def start_server(self):
        if not self.is_running:
            self.main_widget.update_buttons(True)  # 启用停止和重启按钮，禁用启动按钮
            super().start_server()

    def stop_server(self):
        if self.is_running:
            self.main_widget.update_buttons(False)  # 启用启动按钮，禁用停止和重启按钮
            super().stop_server()

    def restart_server(self):
        if self.is_running:
            self.main_widget.update_buttons(False)  # 禁用所有按钮直到重启完成
            super().stop_server()
            time.sleep(1)  # 等待服务完全停止
            super().start_server()
            self.main_widget.update_buttons(True)  # 重启完成后启用停止和重启按钮，禁用启动按钮

    def show_window(self, icon=None, item=None):
        """显示主窗口"""
        self.main_widget.show()
        self.main_widget.activateWindow()

    def hide_window(self, icon=None, item=None):
        self.main_widget.hide()

    def add_log(self, message):
        super().add_log(message)

        log = self.format_log(message)
        # 将日志添加到队列
        self.log_queue.put(log)
        # 发送自定义事件来触发日志更新
        event = QEvent(QEvent.Type(QEvent.User))
        QApplication.postEvent(self.main_widget, event)

    def check_auto_startup(self):
        """
        检查程序是否已设置为开机自启动
        支持检查带参数的命令行设置
        """
        try:
            key = winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Run",
                0, 
                winreg.KEY_READ
            )
            value, _ = winreg.QueryValueEx(key, "DragonServer")
            winreg.CloseKey(key)
            
            if getattr(sys, 'frozen', False):
                # 当程序被pyinstaller打包后，检查注册表中的值是否包含当前exe路径
                # 需要考虑路径可能被引号包裹的情况
                exe_path = sys.executable
                return exe_path in value or f'"{exe_path}"' in value
            else:
                # 当以Python脚本方式运行时，检查注册表中的值是否包含Python解释器和脚本路径
                python_exe = sys.executable
                script_path = os.path.abspath(sys.argv[0])
                
                # 考虑多种可能的格式
                return (
                    (python_exe in value and script_path in value) or 
                    (f'"{python_exe}"' in value and f'"{script_path}"' in value) or
                    (python_exe in value and f'"{script_path}"' in value) or
                    (f'"{python_exe}"' in value and script_path in value)
                )
        except (WindowsError, FileNotFoundError, OSError):
            # 捕获所有可能的错误，包括WindowsError、FileNotFoundError和OSError
            return False

    def toggle_auto_startup(self, state):
        """
        切换开机自启动状态
        """
        is_enabled = state != 0
        self.set_auto_startup(is_enabled)
        self.is_auto_startup = is_enabled
        
        # 更新托盘菜单中的状态
        if hasattr(self, 'auto_startup_item'):
            # pystray会自动更新菜单项的选中状态
            pass
        
        self.add_log(f"开机自启动已{'启用' if is_enabled else '禁用'}")

    def toggle_auto_startup_tray(self, icon, item):
        """
        从托盘菜单切换开机自启动状态
        """
        is_enabled = not self.is_auto_startup
        self.set_auto_startup(is_enabled)
        self.is_auto_startup = is_enabled
        
        # 更新UI中的复选框状态
        if hasattr(self.main_widget, 'auto_startup_checkbox'):
            self.main_widget.auto_startup_checkbox.setChecked(is_enabled)
        
        self.add_log(f"开机自启动已{'启用' if is_enabled else '禁用'}")
        return not item.checked

    def set_auto_startup(self, enable):
        """
        设置或取消设置开机自启动
        支持Python脚本和pyinstaller打包后的exe，确保Windows能正确启动程序
        """
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
                    # 当程序被pyinstaller打包后
                    exe_path = sys.executable
                    # 无论是否有参数，始终用引号包裹路径，确保Windows能正确识别包含空格的路径
                    if ' ' in exe_path or len(exe_path) > 0:
                        cmd_line = f'"{exe_path}"'  # 始终用引号包裹，避免路径解析问题
                else:
                    # 当以Python脚本方式运行时
                    # 获取Python解释器的路径
                    python_exe = sys.executable
                    # 获取当前脚本的完整路径
                    script_path = os.path.abspath(sys.argv[0])
                    
                    # 处理路径中可能包含的空格，用引号包裹
                    if ' ' in python_exe:
                        python_exe = f'"{python_exe}"'
                    if ' ' in script_path:
                        script_path = f'"{script_path}"'
                    
                    # 构建命令行字符串
                    cmd_line = f"{python_exe} {script_path}"
                
                print(f"设置开机自启动命令: {cmd_line}")
                # 将完整的命令行写入注册表
                winreg.SetValueEx(key, "DragonServer", 0, winreg.REG_SZ, cmd_line)
            else:
                # 取消开机自启动
                try:
                    print("取消开机自启动")
                    winreg.DeleteValue(key, "DragonServer")
                except FileNotFoundError:
                    # 如果值不存在，忽略错误
                    pass
            
            winreg.CloseKey(key)
        except Exception as e:
            self.add_log(f"设置开机自启动失败: {str(e)}")

    def quit_application(self):
        self.stop_server()
        self.restore_output()  # 确保退出前恢复输出

        # 停止托盘图标线程
        def stop_tray():
            self.systray.stop()
        threading.Thread(target=stop_tray, daemon=True).start()

        self.main_widget.close()
        self.exit()
        os._exit(0)

    def run(self):
        self.start_server()
        self.main_widget.show()
        return self.exec_()


