import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] bg-slate-900 text-white flex flex-col items-center justify-center p-8">
          <h1 className="text-4xl font-bold text-red-500 mb-4">游戏发生错误</h1>
          <p className="text-gray-300 mb-8 max-w-2xl text-center">
            抱歉，游戏遇到了一个意外错误。这可能是由于资源加载失败或内存不足导致的。
          </p>
          <div className="bg-black/50 p-4 rounded-lg border border-red-900/50 mb-8 w-full max-w-2xl overflow-auto max-h-64">
             <code className="text-red-300 text-sm font-mono whitespace-pre-wrap">
               {this.state.error?.toString()}
             </code>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => window.location.reload()}
              className="bg-cyan-600 px-6 py-3 rounded-lg font-bold hover:bg-cyan-500 transition"
            >
              重新加载游戏
            </button>
            <button
              onClick={() => {
                  localStorage.clear();
                  window.location.reload();
              }}
              className="bg-red-800 px-6 py-3 rounded-lg font-bold hover:bg-red-700 transition"
            >
              清除数据并重置
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
