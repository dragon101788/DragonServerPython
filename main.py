

import Resource
from src.ServerManagerPyqt import *
ServerManagerUI.get_instance()
import Resource





if __name__ == "__main__":
    manager = ServerManagerUI.get_instance()
    print(f"打包信息:{Resource.version.build_date} 版本:{Resource.version.version}");
    print(Resource.debug_path)
    manager.start_server_by_config()
    manager.run()
    print("程序结束")
