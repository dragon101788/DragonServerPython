import os
import sys
import shutil
from typing import List, Tuple

class PackageTool:
    def __init__(self):
        self.current_dir = os.path.dirname(os.path.abspath(__file__))
        os.chdir(self.current_dir);
        self.exclude_dirs = {
            'build', 'dist', '__pycache__', '.git', '.idea', '.vscode',
            'venv', 'env', '.pytest_cache', '.mypy_cache'
        }
        self.exclude_files = {
            'build.py', '.gitignore', '.env', 'requirements.txt',
            'README.md', '.pylintrc', '.python-version'
        }
        self.exclude_extensions = {
            '.pyc', '.pyo', '.pyd', '.so', '.spec', '.git', '.log'
        }

    def scan_resources(self) -> List[Tuple[str, str]]:
        """自动扫描需要打包的资源文件和目录"""
        resources = []

        for root, dirs, files in os.walk(self.current_dir):
            # 排除不需要的目录
            dirs[:] = [d for d in dirs if d not in self.exclude_dirs]

            # 获取相对路径
            rel_path = os.path.relpath(root, self.current_dir)
            if rel_path == '.':
                continue

            # 检查是否为资源目录
            if any(files) and rel_path not in self.exclude_dirs:
                resources.append((rel_path, rel_path))

        return resources

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

    def find_main_file(self) -> str:
        """查找主程序文件"""
        main_files = ['main.py', 'app.py', 'server.py', 'run.py']
        for file in main_files:
            if os.path.exists(os.path.join(self.current_dir, file)):
                return file
        return ""

    def clean_dirs(self):
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

    def build_exe(self, resources: List[Tuple[str, str]], main_file: str, icon_path: str):
        """执行PyInstaller打包命令"""
        # 构建资源参数
        add_data = ' '.join(f'--add-data "{src};{dst}"' for src, dst in resources)


        # 构建图标参数
        icon_param = f'--icon="{icon_path}"' if icon_path else ''

        pyinstaller_path = 'E:/AI/python/conda_python311/Scripts/pyinstaller'
        options=[];
        options.append("--noconfirm");
        options.append("--onefile");
        #options.append("---windowed");
        options_str = ' '.join(options);
        # 设置打包命令
        command = (
            f'{pyinstaller_path}  {options_str}  '
            f'{icon_param} '
            f'--hidden-import=pystray._win32 '
            f'{add_data} '
            f'--name "FastAPIServer" '
            f'"{os.path.join(self.current_dir, main_file)}"'
        )

        print("\n打包命令:")
        print(command)
        print("\n开始打包...")

        result = os.system(command)

        if result == 0:
            print("\n打包成功!")
            exe_path = os.path.join(self.current_dir, 'dist', 'FastAPIServer.exe')
            print(f"生成的程序位置: {exe_path}")
        else:
            print("\n打包失败!")
            sys.exit(1)

    def main(self):
        try:
            print("=== FastAPI服务器打包工具 ===")
            print("\n正在扫描项目资源...")

            # 查找主程序文件
            main_file = self.find_main_file()
            if not main_file:
                print("错误: 找不到主程序文件 (main.py, app.py, server.py 或 run.py)")
                sys.exit(1)
            print(f"找到主程序文件: {main_file}")

            # 扫描资源
            resources = self.scan_resources()
            print("\n找到以下资源:")
            for src, dst in resources:
                print(f"- {src} -> {dst}")

            # 查找图标
            icon_path = self.find_icon()
            if icon_path:
                print(f"\n找到图标文件: {icon_path}")
            else:
                print("\n未找到图标文件，将使用默认图标")

            # 询问是否清理之前的构建文件
            clean = input("\n是否清理之前的构建文件？(y/n): ").lower() == 'y'
            if clean:
                self.clean_dirs()

            # 开始打包
            self.build_exe(resources, main_file, icon_path)

            input("\n按回车键退出...")

        except KeyboardInterrupt:
            print("\n打包过程被用户中断")
        except Exception as e:
            print(f"\n发生错误: {str(e)}")
            input("按回车键退出...")

if __name__ == "__main__":
    PackageTool().main()
