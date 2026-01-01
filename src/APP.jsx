import React, { useState, useEffect, useRef, useMemo } from 'react';
import ToolsPanel from './components/ToolsPanel';
import { 
  Settings, 
  Component, 
  Layout, 
  Smartphone, 
  Monitor, 
  Copy, 
  Check, 
  Image as ImageIcon,
  Code,
  Type,
  Maximize,
  MoveHorizontal,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
  Bold,
  Italic,
  Strikethrough,
  Link2,
  List,
  ListOrdered,
  Terminal,
  Save,
  ScrollText,
  RefreshCw,
  Trash2,
  Tag,
  Share
} from 'lucide-react';

const VERSION = "v1.3.9";
const STORAGE_KEY_PREFIX = "wce_v1_3_9_"; 

// 默认初始内容
const DEFAULT_MARKDOWN = `# 欢迎使用 Pro 版编辑器 (${VERSION})

本次更新新增了 **快捷键支持**，让写作更流畅。

## 1. 常用快捷键
- **加粗**：Ctrl/Cmd + B
- *斜体*：Ctrl/Cmd + I
- ~~删除线~~：Ctrl/Cmd + D
- \`行内代码\`：Ctrl/Cmd + E
- [插入链接](https://github.com)：Ctrl/Cmd + K
- 💾 **保存**：Ctrl/Cmd + S

## 2. 列表快捷键
- 无序列表：Ctrl/Cmd + Shift + U
- 有序列表：Ctrl/Cmd + Shift + O

## 3. 之前的优化依然保留
- **错位修复**：编辑时光标对齐准确。
- **列表缩进**：清晰的层级感。
- **代码高亮**：琥珀色高亮代码块。

---
开始您的创作吧！
`;

/* =============================================================================
  1. 预览区语法高亮引擎 (用于右侧预览)
  =============================================================================
*/
const highlightSyntax = (code, isDark = false, themeColor = '#9333ea') => {
  let safeCode = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const colors = {
    comment: isDark ? '#7f848e' : '#9ca3af', 
    string:  '#d14', 
    stringDark: '#e06c75', 
    number:  isDark ? '#d19a66' : '#d97706', 
    keyword: themeColor, 
    func:    isDark ? '#61afef' : '#2563eb', 
    tag:     isDark ? '#e06c75' : '#dc2626', 
  };

  const activeStringColor = isDark ? colors.stringDark : colors.string;

  const tokenRegex = /((?:\/\/.*$|#.*$|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->))|((?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`))|(\b\d+\b)|(\b(?:const|let|var|function|return|if|else|for|while|class|import|from|def|print|try|catch|async|await|new|this|super|true|false|null|undefined|export|default|break|continue|switch|case|public|private|protected|interface|type|struct|impl|fn|mut|package|main|go|select|defer|int|string|bool|float64|void|None|True|False)\b)|(\b[a-zA-Z_]\w*(?=\())/gm;

  return safeCode.replace(tokenRegex, (match, comment, string, number, keyword, func) => {
    let style = '';
    if (comment) style = `color: ${colors.comment}; font-style: italic;`;
    else if (string) style = `color: ${activeStringColor};`; 
    else if (number) style = `color: ${colors.number};`; 
    else if (keyword) style = `color: ${colors.keyword}; font-weight: bold;`; 
    else if (func) style = `color: ${colors.func};`; 
    
    return style ? `<span style="${style}">${match}</span>` : match;
  });
};

/* =============================================================================
  2. 编辑区高亮渲染器 (Input Highlighter)
  =============================================================================
*/
const renderInputHighlight = (text) => {
  const lines = text.split('\n');
  let inCode = false;

  const parseInline = (lineContent) => {
    // 简单的行内语法着色
    let html = lineContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    // Inline Code
    html = html.replace(/`([^`]+)`/g, '<span class="text-amber-600 bg-amber-50 rounded px-1 font-mono">`$1`</span>');
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<span class="text-orange-600 font-bold">**$1**</span>');
    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<span class="text-purple-600 italic">*$1*</span>');
    // Strike
    html = html.replace(/~~(.*?)~~/g, '<span class="text-gray-400 line-through">~~$1~~</span>');
    // Link
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<span class="text-blue-500">[$1]($2)</span>');
    // Image
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<span class="text-green-600">![$1]($2)</span>');

    return <span dangerouslySetInnerHTML={{__html: html}} />;
  };

  return lines.map((line, i) => {
     const trimmed = line.trim();
     
     // Code Block Fence
     if (trimmed.startsWith('```')) {
         inCode = !inCode;
         return <div key={i} className="text-amber-600 font-bold">{line}</div>;
     }
     
     // Inside Code Block
     if (inCode) {
         // Fix: Ensure empty lines inside code blocks have height
         return <div key={i} className="text-amber-700 opacity-80">{line ? line : <br/>}</div>;
     }

     // Headers
     if (/^#{1,6}\s/.test(line)) {
         return <div key={i} className="text-blue-600 font-bold">{parseInline(line)}</div>;
     }

     // Blockquote
     if (line.startsWith('>')) {
         return <div key={i} className="text-gray-400">{parseInline(line)}</div>;
     }

     // List Markers (Unordered)
     if (/^\s*[-*]\s/.test(line)) {
         const match = line.match(/^(\s*[-*])(\s.*)/);
         if (match) {
             return <div key={i}><span className="text-red-500 font-bold">{match[1]}</span>{parseInline(match[2])}</div>;
         }
     }
     
     // List Markers (Ordered)
     if (/^\s*\d+\.\s/.test(line)) {
         const match = line.match(/^(\s*\d+\.)(\s.*)/);
         if (match) {
             return <div key={i}><span className="text-red-500 font-bold">{match[1]}</span>{parseInline(match[2])}</div>;
         }
     }
     
     // Divider
     if (/^\s*---\s*$/.test(line)) {
         return <div key={i} className="text-gray-300 font-bold">{line}</div>;
     }

     // Normal Line - FIX: Handle empty lines correctly so they occupy vertical space
     return <div key={i}>{line ? parseInline(line) : <br/>}</div>;
  });
};

/* =============================================================================
  3. 样式资源库
  =============================================================================
*/
const STYLE_LIBRARY = {
  h1: [
    { name: '居中大标题', html: `<section style="margin: 40px 0 20px 0; text-align: center;"><h1 style="font-size: 24px; font-weight: bold; color: #333; margin: 0; line-height: 1.2;">{{CONTENT}}</h1></section>` },
    { name: '底部粗线', html: `<section style="margin: 40px 0 20px 0; border-bottom: 4px solid {{COLOR}}; padding-bottom: 10px;"><h1 style="font-size: 26px; font-weight: 900; color: #333; margin: 0;">{{CONTENT}}</h1></section>` },
    { name: '渐变文字', html: `<section style="margin: 40px 0 20px 0; text-align: center;"><h1 style="font-size: 26px; font-weight: 900; background: linear-gradient(135deg, {{COLOR}}, #333); -webkit-background-clip: text; color: transparent; margin: 0;">{{CONTENT}}</h1></section>` },
    { name: '左右装饰', html: `<section style="margin: 40px 0 20px 0; display: flex; align-items: center; justify-content: center; gap: 10px;"><span style="width: 30px; height: 2px; background: {{COLOR}};"></span><h1 style="font-size: 22px; font-weight: bold; color: #333;">{{CONTENT}}</h1><span style="width: 30px; height: 2px; background: {{COLOR}};"></span></section>` },
    { name: '英文下标', html: `<section style="margin: 40px 0 20px 0; text-align: center;"><h1 style="font-size: 24px; font-weight: bold; color: {{COLOR}}; margin: 0;">{{CONTENT}}</h1><div style="font-size: 10px; color: #ccc; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px;">TITLE</div></section>` },
    { name: '左侧色块', html: `<section style="margin: 40px 0 20px 0; display: flex; align-items: center;"><div style="width: 12px; height: 36px; background: {{COLOR}}; margin-right: 12px; border-radius: 0 4px 4px 0;"></div><h1 style="font-size: 24px; font-weight: bold; color: #333; margin: 0;">{{CONTENT}}</h1></section>` },
    { name: '方框包围', html: `<section style="margin: 40px 0 20px 0; text-align: center;"><div style="display: inline-block; border: 2px solid {{COLOR}}; padding: 8px 20px;"><h1 style="font-size: 22px; font-weight: bold; color: #333; margin: 0;">{{CONTENT}}</h1></div></section>` },
    { name: '编号大字', html: `<section style="margin: 40px 0 20px 0;"><span style="font-size: 40px; color: {{COLOR}}; opacity: 0.2; font-weight: 900; display: block; line-height: 0.5;">01</span><h1 style="font-size: 24px; font-weight: bold; color: #333; margin-left: 10px;">{{CONTENT}}</h1></section>` },
    { name: '荧光笔', html: `<section style="margin: 40px 0 20px 0; text-align: center;"><span style="background: linear-gradient(to top, {{COLOR}}33 50%, transparent 50%); padding: 0 10px;"><h1 style="font-size: 24px; font-weight: bold; color: #333; display: inline;">{{CONTENT}}</h1></span></section>` },
    { name: '括号引用', html: `<section style="margin: 40px 0 20px 0; text-align: center; color: {{COLOR}};"><span style="font-size: 20px;">[</span> <h1 style="font-size: 22px; font-weight: bold; color: #333; display: inline; margin: 0 10px;">{{CONTENT}}</h1> <span style="font-size: 20px;">]</span></section>` },
  ],
  h2: [
    { name: '经典左竖线', html: `<section style="margin: 40px 0 20px 0; display: flex; align-items: center;"><span style="display: inline-block; width: 4px; height: 22px; background-color: {{COLOR}}; margin-right: 10px; border-radius: 2px;"></span><h2 style="font-size: 18px; font-weight: bold; color: #333; margin: 0; line-height: 1.4;">{{CONTENT}}</h2></section>` },
    { name: '底部渐变线', html: `<section style="margin: 40px 0 20px 0;"><h2 style="font-size: 18px; font-weight: bold; color: #333; margin: 0 0 8px 0;">{{CONTENT}}</h2><div style="height: 4px; width: 40px; background: linear-gradient(90deg, {{COLOR}}, #fff); border-radius: 2px;"></div></section>` },
    { name: '胶囊背景', html: `<section style="margin: 40px 0 20px 0; text-align: center;"><span style="display: inline-block; padding: 6px 20px; background: {{COLOR}}; color: #fff; border-radius: 50px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 10px {{COLOR}}44;">{{CONTENT}}</span></section>` },
    { name: '序号圆圈', html: `<section style="margin: 40px 0 20px 0; display: flex; align-items: center;"><span style="width: 24px; height: 24px; background: {{COLOR}}; color: #fff; border-radius: 50%; font-size: 14px; font-weight: bold; display: flex; align-items: center; justify-content: center; margin-right: 8px; flex-shrink: 0;">01</span><h2 style="font-size: 18px; font-weight: bold; border-bottom: 2px solid {{COLOR}}; padding-bottom: 4px; color: #333;">{{CONTENT}}</h2></section>` },
    { name: '半透明背景', html: `<section style="margin: 40px 0 20px 0; background: {{COLOR}}15; border-left: 4px solid {{COLOR}}; padding: 8px 12px;"><h2 style="font-size: 17px; font-weight: bold; color: #333; margin: 0;">{{CONTENT}}</h2></section>` },
    { name: '虚线框标题', html: `<section style="margin: 40px 0 20px 0; display: inline-block; border: 1px dashed {{COLOR}}; padding: 6px 16px; border-radius: 4px;"><h2 style="font-size: 17px; font-weight: bold; color: {{COLOR}}; margin: 0;">{{CONTENT}}</h2></section>` },
    { name: '双面线条', html: `<section style="margin: 40px 0 20px 0; border-top: 1px solid {{COLOR}}44; border-bottom: 1px solid {{COLOR}}44; padding: 8px 0; text-align: center;"><h2 style="font-size: 17px; font-weight: bold; color: {{COLOR}}; margin: 0;">{{CONTENT}}</h2></section>` },
    { name: '折角标签', html: `<section style="margin: 40px 0 20px 0; display: inline-block; position: relative; background: {{COLOR}}; color: #fff; padding: 5px 15px;"><h2 style="font-size: 16px; font-weight: bold; margin: 0;">{{CONTENT}}</h2><div style="position: absolute; right: -8px; top: 0; width: 0; height: 0; border-style: solid; border-width: 15px 0 15px 8px; border-color: transparent transparent transparent {{COLOR}};"></div></section>` },
    { name: '下划线装饰', html: `<section style="margin: 40px 0 20px 0;"><h2 style="font-size: 18px; font-weight: bold; color: #333; margin: 0;">{{CONTENT}}</h2><div style="height: 6px; background: {{COLOR}}33; margin-top: -6px; border-radius: 4px;"></div></section>` },
    { name: '极简方块', html: `<section style="margin: 40px 0 20px 0; display: flex; align-items: baseline;"><div style="width: 8px; height: 8px; background: {{COLOR}}; margin-right: 8px;"></div><h2 style="font-size: 18px; font-weight: bold; color: #333; margin: 0;">{{CONTENT}}</h2></section>` },
  ],
  h3: [
    { name: '简约加粗', html: `<h3 style="margin: 20px 0 10px 0; font-size: 16px; font-weight: bold; color: {{COLOR}};">{{CONTENT}}</h3>` },
    { name: '左侧方块', html: `<section style="margin: 20px 0 10px 0; display: flex; align-items: center;"><span style="width: 6px; height: 6px; background: {{COLOR}}; margin-right: 8px; transform: rotate(45deg);"></span><h3 style="margin: 0; font-size: 16px; font-weight: bold; color: #333;">{{CONTENT}}</h3></section>` },
    { name: '下划线', html: `<section style="margin: 20px 0 10px 0; display: inline-block; border-bottom: 2px solid {{COLOR}}44;"><h3 style="margin: 0; font-size: 16px; font-weight: bold; color: #333; padding-bottom: 2px;">{{CONTENT}}</h3></section>` },
    { name: '箭头指示', html: `<h3 style="margin: 20px 0 10px 0; font-size: 16px; font-weight: bold; color: {{COLOR}};">▶ {{CONTENT}}</h3>` },
    { name: '数字圆点', html: `<h3 style="margin: 20px 0 10px 0; display: flex; align-items: center;"><span style="background: {{COLOR}}; color: #fff; width: 18px; height: 18px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; margin-right: 6px;">1</span><span style="font-size: 16px; font-weight: bold; color: #333;">{{CONTENT}}</span></h3>` },
    { name: '波浪下划', html: `<h3 style="margin: 20px 0 10px 0; font-size: 16px; font-weight: bold; color: #333; text-decoration: underline; text-decoration-style: wavy; text-decoration-color: {{COLOR}};">{{CONTENT}}</h3>` },
    { name: '左边框', html: `<h3 style="margin: 20px 0 10px 0; font-size: 16px; font-weight: bold; color: #555; border-left: 3px solid {{COLOR}}; padding-left: 8px;">{{CONTENT}}</h3>` },
    { name: '背景高亮', html: `<span style="background: {{COLOR}}22; padding: 2px 6px; border-radius: 2px; font-size: 16px; font-weight: bold; color: {{COLOR}};">{{CONTENT}}</span>` },
    { name: '短横线', html: `<div style="display: flex; align-items: center; margin: 20px 0 10px 0;"><div style="width: 12px; height: 2px; background: {{COLOR}}; margin-right: 6px;"></div><h3 style="font-size: 16px; font-weight: bold; color: #333; margin: 0;">{{CONTENT}}</h3></div>` },
    { name: '括号风格', html: `<h3 style="margin: 20px 0 10px 0; font-size: 16px; font-weight: bold; color: #333;">【{{CONTENT}}】</h3>` },
    { name: '渐变文字', html: `<h3 style="margin: 20px 0 10px 0; font-size: 16px; font-weight: bold; background: linear-gradient(90deg, {{COLOR}}, #333); -webkit-background-clip: text; color: transparent;">{{CONTENT}}</h3>` },
    { name: '胶囊标签', html: `<span style="display: inline-block; margin: 20px 0 10px 0; padding: 4px 12px; background: {{COLOR}}; color: #fff; border-radius: 20px; font-size: 14px; font-weight: bold;">{{CONTENT}}</span>` },
    { name: '双横线', html: `<div style="margin: 20px 0 10px 0; padding: 6px 0; border-top: 1px solid {{COLOR}}; border-bottom: 1px solid {{COLOR}};"><h3 style="font-size: 16px; font-weight: bold; color: #333; margin: 0; text-align: center;">{{CONTENT}}</h3></div>` },
    { name: '立体阴影', html: `<h3 style="margin: 20px 0 10px 0; font-size: 16px; font-weight: bold; color: {{COLOR}}; text-shadow: 2px 2px 4px rgba(0,0,0,0.1);">{{CONTENT}}</h3>` },
    { name: '折叠面板', html: `<div style="margin: 20px 0 10px 0; border: 1px solid {{COLOR}}44; border-radius: 4px;"><div style="padding: 8px 12px; background: {{COLOR}}10; font-size: 16px; font-weight: bold; color: #333;">{{CONTENT}}</div></div>` },
  ],
  h4: [
    { name: '小标题黑', html: `<h4 style="margin: 15px 0 5px 0; font-size: 15px; font-weight: bold; color: #333;">{{CONTENT}}</h4>` },
    { name: '小标题色', html: `<h4 style="margin: 15px 0 5px 0; font-size: 15px; font-weight: bold; color: {{COLOR}};">{{CONTENT}}</h4>` },
    { name: '圆点前缀', html: `<h4 style="margin: 15px 0 5px 0; font-size: 15px; font-weight: bold; color: #333; display: flex; align-items: center;"><span style="width: 4px; height: 4px; background: {{COLOR}}; border-radius: 50%; margin-right: 6px;"></span>{{CONTENT}}</h4>` },
    { name: '斜体加粗', html: `<h4 style="margin: 15px 0 5px 0; font-size: 15px; font-weight: bold; font-style: italic; color: #555;">{{CONTENT}}</h4>` },
    { name: '字母前缀', html: `<h4 style="margin: 15px 0 5px 0; font-size: 15px; font-weight: bold; color: #333;"><span style="color: {{COLOR}};">A.</span> {{CONTENT}}</h4>` },
    { name: '下虚线', html: `<h4 style="margin: 15px 0 5px 0; font-size: 15px; font-weight: bold; color: #333; border-bottom: 1px dashed #ccc; display: inline-block;">{{CONTENT}}</h4>` },
    { name: '空心方块', html: `<h4 style="margin: 15px 0 5px 0; font-size: 15px; font-weight: bold; color: #333; display: flex; align-items: center;"><span style="width: 6px; height: 6px; border: 1px solid {{COLOR}}; margin-right: 6px;"></span>{{CONTENT}}</h4>` },
    { name: '灰色背景', html: `<h4 style="margin: 15px 0 5px 0; font-size: 14px; font-weight: bold; color: #333; background: #eee; padding: 2px 8px; display: inline-block; border-radius: 3px;">{{CONTENT}}</h4>` },
    { name: '左侧粗线', html: `<h4 style="margin: 15px 0 5px 0; font-size: 15px; font-weight: bold; color: #333; border-left: 2px solid {{COLOR}}; padding-left: 6px;">{{CONTENT}}</h4>` },
    { name: '标签式', html: `<span style="font-size: 12px; font-weight: bold; color: #fff; background: {{COLOR}}; padding: 2px 6px; border-radius: 20px; margin-right: 5px;">Tag</span><span style="font-size: 15px; font-weight: bold;">{{CONTENT}}</span>` },
    { name: '渐变背景', html: `<span style="display: inline-block; margin: 15px 0 5px 0; padding: 3px 8px; background: linear-gradient(135deg, {{COLOR}}, #fff); border-radius: 4px; font-size: 15px; font-weight: bold; color: #333;">{{CONTENT}}</span>` },
    { name: '立体字', html: `<h4 style="margin: 15px 0 5px 0; font-size: 15px; font-weight: bold; color: {{COLOR}}; text-shadow: 1px 1px 2px rgba(0,0,0,0.2);">{{CONTENT}}</h4>` },
    { name: '左右短杠', html: `<div style="display: flex; align-items: center; gap: 8px; margin: 15px 0 5px 0;"><span style="width: 10px; height: 2px; background: {{COLOR}};"></span><span style="font-size: 15px; font-weight: bold; color: #333;">{{CONTENT}}</span><span style="width: 10px; height: 2px; background: {{COLOR}};"></span></div>` },
    { name: '圆角框', html: `<div style="margin: 15px 0 5px 0; display: inline-block; border: 2px solid {{COLOR}}; border-radius: 8px; padding: 2px 10px;"><h4 style="font-size: 14px; font-weight: bold; color: #333; margin: 0;">{{CONTENT}}</h4></div>` },
    { name: '代码风格', html: `<h4 style="margin: 15px 0 5px 0; font-size: 14px; font-weight: bold; color: #333; background: #f5f5f5; border: 1px solid #ddd; padding: 2px 6px; border-radius: 3px; font-family: monospace;">{{CONTENT}}</h4>` },
  ],
  h5: [
    { name: '灰色微标', html: `<h5 style="margin: 10px 0 5px 0; font-size: 14px; font-weight: bold; color: #666;">{{CONTENT}}</h5>` },
    { name: '底色标签', html: `<span style="display: inline-block; margin: 10px 0 5px 0; font-size: 12px; font-weight: bold; color: #fff; background: {{COLOR}}; padding: 2px 6px; border-radius: 3px;">{{CONTENT}}</span>` },
    { name: '极简小字', html: `<h5 style="margin: 10px 0 5px 0; font-size: 13px; font-weight: bold; color: #999; letter-spacing: 1px;">{{CONTENT}}</h5>` },
    { name: '引用感', html: `<h5 style="margin: 10px 0 5px 0; font-size: 14px; color: {{COLOR}}; border-left: 2px solid #ddd; padding-left: 6px;">{{CONTENT}}</h5>` },
    { name: '问答Q', html: `<h5 style="margin: 10px 0 5px 0; font-size: 14px; font-weight: bold; color: #333;"><span style="color: {{COLOR}};">Q:</span> {{CONTENT}}</h5>` },
    { name: '三角形', html: `<h5 style="margin: 10px 0 5px 0; font-size: 14px; font-weight: bold; color: #333; display: flex; align-items: center;"><span style="width: 0; height: 0; border-top: 4px solid transparent; border-bottom: 4px solid transparent; border-left: 6px solid {{COLOR}}; margin-right: 6px;"></span>{{CONTENT}}</h5>` },
    { name: '下划线', html: `<h5 style="margin: 10px 0 5px 0; font-size: 14px; font-weight: bold; color: #333; text-decoration: underline;">{{CONTENT}}</h5>` },
    { name: '高亮', html: `<h5 style="margin: 10px 0 5px 0; font-size: 14px; font-weight: bold; color: {{COLOR}};">{{CONTENT}}</h5>` },
    { name: '代码感', html: `<h5 style="margin: 10px 0 5px 0; font-size: 13px; font-family: monospace; background: #f0f0f0; padding: 2px 5px; display: inline-block;">{{CONTENT}}</h5>` },
    { name: '分割标题', html: `<div style="display: flex; align-items: center; margin: 10px 0;"><span style="font-size: 14px; font-weight: bold; color: #333; margin-right: 10px;">{{CONTENT}}</span><div style="flex: 1; height: 1px; background: #eee;"></div></div>` },
  ],
  quote: [
    { name: '经典灰底', html: `<section style="margin: 20px 0; padding: 15px; background: #f7f7f7; border-left: 4px solid {{COLOR}}; border-radius: 4px;"><div style="color: #666; font-size: 14px; line-height: 1.6;">{{CONTENT}}</div></section>` },
    { name: '引号装饰', html: `<section style="margin: 25px 0; position: relative; padding: 20px; border: 1px solid {{COLOR}}44; border-radius: 8px;"><div style="position: absolute; top: -12px; left: 20px; background: #fff; padding: 0 10px; color: {{COLOR}}; font-size: 24px; line-height: 1; font-family: serif;">“</div><div style="color: #555; font-size: 15px;">{{CONTENT}}</div></section>` },
    { name: '便签风格', html: `<section style="margin: 20px 0; padding: 15px; background: #fffbe6; border: 1px solid #ffe58f; box-shadow: 2px 2px 5px rgba(0,0,0,0.05); color: #8a6d3b; font-size: 14px;">{{CONTENT}}</section>` },
    { name: '虚线边框', html: `<section style="margin: 20px 0; padding: 15px; border: 1px dashed {{COLOR}}; border-radius: 6px;"><div style="color: #666; font-size: 14px;">{{CONTENT}}</div></section>` },
    { name: '双括号', html: `<section style="margin: 20px 0; text-align: center; color: {{COLOR}};"><span style="font-size: 20px;">『</span><div style="color: #555; font-size: 14px; margin: 5px 0;">{{CONTENT}}</div><span style="font-size: 20px;">』</span></section>` },
    { name: '黑底白字', html: `<section style="margin: 20px 0; padding: 15px; background: #333; border-radius: 6px;"><span style="color: #eee; font-size: 14px;">{{CONTENT}}</span></section>` },
    { name: '上下横线', html: `<section style="margin: 20px 0; padding: 10px 0; border-top: 1px solid {{COLOR}}; border-bottom: 1px solid {{COLOR}}; text-align: center;"><span style="color: #555; font-size: 14px; font-style: italic;">{{CONTENT}}</span></section>` },
    { name: '左侧粗框', html: `<section style="margin: 20px 0; padding: 10px 15px; border-left: 8px solid {{COLOR}}22; background: #fff;"><span style="color: #333; font-size: 14px;">{{CONTENT}}</span></section>` },
    { name: '渐变背景', html: `<section style="margin: 20px 0; padding: 2px; background: linear-gradient(90deg, {{COLOR}}, #f7f7f7); border-radius: 4px;"><div style="background: #fff; padding: 15px; border-radius: 2px;"><span style="color: #555; font-size: 14px;">{{CONTENT}}</span></div></section>` },
    { name: '圆角阴影', html: `<section style="margin: 20px 0; padding: 15px; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border-radius: 8px; text-align: justify;"><span style="color: #666; font-size: 14px;">{{CONTENT}}</span></section>` },
    { name: '对话气泡', html: `<section style="margin: 20px 0; padding: 15px; background: {{COLOR}}15; border-radius: 0 15px 15px 15px; position: relative;"><div style="color: #333; font-size: 14px;">{{CONTENT}}</div></section>` },
    { name: '回形针', html: `<section style="margin: 25px 0; border-top: 2px solid {{COLOR}}; position: relative; padding-top: 15px;"><div style="position: absolute; top: -10px; right: 20px; background: #fff; padding: 0 5px; color: {{COLOR}}; font-size: 20px;">📎</div><div style="color: #666; font-size: 14px;">{{CONTENT}}</div></section>` },
  ],
  code: [
    { name: 'Mac 风格 (黑)', isDark: true, html: `<section style="margin: 15px 0; background: #282c34; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); overflow: hidden; max-width: 100%;"><div style="background: #21252b; padding: 8px 12px; display: flex; gap: 6px; border-bottom: 1px solid #181a1f;"><div style="width: 10px; height: 10px; border-radius: 50%; background: #ff5f56;"></div><div style="width: 10px; height: 10px; border-radius: 50%; background: #ffbd2e;"></div><div style="width: 10px; height: 10px; border-radius: 50%; background: #27c93f;"></div></div><div style="padding: 12px; overflow-x: auto;"><pre style="margin: 0; font-family: 'Menlo', 'Monaco', 'Courier New', monospace; font-size: 13px; line-height: 1.5; color: #abb2bf; white-space: pre; word-spacing: normal; word-break: normal;">{{CONTENT}}</pre></div></section>` },
    { name: 'Mac 风格 (白)', isDark: false, html: `<section style="margin: 15px 0; background: #fafafa; border-radius: 8px; border: 1px solid #eee; box-shadow: 0 2px 8px rgba(0,0,0,0.03); overflow: hidden; max-width: 100%;"><div style="background: #f0f0f0; padding: 8px 12px; display: flex; gap: 6px; border-bottom: 1px solid #e0e0e0;"><div style="width: 10px; height: 10px; border-radius: 50%; background: #ff5f56;"></div><div style="width: 10px; height: 10px; border-radius: 50%; background: #ffbd2e;"></div><div style="width: 10px; height: 10px; border-radius: 50%; background: #27c93f;"></div></div><div style="padding: 12px; overflow-x: auto;"><pre style="margin: 0; font-family: 'Menlo', 'Monaco', 'Courier New', monospace; font-size: 13px; line-height: 1.5; color: #333; white-space: pre; word-spacing: normal; word-break: normal;">{{CONTENT}}</pre></div></section>` },
    { name: 'VSCode 深色', isDark: true, html: `<section style="margin: 15px 0; background: #1e1e1e; padding: 15px; border-radius: 6px; max-width: 100%; overflow-x: auto;"><pre style="margin: 0; font-family: 'Consolas', monospace; font-size: 13px; line-height: 1.5; color: #d4d4d4; white-space: pre;">{{CONTENT}}</pre></section>` },
    { name: 'Github 浅色', isDark: false, html: `<section style="margin: 15px 0; background: #f6f8fa; padding: 15px; border-radius: 6px; border: 1px solid #d0d7de; max-width: 100%; overflow-x: auto;"><pre style="margin: 0; font-family: monospace; font-size: 13px; line-height: 1.5; color: #24292f; white-space: pre;">{{CONTENT}}</pre></section>` },
    { name: '左侧色条 (深)', isDark: true, html: `<section style="margin: 15px 0; background: #2d2d2d; padding: 15px; border-left: 4px solid {{COLOR}}; border-radius: 0 4px 4px 0; max-width: 100%; overflow-x: auto;"><pre style="margin: 0; font-family: monospace; font-size: 13px; line-height: 1.5; color: #ccc; white-space: pre;">{{CONTENT}}</pre></section>` },
    { name: '左侧色条 (浅)', isDark: false, html: `<section style="margin: 15px 0; background: #f9f9f9; padding: 15px; border-left: 4px solid {{COLOR}}; border-radius: 0 4px 4px 0; max-width: 100%; overflow-x: auto;"><pre style="margin: 0; font-family: monospace; font-size: 13px; line-height: 1.5; color: #555; white-space: pre;">{{CONTENT}}</pre></section>` },
    { name: '虚线框', isDark: false, html: `<section style="margin: 15px 0; background: #fff; padding: 15px; border: 1px dashed #bbb; border-radius: 4px; max-width: 100%; overflow-x: auto;"><pre style="margin: 0; font-family: monospace; font-size: 13px; line-height: 1.5; color: #333; white-space: pre;">{{CONTENT}}</pre></section>` },
    { name: '终端风格', isDark: true, html: `<section style="margin: 15px 0; background: #000; padding: 15px; border-radius: 4px; max-width: 100%; overflow-x: auto;"><div style="color: #0f0; font-size: 12px; margin-bottom: 8px;">$ terminal</div><pre style="margin: 0; font-family: monospace; font-size: 13px; line-height: 1.5; color: #fff; white-space: pre;">{{CONTENT}}</pre></section>` },
    { name: '暖色纸张', isDark: false, html: `<section style="margin: 15px 0; background: #fdf6e3; padding: 15px; border-radius: 4px; max-width: 100%; overflow-x: auto;"><pre style="margin: 0; font-family: monospace; font-size: 13px; line-height: 1.5; color: #657b83; white-space: pre;">{{CONTENT}}</pre></section>` },
    { name: '夜间蓝调', isDark: true, html: `<section style="margin: 15px 0; background: #0f172a; padding: 15px; border-radius: 8px; border: 1px solid #1e293b; max-width: 100%; overflow-x: auto;"><pre style="margin: 0; font-family: monospace; font-size: 13px; line-height: 1.5; color: #94a3b8; white-space: pre;">{{CONTENT}}</pre></section>` },
    { name: '极简无框', isDark: false, html: `<section style="margin: 15px 0; background: transparent; padding: 15px 0; max-width: 100%; overflow-x: auto; border-top: 1px solid #eee; border-bottom: 1px solid #eee;"><pre style="margin: 0; font-family: monospace; font-size: 13px; line-height: 1.5; color: #555; white-space: pre;">{{CONTENT}}</pre></section>` },
    { name: 'Solarized Dark', isDark: true, html: `<section style="margin: 15px 0; background: #002b36; padding: 15px; border-radius: 4px; max-width: 100%; overflow-x: auto;"><pre style="margin: 0; font-family: monospace; font-size: 13px; line-height: 1.5; color: #839496; white-space: pre;">{{CONTENT}}</pre></section>` },
  ],
  divider: [
    { name: '渐变消失', html: `<section style="margin: 30px 0; text-align: center;"><div style="height: 1px; background: linear-gradient(to right, rgba(255,255,255,0), {{COLOR}}, rgba(255,255,255,0));"></div></section>` },
    { name: '三个圆点', html: `<section style="margin: 40px 0; text-align: center; letter-spacing: 12px; color: {{COLOR}}; font-size: 20px; line-height: 1;">• • •</section>` },
    { name: '虚线剪刀', html: `<section style="margin: 30px 0; border-bottom: 1px dashed {{COLOR}}; position: relative;"><div style="position: absolute; left: 50%; top: -8px; transform: translateX(-50%); background: #fff; padding: 0 10px; color: {{COLOR}}; font-size: 12px;">✂</div></section>` },
    { name: '波浪线', html: `<section style="margin: 30px 0; height: 10px; background-image: radial-gradient(circle, {{COLOR}} 2px, transparent 2.5px); background-size: 10px 10px; opacity: 0.6;"></section>` },
    { name: 'End 标记', html: `<section style="margin: 50px 0 20px 0; text-align: center;"><span style="display: inline-block; padding: 4px 12px; border: 1px solid {{COLOR}}; color: {{COLOR}}; font-size: 12px; border-radius: 20px;">The End</span></section>` },
    { name: '双实线', html: `<section style="margin: 30px 0; border-top: 1px solid {{COLOR}}; border-bottom: 1px solid {{COLOR}}; height: 4px;"></section>` },
    { name: '星号装饰', html: `<section style="margin: 30px 0; text-align: center; color: {{COLOR}}55;">* * * * *</section>` },
    { name: '斜纹条', html: `<section style="margin: 30px 0; height: 8px; background: repeating-linear-gradient(45deg, {{COLOR}}22, {{COLOR}}22 10px, #fff 10px, #fff 20px);"></section>` },
    { name: '极简短线', html: `<section style="margin: 40px 0; text-align: center;"><div style="display: inline-block; width: 60px; height: 3px; background: {{COLOR}}; border-radius: 2px;"></div></section>` },
    { name: '菱形串', html: `<section style="margin: 30px 0; text-align: center; color: {{COLOR}}; font-size: 12px;">♦ ♦ ♦</section>` },
    { name: '透明度渐变', html: `<section style="margin: 30px 0; display: flex; gap: 5px; justify-content: center;"><div style="width: 40px; height: 3px; background:{{COLOR}}; opacity: 1"></div><div style="width: 30px; height: 3px; background:{{COLOR}}; opacity: 0.7"></div><div style="width: 20px; height: 3px; background:{{COLOR}}; opacity: 0.4"></div></section>` },
    { name: '爱心串', html: `<section style="margin: 30px 0; text-align: center; color: {{COLOR}}; font-size: 14px;">♥ ♥ ♥</section>` },
    { name: '方块分割', html: `<section style="margin: 40px 0; display: flex; align-items: center; justify-content: center; gap: 8px;"><div style="width: 8px; height: 8px; background: {{COLOR}};"></div><div style="width: 8px; height: 8px; background: {{COLOR}}; opacity: 0.5;"></div><div style="width: 8px; height: 8px; background: {{COLOR}}; opacity: 0.2;"></div></section>` },
  ]
};

const THEME_PRESETS = [
  { id: 'default', name: '默认简约', color: '#dc2626', styles: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, quote: 0, divider: 0, code: 0 } },
  { id: 'business', name: '商务科技', color: '#2563eb', styles: { h1: 1, h2: 1, h3: 2, h4: 8, h5: 1, quote: 5, divider: 3, code: 0 } },
  { id: 'art', name: '文艺清新', color: '#16a34a', styles: { h1: 3, h2: 4, h3: 3, h4: 2, h5: 0, quote: 2, divider: 1, code: 1 } },
  { id: 'cute', name: '活泼可爱', color: '#ea580c', styles: { h1: 2, h2: 2, h3: 3, h4: 1, h5: 1, quote: 3, divider: 4, code: 1 } },
  { id: 'dark', name: '极客暗黑', color: '#1f2937', styles: { h1: 1, h2: 5, h3: 1, h4: 7, h5: 0, quote: 4, divider: 2, code: 2 } },
  { id: 'fancy', name: '高端精致', color: '#7c3aed', styles: { h1: 9, h2: 3, h3: 7, h4: 0, h5: 4, quote: 1, divider: 10, code: 9 } },
  { id: 'warm', name: '暖色纸张', color: '#d97706', styles: { h1: 5, h2: 6, h3: 4, h4: 5, h5: 2, quote: 2, divider: 6, code: 8 } },
  // v1.3.3 新增模版
  { id: 'academic', name: '学术论文', color: '#0f172a', styles: { h1: 10, h2: 8, h3: 2, h4: 3, h5: 0, quote: 6, divider: 5, code: 1 } },
  { id: 'magazine', name: '红黑杂志', color: '#be123c', styles: { h1: 6, h2: 10, h3: 8, h4: 9, h5: 4, quote: 9, divider: 2, code: 0 } },
  { id: 'glitch', name: '故障艺术', color: '#2dd4bf', styles: { h1: 11, h2: 12, h3: 1, h4: 6, h5: 8, quote: 5, divider: 7, code: 2 } },
  { id: 'forest', name: '森林氧吧', color: '#059669', styles: { h1: 3, h2: 4, h3: 0, h4: 2, h5: 5, quote: 8, divider: 3, code: 1 } },
  { id: 'pink', name: '少女粉嫩', color: '#ec4899', styles: { h1: 8, h2: 7, h3: 4, h4: 9, h5: 1, quote: 10, divider: 11, code: 1 } },
];

const FONT_FAMILIES = [
  { name: '系统无衬线 (默认)', value: "-apple-system-font, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei UI', 'Microsoft YaHei', Arial, sans-serif" },
  { name: '宋体 / 衬线 (文艺)', value: "'Songti SC', 'SimSun', 'STSong', 'Times New Roman', serif" },
  { name: '楷体 / 优雅 (书信)', value: "'Kaiti SC', 'KaiTi', 'STKaiti', 'Baskerville', serif" },
  { name: '圆体 / 可爱 (亲和)', value: "'Yuanti SC', 'YouYuan', 'Varela Round', sans-serif" },
  { name: '等宽 (技术)', value: "'Menlo', 'Monaco', 'Courier New', monospace" }
];

export default function App() {
  
  const loadState = (key, defaultVal) => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + key);
      return saved ? JSON.parse(saved) : defaultVal;
    } catch (e) {
      return defaultVal;
    }
  };

  const saveState = (key, value) => {
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
    } catch (e) {}
  };

  const [markdown, setMarkdown] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'markdown');
    try { return saved ? JSON.parse(saved) : DEFAULT_MARKDOWN; } catch { return saved || DEFAULT_MARKDOWN; }
  });
  
  const [config, setConfig] = useState(() => loadState('config', {
    themeColor: '#dc2626',
    fontSize: 15,
    lineHeight: 1.75,
    letterSpacing: 0.5,
    textAlign: 'justify',
    fontFamily: FONT_FAMILIES[0].value
  }));

  const [styleMapping, setStyleMapping] = useState(() => loadState('style_mapping', {
    h1: 0, h2: 0, h3: 0, h4: 0, h5: 0,
    quote: 0, divider: 0, code: 0
  }));

  const [sidebarOpen, setSidebarOpen] = useState(() => loadState('sidebar_open', true));
  const [previewMode, setPreviewMode] = useState(() => loadState('preview_mode', 'mobile'));
  const [activeTab, setActiveTab] = useState(() => loadState('active_tab', 'themes')); 
  
  const [showToast, setShowToast] = useState(false);
  const [showSyncToast, setShowSyncToast] = useState(false);
  const [syncScroll, setSyncScroll] = useState(() => loadState('sync_scroll', true));
  
  const [componentCategoryOpen, setComponentCategoryOpen] = useState({
    layout: true,
    scroll: false,
    card: false
  });

  const [toolsPanelOpen, setToolsPanelOpen] = useState(false);
  const [showSyncDropdown, setShowSyncDropdown] = useState(false);

  const handleArticleExtracted = (articleContent) => {
    setMarkdown(articleContent);
    setToolsPanelOpen(false);
  };

  const previewRef = useRef(null);
  const textareaRef = useRef(null);
  const previewContainerRef = useRef(null);
  const syncDropdownRef = useRef(null);
  const highlightRef = useRef(null); // Ref for highlighter layer

  useEffect(() => { saveState('markdown', markdown); }, [markdown]);
  useEffect(() => { saveState('config', config); }, [config]);
  useEffect(() => { saveState('style_mapping', styleMapping); }, [styleMapping]);
  useEffect(() => { saveState('sidebar_open', sidebarOpen); }, [sidebarOpen]);
  useEffect(() => { saveState('preview_mode', previewMode); }, [previewMode]);
  useEffect(() => { saveState('active_tab', activeTab); }, [activeTab]);
  useEffect(() => { saveState('sync_scroll', syncScroll); }, [syncScroll]);

  const handleReset = () => {
    if(window.confirm('确定要重置所有设置和内容吗？此操作无法撤销。')) {
      setMarkdown(DEFAULT_MARKDOWN);
      setConfig({
        themeColor: '#dc2626',
        fontSize: 16,
        lineHeight: 1.75,
        letterSpacing: 0.5,
        textAlign: 'justify',
        fontFamily: FONT_FAMILIES[0].value
      });
      setStyleMapping({ h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, quote: 0, divider: 0, code: 0 });
      localStorage.clear(); 
      window.location.reload();
    }
  };

  const applyThemePreset = (preset) => {
    setConfig(prev => ({ ...prev, themeColor: preset.color }));
    setStyleMapping(preset.styles);
  };

  /* =============================================================================
    3. 核心解析器
    =============================================================================
  */
  const parseMarkdown = (md) => {
    if (!md) return '';

    let html = md;
    
    const placeholders = [];
    const savePlaceholder = (content) => {
      const id = placeholders.length;
      placeholders.push(content);
      return `<!--MARKER_${id}-->`; 
    };

    const getStyleHtml = (type, content) => {
      const styleIndex = styleMapping[type] || 0;
      const list = STYLE_LIBRARY[type];
      const template = (list && list[styleIndex]) ? list[styleIndex].html : list[0].html;
      return template
        .replace(/{{CONTENT}}/g, content)
        .replace(/{{COLOR}}/g, config.themeColor);
    };

    // 1. 代码块处理
    html = html.replace(/^```([^\n]*)\n([\s\S]*?)```/gm, (match, lang, code) => {
      const styleIndex = styleMapping['code'] || 0;
      const styleConfig = STYLE_LIBRARY['code'][styleIndex];
      const template = styleConfig.html;
      const isDark = styleConfig.isDark || false;
      const trimmedCode = code.trim();
      const highlightedCode = highlightSyntax(trimmedCode, isDark, config.themeColor);
      return savePlaceholder(template.replace(/{{CONTENT}}/g, highlightedCode).replace(/{{COLOR}}/g, config.themeColor));
    });

    // 2. 行内代码
    html = html.replace(/`([^`]+)`/g, (match, content) => {
      const safeContent = content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<span style="background: #f4f4f5; color: #eb5757; padding: 2px 4px; border-radius: 3px; font-family: Menlo, monospace; font-size: 85%; margin: 0 2px;">${safeContent}</span>`;
    });

    // 3. 标题
    html = html.replace(/^##### (.*$)/gim, (match, content) => getStyleHtml('h5', content));
    html = html.replace(/^#### (.*$)/gim, (match, content) => getStyleHtml('h4', content));
    html = html.replace(/^### (.*$)/gim, (match, content) => getStyleHtml('h3', content));
    html = html.replace(/^## (.*$)/gim, (match, content) => getStyleHtml('h2', content));
    html = html.replace(/^# (.*$)/gim, (match, content) => getStyleHtml('h1', content));

    // 4. 分割线 & 图片
    html = html.replace(/^\s*---\s*$/gim, () => getStyleHtml('divider', ''));
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
      return `<section style="margin: 20px 0; text-align: center;"><img src="${url}" alt="${alt}" style="max-width: 100%; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);" />${alt ? `<div style="font-size: 12px; color: #999; margin-top: 8px;">${alt}</div>` : ''}</section>`;
    });

    // 5. 行内样式
    html = html.replace(/\*\*(.*?)\*\*/g, `<strong style="color: ${config.themeColor}; font-weight: bold;">$1</strong>`);
    html = html.replace(/\*(.*?)\*/g, `<em style="font-style: italic; color: #666;">$1</em>`);
    html = html.replace(/~~(.*?)~~/g, `<del style="color: #999;">$1</del>`);
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, `<a href="$2" style="color: ${config.themeColor}; text-decoration: none; border-bottom: 1px dashed ${config.themeColor};">$1</a>`);

    // 6. 列表与引用
    const lines = html.split('\n');
    let listHtml = [];
    let inList = false;
    let listType = 'ul'; 
    let inQuote = false;
    let quoteContent = [];

    const renderListItem = (content, type) => {
        // v1.3.6: 缩小列表点，调整间距 (4px)
        if (type === 'ul') {
            return `<li style="margin-bottom: 8px; display: flex; align-items: baseline;"><span style="display: inline-block; width: 4px; height: 4px; background-color: ${config.themeColor}; border-radius: 50%; margin-right: 10px; flex-shrink: 0; transform: translateY(-3px);"></span><span style="flex: 1; line-height: ${config.lineHeight}; font-size: 14px;">${content}</span></li>`;
        } else {
            const match = content.match(/^(\d+)\.\s+(.*)/);
            const num = match ? match[1] : '1';
            const text = match ? match[2] : content;
            return `<li style="margin-bottom: 8px; display: flex; align-items: baseline;"><span style="font-weight: bold; color: ${config.themeColor}; margin-right: 8px; flex-shrink: 0; font-size: ${config.fontSize}px;">${num}.</span><span style="flex: 1; line-height: ${config.lineHeight}; font-size: ${config.fontSize}px;">${text}</span></li>`;
        }
    };

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      let trimmed = line.trim();

      // 引用处理
      if (line.startsWith('> ')) {
          if (!inQuote) { inQuote = true; quoteContent = []; }
          let content = line.replace(/^> /, '');
          
          if (/^[\*\-] /.test(content)) {
              content = `<div style="display: flex; align-items: baseline; margin-left: 10px; margin-bottom: 5px;"><span style="display: inline-block; width: 4px; height: 4px; background-color: ${config.themeColor}; border-radius: 50%; margin-right: 8px; flex-shrink: 0; transform: translateY(-3px);"></span><span style="flex: 1;">${content.replace(/^[\*\-] /, '')}</span></div>`;
          } else if (/^\d+\. /.test(content)) {
              const match = content.match(/^(\d+)\.\s+(.*)/);
              content = `<div style="display: flex; align-items: baseline; margin-left: 10px; margin-bottom: 5px;"><span style="font-weight: bold; color: ${config.themeColor}; margin-right: 6px; font-size: 13px;">${match[1]}.</span><span style="flex: 1;">${match[2]}</span></div>`;
          }
          quoteContent.push(content);

          if (i === lines.length - 1) {
             listHtml.push(getStyleHtml('quote', quoteContent.join('<br/>')));
          }
          continue; 
      } else {
          if (inQuote) {
              listHtml.push(getStyleHtml('quote', quoteContent.join('<br/>')));
              inQuote = false;
              quoteContent = [];
          }
      }

      // 列表处理
      if (/^[\*\-] (.*)/.test(line)) {
        if (!inList || listType !== 'ul') { 
            if(inList) listHtml.push(listType === 'ul' ? '</ul>' : '</ol>'); 
            listHtml.push(`<ul style="list-style-type: none; padding-left: 20px; margin: 15px 0;">`); 
            inList = true; 
            listType = 'ul';
        }
        listHtml.push(renderListItem(line.replace(/^[\*\-] /, ''), 'ul'));
        continue;
      } 
      else if (/^\d+\. (.*)/.test(line)) {
         if (!inList || listType !== 'ol') { 
            if(inList) listHtml.push(listType === 'ul' ? '</ul>' : '</ol>');
            listHtml.push(`<ul style="list-style-type: none; padding-left: 20px; margin: 15px 0;">`); 
            inList = true; 
            listType = 'ol';
         }
         listHtml.push(renderListItem(line, 'ol'));
         continue;
      } 
      else {
        if (inList) { 
            listHtml.push(listType === 'ul' ? '</ul>' : '</ol>'); 
            inList = false; 
        }
      }

      if (trimmed.length === 0) continue; 
      if (trimmed.startsWith('<')) {
          listHtml.push(line);
      } else {
          listHtml.push(`<p style="margin: 15px 0; line-height: ${config.lineHeight}; font-size: ${config.fontSize}px; color: #333; text-align: ${config.textAlign}; letter-spacing: ${config.letterSpacing}px;">${line}</p>`);
      }
    }
    
    if (inList) listHtml.push(listType === 'ul' ? '</ul>' : '</ol>');

    let output = listHtml.join('\n');
    placeholders.forEach((content, index) => {
        output = output.replace(`<!--MARKER_${index}-->`, () => content);
    });

    return output;
  };

  const renderedHtml = useMemo(() => parseMarkdown(markdown), [markdown, config, styleMapping]);

  const copyToClipboard = () => {
    return new Promise((resolve, reject) => {
      if (!previewRef.current) {
        reject(new Error('预览区域不存在'));
        return;
      }
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(previewRef.current);
      selection.removeAllRanges();
      selection.addRange(range);
      try {
        document.execCommand('copy');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
        resolve();
      } catch (err) { 
        alert('复制失败');
        reject(err);
      } finally {
        selection.removeAllRanges();
      }
    });
  };

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (syncDropdownRef.current && !syncDropdownRef.current.contains(event.target)) {
        setShowSyncDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // --- 同步功能 ---
  const syncTo = (platform) => {
    const links = {
      'zhihu': 'https://zhuanlan.zhihu.com/write',
      'juejin': 'https://juejin.cn/editor/drafts/new',
      'csdn': 'https://mp.csdn.net/mp_blog/creation/editor',
      'toutiao': 'https://mp.toutiao.com/profile_v4/graphic/publish'
    };

    const link = links[platform];
    if (!link) return;

    // 先复制，成功后再打开新窗口
    copyToClipboard().then(() => {
      // 自定义toast显示
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
      setTimeout(() => {
        const newWindow = window.open(link, '_blank');
        
        // 尝试使用WechatSync风格的DOM注入
        if (newWindow) {
          // 等待页面加载完成
          newWindow.addEventListener('load', () => {
            try {
              // 尝试注入内容到编辑器
              const injectContent = () => {
                const editors = [
                  // 知乎编辑器
                  '.public-DraftEditor-content',
                  '.editor-textarea',
                  'textarea',
                  '[contenteditable="true"]',
                  // 掘金编辑器
                  '.juejin-editor',
                  // CSDN编辑器
                  '.markdown_editor',
                  // 头条编辑器
                  '.rich_editor'
                ];

                editors.forEach(selector => {
                  const editor = newWindow.document.querySelector(selector);
                  if (editor) {
                    if (editor.tagName === 'TEXTAREA') {
                      editor.value = markdownContent;
                    } else if (editor.contentEditable === 'true') {
                      editor.innerHTML = markdownContent;
                    }
                    // 触发输入事件
                    const event = new Event('input', { bubbles: true });
                    editor.dispatchEvent(event);
                  }
                });
              };

              // 立即尝试注入
              injectContent();
              // 延迟再次尝试，确保编辑器完全加载
              setTimeout(injectContent, 2000);
            } catch (error) {
              console.error('DOM注入失败:', error);
            }
          });
        }
      }, 800);
    }).catch(err => {
      console.error('同步失败:', err);
      alert('复制失败，无法同步到平台');
    });
  };

  // --- 增强版同步功能（直接注入）---
  const syncDirectly = (platform) => {
    const platformConfig = {
      'zhihu': {
        url: 'https://zhuanlan.zhihu.com/write',
        selectors: [
          '.public-DraftEditor-content',
          '.editor-textarea',
          '[contenteditable="true"]',
          'textarea'
        ]
      },
      'juejin': {
        url: 'https://juejin.cn/editor/drafts/new',
        selectors: [
          '.juejin-editor',
          '.editor-textarea',
          '[contenteditable="true"]',
          'textarea'
        ]
      },
      'csdn': {
        url: 'https://mp.csdn.net/mp_blog/creation/editor',
        selectors: [
          '.markdown_editor',
          '.editor-textarea',
          '[contenteditable="true"]',
          'textarea'
        ]
      },
      'toutiao': {
        url: 'https://mp.toutiao.com/profile_v4/graphic/publish',
        selectors: [
          '.rich_editor',
          '.editor-textarea',
          '[contenteditable="true"]',
          'textarea'
        ]
      }
    };

    const config = platformConfig[platform];
    if (!config) return;

    // 显示同步提示
    setShowSyncToast(true);
    setTimeout(() => setShowSyncToast(false), 3000);

    // 直接打开新窗口并注入
    const newWindow = window.open(config.url, '_blank');
    
    if (newWindow) {
      // 监听页面加载
      newWindow.addEventListener('load', () => {
        // 尝试注入内容
        const inject = () => {
          // 复制内容到剪贴板
          navigator.clipboard.writeText(markdownContent).then(() => {
            // 尝试粘贴到编辑器
            const paste = () => {
              config.selectors.forEach(selector => {
                const editor = newWindow.document.querySelector(selector);
                if (editor) {
                  editor.focus();
                  // 尝试粘贴
                  newWindow.document.execCommand('paste');
                }
              });
            };

            // 优化粘贴时机
            paste();
            setTimeout(paste, 500);
            setTimeout(paste, 1000);
            setTimeout(paste, 1500);
          }).catch(err => {
            console.error('同步失败:', err);
            alert('同步失败，请检查浏览器权限设置');
          });
        };

        // 优化注入时机
        setTimeout(inject, 1000);
        setTimeout(inject, 2000);
        setTimeout(inject, 3000);
      });
    }
  };

  // --- Cookie管理功能 --- (WechatSync风格)
  const checkPlatformLogin = (platform) => {
    const cookieNames = {
      'zhihu': 'z_c0',
      'juejin': 'sessionid',
      'csdn': 'UserName',
      'toutiao': 'tt_webid'
    };

    const cookieName = cookieNames[platform];
    if (!cookieName) return false;

    // 检查当前域下的Cookie（跨域无法直接访问）
    const cookies = document.cookie.split('; ');
    for (const cookie of cookies) {
      const [name, value] = cookie.split('=');
      if (name === cookieName && value) {
        return true;
      }
    }
    return false;
  };

  // 模拟WechatSync的Cookie共享机制
  const shareCookies = (platform) => {
    // 注意：浏览器安全限制无法直接跨域共享Cookie
    // 这里仅提供模拟实现和提示
    const domains = {
      'zhihu': '.zhihu.com',
      'juejin': '.juejin.cn',
      'csdn': '.csdn.net',
      'toutiao': '.toutiao.com'
    };

    const domain = domains[platform];
    if (!domain) return;

    console.log(`WechatSync风格Cookie共享提示：`);
    console.log(`1. 请确保已登录${getPlatformName(platform)}`);
    console.log(`2. 浏览器安全限制无法直接跨域共享Cookie`);
    console.log(`3. 实际实现需要使用浏览器扩展权限`);
    console.log(`4. 可通过Chrome Extension的cookies API实现跨域Cookie访问`);
  };

  const getPlatformName = (key) => {
    const map = {
      'zhihu': '知乎',
      'juejin': '掘金',
      'csdn': 'CSDN',
      'toutiao': '头条号'
    };
    return map[key] || '平台';
  };

  const handleFormat = (type) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selection = text.substring(start, end);
    let newText = text;
    let newStart = start; let newEnd = end;

    const toggleStyle = (symbol) => {
        const len = symbol.length;
        if (selection.startsWith(symbol) && selection.endsWith(symbol) && selection.length >= 2 * len) {
            newText = text.substring(0, start) + selection.slice(len, -len) + text.substring(end);
            newEnd -= 2 * len;
        } else if (text.substring(start - len, start) === symbol && text.substring(end, end + len) === symbol) {
            newText = text.substring(0, start - len) + selection + text.substring(end + len);
            newStart -= len; newEnd -= len;
        } else {
            const content = selection || (type === 'bold' ? '粗体' : '文字');
            newText = text.substring(0, start) + symbol + content + symbol + text.substring(end);
            newStart += len; newEnd += len + (selection ? 0 : content.length);
        }
    };

    switch (type) {
        case 'bold': toggleStyle('**'); break;
        case 'italic': toggleStyle('*'); break;
        case 'strike': toggleStyle('~~'); break;
        case 'inline-code': toggleStyle('`'); break;
        case 'link': 
             const linkText = selection || '链接';
             newText = text.substring(0, start) + `[${linkText}](https://)` + text.substring(end);
             newStart += 1; newEnd += 1 + linkText.length;
             break;
        case 'ul':
        case 'ol':
             const prefix = type === 'ul' ? '- ' : '1. ';
             if (selection.includes('\n')) {
                 const lines = selection.split('\n').map((l,i) => (type === 'ul' ? '- ' : `${i+1}. `) + l);
                 newText = text.substring(0, start) + lines.join('\n') + text.substring(end);
             } else {
                 newText = text.substring(0, start) + prefix + (selection || '列表项') + text.substring(end);
             }
             break;
    }
    setMarkdown(newText);
    setTimeout(() => { textarea.focus(); textarea.setSelectionRange(newStart, newEnd); }, 0);
  };

  const insertText = (t) => {
    const ta = textareaRef.current; if(!ta) return;
    const start = ta.selectionStart; const end = ta.selectionEnd;
    const val = ta.value;
    setMarkdown(val.substring(0, start) + t + val.substring(end));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + t.length, start + t.length); }, 0);
  };

  const handleKeyDown = (e) => {
    const isMod = e.ctrlKey || e.metaKey;

    if (isMod) {
        if (e.key === 'b') { e.preventDefault(); handleFormat('bold'); return; }
        if (e.key === 'i') { e.preventDefault(); handleFormat('italic'); return; }
        if (e.key === 'd') { e.preventDefault(); handleFormat('strike'); return; }
        if (e.key === 'e') { e.preventDefault(); handleFormat('inline-code'); return; }
        if (e.key === 'k') { e.preventDefault(); handleFormat('link'); return; }
        if (e.key === 's') { 
            e.preventDefault(); 
            setSaveStatus('saving');
            setTimeout(() => setSaveStatus('saved'), 500);
            setShowToast(true); 
            setTimeout(() => setShowToast(false), 1000);
            return; 
        }
        if (e.shiftKey) {
            if (e.key === 'u' || e.key === 'U') { e.preventDefault(); handleFormat('ul'); return; }
            if (e.key === 'o' || e.key === 'O') { e.preventDefault(); handleFormat('ol'); return; }
        }
    }

    if (e.key === 'Enter') {
      const ta = textareaRef.current; if(!ta) return;
      const start = ta.selectionStart; const val = ta.value;
      const lastLine = val.substring(val.lastIndexOf('\n', start - 1) + 1, start);
      const indent = (lastLine.match(/^(\s*)/) || [])[1] || '';
      const extra = (lastLine.trim().endsWith(':') || lastLine.trim().endsWith('{')) ? '  ' : '';
      e.preventDefault();
      const insert = '\n' + indent + extra;
      setMarkdown(val.substring(0, start) + insert + val.substring(ta.selectionEnd));
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + insert.length; }, 0);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current; if(!ta) return;
      setMarkdown(ta.value.substring(0, ta.selectionStart) + '  ' + ta.value.substring(ta.selectionEnd));
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = ta.selectionStart + 2; }, 0);
    }
  };

  const handleScroll = (e) => {
    if (!syncScroll) return;
    const ta = e.target; const pc = previewContainerRef.current;
    if (ta && pc) {
      pc.scrollTop = (ta.scrollTop / (ta.scrollHeight - ta.clientHeight)) * (pc.scrollHeight - pc.clientHeight);
    }
  };

  // Sync scroll for the editor input and highlighter
  const handleEditorScroll = (e) => {
     if(highlightRef.current) {
        highlightRef.current.scrollTop = e.target.scrollTop;
     }
  };

  const renderInputHighlight = (text) => {
    const lines = text.split('\n');
    let inCode = false;
  
    const parseInline = (lineContent) => {
      let html = lineContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      html = html.replace(/`([^`]+)`/g, '<span class="text-amber-600 bg-amber-50 rounded px-1 font-mono">`$1`</span>');
      html = html.replace(/\*\*(.*?)\*\*/g, '<span class="text-orange-600 font-bold">**$1**</span>');
      html = html.replace(/\*([^*]+)\*/g, '<span class="text-purple-600 italic">*$1*</span>');
      html = html.replace(/~~(.*?)~~/g, '<span class="text-gray-400 line-through">~~$1~~</span>');
      html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<span class="text-blue-500">[$1]($2)</span>');
      html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<span class="text-green-600">![$1]($2)</span>');
      return <span dangerouslySetInnerHTML={{__html: html}} />;
    };
  
    return lines.map((line, i) => {
       const trimmed = line.trim();
       if (trimmed.startsWith('```')) { inCode = !inCode; return <div key={i} className="text-amber-600 font-bold">{line}</div>; }
       if (inCode) { return <div key={i} className="text-amber-700 opacity-80">{line ? line : <br/>}</div>; }
       if (/^#{1,6}\s/.test(line)) { return <div key={i} className="text-blue-600 font-bold">{parseInline(line)}</div>; }
       if (line.startsWith('>')) { return <div key={i} className="text-gray-400">{parseInline(line)}</div>; }
       if (/^\s*[-*]\s/.test(line)) { const match = line.match(/^(\s*[-*])(\s.*)/); if (match) return <div key={i}><span className="text-red-500 font-bold">{match[1]}</span>{parseInline(match[2])}</div>; }
       if (/^\s*\d+\.\s/.test(line)) { const match = line.match(/^(\s*\d+\.)(\s.*)/); if (match) return <div key={i}><span className="text-red-500 font-bold">{match[1]}</span>{parseInline(match[2])}</div>; }
       if (/^\s*---\s*$/.test(line)) { return <div key={i} className="text-gray-300 font-bold">{line}</div>; }
       return <div key={i}>{line ? parseInline(line) : <br/>}</div>;
    });
  };

  const renderStyleSelector = (label, type) => (
    <div className="mb-4">
        <label className="text-xs font-bold text-gray-400 mb-2 block uppercase">{label}</label>
        <div className="grid grid-cols-2 gap-2">
            {STYLE_LIBRARY[type].map((s, i) => (
                <button 
                    key={i}
                    onClick={() => setStyleMapping(prev => ({...prev, [type]: i}))}
                    className={`text-xs p-2 border rounded hover:bg-gray-50 text-center truncate transition-colors ${styleMapping[type] === i ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-gray-200 text-gray-600'}`}
                    title={s.name}
                >
                    {s.name}
                </button>
            ))}
        </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-800 font-sans overflow-hidden">
      
      {/* 同步提示Toast */}
      {showSyncToast && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-indigo-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300 animate-fade-in">
          <div className="flex items-center gap-2">
            <Share size={16} />
            <span>内容已复制到剪贴板，正在打开平台编辑器...</span>
          </div>
        </div>
      )}

      {/* 顶部栏 */}
      <header className="flex-none bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-200">
            微
          </div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-bold tracking-tight text-gray-800">公众号美化器 <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded ml-2">Pro Max</span></h1>
            <span className="text-xs text-gray-400 font-mono">{VERSION}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={handleReset} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors" title="重置所有设置"><Trash2 size={14}/> 重置</button>
          <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded border border-green-100"><Save size={14} /> 自动保存中</div>
          <button onClick={() => setSyncScroll(!syncScroll)} className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${syncScroll ? 'text-indigo-600 bg-indigo-50 border border-indigo-100' : 'text-gray-500 hover:bg-gray-100 border border-transparent'}`}><ScrollText size={14}/> {syncScroll ? '同步滚动' : '同步关闭'}</button>
          
          <button onClick={() => setToolsPanelOpen(true)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all text-gray-500 hover:bg-gray-100 border border-transparent" title="工具集"><FileText size={14}/> 工具集</button>
          
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
             <button onClick={() => setPreviewMode('mobile')} className={`p-2 rounded-md transition-all ${previewMode === 'mobile' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`} title="手机预览"><Smartphone size={18} /></button>
             <button onClick={() => setPreviewMode('desktop')} className={`p-2 rounded-md transition-all ${previewMode === 'desktop' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`} title="全宽预览"><Monitor size={18} /></button>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={copyToClipboard} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-medium transition-all transform active:scale-95 shadow-lg shadow-indigo-600/20"><Copy size={18} /> 复制</button>
            
            {/* 同步到平台下拉菜单 */}
            <div className="relative" ref={syncDropdownRef}>
              <button 
                onClick={() => setShowSyncDropdown(!showSyncDropdown)} 
                className={`flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-medium transition-all transform active:scale-95 shadow-lg shadow-indigo-600/20 ${showSyncDropdown ? 'shadow-indigo-600/40' : ''}`}
              >
                <Share size={18} /> 同步到
                <ChevronDown size={16} className={`transition-transform ${showSyncDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {/* 下拉菜单 */}
              {showSyncDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                  <div className="py-2">
                    <button onClick={() => { syncDirectly('zhihu'); setShowSyncDropdown(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-500">知</span>
                        <span>知乎</span>
                      </div>
                    </button>
                    <button onClick={() => { syncDirectly('juejin'); setShowSyncDropdown(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-green-500">掘</span>
                        <span>掘金</span>
                      </div>
                    </button>
                    <button onClick={() => { syncDirectly('csdn'); setShowSyncDropdown(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-orange-500">C</span>
                        <span>CSDN</span>
                      </div>
                    </button>
                    <button onClick={() => { syncDirectly('toutiao'); setShowSyncDropdown(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-red-500">头</span>
                        <span>头条号</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 主体区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 */}
        <div className={`flex flex-row border-r bg-white transition-all duration-300 relative z-10 ${sidebarOpen ? 'w-[400px]' : 'w-16'}`}>
            <div className="w-16 bg-gray-50 border-r flex flex-col items-center py-4 gap-4 flex-none z-20 relative">
                <button onClick={() => { setActiveTab('themes'); setSidebarOpen(true); }} className={`p-3 rounded-xl transition-all ${activeTab === 'themes' && sidebarOpen ? 'bg-indigo-100 text-indigo-600 shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`} title="全案模版"><Layout size={22} /></button>
                <button onClick={() => { setActiveTab('settings'); setSidebarOpen(true); }} className={`p-3 rounded-xl transition-all ${activeTab === 'settings' && sidebarOpen ? 'bg-indigo-100 text-indigo-600 shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`} title="自定义样式"><Settings size={22} /></button>
                <button onClick={() => { setActiveTab('components'); setSidebarOpen(true); }} className={`p-3 rounded-xl transition-all ${activeTab === 'components' && sidebarOpen ? 'bg-indigo-100 text-indigo-600 shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`} title="插入组件"><Component size={22} /></button>
                <div className="flex-1"></div>
                <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors mb-2" title={sidebarOpen ? "收起面板" : "展开面板"}>{sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}</button>
            </div>

            <div className={`flex-1 bg-white flex flex-col h-full overflow-hidden transition-all duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                 <div className="w-[336px] h-full flex flex-col">
                    {/* 面板内容 */}
                    {activeTab === 'themes' && (
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b bg-gray-50/50"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Layout size={18} className="text-indigo-600"/> 一键全案模版</h3></div>
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar"><div className="grid grid-cols-1 gap-3">{THEME_PRESETS.map(preset => (<button key={preset.id} onClick={() => applyThemePreset(preset)} className={`relative group p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${config.themeColor === preset.color && styleMapping.h2 === preset.styles.h2 ? 'border-indigo-600 bg-indigo-50/30' : 'border-gray-100 bg-white hover:border-indigo-200'}`}><div className="flex items-center justify-between mb-2"><span className="font-bold text-gray-700">{preset.name}</span><div className="w-4 h-4 rounded-full" style={{background: preset.color}}></div></div><div className="space-y-2 opacity-60 pointer-events-none"><div className="h-2 w-1/3 rounded-sm" style={{background: preset.color}}></div><div className="h-1.5 w-3/4 bg-gray-200 rounded-sm"></div></div>{config.themeColor === preset.color && styleMapping.h2 === preset.styles.h2 && (<div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-0.5"><Check size={12} /></div>)}</button>))}</div></div>
                        </div>
                    )}
                    {activeTab === 'settings' && (
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b bg-gray-50/50"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Settings size={18} className="text-indigo-600"/> 自定义细节</h3></div>
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                <div className="mb-6"><label className="text-xs font-bold text-gray-400 mb-2 block uppercase">文章字体</label><div className="space-y-2">{FONT_FAMILIES.map((font) => (<button key={font.value} onClick={() => setConfig({ ...config, fontFamily: font.value })} className={`w-full text-left p-2 rounded border text-sm transition-all flex justify-between items-center ${config.fontFamily === font.value ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`} style={{ fontFamily: font.value }}><span>{font.name}</span>{config.fontFamily === font.value && <Check size={14} />}</button>))}</div></div>
                                <div className="mb-6"><label className="text-xs font-bold text-gray-400 mb-2 block uppercase">全局主题色</label><div className="flex flex-wrap gap-2">{['#dc2626', '#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#db2777', '#1f2937', '#0f172a', '#059669'].map(c => (<button key={c} onClick={() => setConfig({...config, themeColor: c})} className={`w-6 h-6 rounded-full border border-gray-200 transition-transform ${config.themeColor === c ? 'scale-110 ring-2 ring-offset-2 ring-indigo-500' : 'hover:scale-110'}`} style={{background: c}}/>))}<input type="color" value={config.themeColor} onChange={(e) => setConfig({...config, themeColor: e.target.value})} className="w-6 h-6 p-0 border-0 rounded-full overflow-hidden cursor-pointer" /></div></div>
                                {renderStyleSelector('一级标题 (H1)', 'h1')}
                                {renderStyleSelector('二级标题 (H2)', 'h2')}
                                {renderStyleSelector('三级标题 (H3)', 'h3')}
                                {renderStyleSelector('四级标题 (H4)', 'h4')}
                                {renderStyleSelector('五级标题 (H5)', 'h5')}
                                {renderStyleSelector('代码块风格', 'code')}
                                {renderStyleSelector('引用风格', 'quote')}
                                {renderStyleSelector('分割线风格', 'divider')}
                                <div className="pt-4 border-t pb-8"><label className="text-xs font-bold text-gray-400 mb-2 block uppercase">排版微调</label><div className="space-y-3"><div className="flex items-center justify-between"><span className="text-xs">字号</span><input type="range" min="12" max="20" value={config.fontSize} onChange={e => setConfig({...config, fontSize: Number(e.target.value)})} className="w-24 accent-indigo-600 h-1 bg-gray-200 rounded-lg appearance-none"/></div><div className="flex items-center justify-between"><span className="text-xs">行高</span><input type="range" min="1.4" max="2.2" step="0.1" value={config.lineHeight} onChange={e => setConfig({...config, lineHeight: Number(e.target.value)})} className="w-24 accent-indigo-600 h-1 bg-gray-200 rounded-lg appearance-none"/></div></div></div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'components' && (
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b bg-gray-50/50"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Component size={18} className="text-indigo-600"/> 插入组件</h3></div>
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
                                <div className="border rounded-lg overflow-hidden bg-white">
                                    <button onClick={() => setComponentCategoryOpen(p => ({...p, scroll: !p.scroll}))} className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"><span className="text-sm font-bold text-gray-700 flex items-center gap-2"><MoveHorizontal size={16} /> 滑动布局</span>{componentCategoryOpen.scroll ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
                                    {componentCategoryOpen.scroll && (<div className="p-2 space-y-2 bg-white"><div onClick={() => insertText(`\n<section style="overflow-x: auto; white-space: nowrap; padding-bottom: 10px; -webkit-overflow-scrolling: touch;">\n  <div style="display: inline-block; width: 200px; height: 120px; background: ${config.themeColor}15; margin-right: 10px; border-radius: 8px; border: 1px solid ${config.themeColor}33; vertical-align: top; padding: 10px; white-space: normal;">卡片 1</div>\n  <div style="display: inline-block; width: 200px; height: 120px; background: ${config.themeColor}15; margin-right: 10px; border-radius: 8px; border: 1px solid ${config.themeColor}33; vertical-align: top; padding: 10px; white-space: normal;">卡片 2</div>\n  <div style="display: inline-block; width: 200px; height: 120px; background: ${config.themeColor}15; margin-right: 10px; border-radius: 8px; border: 1px solid ${config.themeColor}33; vertical-align: top; padding: 10px; white-space: normal;">卡片 3</div>\n</section>\n`)} className="cursor-pointer hover:bg-indigo-50 p-2 rounded border border-transparent hover:border-indigo-100"><div className="text-xs font-medium text-gray-700 mb-1">↔ 左右滑动容器</div><div className="flex gap-1 overflow-hidden opacity-50"><div className="w-10 h-8 bg-gray-200 rounded"></div><div className="w-10 h-8 bg-gray-200 rounded"></div><div className="w-10 h-8 bg-gray-200 rounded"></div></div></div><div onClick={() => insertText(`\n<section style="height: 200px; overflow-y: auto; padding: 15px; border: 1px solid #eee; border-radius: 8px; background: #f9f9f9; -webkit-overflow-scrolling: touch;">\n  <p style="margin-top:0;"><strong>↕ 上下滑动区域</strong></p>\n  <p>这里可以放置非常长的内容...</p>\n</section>\n`)} className="cursor-pointer hover:bg-indigo-50 p-2 rounded border border-transparent hover:border-indigo-100"><div className="text-xs font-medium text-gray-700 mb-1">↕ 上下滑动文本框</div><div className="w-full h-8 bg-gray-200 rounded opacity-50 border-r-4 border-gray-300"></div></div></div>)}
                                </div>
                                <div className="border rounded-lg overflow-hidden bg-white">
                                    <button onClick={() => setComponentCategoryOpen(p => ({...p, card: !p.card}))} className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"><span className="text-sm font-bold text-gray-700 flex items-center gap-2"><Maximize size={16} /> 通用容器</span>{componentCategoryOpen.card ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
                                    {componentCategoryOpen.card && (<div className="p-2 space-y-2 bg-white"><button onClick={() => insertText(`\n<section style="background:${config.themeColor}10; padding:20px; border-radius:8px; border:1px solid ${config.themeColor}33;">\n<h4 style="margin:0 0 10px 0; color:${config.themeColor};">重点卡片</h4>\n<p style="font-size:14px; margin:0;">输入内容...</p>\n</section>\n`)} className="w-full text-left p-2 text-xs hover:bg-indigo-50 rounded">+ 重点边框卡片</button><button onClick={() => insertText(`\n<section style="text-align:center; padding:20px 10px; background:#f8f8f8; border-radius:8px; margin: 20px 0;">\n<span style="color:${config.themeColor}; font-weight:bold; font-size: 15px;">灰色强调区域</span>\n<div style="font-size:12px; color:#999; margin-top:5px;">适合放置解释性文字</div>\n</section>\n`)} className="w-full text-left p-2 text-xs hover:bg-indigo-50 rounded">+ 灰色背景强调</button></div>)}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* 中间编辑区域 */}
        <div className="flex-1 flex flex-col min-w-0 bg-white relative">
            {/* 快捷工具栏 (新增) */}
            <div className="flex-none border-b px-4 py-2 flex items-center gap-1 bg-white overflow-x-auto scrollbar-hide">
                <button onClick={() => handleFormat('bold')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="加粗 (Ctrl/Cmd + B)"><Bold size={16}/></button>
                <button onClick={() => handleFormat('italic')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="斜体 (Ctrl/Cmd + I)"><Italic size={16}/></button>
                <button onClick={() => handleFormat('strike')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="删除线 (Ctrl/Cmd + D)"><Strikethrough size={16}/></button>
                <div className="w-px h-4 bg-gray-200 mx-1"></div>
                <button onClick={() => handleFormat('link')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="超链接 (Ctrl/Cmd + K)"><Link2 size={16}/></button>
                <button onClick={() => handleFormat('inline-code')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="行内代码 (Ctrl/Cmd + E)"><Terminal size={16}/></button>
                <div className="w-px h-4 bg-gray-200 mx-1"></div>
                <button onClick={() => handleFormat('ul')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="无序列表 (Ctrl/Cmd + Shift + U)"><List size={16}/></button>
                <button onClick={() => handleFormat('ol')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="有序列表 (Ctrl/Cmd + Shift + O)"><ListOrdered size={16}/></button>
            </div>
            
            {/* Editor Container with Overlay */}
            <div className="relative flex-1 w-full h-full overflow-hidden">
                {/* 1. Highlight Layer (Bottom) - Replicates text structure with styling */}
                <div 
                  ref={highlightRef}
                  className="absolute inset-0 p-8 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words pointer-events-none overflow-y-auto"
                  style={{ fontFamily: config.fontFamily }} 
                  aria-hidden="true"
                >
                   {renderInputHighlight(markdown)}
                </div>

                {/* 2. Textarea Layer (Top) - Transparent text, visible caret */}
                <textarea 
                  ref={textareaRef} 
                  value={markdown} 
                  onChange={(e) => setMarkdown(e.target.value)} 
                  onKeyDown={handleKeyDown} 
                  onScroll={(e) => { handleEditorScroll(e); handleScroll(e); }} 
                  className="absolute inset-0 w-full h-full p-8 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words bg-transparent text-transparent caret-gray-800 outline-none resize-none overflow-y-auto z-10" 
                  style={{ fontFamily: config.fontFamily }}
                  placeholder="请输入 Markdown 内容..." 
                  spellCheck="false" 
                />
            </div>
            
            <div className="flex-none border-t bg-gray-50 p-2 text-xs text-gray-400 flex justify-between px-4"><span className="flex items-center gap-2"><FileText size={14} /> Markdown</span><span className="flex items-center gap-4"><span className="flex items-center gap-1.5 text-gray-500 bg-gray-100 px-2 py-0.5 rounded"><Type size={12} /> {markdown.length} 字</span><span className="flex items-center gap-2">{config.fontSize}px / {config.lineHeight}</span></span></div>
        </div>

        {/* 右侧预览 */}
        <div className={`flex-1 bg-gray-100 flex flex-col items-center justify-center relative overflow-hidden p-4 transition-all duration-300 ${!sidebarOpen ? 'flex-[1.2]' : ''}`}>
          <div className={`transition-all duration-500 ease-in-out bg-white shadow-2xl flex flex-col overflow-hidden relative ${previewMode === 'mobile' ? 'w-[375px] h-[750px] rounded-[40px] border-[12px] border-gray-900 shadow-2xl' : 'w-full h-full rounded-xl border border-gray-200 shadow-sm'}`}>
            {previewMode === 'mobile' && (<div className="flex-none h-7 bg-gray-900 w-full flex items-center justify-center relative rounded-t-[28px] z-20"><div className="w-20 h-4 bg-black rounded-b-xl absolute top-0"></div></div>)}
            {previewMode === 'mobile' && (<div className="flex-none h-12 border-b bg-gray-50/90 backdrop-blur flex items-center px-4 justify-between text-black z-10 select-none"><span className="font-medium text-sm">文章预览</span><div className="flex gap-1.5"><div className="w-1 h-1 rounded-full bg-black/60"></div><div className="w-1 h-1 rounded-full bg-black/60"></div><div className="w-1 h-1 rounded-full bg-black/60"></div></div></div>)}
            <div ref={previewContainerRef} className="flex-1 overflow-y-auto bg-white custom-scrollbar relative w-full scroll-smooth"><div className="min-h-full p-5 pb-20 w-full" style={{maxWidth: '100%'}}><div ref={previewRef} className="wechat-content" style={{ fontFamily: config.fontFamily, wordBreak: 'break-word', textAlign: 'justify' }} dangerouslySetInnerHTML={{ __html: renderedHtml }} /><div className="mt-12 pt-8 border-t border-dashed border-gray-200 text-center select-none"><p style={{ color: '#ccc', fontSize: '12px', letterSpacing: '1px' }}>— END —</p></div></div></div>
          </div>
        </div>
      </div>

      {showToast && (<div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/85 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in zoom-in duration-200 z-50 backdrop-blur-md"><div className="bg-green-500 rounded-full p-1 shadow-lg shadow-green-500/30"><Check size={16} className="text-white" /></div><div><h4 className="font-bold text-sm">已复制富文本</h4><p className="text-xs text-gray-300 mt-0.5">请前往公众号后台按 Ctrl+V 粘贴</p></div></div>)}
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(0, 0, 0, 0.1); border-radius: 20px; } textarea:focus { outline: none; }`}</style>
      <ToolsPanel isOpen={toolsPanelOpen} onClose={() => setToolsPanelOpen(false)} onArticleExtracted={handleArticleExtracted} />
    </div>
  );
}