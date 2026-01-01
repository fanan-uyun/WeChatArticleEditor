import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
import httpx
from bs4 import BeautifulSoup
from markdownify import markdownify as md
import re
import datetime
import logging
import os

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 初始化 FastAPI 应用
app = FastAPI(title="微信文章转Markdown工具")

# 允许跨域（虽然前后端同源，但保留以备开发调试）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 数据模型 ---
class ArticleRequest(BaseModel):
    url: HttpUrl

class ArticleResponse(BaseModel):
    title: str
    author: str
    date: str
    content: str
    markdown: str

# --- 核心逻辑 ---

async def fetch_wechat_article(url: str) -> dict:
    logger.info(f"正在尝试抓取 URL: {url}")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
    }
    
    # follow_redirects=True 处理微信短链或重定向
    async with httpx.AsyncClient(verify=False, follow_redirects=True) as client:
        try:
            response = await client.get(url, headers=headers, timeout=15.0)
            response.raise_for_status()
        except Exception as e:
            logger.error(f"请求失败: {e}")
            raise HTTPException(status_code=400, detail=f"无法访问该链接: {str(e)}")

    html = response.text
    soup = BeautifulSoup(html, "html.parser")

    # 1. 提取元数据
    try:
        title_tag = soup.select_one('meta[property="og:title"]')
        title = title_tag["content"] if title_tag else soup.title.string if soup.title else "未命名文章"
        
        author_tag = soup.select_one('meta[name="author"]')
        author = author_tag["content"] if author_tag else "未知作者"
        
        publish_date = datetime.datetime.now().strftime("%Y-%m-%d")
        
    except Exception as e:
        logger.warning(f"元数据提取部分失败: {e}")
        title = "解析失败文章"
        author = "Unknown"
        publish_date = datetime.datetime.now().strftime("%Y-%m-%d")

    # 2. 提取并清理正文内容
    content_div = soup.select_one("#js_content")
    if not content_div:
        content_div = soup.select_one(".rich_media_content")
    if not content_div:
        content_div = soup.select_one("#img-content")

    if not content_div:
        logger.error("未找到文章正文内容")
        return {
            "title": title,
            "author": author,
            "date": publish_date,
            "content": "<p>无法解析正文，可能该文章包含特殊布局或已被删除。</p>",
            "markdown": f"# {title}\n\n> 无法解析正文内容，请检查链接是否有效。"
        }

    # 3. 处理图片懒加载
    for img in content_div.find_all("img"):
        if "data-src" in img.attrs:
            img["src"] = img["data-src"]
        elif "data-back-src" in img.attrs:
            img["src"] = img["data-back-src"]
            
        # 移除样式属性
        for attr in ["style", "class", "width", "height"]:
            if attr in img.attrs:
                del img[attr]

    # 4. 转换为 Markdown
    try:
        raw_markdown = md(str(content_div), heading_style="ATX", strip=["script", "style"])
        
        # --- 新增修复逻辑 START ---
        # 修复列表多余的点：去除列表项开头重复的 "•" 或 "·"
        # 匹配逻辑：行首(^) -> 空白/列表符(\s*[-*+]) -> 空格(\s+) -> 圆点([•·]) -> 可选空格(\s*)
        # (?m) 开启多行模式，确保 ^ 能匹配每一行的开头
        raw_markdown = re.sub(r'(?m)^(\s*[-*+])\s+[•·]\s*', r'\1 ', raw_markdown)
        # --- 新增修复逻辑 END ---
        
        # 清理多余空行
        cleaned_markdown = re.sub(r'\n{3,}', '\n\n', raw_markdown)
        cleaned_markdown = cleaned_markdown.replace("预览时标签不可点", "")
        
        final_markdown = f"""# {title}

> 作者: {author}
> 日期: {publish_date}
> 来源: [{url}]({url})

---

{cleaned_markdown}
"""
    except Exception as e:
        logger.error(f"Markdown 转换失败: {e}")
        final_markdown = f"# {title}\n\n转换出错: {str(e)}"

    logger.info("转换成功")
    return {
        "title": title,
        "author": author,
        "date": publish_date,
        "content": str(content_div),
        "markdown": final_markdown
    }

# --- API 路由 ---

@app.post("/api/convert", response_model=ArticleResponse)
async def convert_article(request: ArticleRequest):
    return await fetch_wechat_article(str(request.url))

@app.get("/")
async def read_root():
    # 确保 index.html 存在
    if os.path.exists("index.html"):
        return FileResponse("index.html")
    return {"error": "未找到 index.html，请确保前端文件与 main.py 在同一目录下"}

if __name__ == "__main__":
    print("服务正在启动...")
    print("请在浏览器中访问: http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)