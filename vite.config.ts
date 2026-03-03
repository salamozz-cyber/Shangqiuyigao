import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    // 基础插件配置：支持 React 和 Fast Refresh
    plugins: [react(), tailwindcss()],

    server: {
      // 监听所有地址，方便在手机端测试
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
    },

    // 关键配置：解决代码中对 process.env 的引用冲突
    // 这对于 Google Generative AI 等 Node.js 风格的库在浏览器端运行至关重要
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY),
    },

    build: {
      // 编译输出目录
      outDir: 'dist',
      // 开启源码映射，方便调试
      sourcemap: true,
      // 由于 IndexedDB 逻辑和资源存储代码较多，适当放宽包体积警告限制
      chunkSizeWarningLimit: 1000,
      
      rollupOptions: {
        output: {
          // 静态资源分类打包逻辑
          manualChunks: {
            vendor: ['react', 'react-dom'],
            gemini: ['@google/genai'],
          },
        },
      },
    },

    // 解析配置：确保路径导入正确
    resolve: {
      alias: {
        // 如果后续有文件夹层级加深，可以在此添加路径别名
        '@': '/src',
      },
    },
  };
});
