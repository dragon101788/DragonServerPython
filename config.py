import importlib.util
import Resource
import os
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler


def check_dict_diffrent(src, dst,tab=""):

    for key, value in src.items():
        if key not in dst:
            print(f"{tab} 新增项'{key}' '{value}'")
        elif isinstance(value, dict):
            check_dict_diffrent(value, dst[key],tab+"  ")
        elif isinstance(value, list):
            
                for i in range(len(value)):
                    try:
                        if isinstance(value[i], dict):
                            check_dict_diffrent(value[i], dst[key][i],tab+"   ")
                        else:
                            if value[i]!= dst[key][i]:
                                print(f"{tab}\t项目改动 '{key}' : {value[i]} vs {dst[key][i]}")
                    except IndexError:
                        print(f"{tab}\t删除项 '{key}' : {value[i]}")
        elif value != dst[key]:
            print(f"{tab}项目改动 '{key}' : {value} vs {dst[key]}")
        else:
            print(f"{tab}同样的项目 '{key}' = {value}")

class ConfigBase(FileSystemEventHandler):

    def create_file(self,config_path):
        self.config = {};
        
        path = os.path.join(Resource.get_executable_path(), config_path)
        config_dir = os.path.dirname(path)

        # 如果目录不存在，创建目录
        if not os.path.exists(config_dir):
            os.makedirs(config_dir)
        self.save_to_file(path);
        self.config_path = Resource.real_path_math(config_path)

    def update_defconfig(self,defconfig):
        changed = False
        for k,v in defconfig.items():
            if k not in self.config:
                self.config[k] = v;
                changed = True; 
        
        if changed:
            self.save_to_file(self.config_path)
    def __init__(self, config_path,**kwargs):
        self.config_path = Resource.real_path_math(config_path)
        if self.config_path is None:
            if kwargs is not None and "default_config" in kwargs:
                self.create_file(config_path);
            else:
                raise Exception("配置文件不存在,并且没有默认配置")
        
        self.update_from_file(self.config_path);

        if kwargs is not None and "default_config" in kwargs:
            self.update_defconfig(kwargs["default_config"]);
        
        self.observer = Observer()
        self.observer.schedule(self, path=os.path.dirname(self.config_path), recursive=False)
        self.observer.start()

    def check_nonefile_and_makeit(self, path):
        config_path = Resource.real_path_math(path)
    def save_to_file(self, path):
        raise NotImplementedError("子类必须实现 save_to_file 方法")

    def check_diffrent(self, new_config):
        check_dict_diffrent(self.config, new_config)

    def update(self, new_config):
        self.config.update(new_config)
        self.save_to_file(self.config_path) 
    
    def to_dict(self):
        return self.config
    
    def update_from_file(self,path):
        raise NotImplementedError("子类必须实现 update_from_file 方法")
    
    def on_modified(self, event):
        if event.src_path == self.config_path:
            self.update_from_file(self.config_path)
    
    def get(self, key, default=None):
        return self.config.get(key, default)
    def set(self, key, value):
        self.config[key] = value
        self.save_to_file(self.config_path)
    def __getitem__(self, key):
        return self.config[key]
    def __getattr__(self, name):
        try:
            return self.config.get(name, None)
        except KeyError:
            return None
    def __setitem__(self, key, value):
        self.config[key] = value
        self.save_to_file(self.config_path)

    def __delitem__(self, key):
        del self.config[key]
        self.save_to_file(self.config_path)
    
 

    def __delattr__(self, name):
        del self.config[name]
        self.save_to_file(self.config_path)

    def __contains__(self, key):
        return key in self.config
    def __len__(self):
        return len(self.config)

    def __iter__(self):
        return iter(self.config)

    def __str__(self):
        return str(self.config)
    
    def __repr__(self):
        return repr(self.config)
    
    #返回一个深拷贝
    def instance(self):
        return self.config.copy()
    

class PythonConfig(ConfigBase):
    def __init__(self, config_path,**kwargs):
        super().__init__(config_path,**kwargs)
    def save_to_file(self, path):

        print(f"ChatAI 创建文件并写入默认配置 {path}")

        with open(path, 'w', encoding='utf-8') as f:
            f.write(f"# 这是 ChatAPI 的配置文件\n")
            f.write(f"config = {repr(self.config)}\n")


    def update_from_file(self,path):
        
        # 动态导入配置文件
        spec = importlib.util.spec_from_file_location("config_module", path)
        self.config_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.config_module)
        self.config = self.config_module.config;
    
if __name__ == "__main__":
    config = PythonConfig("config1.py")
    print(config.config)

    config = PythonConfig("config1.py",default_config={"a":1,"b":2})
    print(config.config)

    config2 = PythonConfig("config1.py",default_config={"d":1,"e":2})
    print(config.config)

    print(config.a,config.d,config.c,config.d)