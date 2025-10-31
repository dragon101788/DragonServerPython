import os
import requests
import urllib3
from requests.packages.urllib3.exceptions import InsecureRequestWarning
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

class WebDAVClient:
    def __init__(self, base_url, username=None, password=None, token=None, verify_ssl=True):
        """初始化WebDAV客户端连接

        Args:
            base_url (str): WebDAV服务器基础URL
            username (str, optional): 登录用户名（用于Basic认证）
            password (str, optional): 登录密码（用于Basic认证）
            token (str, optional): 认证令牌（用于Bearer认证）
            verify_ssl (bool): 是否验证SSL证书，默认True
        """
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.verify = verify_ssl
        # 设置认证方式
        if token:
            self.session.headers['Authorization'] = f'Bearer {token}'
        elif username and password:
            self.session.auth = (username, password)
        else:
            raise ValueError("必须提供用户名和密码，或者token以进行认证")
        self.session.headers.update({
            'DAV': '1, 2',
            'Content-Type': 'application/xml'
        })

        # 连接测试
        try:
            print(f"尝试连接到WebDAV服务器: {self.base_url}")
            response = self.session.options(self.base_url, timeout=10)
            print(f"服务器响应状态码: {response.status_code}")
            if response.status_code not in (200, 207):
                raise ConnectionError(f"服务器不支持WebDAV，状态码: {response.status_code}")
            print("=== 成功连接到WebDAV服务器 ===")
        except requests.exceptions.RequestException as e:
            raise ConnectionError(f"无法连接到WebDAV服务器: {str(e)}")

    def list_files(self, remote_path='/'):
        """列出远程目录下的文件和文件夹

        Args:
            remote_path (str): 远程目录路径，默认为根目录

        Returns:
            list: 包含文件名的列表
        """
        url = f"{self.base_url}/{remote_path.lstrip('/')}"
        propfind_xml = '''<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>'''

        try:
            response = self.session.request(
                'PROPFIND',
                url,
                data=propfind_xml,
                headers={'Depth': '1'},
                timeout=30
            )
            response.raise_for_status()

            # 解析XML响应
            root = ET.fromstring(response.content)
            ns = {'d': 'DAV:'}
            files = []

            for response_elem in root.findall('.//d:response', ns):
                href = response_elem.find('d:href', ns).text
                # 提取文件名（排除当前目录）
                if href != remote_path and href != f"{remote_path}/":
                    filename = href.rstrip('/').split('/')[-1]
                    files.append(filename)

            return files
        except requests.exceptions.RequestException as e:
            raise Exception(f"列出文件失败: {str(e)}")
        except ET.ParseError as e:
            raise Exception(f"解析服务器响应失败: {str(e)}")

    def upload_file(self, local_path, remote_path):
        """上传本地文件到远程服务器

        Args:
            local_path (str): 本地文件路径
            remote_path (str): 远程文件路径
        """
        if not os.path.exists(local_path):
            raise FileNotFoundError(f"本地文件不存在: {local_path}")

        url = f"{self.base_url}/{remote_path.lstrip('/')}"

        try:
            with open(local_path, 'rb') as f:
                response = self.session.put(url, data=f, timeout=300)
                response.raise_for_status()
            print(f"文件上传成功: {local_path} -> {remote_path}")
        except requests.exceptions.RequestException as e:
            raise Exception(f"文件上传失败: {str(e)}")

    def download_file(self, remote_path, local_path):
        """从远程服务器下载文件到本地

        Args:
            remote_path (str): 远程文件路径
            local_path (str): 本地保存路径
        """
        url = f"{self.base_url}/{remote_path.lstrip('/')}"

        try:
            response = self.session.get(url, stream=True, timeout=300)
            response.raise_for_status()

            # 创建目录（如果需要）
            os.makedirs(os.path.dirname(local_path), exist_ok=True)

            with open(local_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            print(f"文件下载成功: {remote_path} -> {local_path}")
        except requests.exceptions.RequestException as e:
            raise Exception(f"文件下载失败: {str(e)}")
        except Exception as e:
            raise Exception(f"下载文件时发生未知错误: {str(e)}")

    def create_directory(self, remote_path):
        """在远程服务器创建目录

        Args:
            remote_path (str): 要创建的远程目录路径
        """
        url = f"{self.base_url}/{remote_path.lstrip('/')}"

        try:
            response = self.session.request('MKCOL', url, timeout=30)
            if response.status_code == 405:
                # 目录已存在
                return
            response.raise_for_status()
            print(f"目录创建成功: {remote_path}")
        except requests.exceptions.RequestException as e:
            raise Exception(f"创建目录失败: {str(e)}")

    def delete_resource(self, remote_path):
        """删除远程服务器上的文件或目录

        Args:
            remote_path (str): 要删除的远程资源路径
        """
        url = f"{self.base_url}/{remote_path.lstrip('/')}"

        try:
            response = self.session.delete(url, timeout=30)
            response.raise_for_status()
            print(f"资源删除成功: {remote_path}")
        except requests.exceptions.RequestException as e:
            raise Exception(f"删除资源失败: {str(e)}")

    def get_file_info(self, remote_path):
        """获取远程文件的信息

        Args:
            remote_path (str): 远程文件路径

        Returns:
            dict: 包含文件大小、修改时间等信息的字典
        """
        url = f"{self.base_url}/{remote_path.lstrip('/')}"
        propfind_xml = '''<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>'''

        try:
            response = self.session.request(
                'PROPFIND',
                url,
                data=propfind_xml,
                headers={'Depth': '0'},
                timeout=30
            )
            response.raise_for_status()

            root = ET.fromstring(response.content)
            ns = {'d': 'DAV:'}

            info = {
                'size': root.find('.//d:getcontentlength', ns).text if root.find('.//d:getcontentlength', ns) is not None else None,
                'modified': root.find('.//d:getlastmodified', ns).text if root.find('.//d:getlastmodified', ns) is not None else None,
                'is_directory': bool(root.find('.//d:resourcetype/d:collection', ns))
            }

            return info
        except requests.exceptions.RequestException as e:
            raise Exception(f"获取文件信息失败: {str(e)}")
        except ET.ParseError as e:
            raise Exception(f"解析服务器响应失败: {str(e)}")


# 示例用法
if __name__ == "__main__":
    # 配置连接信息
    WEBDAV_URL = "https://dragon101788.top:8901"

    try:
        # 使用token认证创建客户端实例（kwargs方式）
        client = WebDAVClient(
            base_url=WEBDAV_URL,
            token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImRyYWdvbiIsImV4cCI6MTc1MjY1NTI1OX0.tw6APasD2VEEOr2tV4xV5HgYLx0jWCpMuefPptdbV5w",
            verify_ssl=False
        )
        
        #client = WebDAVClient(WEBDAV_URL, "dragon", "Dragon101788!", verify_ssl=False)
        # 创建客户端实例
        print("成功连接到WebDAV服务器")

        # 示例操作
        print("\n=== 开始列出根目录文件 ===")
        files = client.list_files()
        print(f"找到 {len(files)} 个文件/目录")
        for i, file in enumerate(files, 1):
            print(f"{i}. {file}")
        print("=== 列出根目录文件完成 ===")

        # 创建目录示例
        client.create_directory("/I/test_dir")
        print("\n成功创建测试目录")

        # 上传文件示例
        client.upload_file("./test/a.txt", "/I/test_dir/a.txt")
        print("\n成功上传文件")

        # 下载文件示例
        client.download_file("/I/test_dir/a.txt", "./test/downloaded_file.txt")
        print("\n成功下载文件")

        # 获取文件信息示例
        info = client.get_file_info("/I/test_dir/a.txt")
        print("\n文件信息:", info)

        # 删除文件示例
        client.delete_resource("/I/test_dir/a.txt")
        client.delete_resource("/I/test_dir")
        print("\n成功删除文件和目录")

    except Exception as e:
        print(f"操作失败: {str(e)}")