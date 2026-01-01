import React, { useState } from 'react';
import { ExternalLink, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

const ToolsPanel = ({ onArticleExtracted, isOpen, onClose }) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const extractArticle = async () => {
    if (!url.trim()) {
      setError('请输入公众号文章链接');
      return;
    }

    // 验证微信文章链接格式
    const wechatRegex = /^https?:\/\/mp\.weixin\.qq\.com\/s\//;
    if (!wechatRegex.test(url)) {
      setError('请输入有效的公众号文章链接');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // 实际API调用
      const response = await fetch('http://localhost:8000/api/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || '转换请求失败');
      }

      const data = await response.json();

      // 打印返回数据以便调试
      console.log('API返回数据:', data);

      // 检查是否有markdown字段
      if (data.markdown) {
        setSuccess('文章提取成功！');
        onArticleExtracted(data.markdown);
      } else if (data.content) {
        // 如果没有markdown字段，使用content字段
        setSuccess('文章提取成功！');
        onArticleExtracted(data.content);
      } else {
        throw new Error(data.message || '提取失败');
      }
    } catch (err) {
      setError('文章提取失败，请检查链接是否正确或稍后重试');
      console.error('提取失败:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">工具集</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ExternalLink size={18} className="text-indigo-600" />
              <h3 className="font-semibold text-gray-700">公众号文章提取</h3>
            </div>
            <p className="text-sm text-gray-500">输入公众号文章链接，提取为Markdown格式</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">文章链接</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://mp.weixin.qq.com/s/..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
              <CheckCircle size={16} />
              <span className="text-sm">{success}</span>
            </div>
          )}

          <button
            onClick={extractArticle}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <> <Loader2 size={18} className="animate-spin" /> 提取中... </>
            ) : (
              '提取文章'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ToolsPanel;