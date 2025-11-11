import sys
import os

from PyQt5.QtWidgets import QApplication
from PyQt5.QtCore import Qt

# 导入重构后的launcher模块
from src.launcher.PyqtUI import LauncherApp


def main():
    """主函数"""
    # 确保中文显示正常
    os.environ['QT_FONT_DPI'] = '96'
    
    # 创建QApplication实例
    app = QApplication(sys.argv)
    
    # 设置应用程序信息
    app.setApplicationName("DragonServer Launcher")
    app.setApplicationVersion("1.0.0")
    
    # 确保应用程序的样式正确
    app.setStyle("Fusion")
    
    # 创建并显示主窗口
    launcher = LauncherApp()
    # 进入事件循环
    sys.exit(app.exec_())

if __name__ == "__main__":
    main()